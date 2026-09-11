import { getPreference, setPreference } from '@/storage';
import { isOnDeviceAiEnabled, logOnDeviceAiEvent } from '@/privacy/onDeviceAi';
import { localDateKey } from '@/utils/format';
import {
  extractInsightSignal,
  isMeaningfulSession,
  shouldSkipNudge,
  templateForSignal,
  type InsightNudgeCandidate,
} from '@/services/localInsightNudge';
import { loadLocalPatterns } from '@/services/localInsights';
import { type StoredAppUsage, type StoredSession } from '@/services/sessionInsights';
import { scheduleInsightNotification } from '@/services/notifications';

const ENABLED_KEY = 'insights_nudge_enabled';
const STATE_KEY = 'insights_nudge_state';

export type InsightNudgeState = {
  lastDay: string | null;
  lastSignalId: string | null;
  lastCardId: string | null;
  lastFingerprint: string | null;
  mutedUntil: string | null;
  seenCardIdsToday: string[];
  seenDay: string | null;
};

const EMPTY_STATE: InsightNudgeState = {
  lastDay: null,
  lastSignalId: null,
  lastCardId: null,
  lastFingerprint: null,
  mutedUntil: null,
  seenCardIdsToday: [],
  seenDay: null,
};

export async function areInsightNudgesEnabled(): Promise<boolean> {
  try {
    return (await getPreference(ENABLED_KEY)) === 'true';
  } catch {
    return false;
  }
}

export async function setInsightNudgesEnabled(enabled: boolean): Promise<boolean> {
  if (enabled && !(await isOnDeviceAiEnabled())) {
    await setPreference(ENABLED_KEY, 'false');
    await scheduleInsightNotification(null);
    return false;
  }
  await setPreference(ENABLED_KEY, enabled ? 'true' : 'false');
  if (!enabled) {
    await scheduleInsightNotification(null);
  }
  return enabled;
}

export async function markInsightCardsSeen(cardIds: string[], now = new Date()): Promise<void> {
  const today = localDateKey(now);
  const state = await readState();
  const seen = state.seenDay === today ? state.seenCardIdsToday : [];
  await writeState({
    ...state,
    seenDay: today,
    seenCardIdsToday: [...new Set([...seen, ...cardIds])],
  });
}

export async function maybePrepareInsightNudge(input: {
  durationSeconds?: number;
  pauseCount?: number;
  sessions: StoredSession[];
  appUsage: StoredAppUsage[];
  now?: Date;
}): Promise<void> {
  if (input.durationSeconds != null && input.pauseCount != null) {
    if (!isMeaningfulSession(input.durationSeconds, input.pauseCount)) return;
  }
  if (!(await isOnDeviceAiEnabled())) return;
  if (!(await areInsightNudgesEnabled())) return;

  const now = input.now ?? new Date();
  const today = localDateKey(now);
  const result = await loadLocalPatterns({ sessions: input.sessions, appUsage: input.appUsage, now });
  const signal = extractInsightSignal(input.sessions, input.appUsage, now);
  const candidate = templateForSignal(signal, input.sessions);
  if (!candidate) return;

  const state = await readState();
  const seen = state.seenDay === today ? state.seenCardIdsToday : [];
  if (
    shouldSkipNudge({
      enabled: true,
      today,
      lastDay: state.lastDay,
      lastSignalId: state.lastSignalId,
      lastFingerprint: state.lastFingerprint,
      fingerprint: result.fingerprint,
      mutedUntil: state.mutedUntil,
      seenCardIdsToday: seen,
      cardId: candidate.cardId,
      signalId: candidate.signalId,
    })
  ) {
    return;
  }

  const scheduled = await scheduleInsightNotification(candidate);
  if (!scheduled) return;

  void logOnDeviceAiEvent({
    engine: result.engine,
    task: 'notify',
    fingerprint: result.fingerprint,
  });

  await writeState({
    ...state,
    lastDay: today,
    lastSignalId: candidate.signalId,
    lastCardId: candidate.cardId,
    lastFingerprint: result.fingerprint,
    seenDay: today,
    seenCardIdsToday: seen,
  });
}

async function readState(): Promise<InsightNudgeState> {
  try {
    const raw = await getPreference(STATE_KEY);
    if (!raw) return EMPTY_STATE;
    return { ...EMPTY_STATE, ...(JSON.parse(raw) as Partial<InsightNudgeState>) };
  } catch {
    return EMPTY_STATE;
  }
}

async function writeState(state: InsightNudgeState) {
  await setPreference(STATE_KEY, JSON.stringify(state));
}

export type { InsightNudgeCandidate };
