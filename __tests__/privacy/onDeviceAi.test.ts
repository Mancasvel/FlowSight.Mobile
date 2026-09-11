import { describe, expect, test, vi, beforeEach } from 'vitest';

const storage = vi.hoisted(() => ({
  getPreference: vi.fn(),
  setPreference: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@/storage', () => storage);

import {
  ON_DEVICE_AI_NOTICE_VERSION,
  appendOnDeviceAiEvent,
  isOnDeviceAiNoticeCurrent,
  isOnDeviceAiWritingAllowed,
  onDeviceAiExportPayload,
  onDeviceAiOutputLabel,
  parseOnDeviceAiEventLog,
  sanitizeOnDeviceAiEvent,
  getOnDeviceAiConsent,
  setOnDeviceAiEnabled,
  acceptOnDeviceAiNotice,
} from '@/privacy/onDeviceAi';

describe('on-device AI notice', () => {
  test('pins the AI Act notice version', () => {
    expect(ON_DEVICE_AI_NOTICE_VERSION).toBe('ai-act-2026-09');
    expect(isOnDeviceAiNoticeCurrent('ai-act-2026-09')).toBe(true);
    expect(isOnDeviceAiNoticeCurrent('2026-08-28')).toBe(false);
    expect(isOnDeviceAiNoticeCurrent('')).toBe(false);
  });

  test('keeps writing off until the current notice is accepted', () => {
    expect(isOnDeviceAiWritingAllowed({ enabled: false, noticeVersion: 'ai-act-2026-09' })).toBe(false);
    expect(isOnDeviceAiWritingAllowed({ enabled: true, noticeVersion: 'old' })).toBe(false);
    expect(isOnDeviceAiWritingAllowed({ enabled: true, noticeVersion: 'ai-act-2026-09' })).toBe(true);
  });

  test('labels Apple and Qwen outputs as AI-generated on this iPhone', () => {
    expect(onDeviceAiOutputLabel('apple')).toMatch(/AI-generated on this iPhone/);
    expect(onDeviceAiOutputLabel('qwen')).toMatch(/Qwen3-0.6B/);
    expect(onDeviceAiOutputLabel('qwen')).not.toMatch(/\bCE\b|certified|high-risk/i);
  });
});

describe('on-device AI event log', () => {
  test('keeps only at, engine, task, and fingerprint', () => {
    const stored = sanitizeOnDeviceAiEvent({
      at: '2026-09-10T12:00:00.000Z',
      engine: 'qwen',
      task: 'patterns',
      fingerprint: 'abc123',
      prompt: 'STATS: secret',
      completion: 'You should fire your teammate',
      stats: 'SESSIONS: 2',
    });
    expect(stored).toEqual({
      at: '2026-09-10T12:00:00.000Z',
      engine: 'qwen',
      task: 'patterns',
      fingerprint: 'abc123',
    });
    expect(JSON.stringify(stored)).not.toMatch(/prompt|completion|STATS|secret/i);
  });

  test('caps the log and drops invalid rows', () => {
    const seed = Array.from({ length: 50 }, (_, index) => ({
      at: `2026-09-10T12:00:00.${String(index).padStart(3, '0')}Z`,
      engine: 'qwen' as const,
      task: 'qa' as const,
      fingerprint: 'aa',
    }));
    const next = appendOnDeviceAiEvent(seed, {
      at: '2026-09-10T13:00:00.000Z',
      engine: 'apple',
      task: 'notify',
      fingerprint: 'bb',
    });
    expect(next).toHaveLength(50);
    expect(next[0]?.fingerprint).toBe('aa');
    expect(next[49]).toMatchObject({ engine: 'apple', task: 'notify', fingerprint: 'bb' });
    expect(parseOnDeviceAiEventLog(JSON.stringify([{ task: 'hack' }, next[49]]))).toEqual([next[49]]);
  });

  test('export payload includes the log shape without claiming certification', () => {
    const payload = onDeviceAiExportPayload({
      enabled: true,
      noticeVersion: ON_DEVICE_AI_NOTICE_VERSION,
      events: [
        { at: '2026-09-10T12:00:00.000Z', engine: 'qwen', task: 'patterns', fingerprint: 'deadbeef' },
      ],
    });
    expect(payload.events).toEqual([
      { at: '2026-09-10T12:00:00.000Z', engine: 'qwen', task: 'patterns', fingerprint: 'deadbeef' },
    ]);
    expect(payload.model).toMatchObject({
      name: 'Qwen3-0.6B',
      license: 'Apache-2.0',
      inference: 'on-device',
      flowSightRole: 'deployer-not-provider',
    });
    expect(JSON.stringify(payload)).not.toMatch(/CE mark|certified|notified body/i);
  });
});

describe('on-device AI preferences', () => {
  beforeEach(() => {
    storage.getPreference.mockReset();
    storage.setPreference.mockReset();
    storage.setPreference.mockResolvedValue(undefined);
  });

  test('consent is off when the preference is missing', async () => {
    storage.getPreference.mockResolvedValue(null);
    const consent = await getOnDeviceAiConsent();
    expect(consent.enabled).toBe(false);
    expect(consent.noticeCurrent).toBe(false);
  });

  test('toggling on without the current notice is a no-op', async () => {
    storage.getPreference.mockResolvedValue('old-notice');
    await expect(setOnDeviceAiEnabled(true)).resolves.toBe(false);
    expect(storage.setPreference).not.toHaveBeenCalledWith('on_device_ai_enabled', 'true');
  });

  test('toggling on works after the current notice is stored', async () => {
    storage.getPreference.mockResolvedValue('ai-act-2026-09');
    await expect(setOnDeviceAiEnabled(true)).resolves.toBe(true);
    expect(storage.setPreference).toHaveBeenCalledWith('on_device_ai_enabled', 'true');
  });

  test('accept stamps the notice version and enables writing', async () => {
    await acceptOnDeviceAiNotice();
    expect(storage.setPreference).toHaveBeenCalledWith('on_device_ai_notice_version', 'ai-act-2026-09');
    expect(storage.setPreference).toHaveBeenCalledWith('on_device_ai_enabled', 'true');
  });
});
