/**
 * useTimer — Hook for timer state with automatic re-render.
 */

import { useState, useEffect, useCallback } from 'react';
import {
  getTimerState,
  getCurrentSession,
  getElapsedSeconds,
  subscribe as subscribeTimer,
  startTimer,
  pauseTimer,
  resumeTimer,
  stopTimer,
  recoverTimer,
  type TimerState,
  type TimerSession,
} from '@/services/timer';

export function useTimer() {
  const [timerState, setTimerState] = useState<TimerState>(getTimerState());
  const [session, setSession] = useState<TimerSession | null>(getCurrentSession());
  const [elapsed, setElapsed] = useState(getElapsedSeconds());
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const unsubscribe = subscribeTimer((newState: TimerState, newSession: TimerSession | null) => {
      setTimerState(newState);
      setSession(newSession);
      setElapsed(getElapsedSeconds());
    });

    void recoverTimer().catch(() => {
      setError('Could not restore the previous focus session.');
    });

    return unsubscribe;
  }, []);

  // Update elapsed every second when running
  useEffect(() => {
    if (timerState !== 'running') return;

    const interval = setInterval(() => {
      setElapsed(getElapsedSeconds());
    }, 1000);

    return () => clearInterval(interval);
  }, [timerState]);

  const start = useCallback(async (options?: {
    category?: string;
    taskLabel?: string;
    ticketRef?: string;
  }) => {
    setError(null);
    try {
      await startTimer(options);
    } catch {
      setError('Could not start the timer. Please try again.');
    }
  }, []);

  const pause = useCallback(async () => {
    setError(null);
    try {
      await pauseTimer();
    } catch {
      setError('Could not pause the timer.');
    }
  }, []);

  const resume = useCallback(async () => {
    setError(null);
    try {
      await resumeTimer();
    } catch {
      setError('Could not resume the timer.');
    }
  }, []);

  const stop = useCallback(async () => {
    setError(null);
    try {
      return await stopTimer();
    } catch {
      setError('Could not save this focus session.');
      return null;
    }
  }, []);

  return {
    state: timerState,
    session,
    elapsed,
    error,
    start,
    pause,
    resume,
    stop,
    isIdle: timerState === 'idle',
    isRunning: timerState === 'running',
    isPaused: timerState === 'paused',
  };
}
