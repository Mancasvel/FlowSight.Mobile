import { Platform } from 'react-native';
import {
  generateLocalPatternText,
  getLocalAIStatus,
  isLocalAIModuleAvailable,
} from 'flowsight-local-ai';
import { isOnDeviceAiEnabled, ON_DEVICE_AI_OFF_DETAIL } from '@/privacy/onDeviceAi';
import { isQwenWeightReady, getModelDestUri } from '@/services/localAi/download';
import { runLocalInference } from '@/services/localAi/queue';
import { completeWithQwen, isLlamaAvailable } from '@/services/localAi/qwen';
import { PATTERNS_AND_NOTE_SCHEMA, QA_SCHEMA } from '@/services/localAi/schemas';

export type LocalEngineId = 'qwen' | 'apple' | 'none';

export type EngineChoice = {
  engine: LocalEngineId;
  available: boolean;
  reason: string;
  detail?: string;
  canDownload: boolean;
};

function isPhysicalIos(): boolean {
  if (Platform.OS !== 'ios') return false;
  try {
    const Device = require('expo-device') as { isDevice?: boolean };
    if (typeof Device.isDevice === 'boolean') return Device.isDevice;
  } catch {
    // expo-device optional at test time
  }
  return true;
}

export function engineChoiceWhenAiOff(): EngineChoice {
  return {
    engine: 'none',
    available: false,
    reason: 'opted-out',
    detail: ON_DEVICE_AI_OFF_DETAIL,
    canDownload: false,
  };
}

export async function pickEngine(): Promise<EngineChoice> {
  if (!(await isOnDeviceAiEnabled())) {
    return engineChoiceWhenAiOff();
  }

  const physical = isPhysicalIos();
  const qwenReady = physical && (await isQwenWeightReady());
  if (qwenReady && isLlamaAvailable()) {
    return {
      engine: 'qwen',
      available: true,
      reason: 'ready',
      detail: 'Qwen3-0.6B on this iPhone.',
      canDownload: false,
    };
  }

  if (isLocalAIModuleAvailable()) {
    const apple = await getLocalAIStatus();
    if (apple.available) {
      return {
        engine: 'apple',
        available: true,
        reason: 'ready',
        detail: apple.detail ?? 'Apple Intelligence on this iPhone.',
        canDownload: false,
      };
    }
    if (apple.reason === 'not-ready') {
      return {
        engine: 'none',
        available: false,
        reason: 'not-ready',
        detail: apple.detail,
        canDownload: physical,
      };
    }
  }

  return {
    engine: 'none',
    available: false,
    reason: physical ? 'missing-weights' : 'simulator',
    detail: physical
      ? 'Download the on-device model to write from STATS.'
      : 'On-device writing is not in Simulator. Session rules still work from your blocks.',
    canDownload: physical && isLlamaAvailable(),
  };
}

export async function generateOnDevice(input: {
  kind: 'patterns' | 'qa';
  stats: string;
  question?: string;
}): Promise<{ ok: boolean; text?: string; engine: LocalEngineId; detail?: string; reason?: string }> {
  if (!(await isOnDeviceAiEnabled())) {
    const off = engineChoiceWhenAiOff();
    return { ok: false, engine: 'none', reason: off.reason, detail: off.detail };
  }

  const choice = await pickEngine();
  if (!choice.available) {
    return { ok: false, engine: 'none', reason: choice.reason, detail: choice.detail };
  }

  if (choice.engine === 'apple') {
    const raw = await generateLocalPatternText(
      input.kind === 'qa' ? `${input.question ?? ''}\n\nSTATS:\n${input.stats}` : input.stats
    );
    return {
      ok: raw.ok,
      text: raw.text,
      engine: 'apple',
      reason: raw.reason,
      detail: raw.detail,
    };
  }

  const dest = await getModelDestUri();
  if (!dest) {
    return { ok: false, engine: 'none', reason: 'missing-weights', detail: 'Model file is missing.' };
  }

  return runLocalInference(async () => {
    try {
      const text = await completeWithQwen({
        modelPath: dest,
        stats: input.stats,
        kind: input.kind,
        question: input.question,
        schema: input.kind === 'qa' ? QA_SCHEMA : PATTERNS_AND_NOTE_SCHEMA,
        nPredict: input.kind === 'qa' ? 192 : 400,
      });
      return { ok: true, text, engine: 'qwen' as const };
    } catch (error) {
      return {
        ok: false,
        engine: 'qwen' as const,
        reason: 'error',
        detail: error instanceof Error ? error.message : 'On-device generation failed.',
      };
    }
  });
}
