import { localDateKey } from '@/utils/format';
import type { StoredAppUsage, StoredSession } from '@/services/sessionInsights';

export type InsightSignalId = 'pauses' | 'short' | 'peak' | 'deep' | 'social' | 'none';

export type InsightNudgeCandidate = {
  signalId: Exclude<InsightSignalId, 'none'>;
  cardId: string;
  title: string;
  body: string;
};

const APP_NAME_RE = /\b(xcode|safari|slack|instagram|tiktok|youtube|messages|mail|chrome|figma|notion)\b/gi;

export function isMeaningfulSession(durationSeconds: number, pauseCount: number): boolean {
  return durationSeconds >= 10 * 60 || (durationSeconds >= 5 * 60 && pauseCount >= 2);
}

export function extractInsightSignal(
  sessions: StoredSession[],
  appUsage: StoredAppUsage[],
  now = new Date()
): InsightSignalId {
  if (sessions.length === 0) return 'none';
  const todayKey = localDateKey(now);
  const interrupted = sessions.filter((session) => session.pause_count >= 2);
  const short = sessions.filter((session) => session.duration_seconds < 5 * 60);
  const deepToday = sessions.filter(
    (session) => localDateKey(new Date(session.start_at)) === todayKey && session.duration_seconds >= 30 * 60
  );
  const hourCounts = new Map<number, number>();
  for (const session of sessions) {
    const hour = new Date(session.start_at).getHours();
    hourCounts.set(hour, (hourCounts.get(hour) ?? 0) + 1);
  }
  const peak = [...hourCounts.entries()].sort((left, right) => right[1] - left[1])[0];

  let socialSeconds = 0;
  let focusSeconds = 0;
  for (const row of appUsage) {
    const name = `${row.app_name} ${row.bundle_id ?? ''}`.toLowerCase();
    if (/(instagram|tiktok|youtube|facebook|twitter|snapchat|social)/.test(name)) {
      socialSeconds += row.seconds;
    } else {
      focusSeconds += row.seconds;
    }
  }

  if (interrupted.length >= 1) return 'pauses';
  if (short.length >= 2) return 'short';
  if (peak && peak[1] >= 2) return 'peak';
  if (deepToday.length >= 1) return 'deep';
  if (socialSeconds > 0 && socialSeconds >= focusSeconds) return 'social';
  return 'none';
}

export function templateForSignal(
  signalId: InsightSignalId,
  sessions: StoredSession[]
): InsightNudgeCandidate | null {
  if (signalId === 'none') return null;

  const templates: Record<Exclude<InsightSignalId, 'none'>, { title: string; body: string }> = {
    pauses: {
      title: 'Fewer pauses',
      body: `${sessions.filter((session) => session.pause_count >= 2).length} of your last ${sessions.length} blocks were paused twice or more.`,
    },
    short: {
      title: 'Longer blocks',
      body: `${sessions.filter((session) => session.duration_seconds < 5 * 60).length} recent blocks lasted under 5 minutes. One longer Start-Stop helps.`,
    },
    peak: {
      title: 'Protect that hour',
      body: 'Most recent blocks began around your usual start. Protect that slot if it is when you focus.',
    },
    deep: {
      title: 'Keep the long block',
      body: 'You had a 30m+ block today. Tomorrow, start in that same window.',
    },
    social: {
      title: 'Keep the next block timed',
      body: 'Social time showed up beside your timed blocks. Keep the next block inside Start-Stop.',
    },
  };

  const copy = templates[signalId];
  return {
    signalId,
    cardId: signalId,
    title: clip(copy.title, 40),
    body: clip(sanitizeLockScreen(copy.body), 90),
  };
}

export function sanitizeLockScreen(text: string, appNames: string[] = []): string {
  let cleaned = text;
  for (const name of appNames) {
    if (name.trim().length < 3) continue;
    cleaned = cleaned.replace(new RegExp(escapeRegExp(name), 'gi'), 'an app');
  }
  cleaned = cleaned.replace(APP_NAME_RE, 'an app');
  return cleaned.replace(/\s+/g, ' ').trim();
}

export function shouldSkipNudge(input: {
  enabled: boolean;
  today: string;
  lastDay: string | null;
  lastSignalId: string | null;
  lastFingerprint: string | null;
  fingerprint: string;
  mutedUntil: string | null;
  seenCardIdsToday: string[];
  cardId: string;
  signalId: string;
}): boolean {
  if (!input.enabled) return true;
  if (input.lastDay === input.today) return true;
  if (input.mutedUntil && input.mutedUntil >= input.today) return true;
  if (input.lastFingerprint === input.fingerprint) return true;
  if (input.seenCardIdsToday.includes(input.cardId)) return true;
  if (input.lastSignalId === input.signalId && daysBetween(input.lastDay, input.today) < 7) {
    return true;
  }
  return false;
}

function daysBetween(from: string | null, to: string): number {
  if (!from) return Number.POSITIVE_INFINITY;
  const start = Date.parse(`${from}T00:00:00`);
  const end = Date.parse(`${to}T00:00:00`);
  if (!Number.isFinite(start) || !Number.isFinite(end)) return Number.POSITIVE_INFINITY;
  return Math.round((end - start) / 86_400_000);
}

function clip(value: string, max: number): string {
  if (value.length <= max) return value;
  return `${value.slice(0, max - 1).trim()}...`;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
