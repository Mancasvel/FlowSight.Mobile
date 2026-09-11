/**
 * On-device AI writing consent (EU AI Act Art. 50 transparency).
 * FlowSight is a limited-risk deployer of a general-purpose model, not the GPAI provider.
 * Default is off until the user accepts the current notice version.
 */

import { getPreference, setPreference } from '@/storage';

export const ON_DEVICE_AI_NOTICE_VERSION = 'ai-act-2026-09';
export const ON_DEVICE_AI_EVENT_LOG_CAP = 50;

const ENABLED_KEY = 'on_device_ai_enabled';
const NOTICE_KEY = 'on_device_ai_notice_version';
const NOTICE_AT_KEY = 'on_device_ai_notice_at';
const LOG_KEY = 'on_device_ai_event_log';

export const ON_DEVICE_AI_NOTICE_TITLE = 'On-device AI writing';

export const ON_DEVICE_AI_NOTICE_BODY =
  "Insights, this week's note, and Ask this iPhone can be written by an on-device AI model (Qwen3-0.6B or Apple Intelligence). Outputs can be wrong. They are suggestions, not professional advice.\n\n" +
  'Usage STATS stay on this iPhone. This is not cloud coaching. FlowSight runs inference on this device and is not the provider of that general-purpose AI model. Qwen3-0.6B is Apache-2.0 (Alibaba/Qwen weights via bartowski GGUF).\n\n' +
  'You can turn this off in You or Settings and keep session rules from your blocks.';

export const ON_DEVICE_AI_TOGGLE_CAPTION =
  'Insights, notes, and Ask can be written by Qwen3-0.6B or Apple Intelligence on this iPhone. Suggestions only. They can be wrong. Session rules stay if you turn this off.';

export const ON_DEVICE_AI_NUDGE_CAPTION =
  'At most one ping a day, usually in the evening. AI-assisted from local STATS. No app names on the lock screen. Needs on-device AI writing.';

export const ON_DEVICE_AI_OFF_DETAIL =
  'On-device AI writing is off. Session rules still work from your blocks.';

export type OnDeviceAiEngine = 'qwen' | 'apple' | 'none';
export type OnDeviceAiTask = 'patterns' | 'qa' | 'notify';

export type OnDeviceAiEvent = {
  at: string;
  engine: OnDeviceAiEngine;
  task: OnDeviceAiTask;
  fingerprint: string;
};

export type OnDeviceAiConsent = {
  enabled: boolean;
  writingFlag: boolean;
  noticeVersion: string;
  noticeCurrent: boolean;
  acceptedAt: string;
};

export function isOnDeviceAiNoticeCurrent(version: string | null | undefined): boolean {
  return version === ON_DEVICE_AI_NOTICE_VERSION;
}

export function isOnDeviceAiWritingAllowed(input: {
  enabled: boolean;
  noticeVersion: string | null | undefined;
}): boolean {
  return input.enabled === true && isOnDeviceAiNoticeCurrent(input.noticeVersion);
}

export async function getOnDeviceAiConsent(): Promise<OnDeviceAiConsent> {
  const [flag, version, acceptedAt] = await Promise.all([
    getPreference(ENABLED_KEY),
    getPreference(NOTICE_KEY),
    getPreference(NOTICE_AT_KEY),
  ]);
  const writingFlag = flag === 'true';
  const noticeVersion = version ?? '';
  const noticeCurrent = isOnDeviceAiNoticeCurrent(noticeVersion);
  return {
    enabled: isOnDeviceAiWritingAllowed({ enabled: writingFlag, noticeVersion }),
    writingFlag,
    noticeVersion,
    noticeCurrent,
    acceptedAt: acceptedAt ?? '',
  };
}

export async function isOnDeviceAiEnabled(): Promise<boolean> {
  try {
    const consent = await getOnDeviceAiConsent();
    return consent.enabled;
  } catch {
    return false;
  }
}

export async function acceptOnDeviceAiNotice(): Promise<boolean> {
  const now = new Date().toISOString();
  await setPreference(NOTICE_KEY, ON_DEVICE_AI_NOTICE_VERSION);
  await setPreference(NOTICE_AT_KEY, now);
  await setPreference(ENABLED_KEY, 'true');
  return true;
}

