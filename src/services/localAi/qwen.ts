import { Platform } from 'react-native';
import { PATTERNS_SYSTEM_PROMPT, QA_SYSTEM_PROMPT } from '@/services/localAi/schemas';

type LlamaContext = {
  completion: (params: Record<string, unknown>) => Promise<{ text?: string; content?: string }>;
  release: () => Promise<void>;
};

type LlamaModule = {
  initLlama: (params: {
    model: string;
    n_ctx: number;
    n_gpu_layers: number;
    n_batch: number;
    use_mlock: boolean;
  }) => Promise<LlamaContext>;
};

function loadLlama(): LlamaModule | null {
  if (Platform.OS !== 'ios') return null;
  try {
    return require('llama.rn') as LlamaModule;
  } catch {
    return null;
  }
}

export function isLlamaAvailable(): boolean {
  return loadLlama() != null;
}

export async function completeWithQwen(input: {
  modelPath: string;
  stats: string;
  kind: 'patterns' | 'qa';
  question?: string;
  schema: Record<string, unknown>;
  nPredict: number;
}): Promise<string> {
  const llama = loadLlama();
  if (!llama) {
    throw new Error('llama.rn is not in this build.');
  }

  const context = await llama.initLlama({
    model: input.modelPath.replace('file://', ''),
    n_ctx: 4096,
    n_gpu_layers: 99,
    n_batch: 256,
    use_mlock: false,
  });

  try {
    const system = input.kind === 'qa' ? QA_SYSTEM_PROMPT : PATTERNS_SYSTEM_PROMPT;
    const user =
      input.kind === 'qa'
        ? `Question: ${input.question ?? ''}\n\nSTATS:\n${input.stats}`
        : `Write 3 to 5 work-pattern cards and a short week's note from STATS.\n\nSTATS:\n${input.stats}`;

    const result = await context.completion({
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user },
      ],
      jinja: true,
      enable_thinking: false,
      n_predict: input.nPredict,
      temperature: 0.2,
      stop: ['<|im_end|>', '<|endoftext|>'],
      response_format: {
        type: 'json_schema',
        json_schema: {
          strict: true,
          schema: input.schema,
        },
      },
    });
    return (result.text ?? result.content ?? '').trim();
  } finally {
    await context.release();
  }
}
