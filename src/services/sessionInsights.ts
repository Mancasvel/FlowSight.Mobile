/**
 * Local session patterns. No app names — Apple keeps those in Screen Time.
 * Used for on-device tips only; nothing is sent to a server.
 */

import { getDailyStats, getRecentSessions } from '@/storage';

export type StoredSession = {
  id: string;
  start_at: string;
  end_at: string;
  duration_seconds: number;
  pause_count: number;
};

export type SessionPattern = {
  id: string;
  title: string;
  body: string;
};

export type YouStats = {
  todaySeconds: number;
  sessionCount: number;
  streak: number;
};

export async function loadRecentSessions(limit = 14): Promise<StoredSession[]> {
  return getRecentSessions(limit);
}

export async function loadYouStats(): Promise<YouStats> {
  const today = new Date().toISOString().slice(0, 10);
  const [daily, sessions] = await Promise.all([
    getDailyStats(today),
    getRecentSessions(60),
  ]);
  return {
    todaySeconds: daily.totalSeconds,
    sessionCount: sessions.length,
    streak: streakFromSessions(sessions),
  };
}

export function streakFromSessions(sessions: StoredSession[]): number {
  const days = new Set(sessions.map((session) => session.start_at.slice(0, 10)));
  const cursor = new Date();
  const today = cursor.toISOString().slice(0, 10);
  if (!days.has(today)) {
    cursor.setUTCDate(cursor.getUTCDate() - 1);
  }

  let streak = 0;
  while (days.has(cursor.toISOString().slice(0, 10))) {
    streak += 1;
    cursor.setUTCDate(cursor.getUTCDate() - 1);
  }
  return streak;
}

export function patternsFromSessions(sessions: StoredSession[]): SessionPattern[] {
  if (sessions.length === 0) {
    return [
      {
        id: 'empty',
        title: 'No sessions yet',
        body: 'Start and Stop a block. FlowSight only measures Screen Time inside that window.',
      },
    ];
  }

  const patterns: SessionPattern[] = [];
  const short = sessions.filter((session) => session.duration_seconds < 5 * 60);
  const interrupted = sessions.filter((session) => session.pause_count >= 2);
  const hourCounts = new Map<number, number>();

  for (const session of sessions) {
    const hour = new Date(session.start_at).getHours();
    hourCounts.set(hour, (hourCounts.get(hour) ?? 0) + 1);
  }

  const peakHour = [...hourCounts.entries()].sort((a, b) => b[1] - a[1])[0];

  if (interrupted.length >= 1) {
    patterns.push({
      id: 'pauses',
      title: 'Interrupted blocks',
      body: `${interrupted.length} of your last ${sessions.length} sessions were paused at least twice. Fewer pauses usually means less context switching.`,
    });
  }

  if (short.length >= 2) {
    patterns.push({
      id: 'short',
      title: 'Fragmented time',
      body: `${short.length} sessions lasted under 5 minutes. Short blocks are fine; a longer Start to Stop window gives Screen Time more to show.`,
    });
  }

  if (peakHour && peakHour[1] >= 2) {
    const hourLabel = new Intl.DateTimeFormat(undefined, { hour: 'numeric' }).format(
      new Date(2026, 0, 1, peakHour[0])
    );
    patterns.push({
      id: 'peak',
      title: 'Your usual start',
      body: `Most recent sessions began around ${hourLabel}. Protect that slot if it is when you focus best.`,
    });
  }

  if (patterns.length === 0) {
    patterns.push({
      id: 'steady',
      title: 'Steady sessions',
      body: 'Your last blocks look uninterrupted. The timeline is Apple Screen Time for Start to Stop only.',
    });
  }

  return patterns.slice(0, 3);
}

export function warningsForSession(input: {
  durationSeconds: number;
  pauseCount: number;
  captureStarted: boolean;
}): string[] {
  const warnings: string[] = [];

  if (!input.captureStarted) {
    warnings.push(
      'This session saved the timer only. Screen Time needs permission and the apps you choose to measure.'
    );
  }
  if (input.pauseCount >= 2) {
    warnings.push(
      `Paused ${input.pauseCount} times. Pause stops the timer; Screen Time still covers Start to Stop.`
    );
  }
  if (input.durationSeconds < 60) {
    warnings.push('Sessions under a minute often look empty in Screen Time.');
  }

  return warnings;
}
