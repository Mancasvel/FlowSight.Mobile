/**
 * Timer Service — Reliable manual timer with persistence and recovery.
 *
 * Uses persisted timestamps, not setInterval as source of truth.
 * Survives app backgrounding, suspension, and relaunch.
 */

import { Platform } from 'react-native';
import { getCurrentUser } from './auth';
import { requireRecordingAccess, RecordingPermissionError } from './recordingPermissions';
import { saveActiveSession, getActiveSession, clearActiveSession, insertActivityEvent } from '@/storage';
import { getDeviceId } from '@/storage';
import { createId } from '@/utils/id';
import { startDeviceActivityCapture, stopDeviceActivityCapture, persistUsageSnapshot } from '@/services/deviceActivity';
import {
  cancelFocusGoalNotification,
  markFocusDayCompleted,
  scheduleFocusGoalNotification,
} from './notifications';

export type TimerState = 'idle' | 'running' | 'paused';

export interface TimerSession {
  id: string;
  userId: string | null;
  startedAt: number;       // Unix timestamp ms
  category: string | null;
  taskLabel: string | null;
  ticketRef: string | null;
  pausedAt: number | null;
  accumulatedSeconds: number;
  pauseCount: number;
  deviceActivityStarted: boolean;
  captureWarning: string | null;
}

let currentSession: TimerSession | null = null;
let state: TimerState = 'idle';
let starting = false;
let resuming = false;
let accountGeneration = 0;
let listeners: Array<(state: TimerState, session: TimerSession | null) => void> = [];

export function getTimerState(): TimerState {
  return state;
}

export function getCurrentSession(): TimerSession | null {
  return currentSession;
}

export function getElapsedSeconds(): number {
  if (!currentSession) return 0;
  if (state === 'paused') return currentSession.accumulatedSeconds;
  if (state === 'running') {
    const now = Date.now();
    const runningSeconds = Math.floor((now - currentSession.startedAt) / 1000);
    return currentSession.accumulatedSeconds + runningSeconds;
  }
  return 0;
}

export function subscribe(listener: (state: TimerState, session: TimerSession | null) => void) {
  listeners.push(listener);
  return () => {
    listeners = listeners.filter((l) => l !== listener);
  };
}

function notify() {
  for (const listener of listeners) {
    listener(state, currentSession);
  }
}

export async function startTimer(options?: {
  category?: string;
  taskLabel?: string;
  ticketRef?: string;
}) {
  if (state !== 'idle' || starting) return;
  starting = true;
  const generation = accountGeneration;
  let captureStarted = false;
  try {
    const owner = await getCurrentUser();
    await requireRecordingAccess();
    const capture = await startDeviceActivityCapture();
    if (!capture.started) {
      throw new RecordingPermissionError(capture.warning ?? 'Recording could not start. Review permissions in Settings.');
    }
    captureStarted = true;
    if (generation !== accountGeneration || ((await getCurrentUser())?.id ?? null) !== (owner?.id ?? null)) {
      throw new Error('Your account changed. Start a new recording.');
    }
    const id = createId();
    const now = Date.now();
    await saveActiveSession({
      id,
      user_id: owner?.id ?? null,
      started_at: new Date(now).toISOString(),
      category: options?.category,
      task_label: options?.taskLabel,
      ticket_ref: options?.ticketRef,
      accumulated_seconds: 0,
      pause_count: 0,
    });
    if (generation !== accountGeneration) {
      await clearActiveSession(owner?.id ?? null);
      throw new Error('Your account changed. Start a new recording.');
    }
    currentSession = {
      id,
      userId: owner?.id ?? null,
      startedAt: now,
      category: options?.category ?? null,
      taskLabel: options?.taskLabel ?? null,
      ticketRef: options?.ticketRef ?? null,
      pausedAt: null,
      accumulatedSeconds: 0,
      pauseCount: 0,
      deviceActivityStarted: true,
      captureWarning: null,
    };
    state = 'running';
    notify();
    void scheduleFocusGoalNotification(0);
  } catch (error) {
    if (captureStarted) await stopDeviceActivityCapture().catch(() => undefined);
    throw error;
  } finally {
    starting = false;
  }
}

