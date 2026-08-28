/**
 * Coach Service ù Cloud AI coaching with local conversation history.
 */

import { getClient } from './auth';
import { canCloudAI, getEntitlements } from './entitlements';
import { saveCoachMessage, getCoachHistory } from '@/storage';
import { createId } from '@/utils/id';

export interface CoachUsage {
  used: number;
  limit: number;
  remaining: number;
  planId: string;
  allowed: boolean;
}

export interface CoachResult {
  reply: string;
  reasoning?: string | null;
  usage: CoachUsage;
}

export async function sendCoachMessage(message: string): Promise<CoachResult> {
  const entitlements = await getEntitlements();
  if (!canCloudAI(entitlements)) {
    throw new Error('Cloud chat is not available in this iPhone app');
  }

  await saveCoachMessage({ id: createId(), role: 'user', content: message });
  const history = await getCoachHistory(12);

  const response = await getClient().sendCoachMessage(message, {
    history: history
      .reverse()
      .filter((m) => m.role === 'user' || m.role === 'assistant')
      .map((m) => ({ role: m.role as 'user' | 'assistant', content: m.content })),
  });

  await saveCoachMessage({ id: createId(), role: 'assistant', content: response.reply });

  return {
    reply: response.reply,
    reasoning: response.reasoning,
    usage: response.usage,
  };
}

export async function getCoachUsage(): Promise<CoachUsage | null> {
  try {
    const history = await getConversationHistory();
    if (history.length === 0) return null;
    return null;
  } catch {
    return null;
  }
}

export async function getConversationHistory() {
  const rows = await getCoachHistory(50);
  return rows.reverse();
}
