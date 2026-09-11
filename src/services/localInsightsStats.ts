/**
 * Pure STATS snapshot + JSON parse for on-device Insights.
 * Mirrors Mac `insights_local.rs` (`build_section_stats_snapshot` / JSON repair)
 * using iPhone SQLite sessions and hourly Screen Time ù text only, no vision.
 */

import { screenTimeCategory } from '@/services/appCategory';
import {
  type SessionPattern,
  type StoredAppUsage,
  type StoredSession,
} from '@/services/sessionInsights';
import { localDateKey } from '@/utils/format';

export const LOCAL_STATS_MAX_CHARS = 2800;
export const LOCAL_PATTERN_PERIOD_DAYS = 7;

export type ParsedPatternCard = {
  title: string;
  body: string;
};

export function fingerprintStats(text: string): string {
  let hash = 2166136261;
  for (let i = 0; i < text.length; i += 1) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16);
}

export function buildLocalStatsSnapshot(
  sessions: StoredSession[],
  appUsage: StoredAppUsage[],
  now = new Date(),
  periodDays = LOCAL_PATTERN_PERIOD_DAYS
): string {
  const days = Math.max(1, Math.min(30, periodDays));
  const periodEnd = new Date(now);
  periodEnd.setHours(23, 59, 59, 999);
  const periodStart = new Date(now);
  periodStart.setHours(0, 0, 0, 0);
  periodStart.setDate(periodStart.getDate() - (days - 1));
  const startMs = periodStart.getTime();
  const endMs = periodEnd.getTime();
  const startKey = localDateKey(periodStart);
  const endKey = localDateKey(periodEnd);

  const inPeriod = sessions.filter((session) => {
    const start = new Date(session.start_at).getTime();
    return start >= startMs && start <= endMs;
  });

  const totalSeconds = inPeriod.reduce((sum, session) => sum + session.duration_seconds, 0);
  const pauseTotal = inPeriod.reduce((sum, session) => sum + session.pause_count, 0);
  const shortCount = inPeriod.filter((session) => session.duration_seconds < 5 * 60).length;
  const interrupted = inPeriod.filter((session) => session.pause_count >= 2).length;
  const deepFocus = inPeriod.filter((session) => session.duration_seconds >= 30 * 60).length;
  const avgMinutes =
    inPeriod.length === 0 ? 0 : Math.round(totalSeconds / inPeriod.length / 60);

  const activeDays = new Set(inPeriod.map((session) => localDateKey(new Date(session.start_at))));
  const consistency = days > 0 ? Math.round((activeDays.size / days) * 1000) / 10 : 0;

  const categoryMap = new Map<string, { seconds: number; count: number }>();
  const hourCounts = new Map<number, number>();
  const hourFocusSeconds = new Map<number, number>();

  for (const session of inPeriod) {
    const name = session.category?.trim() || 'Focus';
    const entry = categoryMap.get(name) ?? { seconds: 0, count: 0 };
    entry.seconds += session.duration_seconds;
    entry.count += 1;
    categoryMap.set(name, entry);

    const hour = new Date(session.start_at).getHours();
    hourCounts.set(hour, (hourCounts.get(hour) ?? 0) + 1);
    hourFocusSeconds.set(hour, (hourFocusSeconds.get(hour) ?? 0) + session.duration_seconds);
  }

  const usageInPeriod = appUsage.filter((row) => row.day >= startKey && row.day <= endKey);
  const appMap = new Map<string, number>();
  const usageCategoryMap = new Map<string, number>();
  for (const row of usageInPeriod) {
    if (row.seconds <= 0) continue;
    appMap.set(row.app_name, (appMap.get(row.app_name) ?? 0) + row.seconds);
    const category = screenTimeCategory(row.app_name, row.bundle_id);
    usageCategoryMap.set(category, (usageCategoryMap.get(category) ?? 0) + row.seconds);
    hourFocusSeconds.set(row.hour, (hourFocusSeconds.get(row.hour) ?? 0) + row.seconds);
  }

  const topCategories = [...categoryMap.entries()]
    .sort((left, right) => right[1].seconds - left[1].seconds)
    .slice(0, 8)
    .map(([name, row]) => `${name} ${hoursLabel(row.seconds)}h (${row.count} sessions)`);

  if (topCategories.length === 0) {
    const fromApps = [...usageCategoryMap.entries()]
      .sort((left, right) => right[1] - left[1])
      .slice(0, 6)
      .map(([name, seconds]) => `${name} ${hoursLabel(seconds)}h`);
    topCategories.push(...fromApps);
  }

  const topApps = [...appMap.entries()]
    .sort((left, right) => right[1] - left[1])
    .slice(0, 8)
    .map(([name, seconds]) => `${name} ${hoursLabel(seconds)}h`);

  const peakStart = [...hourCounts.entries()].sort((left, right) => right[1] - left[1])[0];
  const focusHours = [...hourFocusSeconds.entries()]
    .filter(([, seconds]) => seconds > 0)
    .sort((left, right) => right[1] - left[1])
    .slice(0, 8)
    .map(([hour, seconds]) => `${hour}:00 ${Math.round(seconds / 60)}m`);

  const longest = [...inPeriod]
    .sort((left, right) => right.duration_seconds - left.duration_seconds)
    .slice(0, 8);

  const lines: string[] = [
    `PERIOD: ${startKey} to ${endKey} (${days} days)`,
    `TOTAL: ${hoursLabel(totalSeconds)}h | SESSIONS: ${inPeriod.length} | AVG: ${avgMinutes}m | PAUSES: ${pauseTotal}`,
    `HEALTH: ${consistency}% days tracked (${activeDays.size}/${days}d) | interrupted: ${interrupted} | short (<5m): ${shortCount} | deep-focus 30m+: ${deepFocus}`,
  ];

  if (topCategories.length > 0) {
    lines.push(`CATEGORIES: ${topCategories.join(' | ')}`);
  }
  if (focusHours.length > 0) {
    lines.push(`FOCUS_HOURS: ${focusHours.join(', ')}`);
  }
  if (peakStart && peakStart[1] >= 1) {
    lines.push(`PEAK_START_HOUR: ${peakStart[0]}:00 (${peakStart[1]} sessions)`);
  }
  if (topApps.length > 0) {
    lines.push(`APPS: ${topApps.join(' | ')}`);
  }

  for (const session of longest) {
    const date = localDateKey(new Date(session.start_at));
    const category = session.category?.trim() || 'Focus';
    const minutes = Math.round(session.duration_seconds / 60);
    lines.push(`- SESSION ${date} ${category} ${minutes}m, ${session.pause_count} pauses`);
  }

  if (inPeriod.length === 0 && usageInPeriod.length === 0) {
    lines.push('ACTIVITY_LOG: none ù start and stop a block to populate STATS.');
  }

  return truncateStatsText(lines.join('\n'), LOCAL_STATS_MAX_CHARS);
}

