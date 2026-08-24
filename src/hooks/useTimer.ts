/**
 * useTimer — Hook for timer state with automatic re-render.
 */

import { useState, useEffect, useCallback } from 'react';
import {
  getTimerState,
  getCurrentSession,
  getElapsedSeconds,
  subscribeTimer,
  startTimer,
  pauseTimer,
  resumeTimer,
  stopTimer,
  recoverTimer,
  type TimerState,
  type TimerSession,
} from '@/services';

export function useTimer() {
  const [timerState, setTimerState] = useState<TimerState>(getTimerState());
  const [session, setSession] = useState<TimerSession | null>(getCurrentSession());
  const [elapsed, setElapsed] = useState(getElapsedSeconds());

  useEffect(() => {
    // Recover timer on mount
    recoverTimer();

    const unsubscribe = subscribeTimer((newState, newSession) => {
      setTimerState(newState);
      setSession(newSession);
      setElapsed(getElapsedSeconds());
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
    await startTimer(options);
  }, []);

  const pause = useCallback(async () => {
    await pauseTimer();
  }, []);

  const resume = useCallback(async () => {
    await resumeTimer();
  }, []);

  const stop = useCallback(async () => {
    return stopTimer();
  }, []);

  return {
    state: timerState,
    session,
    elapsed,
    start,
    pause,
    resume,
    stop,
    isIdle: timerState === 'idle',
    isRunning: timerState === 'running',
    isPaused: timerState === 'paused',
  };
}
