/**
 * On-device Insights: STATS snapshot → local model → JSON cards + short note.
 * Cloud coach / OpenRouter are never used here. Rule-based patterns stay the fallback.
 */

import { getPreference, setPreference } from '@/storage';
import { isOnDeviceAiEnabled, logOnDeviceAiEvent } from '@/privacy/onDeviceAi';
import { generateOnDevice, pickEngine, type LocalEngineId } from '@/services/localAi/engine';
import { resolveQaFromModelOutput } from '@/services/localInsightsQa';
import { patternsFromSessions, type SessionPattern, type StoredAppUsage, type StoredSession } from '@/services/sessionInsights';
import {
  buildLocalStatsSnapshot,
  fingerprintStats,
  parseLocalNote,
  resolvePatternsFromModelOutput,
} from '@/services/localInsightsStats';

const CACHE_KEY = 'local_insights_cache_v2';
const GENERATE_TIMEOUT_MS = 45_000;
const QA_TIMEOUT_MS = 20_000;
const SCHEMA_VERSION = 1;

export type LocalPatternStatus = 'unavailable' | 'loading' | 'ready' | 'fallback' | 'download' | 'opted-out';

export type LocalPatternResult = {
  patterns: SessionPattern[];
  note: string | null;
  status: LocalPatternStatus;
  source: 'on-device' | 'rules';
  engine: LocalEngineId;
  detail?: string;
  fingerprint: string;
  canDownload: boolean;
};

type CachePayload = {
  fingerprint: string;
  schemaVersion: number;
  engine: LocalEngineId;
  patterns: SessionPattern[];
  note: string | null;
  generatedAt: string;
};

let inFlight: Promise<LocalPatternResult> | null = null;
let inFlightFingerprint = '';

export async function loadLocalPatterns(input: {
  sessions: StoredSession[];
  appUsage: StoredAppUsage[];
  now?: Date;
}): Promise<LocalPatternResult> {
  const fallback = patternsFromSessions(input.sessions);
  const stats = buildLocalStatsSnapshot(input.sessions, input.appUsage, input.now);
  const fingerprint = fingerprintStats(stats);
  const choice = await pickEngine();

  if (choice.reason === 'opted-out') {
    return {
      patterns: fallback,
      note: null,
      status: 'opted-out',
      source: 'rules',
      engine: 'none',
      detail: choice.detail,
      fingerprint,
      canDownload: false,
    };
  }

  const cached = await readCache();
  if (
    cached &&
    cached.fingerprint === fingerprint &&
    cached.schemaVersion === SCHEMA_VERSION &&
    cached.patterns.length > 0 &&
    cached.engine === choice.engine &&
    choice.available
  ) {
    return {
      patterns: cached.patterns,
      note: cached.note,
      status: 'ready',
      source: 'on-device',
      engine: cached.engine,
      fingerprint,
      canDownload: false,
    };
  }

  if (!choice.available) {
    return {
      patterns: fallback,
      note: null,
      status: choice.reason === 'not-ready' ? 'loading' : choice.canDownload ? 'download' : 'unavailable',
      source: 'rules',
      engine: 'none',
      detail: choice.detail,
      fingerprint,
      canDownload: choice.canDownload,
    };
  }

  if (inFlight && inFlightFingerprint === fingerprint) {
    return inFlight;
  }

  inFlightFingerprint = fingerprint;
  inFlight = runGeneration(stats, fallback, fingerprint, choice.engine);
  try {
    return await inFlight;
  } finally {
    inFlight = null;
    inFlightFingerprint = '';
  }
}

export async function askLocalStats(input: {
  question: string;
  sessions: StoredSession[];
  appUsage: StoredAppUsage[];
  now?: Date;
}): Promise<{ answer: string; grounded: boolean; detail?: string; engine?: LocalEngineId }> {
  const stats = buildLocalStatsSnapshot(input.sessions, input.appUsage, input.now);
  if (!(await isOnDeviceAiEnabled())) {
    return {
      answer: 'On-device AI writing is off. Turn it on in You or Settings to ask about local STATS.',
      grounded: false,
      detail: 'On-device AI writing is off.',
      engine: 'none',
    };
  }
  try {
    const raw = await withTimeout(
      generateOnDevice({ kind: 'qa', stats, question: input.question.trim() }),
      QA_TIMEOUT_MS
    );
    if (!raw.ok || !raw.text) {
      return { answer: resolveQaFromModelOutput(null, stats).answer, grounded: false, detail: raw.detail, engine: raw.engine };
    }
    const resolved = resolveQaFromModelOutput({ text: raw.text }, stats);
    if (resolved.grounded) {
      void logOnDeviceAiEvent({ engine: raw.engine, task: 'qa', fingerprint: fingerprintStats(stats) });
    }
    return { ...resolved, engine: raw.engine };
  } catch (error) {
    return {
      answer: resolveQaFromModelOutput(null, stats).answer,
      grounded: false,
      detail: error instanceof Error ? error.message : 'That question timed out.',
      engine: 'none',
    };
  }
}

async function runGeneration(
  stats: string,
  fallback: SessionPattern[],
  fingerprint: string,
  engine: LocalEngineId
): Promise<LocalPatternResult> {
  try {
    const raw = await withTimeout(generateOnDevice({ kind: 'patterns', stats }), GENERATE_TIMEOUT_MS);
    if (!raw.ok) {
      return {
        patterns: fallback,
        note: null,
        status: raw.reason === 'not-ready' ? 'loading' : 'fallback',
        source: 'rules',
        engine,
        detail: raw.detail,
        fingerprint,
        canDownload: false,
      };
    }

    const resolved = resolvePatternsFromModelOutput(raw, fallback);
    const note = parseLocalNote(raw);
    if (resolved.source === 'on-device') {
      await writeCache({
        fingerprint,
        schemaVersion: SCHEMA_VERSION,
        engine,
        patterns: resolved.patterns,
        note,
        generatedAt: new Date().toISOString(),
      });
      void logOnDeviceAiEvent({ engine, task: 'patterns', fingerprint });
      return {
        patterns: resolved.patterns,
        note,
        status: 'ready',
        source: 'on-device',
        engine,
        fingerprint,
        canDownload: false,
      };
    }

    return {
      patterns: fallback,
      note: null,
      status: 'fallback',
      source: 'rules',
      engine,
      detail: 'On-device model returned no usable patterns.',
      fingerprint,
      canDownload: false,
    };
  } catch (error) {
    return {
      patterns: fallback,
      note: null,
      status: 'fallback',
      source: 'rules',
      engine,
      detail: error instanceof Error ? error.message : 'On-device generation failed.',
      fingerprint,
      canDownload: false,
    };
  }
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('On-device generation timed out.')), ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error) => {
        clearTimeout(timer);
        reject(error);
      }
    );
  });
}

async function readCache(): Promise<CachePayload | null> {
  try {
    const raw = await getPreference(CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CachePayload;
    if (!parsed?.fingerprint || !Array.isArray(parsed.patterns) || parsed.schemaVersion !== SCHEMA_VERSION) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

async function writeCache(payload: CachePayload) {
  try {
    await setPreference(CACHE_KEY, JSON.stringify(payload));
  } catch {
    // Cache is optional; Insights still shows the live result.
  }
}