export function parseLocalPatternResponse(raw: unknown): ParsedPatternCard[] {
  const text = extractTextPayload(raw);
  if (!text) return [];

  const json = parseJsonObject(text);
  if (!json) return [];

  const rows = Array.isArray(json.patterns)
    ? json.patterns
    : Array.isArray(json.lessons_learned)
      ? json.lessons_learned
      : [];

  const cards: ParsedPatternCard[] = [];
  for (const row of rows) {
    const parsed = sanitizePatternCard(row);
    if (parsed) cards.push(parsed);
  }
  return cards.slice(0, 5);
}

export function patternsFromModelCards(cards: ParsedPatternCard[]): SessionPattern[] {
  return cards.map((card, index) => ({
    id: `local-${index + 1}-${slug(card.title)}`,
    title: card.title,
    body: card.body,
  }));
}

export function resolvePatternsFromModelOutput(
  raw: unknown,
  fallback: SessionPattern[]
): { patterns: SessionPattern[]; source: 'on-device' | 'fallback' } {
  const fromModel = patternsFromModelCards(parseLocalPatternResponse(raw));
  if (fromModel.length === 0) {
    return { patterns: fallback, source: 'fallback' };
  }
  return { patterns: fromModel, source: 'on-device' };
}

export function parseLocalNote(raw: unknown): string | null {
  const text = extractTextPayload(raw);
  if (!text) return null;
  const json = parseJsonObject(text);
  const note =
    typeof json?.note === 'string'
      ? json.note
      : typeof json?.caption === 'string'
        ? json.caption
        : '';
  const cleaned = cleanLine(note);
  if (cleaned.length < 40 || cleaned.length > 700) return null;
  return cleaned;
}

