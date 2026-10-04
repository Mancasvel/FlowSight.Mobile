import { afterEach, describe, expect, test, vi } from 'vitest';

const storage = vi.hoisted(() => ({
  saveActiveSession: vi.fn().mockResolvedValue(undefined),
  getActiveSession: vi.fn().mockResolvedValue(null),
  clearActiveSession: vi.fn().mockResolvedValue(undefined),
  insertActivityEvent: vi.fn().mockResolvedValue(undefined),
  getDeviceId: vi.fn().mockResolvedValue('device-id'),
}));

vi.mock('@/storage', () => storage);
vi.mock('@/utils/id', () => ({ createId: () => 'session-id' }));
vi.mock('react-native', () => ({ Platform: { OS: 'android' } }));

const deviceActivity = vi.hoisted(() => ({
  startDeviceActivityCapture: vi.fn().mockResolvedValue({ started: true, warning: null }),
  stopDeviceActivityCapture: vi.fn().mockResolvedValue(null),
}));

vi.mock('@/services/deviceActivity', () => deviceActivity);
const access = vi.hoisted(() => ({ requireRecordingAccess: vi.fn().mockResolvedValue(undefined) }));
vi.mock('@/services/recordingPermissions', () => ({ ...access, RecordingPermissionError: class extends Error {} }));
const auth = vi.hoisted(() => ({ userId: null as string | null }));
vi.mock('@/services/auth', () => ({ getCurrentUser: async () => auth.userId ? { id: auth.userId } : null }));
vi.mock('@/services/notifications', () => ({
  scheduleFocusGoalNotification: vi.fn().mockResolvedValue(undefined),
  cancelFocusGoalNotification: vi.fn().mockResolvedValue(undefined),
  markFocusDayCompleted: vi.fn().mockResolvedValue(undefined),
}));

import {
  getElapsedSeconds,
  getTimerState,
  pauseTimer,
  resumeTimer,
  startTimer,
  stopTimer,
  recoverTimer,
  getCurrentSession,
  suspendTimerForAccountSwitch,
  validateRecordingPermission,
} from '@/services/timer';