export async function pauseTimer() {
  if (state !== 'running' || !currentSession) return;

  const now = Date.now();
  const runningSeconds = Math.floor((now - currentSession.startedAt) / 1000);
  currentSession.accumulatedSeconds += runningSeconds;
  currentSession.pausedAt = now;
  currentSession.pauseCount += 1;
  state = 'paused';

  await saveActiveSession({
    id: currentSession.id,
    user_id: currentSession.userId,
    started_at: new Date(currentSession.startedAt).toISOString(),
    category: currentSession.category ?? undefined,
    task_label: currentSession.taskLabel ?? undefined,
    ticket_ref: currentSession.ticketRef ?? undefined,
    paused_at: new Date(now).toISOString(),
    accumulated_seconds: currentSession.accumulatedSeconds,
    pause_count: currentSession.pauseCount,
  });

  notify();
  void cancelFocusGoalNotification();
}

export async function resumeTimer(): Promise<void> {
  if (state !== 'paused' || !currentSession || resuming) return;
  resuming = true;
  const previous = currentSession;
  const generation = accountGeneration;
  let captureStarted = false;
  try {
    if (((await getCurrentUser())?.id ?? null) !== previous.userId) {
      throw new Error('Sign in to the account that started this recording.');
    }
    await requireRecordingAccess();
    if (!previous.deviceActivityStarted) {
      const capture = await startDeviceActivityCapture();
      if (!capture.started) throw new RecordingPermissionError(capture.warning ?? 'Recording could not resume. Review permissions in Settings.');
      captureStarted = true;
    }
    if (generation !== accountGeneration || currentSession !== previous) {
      throw new Error('Your account changed. Start a new recording.');
    }
    const now = Date.now();
    await saveActiveSession({
      id: previous.id,
      user_id: previous.userId,
      started_at: new Date(now).toISOString(),
      category: previous.category ?? undefined,
      task_label: previous.taskLabel ?? undefined,
      ticket_ref: previous.ticketRef ?? undefined,
      accumulated_seconds: previous.accumulatedSeconds,
      pause_count: previous.pauseCount,
    });
    if (generation !== accountGeneration || currentSession !== previous) {
      throw new Error('Your account changed. Start a new recording.');
    }
    previous.startedAt = now;
    previous.pausedAt = null;
    previous.deviceActivityStarted = true;
    previous.captureWarning = null;
    state = 'running';
    notify();
    void scheduleFocusGoalNotification(getElapsedSeconds());
  } catch (error) {
    if (captureStarted) await stopDeviceActivityCapture().catch(() => null);
    throw error;
  } finally { resuming = false; }
}

export async function stopTimer(): Promise<{
  durationSeconds: number;
  pauseCount: number;
  captureStarted: boolean;
  category: string;
  taskLabel: string | null;
  ticketRef: string | null;
} | null> {
  if (!currentSession) return null;

  const elapsed = getElapsedSeconds();
  const deviceId = await getDeviceId();
  const now = new Date();
  const startedAt = new Date(currentSession.startedAt - (currentSession.accumulatedSeconds * 1000));
  const session = currentSession;
  const captureWindow = await stopDeviceActivityCapture();
  const usedDeviceActivity = Boolean(session.deviceActivityStarted && captureWindow);

  const event = {
    user_id: session.userId ?? undefined,
    id: session.id,
    client_event_id: session.id,
    device_id: deviceId,
    source: (usedDeviceActivity ? 'ios_device_activity' : 'manual_timer') as
      | 'ios_device_activity'
      | 'manual_timer',
    source_platform: Platform.OS as 'ios' | 'android',
    capture_source: usedDeviceActivity ? 'device_activity' : 'manual',
    start_at: startedAt.toISOString(),
    end_at: now.toISOString(),
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    duration_seconds: elapsed,
    category: session.category ?? 'Focus',
    task_label: session.taskLabel,
    ticket_ref: session.ticketRef,
    confidence: 1.0,
    pause_count: session.pauseCount,
  };

  await insertActivityEvent(event);
  await clearActiveSession(session.userId);

  const result = {
    durationSeconds: elapsed,
    pauseCount: session.pauseCount,
    captureStarted: usedDeviceActivity,
    category: event.category,
    taskLabel: event.task_label,
    ticketRef: event.ticket_ref,
  };

  currentSession = null;
  state = 'idle';
  notify();
  void markFocusDayCompleted();
  void persistUsageSnapshot();

  void import('@/services/sessionInsights').then(async ({ loadSessionsForPeriod, loadRecentHourlyAppUsage }) => {
    const { maybePrepareInsightNudge } = await import('@/services/localInsightNotify');
    const [sessions, appUsage] = await Promise.all([loadSessionsForPeriod(7), loadRecentHourlyAppUsage(7)]);
    await maybePrepareInsightNudge({
      durationSeconds: result.durationSeconds,
      pauseCount: result.pauseCount,
      sessions,
      appUsage,
    });
  });

  return result;
}