export function parseLocalQa(raw: unknown): { answer: string; grounded: boolean; usedFacts: string[] } | null {
  const text = extractTextPayload(raw);
  if (!text) return null;
  const json = parseJsonObject(text);
  if (!json) return null;
  const answer = cleanLine(typeof json.answer === 'string' ? json.answer : '');
  if (answer.length < 20 || answer.length > 400) return null;
  return {
    answer,
    grounded: json.grounded !== false,
    usedFacts: Array.isArray(json.used_facts)
      ? json.used_facts.filter((item): item is string => typeof item === 'string').slice(0, 4)
      : [],
  };
}

export function factsAreInStats(facts: string[], stats: string): boolean {
  const haystack = stats.toLowerCase();
  return facts.every((fact) => {
    const needle = fact.trim().toLowerCase();
    if (needle.length < 3) return false;
    const token = needle.replace(/[^a-z0-9:.% ]/g, ' ').split(/\s+/).find((part) => part.length >= 3);
    return token ? haystack.includes(token) : false;
  });
}

function hoursLabel(seconds: number): string {
  return (Math.round((seconds / 3600) * 10) / 10).toFixed(1);
}

function truncateStatsText(text: string, maxChars: number): string {
  if (text.length <= maxChars) return text;
  return `${text.slice(0, maxChars)}ù`;
}

function extractTextPayload(raw: unknown): string {
  if (typeof raw === 'string') return raw.trim();
  if (!raw || typeof raw !== 'object') return '';
  const record = raw as Record<string, unknown>;
  if (typeof record.text === 'string') return record.text.trim();
  if (typeof record.content === 'string') return record.content.trim();
  if (Array.isArray(record.patterns) || typeof record.note === 'string' || typeof record.answer === 'string') {
    return JSON.stringify(record);
  }
  return '';
}

function sanitizePatternCard(row: unknown): ParsedPatternCard | null {
  if (!row || typeof row !== 'object') return null;
  const record = row as Record<string, unknown>;
  const title = cleanLine(typeof record.title === 'string' ? record.title : '');
  const body = cleanLine(
    typeof record.body === 'string'
      ? record.body
      : typeof record.notes === 'string'
        ? record.notes
        : ''
  );
  if (title.length < 3 || title.length > 80) return null;
  if (body.length < 20 || body.length > 400) return null;
  return { title, body };
}

function cleanLine(value: string): string {
  return value.replace(/\s+/g, ' ').replace(/[`*_#]/g, '').trim();
}

function slug(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 24) || 'pattern';
}

function extractJsonBlock(raw: string): string {
  const trimmed = raw.trim();
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const source = fenced?.[1]?.trim() || trimmed;
  if (source.startsWith('{')) return source;
  const start = source.indexOf('{');
  const end = source.lastIndexOf('}');
  if (start >= 0 && end > start) return source.slice(start, end + 1);
  return source;
}

function closeJsonBrackets(value: string): string {
  let result = value.trim().replace(/,+\s*$/, '');
  const openBrackets = (result.match(/\[/g) || []).length;
  const closeBrackets = (result.match(/]/g) || []).length;
  const openBraces = (result.match(/\{/g) || []).length;
  const closeBraces = (result.match(/}/g) || []).length;
  result += ']'.repeat(Math.max(0, openBrackets - closeBrackets));
  result += '}'.repeat(Math.max(0, openBraces - closeBraces));
  return result;
}

function parseJsonObject(raw: string): Record<string, unknown> | null {
  const jsonStr = extractJsonBlock(raw);
  const candidates = [jsonStr, closeJsonBrackets(jsonStr)];
  for (const candidate of candidates) {
    try {
      const parsed = JSON.parse(candidate) as unknown;
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        return parsed as Record<string, unknown>;
      }
    } catch {
      // try truncated repair below
    }
  }

  for (let end = jsonStr.length - 1; end > 20; end -= 1) {
    const candidate = closeJsonBrackets(jsonStr.slice(0, end));
    try {
      const parsed = JSON.parse(candidate) as unknown;
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        return parsed as Record<string, unknown>;
      }
    } catch {
      continue;
    }
  }
  return null;
}
