/**
 * Entitlements Service — Server-side entitlement management.
 *
 * Never trusts client-asserted plan, user_id, or team_id.
 * Always fetches from Supabase RPC get_user_entitlements.
 */

import { getClient } from './auth';
import type { Entitlements } from '@/contracts';
import { EntitlementsSchema } from '@/contracts';

let cachedEntitlements: Entitlements | null = null;
let lastFetch = 0;
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

export async function getEntitlements(forceRefresh = false): Promise<Entitlements> {
  const now = Date.now();
  if (!forceRefresh && cachedEntitlements && now - lastFetch < CACHE_TTL_MS) {
    return cachedEntitlements;
  }

  const client = getClient();
  const { data, error } = await client.supabase.rpc('get_user_entitlements');

  if (error) {
    console.error('[Entitlements] Fetch error:', error);
    return freeEntitlements();
  }

  if (!data) return freeEntitlements();

  try {
    const parsed = EntitlementsSchema.parse(data);
    cachedEntitlements = parsed;
    lastFetch = now;
    return parsed;
  } catch {
    console.error('[Entitlements] Parse error');
    return freeEntitlements();
  }
}

export function freeEntitlements(): Entitlements {
  return {
    plan: null,
    status: 'free',
    team_ids: [],
    active_team_id: null,
    features: {
      sync: false,
      cloud_ai: false,
      integrations: false,
    },
  };
}

export function clearEntitlementsCache(): void {
  cachedEntitlements = null;
  lastFetch = 0;
}

export function canSync(entitlements: Entitlements): boolean {
  return entitlements.features.sync;
}

export function canCloudAI(entitlements: Entitlements): boolean {
  return entitlements.features.cloud_ai;
}

export function canIntegrations(entitlements: Entitlements): boolean {
  return entitlements.features.integrations;
}

export function isPaid(entitlements: Entitlements): boolean {
  return canSync(entitlements) || canCloudAI(entitlements) || canIntegrations(entitlements);
}