describe('timer service', () => {
  test('permission denial leaves the timer idle and writes no session', async () => {
    access.requireRecordingAccess.mockRejectedValueOnce(new Error('Allow activity permission'));
    await expect(startTimer()).rejects.toThrow('Allow activity permission');
    expect(getTimerState()).toBe('idle');
    expect(getCurrentSession()).toBeNull();
    expect(storage.saveActiveSession).not.toHaveBeenCalled();
    expect(deviceActivity.startDeviceActivityCapture).not.toHaveBeenCalled();
  });

  test('capture failure leaves the timer idle', async () => {
    deviceActivity.startDeviceActivityCapture.mockResolvedValueOnce({ started: false, warning: 'Permission revoked' });
    await expect(startTimer()).rejects.toThrow('Permission revoked');
    expect(getTimerState()).toBe('idle');
    expect(storage.saveActiveSession).not.toHaveBeenCalled();
  });

  test('a double tap starts one recording', async () => {
    await Promise.all([startTimer(), startTimer()]);
    expect(deviceActivity.startDeviceActivityCapture).toHaveBeenCalledTimes(1);
    expect(storage.saveActiveSession).toHaveBeenCalledTimes(1);
  });

  test('storage failure rolls back native capture', async () => {
    storage.saveActiveSession.mockRejectedValueOnce(new Error('Storage failed'));
    await expect(startTimer()).rejects.toThrow('Storage failed');
    expect(getTimerState()).toBe('idle');
    expect(deviceActivity.stopDeviceActivityCapture).toHaveBeenCalledTimes(1);
  });

  test('revoked permission prevents resume', async () => {
    await startTimer();
    await pauseTimer();
    access.requireRecordingAccess.mockRejectedValueOnce(new Error('Permission revoked'));
    await expect(resumeTimer()).rejects.toThrow('Permission revoked');
    expect(getTimerState()).toBe('paused');
  });

  test('recovery with revoked permission restores a paused session', async () => {
    storage.getActiveSession.mockResolvedValueOnce({
      id: 'session-id', started_at: new Date(Date.now() - 5000).toISOString(),
      paused_at: null, accumulated_seconds: 10, pause_count: 0,
      category: 'Coding', task_label: null, ticket_ref: null,
    });
    access.requireRecordingAccess.mockRejectedValueOnce(new Error('Permission revoked'));
    await recoverTimer();
    expect(getTimerState()).toBe('paused');
    expect(getElapsedSeconds()).toBeGreaterThanOrEqual(15);
    expect(storage.saveActiveSession).toHaveBeenCalledWith(expect.objectContaining({ paused_at: expect.any(String) }));
    expect(deviceActivity.startDeviceActivityCapture).not.toHaveBeenCalled();
  });

  test('a session keeps its original owner when the account changes', async () => {
    auth.userId = 'account-a';
    await startTimer();
    auth.userId = 'account-b';
    await stopTimer();
    expect(storage.insertActivityEvent).toHaveBeenCalledWith(expect.objectContaining({ user_id: 'account-a' }));
    expect(storage.clearActiveSession).toHaveBeenCalledWith('account-a');
  });

  test('account switching hides and pauses the previous owner’s recording', async () => {
    auth.userId = 'account-a';
    await startTimer();
    await suspendTimerForAccountSwitch();
    expect(getTimerState()).toBe('idle');
    expect(getCurrentSession()).toBeNull();
    expect(storage.saveActiveSession).toHaveBeenLastCalledWith(expect.objectContaining({ user_id: 'account-a', paused_at: expect.any(String) }));
  });

  test('recovery never exposes another account’s session', async () => {
    auth.userId = 'account-b';
    storage.getActiveSession.mockResolvedValueOnce({ user_id: 'account-a' });
    await recoverTimer();
    expect(getTimerState()).toBe('idle');
    expect(deviceActivity.startDeviceActivityCapture).not.toHaveBeenCalled();
  });

  test('returning from Settings with permission revoked pauses active recording', async () => {
    await startTimer();
    access.requireRecordingAccess.mockRejectedValueOnce(new Error('Permission revoked'));
    await validateRecordingPermission();
    expect(getTimerState()).toBe('paused');
    expect(getCurrentSession()?.deviceActivityStarted).toBe(false);
    expect(getCurrentSession()?.captureWarning).toBe('Permission revoked');
  });

  test('failed resume persistence keeps the session paused', async () => {
    await startTimer();
    await pauseTimer();
    storage.saveActiveSession.mockRejectedValueOnce(new Error('Storage failed'));
    await expect(resumeTimer()).rejects.toThrow('Storage failed');
    expect(getTimerState()).toBe('paused');
    expect(getCurrentSession()?.pausedAt).not.toBeNull();
  });

  afterEach(async () => {
    vi.useRealTimers();
    if (getTimerState() !== 'idle') await stopTimer();
    auth.userId = null;
    vi.clearAllMocks();
  });

  test('starts immediately, measures elapsed time, pauses, resumes and saves', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-08-28T10:00:00.000Z'));

    await startTimer({ category: 'Coding' });
    expect(getTimerState()).toBe('running');

    vi.advanceTimersByTime(5_000);
    expect(getElapsedSeconds()).toBe(5);

    await pauseTimer();
    expect(getTimerState()).toBe('paused');
    expect(getElapsedSeconds()).toBe(5);

    vi.advanceTimersByTime(8_000);
    expect(getElapsedSeconds()).toBe(5);

    await resumeTimer();
    vi.advanceTimersByTime(3_000);
    expect(getElapsedSeconds()).toBe(8);

    const result = await stopTimer();
    expect(result?.durationSeconds).toBe(8);
    expect(result?.pauseCount).toBe(1);
    expect(storage.insertActivityEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'session-id',
        category: 'Coding',
        duration_seconds: 8,
        pause_count: 1,
      })
    );
    expect(getTimerState()).toBe('idle');
  });

  test('saves android_usage_stats when Usage Access capture started', async () => {
    deviceActivity.startDeviceActivityCapture.mockResolvedValueOnce({
      started: true,
      warning: null,
    });
    deviceActivity.stopDeviceActivityCapture.mockResolvedValueOnce({
      startMs: 1,
      endMs: 2,
    });

    await startTimer();
    const result = await stopTimer();

    expect(result?.durationSeconds).toBe(0);
    expect(storage.insertActivityEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        source: 'android_usage_stats',
        capture_source: 'usage_stats',
        category: 'General',
      })
    );
  });
});
