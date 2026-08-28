/**
 * Local session patterns plus hourly Screen Time apps stored in SQLite.
 * App names stay on-device; they are never added to the sync queue.
 */

import { getDailyStats, getHourlyAppUsage, getRecentSessions, type HourlyAppUsageRow } from '@/storage';
import { localDateKey, startOfWeekMonday } from '@/utils/format';

export type StoredSession = {
  id: string;
  start_at: string;
  end_at: string;
  duration_seconds: number;
  pause_count: number;
  category?: string | null;
};

export type HourSegment = {
  category: string;
  seconds: number;
};

export type HourBucket = {
  hour: number;
  seconds: number;
  segments: HourSegment[];
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

export type WeekDayUsage = {
  key: string;
  label: string;
  used: boolean;
  isToday: boolean;
  seconds: number;
};

export type StoredAppUsage = HourlyAppUsageRow;

export async function loadHourlyAppUsage(day = localDateKey(new Date())): Promise<StoredAppUsage[]> {
  return getHourlyAppUsage(day);
}

export async function loadRecentSessions(limit = 14): Promise<StoredSession[]> {
  return getRecentSessions(limit);
}

export async function loadYouStats(): Promise<YouStats> {
  const today = localDateKey(new Date());
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

export function sessionEndMs(session: StoredSession): number {
  const start = new Date(session.start_at).getTime();
  const explicitEnd = new Date(session.end_at).getTime();
  if (Number.isFinite(explicitEnd) && explicitEnd > start) return explicitEnd;
  return start + session.duration_seconds * 1000;
}

export function hourlyBucketsFromSessions(sessions: StoredSession[], day = new Date()): HourBucket[] {
  const buckets: HourBucket[] = Array.from({ length: 24 }, (_, hour) => ({
    hour,
    seconds: 0,
    segments: [],
  }));
  const startDay = new Date(day);
  startDay.setHours(0, 0, 0, 0);
  const dayStart = startDay.getTime();
  const dayEnd = dayStart + 86_400_000;

  for (const session of sessions) {
    let cursor = Math.max(new Date(session.start_at).getTime(), dayStart);
    const sessionEnd = Math.min(sessionEndMs(session), dayEnd);
    if (sessionEnd <= cursor) continue;
    const category = session.category?.trim() || 'Focus';

    while (cursor < sessionEnd) {
      const hourDate = new Date(cursor);
      hourDate.setMinutes(0, 0, 0);
      const nextHour = hourDate.getTime() + 3_600_000;
      const sliceEnd = Math.min(sessionEnd, nextHour);
      const delta = (sliceEnd - cursor) / 1000;
      const bucket = buckets[hourDate.getHours()];
      bucket.seconds += delta;
      const existing = bucket.segments.find((segment) => segment.category === category);
      if (existing) existing.seconds += delta;
      else bucket.segments.push({ category, seconds: delta });
      cursor = sliceEnd;
    }
  }

  return buckets;
}

export function hourlyBucketsFromAppUsage(rows: StoredAppUsage[], day = new Date()): HourBucket[] {
  const dayKey = localDateKey(day);
  const buckets: HourBucket[] = Array.from({ length: 24 }, (_, hour) => ({
    hour,
    seconds: 0,
    segments: [],
  }));

  for (const row of rows) {
    if (row.day !== dayKey || row.hour < 0 || row.hour > 23 || row.seconds <= 0) continue;
    const bucket = buckets[row.hour];
    bucket.seconds += row.seconds;
    const existing = bucket.segments.find((segment) => segment.category === row.app_name);
    if (existing) existing.seconds += row.seconds;
    else bucket.segments.push({ category: row.app_name, seconds: row.seconds });
  }

  return buckets;
}

export function hourlyBucketsFromSources(
  sessions: StoredSession[],
  appUsage: StoredAppUsage[],
  day = new Date()
): HourBucket[] {
  const fromApps = hourlyBucketsFromAppUsage(appUsage, day);
  const fromSessions = hourlyBucketsFromSessions(sessions, day);
  return fromApps.map((bucket, hour) => (bucket.seconds > 0 ? bucket : fromSessions[hour]));
}

function hourStartMs(day: string, hour: number): number {
  const [year, month, date] = day.split('-').map(Number);
  return new Date(year, month - 1, date, hour, 0, 0, 0).getTime();
}

export function appsDuringSession(
  session: StoredSession,
  appUsage: StoredAppUsage[]
): { name: string; seconds: number }[] {
  const start = new Date(session.start_at).getTime();
  const end = sessionEndMs(session);
  const totals = new Map<string, number>();

  for (const row of appUsage) {
    const hourStart = hourStartMs(row.day, row.hour);
    const hourEnd = hourStart + 3_600_000;
    if (hourEnd <= start || hourStart >= end) continue;
    const overlap = Math.min(end, hourEnd) - Math.max(start, hourStart);
    if (overlap <= 0) continue;
    const seconds = row.seconds * (overlap / 3_600_000);
    totals.set(row.app_name, (totals.get(row.app_name) ?? 0) + seconds);
  }

  return [...totals.entries()]
    .sort((left, right) => right[1] - left[1])
    .map(([name, seconds]) => ({ name, seconds }));
}

const FULL_DAY_SPAN_HOURS = 8;

export function visibleHourBuckets(
  buckets: HourBucket[],
  nowHour = new Date().getHours()
): HourBucket[] {
  if (buckets.length !== 24) return buckets;

  const used = buckets.filter((bucket) => bucket.seconds > 0).map((bucket) => bucket.hour);
  if (used.length > 0) {
    const span = Math.max(...used) - Math.min(...used);
    if (span >= FULL_DAY_SPAN_HOURS) return buckets;
  }

  const center =
    used.length === 0
      ? nowHour
      : used.reduce((best, hour) => (buckets[hour].seconds > buckets[best].seconds ? hour : best), used[0]);
  const start = Math.max(0, Math.min(16, center - 3));
  return buckets.slice(start, start + FULL_DAY_SPAN_HOURS);
}

export function weekActivityFromSessions(sessions: StoredSession[], now = new Date()): WeekDayUsage[] {
  const labels = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
  const start = startOfWeekMonday(now);
  const todayKey = localDateKey(now);
  const secondsByDay = new Map<string, number>();

  for (const session of sessions) {
    const key = localDateKey(new Date(session.start_at));
    secondsByDay.set(key, (secondsByDay.get(key) ?? 0) + session.duration_seconds);
  }

  return labels.map((label, index) => {
    const date = new Date(start);
    date.setDate(start.getDate() + index);
    const key = localDateKey(date);
    const seconds = secondsByDay.get(key) ?? 0;
    return {
      key,
      label,
      used: seconds > 0,
      isToday: key === todayKey,
      seconds,
    };
  });
}

export function streakFromSessions(sessions: StoredSession[]): number {
  const days = new Set(sessions.map((session) => localDateKey(new Date(session.start_at))));
  const cursor = new Date();
  cursor.setHours(0, 0, 0, 0);
  if (!days.has(localDateKey(cursor))) {
    cursor.setDate(cursor.getDate() - 1);
  }

  let streak = 0;
  while (days.has(localDateKey(cursor))) {
    streak += 1;
    cursor.setDate(cursor.getDate() - 1);
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
