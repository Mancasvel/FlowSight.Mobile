import { describe, expect, test, vi } from 'vitest';

vi.mock('@/storage', () => ({
  getDailyStats: vi.fn(),
  getRecentSessions: vi.fn(),
  getHourlyAppUsage: vi.fn(),
  getHourlyAppUsageSince: vi.fn(),
}));

import {
  buildLocalStatsSnapshot,
  fingerprintStats,
  parseLocalPatternResponse,
  resolvePatternsFromModelOutput,
} from '@/services/localInsightsStats';
import { patternsFromSessions, type StoredAppUsage, type StoredSession } from '@/services/sessionInsights';

function session(partial: Partial<StoredSession> & Pick<StoredSession, 'id' | 'start_at'>): StoredSession {
  return {
    end_at: partial.end_at ?? partial.start_at,
    duration_seconds: partial.duration_seconds ?? 1500,
    pause_count: partial.pause_count ?? 0,
    ...partial,
  };
}

const sessions: StoredSession[] = [
  session({
    id: 'a',
    start_at: '2026-09-10T09:00:00',
    end_at: '2026-09-10T09:45:00',
    duration_seconds: 45 * 60,
    pause_count: 0,
    category: 'Coding',
  }),
  session({
    id: 'b',
    start_at: '2026-09-10T14:00:00',
    end_at: '2026-09-10T14:04:00',
    duration_seconds: 240,
    pause_count: 3,
    category: 'Slack',
  }),
];

const usage: StoredAppUsage[] = [
  {
    day: '2026-09-10',
    hour: 9,
    app_id: 'xcode',
    app_name: 'Xcode',
    bundle_id: 'com.apple.dt.Xcode',
    seconds: 2400,
    is_focus: 1,
    captured_at: '2026-09-10T12:00:00.000Z',
  },
  {
    day: '2026-09-10',
    hour: 14,
    app_id: 'safari',
    app_name: 'Safari',
    bundle_id: 'com.apple.mobilesafari',
    seconds: 600,
    is_focus: 0,
    captured_at: '2026-09-10T15:00:00.000Z',
  },
];

describe('localInsightsStats', () => {
  test('builds a compact STATS snapshot from sessions and Screen Time apps', () => {
    const stats = buildLocalStatsSnapshot(sessions, usage, new Date('2026-09-10T16:00:00'));
    expect(stats).toContain('PERIOD:');
    expect(stats).toContain('SESSIONS: 2');
    expect(stats).toContain('CATEGORIES:');
    expect(stats).toContain('Coding');
    expect(stats).toContain('APPS: Xcode');
    expect(stats).toContain('Safari');
    expect(stats).toContain('PEAK_START_HOUR:');
    expect(stats).toContain('- SESSION 2026-09-10');
    expect(stats.length).toBeLessThanOrEqual(2800);
  });

  test('fingerprints the same STATS consistently', () => {
    const stats = buildLocalStatsSnapshot(sessions, usage, new Date('2026-09-10T16:00:00'));
    expect(fingerprintStats(stats)).toBe(fingerprintStats(stats));
    expect(fingerprintStats(stats)).not.toBe(fingerprintStats(`${stats}x`));
  });

  test('parses model JSON and repairs truncated braces', () => {
    const cards = parseLocalPatternResponse(`
Here you go
\`\`\`json
{"patterns":[{"title":"Protect mornings","body":"Most deep work started at 9:00 with 45m Coding blocks and Xcode on Screen Time."},{"title":"Too many pauses","body":"One afternoon session was paused 3 times in 4 minutes  batch Slack instead of fragmenting the block."}
\`\`\`
`);
    expect(cards).toHaveLength(2);
    expect(cards[0]?.title).toBe('Protect mornings');
  });

  test('falls back to rule-based patterns when the model returns garbage', () => {
    const fallback = patternsFromSessions(sessions);
    const resolved = resolvePatternsFromModelOutput('not json at all', fallback);
    expect(resolved.source).toBe('fallback');
    expect(resolved.patterns).toEqual(fallback);
    expect(resolved.patterns.map((pattern) => pattern.id)).toContain('pauses');
  });

  test('rejects empty or too-short model cards', () => {
    expect(
      parseLocalPatternResponse({
        patterns: [{ title: 'Hi', body: 'Too short' }],
      })
    ).toEqual([]);
  });
});
