/**
 * Pinned on-device Qwen3-0.6B GGUF. Not bundled in the IPA.
 * Size + sha256 must match the Hugging Face file byte-for-byte (Mac model_assets pattern).
 */

export const QWEN_WEIGHT = {
  repo: 'bartowski/Qwen_Qwen3-0.6B-GGUF',
  filename: 'Qwen_Qwen3-0.6B-Q4_K_M.gguf',
  url: 'https://huggingface.co/bartowski/Qwen_Qwen3-0.6B-GGUF/resolve/main/Qwen_Qwen3-0.6B-Q4_K_M.gguf',
  sizeBytes: 484_220_320,
  sha256: '9acfc1e001311f34b4252001b626f2e466d592a42065f66571bff3790d4e1b14',
  license: 'Apache-2.0',
  label: 'Qwen3-0.6B',
} as const;

export const MODELS_SUBDIR = 'models';

export function partPath(dest: string): string {
  return `${dest}.part`;
}

export function weightComplete(sizeBytes: number, expected = QWEN_WEIGHT.sizeBytes): boolean {
  return sizeBytes === expected;
}

export function percentOf(done: number, total: number): number {
  if (total <= 0) return 0;
  return Math.min(100, Math.round((Math.min(done, total) * 100) / total));
}

export function stripFileUri(path: string): string {
  return path.startsWith('file://') ? path.slice('file://'.length) : path;
}
