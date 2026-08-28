/**
 * Focus Spec ù TypeScript port of desktop focus semantics.
 *
 * Canonical rules:
 * - Deep focus = contiguous focus-eligible work ? 25 minutes
 * - General/Idle ? 60s is a grace break (interrupts, does not split)
 * - Browsing ? 120s is a distraction and splits the session
 * - Meeting/Planning/Communication/Sales are context work, never distraction
 * - Samples that cross midnight are split at the day boundary
 * - Overlapping samples are clipped
 */

import type { CanonicalCategory, DataSource } from '@/contracts';

export const THRESHOLDS = {
  deepFocusMinSeconds: 1500,
  graceBreakMaxSeconds: 60,
  distractionMinSeconds: 120,
} as const;

const FOCUS_CATEGORIES = new Set<CanonicalCategory>([
  'Analysis',
  'Writing',
  'Coding',
  'Debugging',
  'CodeReview',
  'Testing',
  'Documentation',
  'Design',
  'Research',
  'Learning',
  'DevOps',
  'Database',
]);

const CONTEXT_CATEGORIES = new Set<CanonicalCategory>([
  'Meeting',
  'Planning',
  'Communication',
  'Sales',
  'Admin',
]);

const UNCERTAIN_CATEGORIES = new Set<CanonicalCategory>(['General', 'Idle']);

export interface ActivitySample {
  start_at: string;
  duration_seconds: number;
  category: CanonicalCategory;
  theme_hint?: string | null;
  source: DataSource | string;
}

export interface FocusSession {
  start_at: string;
  end_at: string;
  duration_seconds: number;
  theme: string | null;
  interrupted: boolean;
  is_deep: boolean;
}

export interface FocusSummary {
  deep_focus_seconds: number;
  deep_focus_sessions: number;
  total_sessions: number;
  interrupted_sessions: number;
  theme_switches: number;
  resume_events: number;
  distraction_events: number;
  distraction_seconds: number;
  context_work_seconds: number;
  sessions: FocusSession[];
  proxy_disclaimer: string;
}

interface Interval {
  start: number;
  end: number;
  category: CanonicalCategory;
  theme: string | null;
}

function startOfNextDay(ms: number): number {
  const d = new Date(ms);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1).getTime();
}

function splitAtMidnight(samples: ActivitySample[]): Interval[] {
  const intervals: Interval[] = [];

  for (const sample of samples) {
    let start = new Date(sample.start_at).getTime();
    let remaining = sample.duration_seconds * 1000;
    const theme = sample.theme_hint ?? null;

    while (remaining > 0) {
      const midnight = startOfNextDay(start);
      const slice = Math.min(remaining, midnight - start);
      intervals.push({
        start,
        end: start + slice,
        category: sample.category,
        theme,
      });
      start += slice;
      remaining -= slice;
    }
  }

  return intervals.sort((a, b) => a.start - b.start);
}

function clipOverlaps(intervals: Interval[]): Interval[] {
  const clipped: Interval[] = [];
  let cursor = 0;

  for (const interval of intervals) {
    const start = Math.max(interval.start, cursor);
    if (start >= interval.end) continue;
    clipped.push({ ...interval, start });
    cursor = interval.end;
  }

  return clipped;
}

function isFocus(category: CanonicalCategory): boolean {
  return FOCUS_CATEGORIES.has(category);
}

function isContext(category: CanonicalCategory): boolean {
  return CONTEXT_CATEGORIES.has(category);
}

function isUncertain(category: CanonicalCategory): boolean {
  return UNCERTAIN_CATEGORIES.has(category);
}

function isDistraction(category: CanonicalCategory, seconds: number): boolean {
  return category === 'Browsing' && seconds >= THRESHOLDS.distractionMinSeconds;
}

function isGrace(category: CanonicalCategory, seconds: number): boolean {
  return isUncertain(category) && seconds <= THRESHOLDS.graceBreakMaxSeconds;
}

