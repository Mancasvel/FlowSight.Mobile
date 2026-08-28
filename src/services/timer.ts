/**
 * Timer Service — Reliable manual timer with persistence and recovery.
 *
 * Uses persisted timestamps, not setInterval as source of truth.
 * Survives app backgrounding, suspension, and relaunch.
 */

import { Platform } from 'react-native';
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
  const id = createId();
  const now = Date.now();

  currentSession = {
    id,
    startedAt: now,
    category: options?.category ?? null,
    taskLabel: options?.taskLabel ?? null,
    ticketRef: options?.ticketRef ?? null,
    pausedAt: null,
    accumulatedSeconds: 0,
    pauseCount: 0,
    deviceActivityStarted: false,
    captureWarning: null,
  };

  state = 'running';
  notify();

  try {
    await saveActiveSession({
      id,
      started_at: new Date(now).toISOString(),
      category: options?.category,
      task_label: options?.taskLabel,
      ticket_ref: options?.ticketRef,
      accumulated_seconds: 0,
      pause_count: 0,
    });
  } catch (error) {
    currentSession = null;
    state = 'idle';
    notify();
    throw error;
  }

  try {
    const capture = await startDeviceActivityCapture();
    if (currentSession?.id === id) {
      currentSession.deviceActivityStarted = capture.started;
      currentSession.captureWarning = capture.warning;
      notify();
    }
  } catch {
    if (currentSession?.id === id) {
      currentSession.captureWarning = 'Could not start Screen Time capture. The timer still runs.';
      notify();
    }
  }

  void scheduleFocusGoalNotification(0);
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
  if (state !== 'paused' || !currentSession) return;

  currentSession.startedAt = Date.now();
  currentSession.pausedAt = null;
  state = 'running';

  await saveActiveSession({
    id: currentSession.id,
    started_at: new Date(currentSession.startedAt).toISOString(),
    category: currentSession.category ?? undefined,
    task_label: currentSession.taskLabel ?? undefined,
    ticket_ref: currentSession.ticketRef ?? undefined,
    accumulated_seconds: currentSession.accumulatedSeconds,
    pause_count: currentSession.pauseCount,
  });

  notify();
  void scheduleFocusGoalNotification(getElapsedSeconds());
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
  await clearActiveSession();

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

  return result;
}

/**
 * Recover timer state after app relaunch.
 * Call this on app startup.
 */
export async function recoverTimer(): Promise<void> {
  const saved = await getActiveSession();
  if (!saved) return;

  const now = Date.now();
  const startedAt = new Date(saved.started_at).getTime();

  if (saved.paused_at) {
    // Was paused — restore in paused state
    currentSession = {
      id: saved.id,
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
    state = 'running';
    void startDeviceActivityCapture()
      .then((capture) => {
        if (!currentSession || currentSession.id !== saved.id) return;
        currentSession.deviceActivityStarted = capture.started;
        currentSession.captureWarning = capture.warning;
        notify();
      })
      .catch(() => undefined);
  }

  notify();
  if (state === 'running') {
    void scheduleFocusGoalNotification(getElapsedSeconds());
  } else {
    void cancelFocusGoalNotification();
  }
}
