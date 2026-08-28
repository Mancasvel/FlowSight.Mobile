/**
 * Entitlements Service — Server-side plan and feature flags.
 *
 * Free plan is the default until the server returns a paid entitlement.
 */

import type { Entitlements } from '@/contracts';
import { getClient } from './auth';

export const freeEntitlements: Entitlements = {
  plan: 'free',
  status: 'active',
  team_ids: [],
  active_team_id: null,
  features: {
    sync: false,
    cloud_ai: false,
    integrations: false,
  },
};

let cache: Entitlements | null = null;

export function clearEntitlementsCache() {
  cache = null;
}

export async function getEntitlements(): Promise<Entitlements> {
  if (cache) return cache;

  try {
    const remote = await getClient().getEntitlements();
    cache = remote ?? freeEntitlements;
  } catch {
    cache = freeEntitlements;
  }

  return cache;
}

export function canSync(entitlements: Entitlements = cache ?? freeEntitlements): boolean {
  return entitlements.features.sync;
}

export function canCloudAI(entitlements: Entitlements = cache ?? freeEntitlements): boolean {
  return entitlements.features.cloud_ai;
}

export function canIntegrations(entitlements: Entitlements = cache ?? freeEntitlements): boolean {
  return entitlements.features.integrations;
}

export function isPaid(entitlements: Entitlements = cache ?? freeEntitlements): boolean {
  return entitlements.plan !== 'free' && entitlements.status === 'active';
}