function dayKey(ms: number): string {
  const d = new Date(ms);
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

const PROXY_DISCLAIMER =
  'Deep focus is an observable proxy of contiguous work time, not a measure of cognitive intensity or quality.';

export function summarizeFocus(samples: ActivitySample[]): FocusSummary {
  const empty: FocusSummary = {
    deep_focus_seconds: 0,
    deep_focus_sessions: 0,
    total_sessions: 0,
    interrupted_sessions: 0,
    theme_switches: 0,
    resume_events: 0,
    distraction_events: 0,
    distraction_seconds: 0,
    context_work_seconds: 0,
    sessions: [],
    proxy_disclaimer: PROXY_DISCLAIMER,
  };

  if (samples.length === 0) return empty;

  const intervals = clipOverlaps(splitAtMidnight(samples));
  const sessions: FocusSession[] = [];

  let deep_focus_seconds = 0;
  let interrupted_sessions = 0;
  let theme_switches = 0;
  let resume_events = 0;
  let distraction_events = 0;
  let distraction_seconds = 0;
  let context_work_seconds = 0;

  let current: {
    start: number;
    end: number;
    theme: string | null;
    focusSeconds: number;
    interrupted: boolean;
  } | null = null;

  let pendingResumeTheme: string | null | undefined;
  let consecutiveUncertain = 0;
  let lastCloseReason: 'theme' | 'context' | 'other' | null = null;

  const closeSession = (interrupted: boolean, reason: 'theme' | 'context' | 'other' = 'other') => {
    if (!current) return;
    const duration = Math.round(current.focusSeconds);
    const is_deep = duration >= THRESHOLDS.deepFocusMinSeconds;
    sessions.push({
      start_at: new Date(current.start).toISOString(),
      end_at: new Date(current.end).toISOString(),
      duration_seconds: duration,
      theme: current.theme,
      interrupted: interrupted || current.interrupted,
      is_deep,
    });
    if (interrupted || current.interrupted) interrupted_sessions += 1;
    if (is_deep) deep_focus_seconds += duration;
    pendingResumeTheme = current.theme;
    lastCloseReason = reason;
    current = null;
    consecutiveUncertain = 0;
  };

  for (const interval of intervals) {
    const seconds = Math.round((interval.end - interval.start) / 1000);

    if (isFocus(interval.category)) {
      consecutiveUncertain = 0;
      if (current && dayKey(current.start) !== dayKey(interval.start)) {
        closeSession(false);
      }

      if (current) {
        if (current.theme && interval.theme && current.theme !== interval.theme) {
          closeSession(true, 'theme');
          theme_switches += 1;
        }
      }

      if (!current) {
        if (
          lastCloseReason === 'context' &&
          pendingResumeTheme &&
          interval.theme &&
          interval.theme !== pendingResumeTheme
        ) {
          theme_switches += 1;
        }
        if (
          pendingResumeTheme !== undefined &&
          pendingResumeTheme !== null &&
          interval.theme === pendingResumeTheme
        ) {
          resume_events += 1;
        }
        current = {
          start: interval.start,
          end: interval.end,
          theme: interval.theme,
          focusSeconds: seconds,
          interrupted: false,
        };
        lastCloseReason = null;
      } else {
        current.end = interval.end;
        current.focusSeconds += seconds;
        if (!current.theme && interval.theme) current.theme = interval.theme;
      }
      pendingResumeTheme = undefined;
      continue;
    }

    if (isGrace(interval.category, seconds) && current && consecutiveUncertain === 0) {
      consecutiveUncertain += 1;
      current.interrupted = true;
      current.end = interval.end;
      continue;
    }

    if (isUncertain(interval.category)) {
      consecutiveUncertain += 1;
      if (current) closeSession(true);
      pendingResumeTheme = undefined;
      continue;
    }

    consecutiveUncertain = 0;

    if (isContext(interval.category)) {
      context_work_seconds += seconds;
      if (current) closeSession(true, 'context');
      continue;
    }

    if (isDistraction(interval.category, seconds)) {
      distraction_events += 1;
      distraction_seconds += seconds;
      if (current) closeSession(true);
      pendingResumeTheme = undefined;
      continue;
    }

    if (interval.category === 'Browsing') {
      if (current) {
        current.interrupted = true;
        current.end = interval.end;
      }
      continue;
    }

    if (current) closeSession(true);
  }

  closeSession(false);

  return {
    deep_focus_seconds,
    deep_focus_sessions: sessions.filter((s) => s.is_deep).length,
    total_sessions: sessions.length,
    interrupted_sessions,
    theme_switches,
    resume_events,
    distraction_events,
    distraction_seconds,
    context_work_seconds,
    sessions,
    proxy_disclaimer: PROXY_DISCLAIMER,
  };
}
