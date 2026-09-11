import { QA_REFUSAL } from '@/services/localAi/schemas';
import { factsAreInStats, parseLocalQa } from '@/services/localInsightsStats';

export function resolveQaFromModelOutput(raw: unknown, stats: string): { answer: string; grounded: boolean } {
  const parsed = parseLocalQa(raw);
  if (!parsed) {
    return { answer: QA_REFUSAL, grounded: false };
  }
  if (!parsed.grounded || !factsAreInStats(parsed.usedFacts, stats)) {
    return { answer: QA_REFUSAL, grounded: false };
  }
  return { answer: parsed.answer, grounded: true };
}
