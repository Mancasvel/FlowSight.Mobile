import { Platform } from 'react-native';
import { isOnDeviceAiEnabled } from '@/privacy/onDeviceAi';
import {
  MODELS_SUBDIR,
  partPath,
  percentOf,
  QWEN_WEIGHT,
  stripFileUri,
  weightComplete,
} from '@/services/localAi/assets';
import { sha256File } from 'flowsight-local-ai';

export type DownloadPhase = 'idle' | 'downloading' | 'verifying' | 'ready' | 'error';

export type DownloadProgress = {
  phase: DownloadPhase;
  downloadedBytes: number;
  totalBytes: number;
  percent: number;
  error?: string;
};

type FileSystemModule = {
  documentDirectory?: string | null;
  getInfoAsync: (uri: string) => Promise<{ exists: boolean; size?: number; isDirectory?: boolean }>;
  makeDirectoryAsync: (uri: string, options?: { intermediates?: boolean }) => Promise<void>;
  deleteAsync: (uri: string, options?: { idempotent?: boolean }) => Promise<void>;
  moveAsync: (options: { from: string; to: string }) => Promise<void>;
  createDownloadResumable: (
    uri: string,
    fileUri: string,
    options?: { headers?: Record<string, string> },
    callback?: (data: { totalBytesWritten: number; totalBytesExpectedToWrite: number }) => void,
    resumeData?: string
  ) => {
    downloadAsync: () => Promise<{ uri: string; status: number } | undefined>;
    pauseAsync: () => Promise<{ resumeData?: string }>;
  };
};

const listeners = new Set<(progress: DownloadProgress) => void>();
let inFlight: Promise<string> | null = null;
let lastProgress: DownloadProgress = {
  phase: 'idle',
  downloadedBytes: 0,
  totalBytes: QWEN_WEIGHT.sizeBytes,
  percent: 0,
};

export function subscribeModelDownload(listener: (progress: DownloadProgress) => void): () => void {
  listeners.add(listener);
  listener(lastProgress);
  return () => {
    listeners.delete(listener);
  };
}

export function getModelDownloadProgress(): DownloadProgress {
  return lastProgress;
}

function emit(progress: DownloadProgress) {
  lastProgress = progress;
  for (const listener of listeners) listener(progress);
}

function loadFs(): FileSystemModule | null {
  if (Platform.OS !== 'ios') return null;
  try {
    return require('expo-file-system') as FileSystemModule;
  } catch {
    return null;
  }
}

export async function getModelDestUri(): Promise<string | null> {
  const fs = loadFs();
  const root = fs?.documentDirectory;
  if (!fs || !root) return null;
  const dir = `${root}${MODELS_SUBDIR}`;
  return `${dir}/${QWEN_WEIGHT.filename}`;
}

export async function isQwenWeightReady(): Promise<boolean> {
  const fs = loadFs();
  const dest = await getModelDestUri();
  if (!fs || !dest) return false;
  const info = await fs.getInfoAsync(dest);
  return Boolean(info.exists && weightComplete(info.size ?? 0));
}

export async function deleteQwenWeights(): Promise<void> {
  const fs = loadFs();
  const dest = await getModelDestUri();
  if (!fs || !dest) return;
  await fs.deleteAsync(dest, { idempotent: true });
  await fs.deleteAsync(partPath(dest), { idempotent: true });
  emit({
    phase: 'idle',
    downloadedBytes: 0,
    totalBytes: QWEN_WEIGHT.sizeBytes,
    percent: 0,
  });
}

export async function ensureQwenWeight(): Promise<string> {
  if (!(await isOnDeviceAiEnabled())) {
    throw new Error('On-device AI writing is off.');
  }
  if (inFlight) return inFlight;
  inFlight = downloadAndVerify();
  try {
    return await inFlight;
  } finally {
    inFlight = null;
  }
}

async function downloadAndVerify(): Promise<string> {
  const fs = loadFs();
  const dest = await getModelDestUri();
  if (!fs || !dest) {
    throw new Error('On-device model storage is not available in this build.');
  }

  const dir = dest.slice(0, dest.lastIndexOf('/'));
  await fs.makeDirectoryAsync(dir, { intermediates: true });

  const existing = await fs.getInfoAsync(dest);
  if (existing.exists && weightComplete(existing.size ?? 0)) {
    emit({
      phase: 'ready',
      downloadedBytes: QWEN_WEIGHT.sizeBytes,
      totalBytes: QWEN_WEIGHT.sizeBytes,
      percent: 100,
    });
    return dest;
  }

  const part = partPath(dest);
  emit({
    phase: 'downloading',
    downloadedBytes: 0,
    totalBytes: QWEN_WEIGHT.sizeBytes,
    percent: 0,
  });

  const resumable = fs.createDownloadResumable(
    QWEN_WEIGHT.url,
    part,
    {},
    ({ totalBytesWritten, totalBytesExpectedToWrite }) => {
      const total = totalBytesExpectedToWrite > 0 ? totalBytesExpectedToWrite : QWEN_WEIGHT.sizeBytes;
      emit({
        phase: 'downloading',
        downloadedBytes: totalBytesWritten,
        totalBytes: total,
        percent: percentOf(totalBytesWritten, total),
      });
    }
  );

  const result = await resumable.downloadAsync();
  if (!result || result.status < 200 || result.status >= 300) {
    const error = `Could not download the on-device model (${result?.status ?? 'no response'}).`;
    emit({
      phase: 'error',
      downloadedBytes: 0,
      totalBytes: QWEN_WEIGHT.sizeBytes,
      percent: 0,
      error,
    });
    throw new Error(error);
  }

  emit({
    phase: 'verifying',
    downloadedBytes: QWEN_WEIGHT.sizeBytes,
    totalBytes: QWEN_WEIGHT.sizeBytes,
    percent: 100,
  });

  const partInfo = await fs.getInfoAsync(part);
  if (!weightComplete(partInfo.size ?? 0)) {
    await fs.deleteAsync(part, { idempotent: true });
    const error = `Download of ${QWEN_WEIGHT.filename} is incomplete.`;
    emit({ phase: 'error', downloadedBytes: 0, totalBytes: QWEN_WEIGHT.sizeBytes, percent: 0, error });
    throw new Error(error);
  }

  const digest = await sha256File(stripFileUri(part));
  if (digest && digest !== QWEN_WEIGHT.sha256) {
    await fs.deleteAsync(part, { idempotent: true });
    const error = 'Integrity check failed for the on-device model. Retry the download.';
    emit({ phase: 'error', downloadedBytes: 0, totalBytes: QWEN_WEIGHT.sizeBytes, percent: 0, error });
    throw new Error(error);
  }

  await fs.moveAsync({ from: part, to: dest });
  emit({
    phase: 'ready',
    downloadedBytes: QWEN_WEIGHT.sizeBytes,
    totalBytes: QWEN_WEIGHT.sizeBytes,
    percent: 100,
  });
  return dest;
}
