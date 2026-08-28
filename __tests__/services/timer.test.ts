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
vi.mock('react-native', () => ({ Platform: { OS: 'ios' } }));

const deviceActivity = vi.hoisted(() => ({
  startDeviceActivityCapture: vi.fn().mockResolvedValue({ started: false, warning: null }),
  stopDeviceActivityCapture: vi.fn().mockResolvedValue(null),
}));

vi.mock('@/services/deviceActivity', () => deviceActivity);

import {
  getElapsedSeconds,
  getTimerState,
  pauseTimer,
  resumeTimer,
  startTimer,
  stopTimer,
} from '@/services/timer';

describe('timer service', () => {
  afterEach(async () => {
    vi.useRealTimers();
    if (getTimerState() !== 'idle') await stopTimer();
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

  test('saves ios_device_activity when Screen Time capture started', async () => {
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
        source: 'ios_device_activity',
        capture_source: 'device_activity',
        category: 'General',
      })
    );
  });
});
