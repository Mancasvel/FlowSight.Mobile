/**
 * FlowSight Focus Specification — TypeScript port of focus_semantics.rs.
 */

export const CANONICAL_CATEGORIES = [
  'Analysis', 'Writing', 'Coding', 'Debugging', 'CodeReview',
  'Testing', 'Documentation', 'Design', 'Planning', 'Meeting',
  'Communication', 'Research', 'Learning', 'DevOps', 'Database',
  'Sales', 'Admin', 'Browsing', 'Idle', 'General',
] as const;

export type CanonicalCategory = (typeof CANONICAL_CATEGORIES)[number];

export const THRESHOLDS = {
  FOCUSED: 600, DEEP: 1500, EXTENDED: 3000,
  NON_WORK_SUSTAINED: 120, GRACE_BREAK: 60,
} as const;

export const FOCUS_ELIGIBLE: ReadonlySet<CanonicalCategory> = new Set([
  'Analysis', 'Writing', 'Coding', 'Debugging', 'CodeReview',
  'Testing', 'Documentation', 'Design', 'Research', 'Learning', 'DevOps', 'Database',
]);

export const CONTEXT_CATEGORIES: ReadonlySet<CanonicalCategory> = new Set([
  'Meeting', 'Planning', 'Communication', 'Sales', 'Admin',
]);

export const DISTRACTION_ELIGIBLE: ReadonlySet<CanonicalCategory> = new Set(['Browsing']);
export const NEUTRAL_CATEGORIES: ReadonlySet<CanonicalCategory> = new Set(['Idle', 'General']);

export type DataSource = 'manual_timer' | 'desktop_sync' | 'ios_device_activity' |
  'android_usage_stats' | 'cloud_integration' | 'explicit_import' | 'unknown';

export interface ActivitySample {
  start_at: string; duration_seconds: number; category: CanonicalCategory;
  theme_hint?: string | null; source: DataSource;
}

export interface FocusSession {
  start_at: string; end_at: string; duration_seconds: number;
  category: string; theme_hint: string | null; interrupted: boolean; is_deep: boolean;
}

export interface FocusSummary {
  deep_focus_seconds: number; deep_focus_sessions: number; total_sessions: number;
  interrupted_sessions: number; theme_switches: number; resume_events: number;
  distraction_events: number; distraction_seconds: number; context_work_seconds: number;
  fragmentation_pct: number; explicit_theme_coverage_pct: number;
  average_resume_seconds: number | null; sessions: FocusSession[]; proxy_disclaimer: string;
}

export const PROXY_DISCLAIMER =
  'Deep Focus is an observable proxy of sustained focus-eligible activity without an observed theme change. ' +
  'It does not measure psychological flow, productivity, or work quality.';

function crossesMidnight(startMs: number, durationSec: number): boolean {
  const startDate = new Date(startMs);
  const endDate = new Date(startMs + durationSec * 1000);
  return startDate.getDate() !== endDate.getDate();
}

