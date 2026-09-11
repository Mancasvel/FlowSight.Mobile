/**
 * Apple Intelligence stand-in plus SHA-256 for the Qwen GGUF download.
 * Qwen3-0.6B inference runs in JS via llama.rn, not here.
 */

import { Platform } from 'react-native';

export const APPLE_ENGINE_ID = 'apple-foundation-models';

export type LocalAIStatus = {
  available: boolean;
  reason: string;
  engine: string;
  modelId: string;
  detail?: string;
};

export type LocalAIGenerateResult = {
  ok: boolean;
  text?: string;
  engine?: string;
  modelId?: string;
  reason?: string;
  detail?: string;
};

type NativeModule = {
  getStatus: () => Promise<LocalAIStatus>;
  generatePatterns: (stats: string) => Promise<LocalAIGenerateResult>;
  sha256File: (path: string) => Promise<string>;
};

function getNative(): NativeModule | null {
  if (Platform.OS !== 'ios') return null;
  try {
    const core = require('expo-modules-core') as Record<string, unknown>;
    const optional = core.requireOptionalNativeModule as
      | ((name: string) => NativeModule | null)
      | undefined;
    if (typeof optional === 'function') {
      return optional('FlowSightLocalAI');
    }
  } catch {
    return null;
  }
  return null;
}

export function isLocalAIModuleAvailable(): boolean {
  return getNative() != null;
}

export async function getLocalAIStatus(): Promise<LocalAIStatus> {
  const native = getNative();
  if (!native) {
    return {
      available: false,
      reason: 'missing-module',
      engine: 'none',
      modelId: APPLE_ENGINE_ID,
      detail: 'Native on-device module is not in this build.',
    };
  }
  try {
    return await native.getStatus();
  } catch (error) {
    return {
      available: false,
      reason: 'error',
      engine: 'none',
      modelId: APPLE_ENGINE_ID,
      detail: error instanceof Error ? error.message : 'status failed',
    };
  }
}

export async function generateLocalPatternText(stats: string): Promise<LocalAIGenerateResult> {
  const native = getNative();
  if (!native) {
    return { ok: false, reason: 'missing-module', modelId: APPLE_ENGINE_ID };
  }
  try {
    return await native.generatePatterns(stats);
  } catch (error) {
    return {
      ok: false,
      reason: 'error',
      modelId: APPLE_ENGINE_ID,
      detail: error instanceof Error ? error.message : 'generate failed',
    };
  }
}

export async function sha256File(path: string): Promise<string | null> {
  const native = getNative();
  if (!native) return null;
  try {
    return await native.sha256File(path);
  } catch {
    return null;
  }
}
