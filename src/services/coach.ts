/**
 * Coach Service — AI Coach chat with quotas, consent, and local history.
 *
 * Reuses the existing coach-chat Edge Function.
 * Maintains local conversation history with 30-day retention.
 * Requires entitlement and cloud_ai consent.
 */

import { getClient } from './auth';
import { getEntitlements, canCloudAI } from './entitlements';
import { saveCoachMessage, getCoachHistory, cleanupExpiredCoachMessages } from '@/storage';
import { CoachResponseSchema, type CoachMessage } from '@/contracts';
import { v4 as uuidv4 } from 'uuid';

export interface CoachUsage {
  used: number;
  limit: number;
  remaining: number;
  planId: string;
  allowed: boolean;
}

export interface CoachResult {
  reply: string;
  reasoning: string | null;
  usage: CoachUsage;
}

/**
 * Send a message to the AI Coach.
 */
export async function sendCoachMessage(
  message: string,
  options?: {
    teamId?: string;
    localContext?: Record<string, unknown>;
  }
): Promise<CoachResult> {
  // Check entitlement
  const entitlements = await getEntitlements();
  if (!canCloudAI(entitlements)) {
    throw new Error('AI Coach requires an active subscription. Upgrade to unlock.');
  }

  // Get conversation history
  const historyRows = await getCoachHistory(12);
  const history = historyRows.reverse().map((r) => ({
    role: r.role as 'user' | 'assistant',
    content: r.content,
  }));

  // Save user message locally
  const userMessageId = uuidv4();
  await saveCoachMessage({
    id: userMessageId,
    role: 'user',
    content: message,
  });

  // Call Edge Function
  const client = getClient();
  const result = await client.sendCoachMessage(message, {
    teamId: options?.teamId,
    history,
    localContext: options?.localContext,
  });

  // Save assistant reply locally
  const assistantMessageId = uuidv4();
  await saveCoachMessage({
    id: assistantMessageId,
    role: 'assistant',
    content: result.reply,
  });

  // Cleanup expired messages
  await cleanupExpiredCoachMessages();

  return {
    reply: result.reply,
    reasoning: result.reasoning ?? null,
    usage: result.usage,
  };
}

/**
 * Get coach usage stats.
 */
export async function getCoachUsage(): Promise<CoachUsage | null> {
  try {
    const client = getClient();
    const { data: { session } } = await client.supabase.auth.getSession();
    if (!session) return null;

    const response = await fetch(
      `${client.supabase.supabaseUrl}/functions/v1/coach-chat`,
      {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
        },
      }
    );

    if (!response.ok) return null;
    const json = await response.json();
    return json.usage ?? null;
  } catch {
    return null;
  }
}

/**
 * Get local conversation history.
 */
export async function getConversationHistory(limit = 50): Promise<Array<{ role: string; content: string; created_at: string }>> {
  const db = await import('@/storage').then((m) => m.getDatabase());
  return db.getAllAsync(
    `SELECT role, content, created_at FROM coach_messages
     WHERE expires_at > datetime('now')
     ORDER BY created_at ASC LIMIT ?`,
    [limit]
  );
}