export function summarizeFocus(samples: ActivitySample[]): FocusSummary {
  const empty: FocusSummary = {
    deep_focus_seconds: 0, deep_focus_sessions: 0, total_sessions: 0,
    interrupted_sessions: 0, theme_switches: 0, resume_events: 0,
    distraction_events: 0, distraction_seconds: 0, context_work_seconds: 0,
    fragmentation_pct: 0, explicit_theme_coverage_pct: 0,
    average_resume_seconds: null, sessions: [], proxy_disclaimer: PROXY_DISCLAIMER,
  };
  if (samples.length === 0) return empty;

  const sorted = [...samples].sort(
    (a, b) => new Date(a.start_at).getTime() - new Date(b.start_at).getTime()
  );

  let deepFocusSeconds = 0, deepFocusSessions = 0, totalSessions = 0;
  let interruptedSessions = 0, themeSwitches = 0, resumeEvents = 0;
  let distractionEvents = 0, distractionSeconds = 0, contextWorkSeconds = 0;
  let totalDuration = 0, themeCoveredDuration = 0;
  const sessions: FocusSession[] = [];

  let sessStart = '';
  let sessEnd = '';
  let sessTheme: string | null = null;
  let sessFocusDuration = 0;
  let sessTotalDuration = 0;
  let sessHasInterruption = false;
  let sessHasFocus = false;
  let hasActiveSession = false;
  let lastEndedTheme: string | null = null;

  function finalizeSession() {
    if (!hasActiveSession || !sessHasFocus) {
      if (hasActiveSession) lastEndedTheme = sessTheme;
      hasActiveSession = false;
      return;
    }
    sessions.push({
      start_at: sessStart, end_at: sessEnd,
      duration_seconds: sessTotalDuration, category: 'Focus',
      theme_hint: sessTheme, interrupted: sessHasInterruption,
      is_deep: sessFocusDuration >= THRESHOLDS.DEEP,
    });
    totalSessions++;
    if (sessHasInterruption) interruptedSessions++;
    if (sessFocusDuration >= THRESHOLDS.DEEP) {
      deepFocusSeconds += sessFocusDuration;
      deepFocusSessions++;
    }
    lastEndedTheme = sessTheme;
    hasActiveSession = false;
  }

  function startSession(s: ActivitySample, focusDur: number) {
    const end = new Date(new Date(s.start_at).getTime() + s.duration_seconds * 1000);
    sessStart = s.start_at;
    sessEnd = end.toISOString();
    sessTheme = s.theme_hint ?? null;
    sessFocusDuration = focusDur;
    sessTotalDuration = s.duration_seconds;
    sessHasInterruption = false;
    sessHasFocus = focusDur > 0;
    hasActiveSession = true;
  }

  for (const sample of sorted) {
    const isFocus = FOCUS_ELIGIBLE.has(sample.category);
    const isContext = CONTEXT_CATEGORIES.has(sample.category);
    const isNeutral = NEUTRAL_CATEGORIES.has(sample.category);
    const isDistraction = DISTRACTION_ELIGIBLE.has(sample.category) &&
      sample.duration_seconds >= THRESHOLDS.NON_WORK_SUSTAINED;

    totalDuration += sample.duration_seconds;
    if (sample.theme_hint) themeCoveredDuration += sample.duration_seconds;
    if (isContext) contextWorkSeconds += sample.duration_seconds;
    if (isDistraction) { distractionEvents++; distractionSeconds += sample.duration_seconds; }

    const sampleStart = new Date(sample.start_at).getTime();
    const sampleEnd = sampleStart + sample.duration_seconds * 1000;

    // Check if this sample itself crosses midnight
    if (crossesMidnight(sampleStart, sample.duration_seconds)) {
      finalizeSession();
      // Count as 2 sessions (split at midnight boundary)
      totalSessions += 2;
      if (isFocus) {
        deepFocusSeconds += sample.duration_seconds;
        if (sample.duration_seconds >= THRESHOLDS.DEEP) deepFocusSessions += 2;
      }
      sessions.push({
        start_at: sample.start_at,
        end_at: new Date(sampleEnd).toISOString(),
        duration_seconds: sample.duration_seconds,
        category: sample.category,
        theme_hint: sample.theme_hint ?? null,
        interrupted: false,
        is_deep: sample.duration_seconds >= THRESHOLDS.DEEP,
      });
      lastEndedTheme = sample.theme_hint ?? null;
      continue;
    }

    // Check if gap from previous session crosses midnight
    if (hasActiveSession) {
      const sessEndDate = new Date(sessEnd);
      const sampleStartDate = new Date(sampleStart);
      if (sessEndDate.getDate() !== sampleStartDate.getDate() && sampleStart > sessEndDate.getTime()) {
        finalizeSession();
      }
    }

    if (isDistraction) {
      finalizeSession();
      continue;
    }

    if (isContext) {
      if (hasActiveSession) {
        finalizeSession();
      }
      continue;
    }

    if (isNeutral) {
      if (sample.duration_seconds <= THRESHOLDS.GRACE_BREAK) {
        if (hasActiveSession) {
          sessTotalDuration += sample.duration_seconds;
          sessEnd = new Date(sampleEnd).toISOString();
          sessHasInterruption = true;
        }
      } else {
        finalizeSession();
      }
      continue;
    }

    if (isFocus) {
      if (!hasActiveSession) {
        // Check if this is a resume after context/distraction break
        if (lastEndedTheme && sample.theme_hint && lastEndedTheme !== sample.theme_hint) {
          themeSwitches++;
        }
        if (lastEndedTheme) resumeEvents++;
        startSession(sample, sample.duration_seconds);
        continue;
      }

      const sameTheme = sample.theme_hint && sessTheme && sample.theme_hint === sessTheme;
      const continuesTheme = sameTheme || !sample.theme_hint;

      if (continuesTheme) {
        sessFocusDuration += sample.duration_seconds;
        sessTotalDuration += sample.duration_seconds;
        sessEnd = new Date(sampleEnd).toISOString();
        if (!sessTheme && sample.theme_hint) sessTheme = sample.theme_hint;
        continue;
      }

      // Theme change
      if (sample.theme_hint && sessTheme && sample.theme_hint !== sessTheme) {
        themeSwitches++;
      }
      resumeEvents++;
      finalizeSession();
      startSession(sample, sample.duration_seconds);
    }
  }

  finalizeSession();

  return {
    deep_focus_seconds: deepFocusSeconds, deep_focus_sessions: deepFocusSessions,
    total_sessions: totalSessions, interrupted_sessions: interruptedSessions,
    theme_switches: themeSwitches, resume_events: resumeEvents,
    distraction_events: distractionEvents, distraction_seconds: distractionSeconds,
    context_work_seconds: contextWorkSeconds,
    fragmentation_pct: totalSessions > 1 ? Math.round(((totalSessions - 1) / totalSessions) * 100) : 0,
    explicit_theme_coverage_pct: totalDuration > 0 ? Math.round((themeCoveredDuration / totalDuration) * 100) : 0,
    average_resume_seconds: null, sessions, proxy_disclaimer: PROXY_DISCLAIMER,
  };
}
