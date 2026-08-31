import { describe, expect, test, vi } from 'vitest';

vi.mock('@/storage', () => ({
  getDailyStats: vi.fn(),
  getRecentSessions: vi.fn(),
  getHourlyAppUsage: vi.fn(),
}));

import {
  hourlyBucketsFromSessions,
  hourlyBucketsFromSources,
  appsDuringSession,
  topUsageCategories,
  visibleHourBuckets,
  patternsFromSessions,
  streakFromSessions,
  weekActivityFromSessions,
  warningsForSession,
  type StoredAppUsage,
  type StoredSession,
} from '@/services/sessionInsights';

function session(partial: Partial<StoredSession> & Pick<StoredSession, 'id' | 'start_at'>): StoredSession {
  return {
    end_at: partial.end_at ?? partial.start_at,
    duration_seconds: partial.duration_seconds ?? 1500,
    pause_count: partial.pause_count ?? 0,
    ...partial,
  };
}

describe('sessionInsights', () => {
  test('warns when Screen Time did not start and the block was short', () => {
    expect(
      warningsForSession({ durationSeconds: 20, pauseCount: 0, captureStarted: false })
    ).toEqual(
      expect.arrayContaining([
        expect.stringMatching(/timer only/i),
        expect.stringMatching(/under a minute/i),
      ])
    );
  });

  test('flags interrupted and fragmented sessions', () => {
    const patterns = patternsFromSessions([
      session({ id: 'a', start_at: '2026-08-28T09:00:00.000Z', duration_seconds: 120, pause_count: 3 }),
      session({ id: 'b', start_at: '2026-08-28T10:00:00.000Z', duration_seconds: 90, pause_count: 2 }),
    ]);
    expect(patterns.map((pattern) => pattern.id)).toEqual(expect.arrayContaining(['pauses', 'short']));
  });

  test('counts a streak from consecutive UTC days', () => {
    const today = new Date().toISOString().slice(0, 10);
    const yesterday = new Date(Date.now() - 86_400_000).toISOString().slice(0, 10);
    expect(
      streakFromSessions([
        session({ id: 'today', start_at: `${today}T08:00:00.000Z` }),
        session({ id: 'yesterday', start_at: `${yesterday}T18:00:00.000Z` }),
      ])
    ).toBe(2);
  });

  test('splits a block across hourly Screen Time bars', () => {
    const buckets = hourlyBucketsFromSessions(
      [
        session({
          id: 'span',
          start_at: '2026-08-28T10:45:00.000Z',
          end_at: '2026-08-28T12:15:00.000Z',
          duration_seconds: 90 * 60,
        }),
      ],
      new Date('2026-08-28T12:00:00.000Z')
    );
    const filled = buckets.filter((bucket) => bucket.seconds > 0);
    expect(filled.length).toBeGreaterThanOrEqual(2);
    expect(buckets.reduce((sum, bucket) => sum + bucket.seconds, 0)).toBe(90 * 60);
  });

  test('stacks hourly bars by session category', () => {
    const buckets = hourlyBucketsFromSessions(
      [
        session({
          id: 'code',
          start_at: '2026-08-28T10:00:00.000Z',
          end_at: '2026-08-28T10:20:00.000Z',
          duration_seconds: 20 * 60,
          category: 'Coding',
        }),
        session({
          id: 'write',
          start_at: '2026-08-28T10:20:00.000Z',
          end_at: '2026-08-28T10:40:00.000Z',
          duration_seconds: 20 * 60,
          category: 'Writing',
        }),
      ],
      new Date('2026-08-28T12:00:00.000Z')
    );
    const stacked = buckets.find((bucket) => bucket.segments.length === 2);
    expect(stacked?.segments.map((segment) => segment.category).sort()).toEqual(['Coding', 'Writing']);
  });

  test('stacks hourly bars by Screen Time category instead of app names', () => {
    const day = new Date('2026-08-28T12:00:00');
    const usage: StoredAppUsage[] = [
      {
        day: '2026-08-28',
        hour: 10,
        app_id: 'safari',
        app_name: 'Safari',
        bundle_id: 'com.apple.mobilesafari',
        seconds: 900,
        is_focus: 0,
        captured_at: '2026-08-28T12:00:00.000Z',
      },
      {
        day: '2026-08-28',
        hour: 10,
        app_id: 'xcode',
        app_name: 'Xcode',
        bundle_id: 'com.apple.dt.Xcode',
        seconds: 600,
        is_focus: 1,
        captured_at: '2026-08-28T12:00:00.000Z',
      },
    ];
    const buckets = hourlyBucketsFromSources(
      [
        session({
          id: 'block',
          start_at: '2026-08-28T10:00:00',
          end_at: '2026-08-28T10:30:00',
          duration_seconds: 30 * 60,
          category: 'General',
        }),
      ],
      usage,
      day
    );
    expect(buckets[10].segments.map((segment) => segment.category).sort()).toEqual([
      'Productivity',
      'Reading',
    ]);
    expect(buckets[10].seconds).toBe(1500);
  });

  test('keeps the five categories with the most time', () => {
    const buckets = Array.from({ length: 24 }, (_, hour) => ({
      hour,
      seconds: hour === 10 ? 2100 : 0,
      segments:
        hour === 10
          ? [
              { category: 'Social', seconds: 800 },
              { category: 'Entertainment', seconds: 500 },
              { category: 'Reading', seconds: 300 },
              { category: 'Productivity', seconds: 200 },
              { category: 'Creativity', seconds: 150 },
              { category: 'Games', seconds: 100 },
              { category: 'Other', seconds: 50 },
            ]
          : [],
    }));
    expect(topUsageCategories(buckets).map((row) => row.name)).toEqual([
      'Social',
      'Entertainment',
      'Reading',
      'Productivity',
      'Creativity',
    ]);
  });

  test('names apps that overlap a saved session', () => {
    const apps = appsDuringSession(
      session({
        id: 'block',
        start_at: '2026-08-28T10:00:00',
        end_at: '2026-08-28T10:30:00',
        duration_seconds: 30 * 60,
      }),
      [
        {
          day: '2026-08-28',
          hour: 10,
          app_id: 'safari',
          app_name: 'Safari',
          bundle_id: null,
          seconds: 1800,
          is_focus: 0,
          captured_at: '2026-08-28T12:00:00.000Z',
        },
      ]
    );
    expect(apps[0]?.name).toBe('Safari');
  });

  test('uses a full day when activity spans eight hours, otherwise eight nearby hours', () => {
    const empty = Array.from({ length: 24 }, (_, hour) => ({ hour, seconds: 0, segments: [] }));
    expect(visibleHourBuckets(empty, 14)).toEqual(empty.slice(11, 19));

    const clustered = empty.map((bucket) =>
      bucket.hour === 10 ? { ...bucket, seconds: 600 } : bucket
    );
    expect(visibleHourBuckets(clustered, 22).map((bucket) => bucket.hour)).toEqual([7, 8, 9, 10, 11, 12, 13, 14]);

    const spread = empty.map((bucket) =>
      bucket.hour === 8 || bucket.hour === 17 ? { ...bucket, seconds: 300 } : bucket
    );
    expect(visibleHourBuckets(spread, 12)).toHaveLength(24);
  });

  test('marks weekdays with sessions', () => {
    const days = weekActivityFromSessions(
      [session({ id: 'a', start_at: '2026-08-28T09:00:00.000Z', duration_seconds: 600 })],
      new Date('2026-08-28T12:00:00.000Z')
    );
    expect(days).toHaveLength(7);
    expect(days.some((day) => day.used)).toBe(true);
  });
});