/**
 * Recover timer state after app relaunch.
 * Call this on app startup.
 */
export async function recoverTimer(): Promise<void> {
  if (currentSession || starting) return;
  const saved = await getActiveSession();
  if (!saved) return;
  const owner = await getCurrentUser();
  if ((saved.user_id ?? null) !== (owner?.id ?? null)) return;

  const now = Date.now();
  const startedAt = new Date(saved.started_at).getTime();

  if (saved.paused_at) {
    // Was paused — restore in paused state
    currentSession = {
      id: saved.id,
      userId: saved.user_id ?? null,
      startedAt,
      category: saved.category,
      taskLabel: saved.task_label,
      ticketRef: saved.ticket_ref,
      pausedAt: new Date(saved.paused_at).getTime(),
      accumulatedSeconds: saved.accumulated_seconds,
      pauseCount: saved.pause_count ?? 0,
      deviceActivityStarted: false,
      captureWarning: null,
    };
    state = 'paused';
  } else {
    // Was running — calculate elapsed and continue
    const elapsedSinceStart = Math.floor((now - startedAt) / 1000);
    currentSession = {
      id: saved.id,
      userId: saved.user_id ?? null,
      startedAt: now, // Reset start to now to avoid counting background time
      category: saved.category,
      taskLabel: saved.task_label,
      ticketRef: saved.ticket_ref,
      pausedAt: null,
      accumulatedSeconds: saved.accumulated_seconds + elapsedSinceStart,
      pauseCount: saved.pause_count ?? 0,
      deviceActivityStarted: false,
      captureWarning: null,
    };
    try {
      await requireRecordingAccess();
      const capture = await startDeviceActivityCapture();
      if (!capture.started) throw new RecordingPermissionError(capture.warning ?? 'Review recording permissions in Settings.');
      currentSession.deviceActivityStarted = true;
      state = 'running';
    } catch (error) {
      state = 'paused';
      currentSession.pausedAt = now;
      currentSession.captureWarning = error instanceof Error ? error.message : 'Review recording permissions in Settings.';
    }
    await saveActiveSession({
      id: currentSession.id,
      user_id: currentSession.userId,
      started_at: new Date(now).toISOString(),
      category: currentSession.category ?? undefined,
      task_label: currentSession.taskLabel ?? undefined,
      ticket_ref: currentSession.ticketRef ?? undefined,
      paused_at: state === 'paused' ? new Date(now).toISOString() : undefined,
      accumulated_seconds: currentSession.accumulatedSeconds,
      pause_count: currentSession.pauseCount,
    });
  }

  notify();
  if (state === 'running') {
    void scheduleFocusGoalNotification(getElapsedSeconds());
  } else {
    void cancelFocusGoalNotification();
  }
}

/** Hide and suspend the previous account's session without changing its owner. */
export async function suspendTimerForAccountSwitch(): Promise<void> {
  accountGeneration++;
  const previous = currentSession;
  const wasRunning = state === 'running';
  currentSession = null;
  state = 'idle';
  notify();
  await stopDeviceActivityCapture().catch(() => null);
  await cancelFocusGoalNotification();
  if (previous) {
    const now = Date.now();
    await saveActiveSession({
      id: previous.id,
      user_id: previous.userId,
      started_at: new Date(previous.startedAt).toISOString(),
      category: previous.category ?? undefined,
      task_label: previous.taskLabel ?? undefined,
      ticket_ref: previous.ticketRef ?? undefined,
      paused_at: new Date(previous.pausedAt ?? now).toISOString(),
      accumulated_seconds: previous.accumulatedSeconds + (wasRunning ? Math.max(0, Math.floor((now - previous.startedAt) / 1000)) : 0),
      pause_count: previous.pauseCount,
    });
  }
}

export async function discardTimerRuntime(): Promise<void> {
  accountGeneration++;
  currentSession = null;
  state = 'idle';
  notify();
  await stopDeviceActivityCapture().catch(() => null);
  await cancelFocusGoalNotification();
}

/** Returning from system Settings must not continue recording after revocation. */
export async function validateRecordingPermission(): Promise<void> {
  if (state !== 'running' || !currentSession) return;
  try {
    await requireRecordingAccess();
  } catch (error) {
    if (state !== 'running' || !currentSession) return;
    currentSession.captureWarning = error instanceof Error ? error.message : 'Review recording permission in Settings.';
    await pauseTimer();
    await stopDeviceActivityCapture().catch(() => null);
    if (currentSession) currentSession.deviceActivityStarted = false;
    notify();
  }
}
