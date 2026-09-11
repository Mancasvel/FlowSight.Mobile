export const PATTERN_CARD_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['title', 'body'],
  properties: {
    title: { type: 'string', minLength: 3, maxLength: 48 },
    body: { type: 'string', minLength: 20, maxLength: 220 },
  },
} as const;

export const PATTERNS_AND_NOTE_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['patterns', 'note'],
  properties: {
    patterns: {
      type: 'array',
      minItems: 3,
      maxItems: 5,
      items: PATTERN_CARD_SCHEMA,
    },
    note: { type: 'string', minLength: 40, maxLength: 600 },
  },
} as const;

export const QA_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['answer', 'grounded', 'used_facts'],
  properties: {
    answer: { type: 'string', minLength: 20, maxLength: 280 },
    grounded: { type: 'boolean' },
    used_facts: {
      type: 'array',
      maxItems: 4,
      items: { type: 'string', maxLength: 80 },
    },
  },
} as const;

export const PATTERNS_SYSTEM_PROMPT = `You are an expert productivity consultant. English only. Output valid JSON only — no markdown.
Use ONLY the STATS. Cite hours, pause counts, session lengths, and app names from STATS.
Return {"patterns":[{"title":"short title","body":"1-2 sentences, max 220 characters"}],"note":"3-5 sentences, max 600 characters"}.
patterns: 3 to 5 how-to-improve cards. note: a short week read, not a full report.`;

export const QA_SYSTEM_PROMPT = `You answer questions about THIS week's STATS only. English. JSON only.
If the answer is not in STATS, set grounded to false and say so.
Return {"answer":"2-4 sentences","grounded":true,"used_facts":["short STATS snippets"]}.`;

export const QA_REFUSAL =
  "Your STATS don't include that. I can only use sessions, hours, and apps saved on this iPhone.";

export const ASK_CHIPS = [
  'When do I pause most?',
  'Which hour runs longest?',
  'What apps show up in blocks?',
] as const;
