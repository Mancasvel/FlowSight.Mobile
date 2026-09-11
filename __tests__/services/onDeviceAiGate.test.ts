import { beforeEach, describe, expect, test, vi } from 'vitest';

const onDeviceAi = vi.hoisted(() => ({
  isOnDeviceAiEnabled: vi.fn(),
  logOnDeviceAiEvent: vi.fn().mockResolvedValue(undefined),
  ON_DEVICE_AI_OFF_DETAIL: 'On-device AI writing is off. Session rules still work from your blocks.',
}));

const storage = vi.hoisted(() => ({
  getPreference: vi.fn().mockResolvedValue(null),
  setPreference: vi.fn().mockResolvedValue(undefined),
}));

const notifications = vi.hoisted(() => ({
  scheduleInsightNotification: vi.fn().mockResolvedValue(true),
}));

vi.mock('@/privacy/onDeviceAi', () => onDeviceAi);
vi.mock('@/storage', () => storage);
vi.mock('@/services/notifications', () => notifications);
vi.mock('react-native', () => ({ Platform: { OS: 'ios' } }));

import { engineChoiceWhenAiOff, generateOnDevice, pickEngine } from '@/services/localAi/engine';
import { ensureQwenWeight } from '@/services/localAi/download';
import { askLocalStats, loadLocalPatterns } from '@/services/localInsights';
import { maybePrepareInsightNudge, setInsightNudgesEnabled } from '@/services/localInsightNotify';
import { patternsFromSessions, type StoredSession } from '@/services/sessionInsights';

const sessions: StoredSession[] = [
  {
    id: 'a',
    start_at: '2026-09-10T09:00:00',
    end_at: '2026-09-10T09:45:00',
    duration_seconds: 45 * 60,
    pause_count: 0,
    category: 'Coding',
  },
];

describe('on-device AI off path', () => {
  beforeEach(() => {
    onDeviceAi.isOnDeviceAiEnabled.mockReset();
    onDeviceAi.logOnDeviceAiEvent.mockClear();
    storage.getPreference.mockReset();
    storage.getPreference.mockResolvedValue(null);
    notifications.scheduleInsightNotification.mockClear();
  });

  test('pickEngine does not select Qwen or Apple when writing is off', async () => {
    onDeviceAi.isOnDeviceAiEnabled.mockResolvedValue(false);
    const choice = await pickEngine();
    expect(choice).toEqual(engineChoiceWhenAiOff());
    expect(choice.engine).toBe('none');
    expect(choice.available).toBe(false);
    expect(choice.canDownload).toBe(false);
    expect(choice.reason).toBe('opted-out');
  });

  test('generateOnDevice does not run when writing is off', async () => {
    onDeviceAi.isOnDeviceAiEnabled.mockResolvedValue(false);
    const result = await generateOnDevice({ kind: 'patterns', stats: 'SESSIONS: 1' });
    expect(result.ok).toBe(false);
    expect(result.engine).toBe('none');
    expect(result.reason).toBe('opted-out');
    expect(onDeviceAi.logOnDeviceAiEvent).not.toHaveBeenCalled();
  });

  test('ensureQwenWeight refuses to download when writing is off', async () => {
    onDeviceAi.isOnDeviceAiEnabled.mockResolvedValue(false);
    await expect(ensureQwenWeight()).rejects.toThrow(/on-device AI writing is off/i);
  });

  test('loadLocalPatterns stays on session rules and never logs an AI event', async () => {
    onDeviceAi.isOnDeviceAiEnabled.mockResolvedValue(false);
    const result = await loadLocalPatterns({ sessions, appUsage: [] });
    expect(result.status).toBe('opted-out');
    expect(result.source).toBe('rules');
    expect(result.engine).toBe('none');
    expect(result.canDownload).toBe(false);
    expect(result.patterns).toEqual(patternsFromSessions(sessions));
    expect(result.note).toBeNull();
    expect(onDeviceAi.logOnDeviceAiEvent).not.toHaveBeenCalled();
  });

  test('askLocalStats does not call the model when writing is off', async () => {
    onDeviceAi.isOnDeviceAiEnabled.mockResolvedValue(false);
    const result = await askLocalStats({ question: 'When do I pause most?', sessions, appUsage: [] });
    expect(result.grounded).toBe(false);
    expect(result.engine).toBe('none');
    expect(result.answer).toMatch(/on-device AI writing is off/i);
    expect(onDeviceAi.logOnDeviceAiEvent).not.toHaveBeenCalled();
  });

  test('insight nudges no-op when writing is off', async () => {
    onDeviceAi.isOnDeviceAiEnabled.mockResolvedValue(false);
    storage.getPreference.mockResolvedValue('true');
    await maybePrepareInsightNudge({
      durationSeconds: 20 * 60,
      pauseCount: 0,
      sessions,
      appUsage: [],
    });
    expect(notifications.scheduleInsightNotification).not.toHaveBeenCalled();
    expect(onDeviceAi.logOnDeviceAiEvent).not.toHaveBeenCalled();
  });

  test('insight nudge toggle cannot enable while writing is off', async () => {
    onDeviceAi.isOnDeviceAiEnabled.mockResolvedValue(false);
    await expect(setInsightNudgesEnabled(true)).resolves.toBe(false);
    expect(storage.setPreference).toHaveBeenCalledWith('insights_nudge_enabled', 'false');
  });
});
