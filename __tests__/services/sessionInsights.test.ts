import { describe, expect, test, vi } from 'vitest';

vi.mock('@/storage', () => ({
  getDailyStats: vi.fn(),
  getRecentSessions: vi.fn(),
}));

import {
  patternsFromSessions,
  streakFromSessions,
  warningsForSession,
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
});