export async function deferOnDeviceAiNotice(): Promise<void> {
  await setPreference(ENABLED_KEY, 'false');
}

export async function setOnDeviceAiEnabled(enabled: boolean): Promise<boolean> {
  if (enabled) {
    const version = await getPreference(NOTICE_KEY);
    if (!isOnDeviceAiNoticeCurrent(version)) {
      return false;
    }
    await setPreference(ENABLED_KEY, 'true');
    return true;
  }

  await setPreference(ENABLED_KEY, 'false');
  try {
    const { setInsightNudgesEnabled } = await import('@/services/localInsightNotify');
    await setInsightNudgesEnabled(false);
  } catch {
    // Best-effort: writing off even if the nudge module is unavailable.
  }
  return false;
}

export function sanitizeOnDeviceAiEvent(value: unknown): OnDeviceAiEvent | null {
  if (!value || typeof value !== 'object') return null;
  const row = value as Record<string, unknown>;
  const engine = row.engine;
  const task = row.task;
  const at = typeof row.at === 'string' ? row.at.slice(0, 40) : '';
  const fingerprint = typeof row.fingerprint === 'string' ? row.fingerprint.replace(/[^a-fA-F0-9]/g, '').slice(0, 32) : '';
  if (!at || !fingerprint) return null;
  if (engine !== 'qwen' && engine !== 'apple' && engine !== 'none') return null;
  if (task !== 'patterns' && task !== 'qa' && task !== 'notify') return null;
  return { at, engine, task, fingerprint };
}

export function parseOnDeviceAiEventLog(raw: string | null | undefined): OnDeviceAiEvent[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map(sanitizeOnDeviceAiEvent)
      .filter((event): event is OnDeviceAiEvent => event != null)
      .slice(-ON_DEVICE_AI_EVENT_LOG_CAP);
  } catch {
    return [];
  }
}

export function appendOnDeviceAiEvent(
  log: OnDeviceAiEvent[],
  event: OnDeviceAiEvent,
  cap = ON_DEVICE_AI_EVENT_LOG_CAP
): OnDeviceAiEvent[] {
  const next = sanitizeOnDeviceAiEvent(event);
  if (!next) return log.slice(-cap);
  return [...log, next].slice(-cap);
}

export async function getOnDeviceAiEventLog(): Promise<OnDeviceAiEvent[]> {
  try {
    return parseOnDeviceAiEventLog(await getPreference(LOG_KEY));
  } catch {
    return [];
  }
}

export async function logOnDeviceAiEvent(event: {
  engine: OnDeviceAiEngine;
  task: OnDeviceAiTask;
  fingerprint: string;
  at?: string;
}): Promise<void> {
  const nextEvent = sanitizeOnDeviceAiEvent({
    at: event.at ?? new Date().toISOString(),
    engine: event.engine,
    task: event.task,
    fingerprint: event.fingerprint,
  });
  if (!nextEvent) return;
  const log = await getOnDeviceAiEventLog();
  await setPreference(LOG_KEY, JSON.stringify(appendOnDeviceAiEvent(log, nextEvent)));
}

export function onDeviceAiExportPayload(input: {
  enabled: boolean;
  noticeVersion: string;
  events: OnDeviceAiEvent[];
}): Record<string, unknown> {
  return {
    enabled: input.enabled,
    noticeVersion: input.noticeVersion,
    model: {
      name: 'Qwen3-0.6B',
      license: 'Apache-2.0',
      weights: 'Alibaba/Qwen via bartowski GGUF',
      inference: 'on-device',
      appleFallback: 'Apple Intelligence SystemLanguageModel when available',
      flowSightRole: 'deployer-not-provider',
    },
    events: input.events,
    privacyNote:
      'Event log stores time, engine id, task, and a STATS fingerprint only. No prompts, completions, or usage content.',
  };
}

export function onDeviceAiOutputLabel(engine: OnDeviceAiEngine): string {
  if (engine === 'apple') {
    return 'AI-generated on this iPhone with Apple Intelligence. Usage never left the device.';
  }
  return 'AI-generated on this iPhone (Qwen3-0.6B). Usage never left the device.';
}
