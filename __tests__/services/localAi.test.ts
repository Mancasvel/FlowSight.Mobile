import { describe, expect, test } from 'vitest';
import { parseLocalNote, parseLocalQa, factsAreInStats } from '@/services/localInsightsStats';
import { resolveQaFromModelOutput } from '@/services/localInsightsQa';
import { QA_REFUSAL } from '@/services/localAi/schemas';
import { partPath, percentOf, weightComplete, QWEN_WEIGHT } from '@/services/localAi/assets';
import {
  extractInsightSignal,
  isMeaningfulSession,
  sanitizeLockScreen,
  shouldSkipNudge,
  templateForSignal,
} from '@/services/localInsightNudge';
import type { StoredSession } from '@/services/sessionInsights';

const sessions: StoredSession[] = [
  {
    id: 'a',
    start_at: '2026-09-10T09:00:00',
    end_at: '2026-09-10T09:45:00',
    duration_seconds: 45 * 60,
    pause_count: 0,
    category: 'Coding',
  },
  {
    id: 'b',
    start_at: '2026-09-10T14:00:00',
    end_at: '2026-09-10T14:04:00',
    duration_seconds: 240,
    pause_count: 3,
    category: 'Slack',
  },
];

describe('qwen assets', () => {
  test('part path keeps the gguf extension', () => {
    expect(partPath('/models/Qwen_Qwen3-0.6B-Q4_K_M.gguf')).toBe(
      '/models/Qwen_Qwen3-0.6B-Q4_K_M.gguf.part'
    );
  });

  test('weight is complete only at the pinned size', () => {
    expect(weightComplete(QWEN_WEIGHT.sizeBytes)).toBe(true);
    expect(weightComplete(12)).toBe(false);
    expect(percentOf(242_110_160, QWEN_WEIGHT.sizeBytes)).toBe(50);
  });
});

describe('note and qa parsers', () => {
  test('reads a week note from combined JSON', () => {
    const note = parseLocalNote({
      note: 'Most deep work started at 09:00. One afternoon block was paused three times. Protect the morning slot and batch chat.',
    });
    expect(note).toContain('09:00');
  });

  test('refuses ungrounded answers', () => {
    const stats = 'PERIOD: 2026-09-04 to 2026-09-10 (7 days)\nPAUSES: 3';
    const refused = resolveQaFromModelOutput(
      { answer: 'You should meditate more and call your manager.', grounded: true, used_facts: ['calendar'] },
      stats
    );
    expect(refused.grounded).toBe(false);
    expect(refused.answer).toBe(QA_REFUSAL);
  });

  test('accepts answers that cite STATS tokens', () => {
    const stats = 'HEALTH: interrupted: 1 | PAUSES: 3';
    const parsed = parseLocalQa({
      answer: 'You paused 3 times across interrupted blocks this week.',
      grounded: true,
      used_facts: ['PAUSES: 3'],
    });
    expect(parsed?.grounded).toBe(true);
    expect(factsAreInStats(parsed?.usedFacts ?? [], stats)).toBe(true);
  });
});

describe('insight nudges', () => {
  test('skips tiny sessions', () => {
    expect(isMeaningfulSession(40, 0)).toBe(false);
    expect(isMeaningfulSession(12 * 60, 0)).toBe(true);
    expect(isMeaningfulSession(6 * 60, 2)).toBe(true);
  });

  test('picks pauses over other signals and keeps lock-screen copy generic', () => {
    expect(extractInsightSignal(sessions, [])).toBe('pauses');
    const candidate = templateForSignal('pauses', sessions);
    expect(candidate?.body).toMatch(/paused/);
    expect(sanitizeLockScreen('Instagram ate 2h', ['Instagram'])).toBe('an app ate 2h');
  });

  test('enforces one ping per day and 7-day signal dedupe', () => {
    expect(
      shouldSkipNudge({
        enabled: true,
        today: '2026-09-10',
        lastDay: '2026-09-10',
        lastSignalId: 'pauses',
        lastFingerprint: 'abc',
        fingerprint: 'def',
        mutedUntil: null,
        seenCardIdsToday: [],
        cardId: 'pauses',
        signalId: 'pauses',
      })
    ).toBe(true);
    expect(
      shouldSkipNudge({
        enabled: true,
        today: '2026-09-12',
        lastDay: '2026-09-10',
        lastSignalId: 'pauses',
        lastFingerprint: 'abc',
        fingerprint: 'def',
        mutedUntil: null,
        seenCardIdsToday: [],
        cardId: 'pauses',
        signalId: 'pauses',
      })
    ).toBe(true);
    expect(
      shouldSkipNudge({
        enabled: true,
        today: '2026-09-20',
        lastDay: '2026-09-10',
        lastSignalId: 'pauses',
        lastFingerprint: 'abc',
        fingerprint: 'def',
        mutedUntil: null,
        seenCardIdsToday: [],
        cardId: 'short',
        signalId: 'short',
      })
    ).toBe(false);
  });
});
