import { describe, expect, test, vi } from 'vitest';
import { randomBytes } from 'node:crypto';
import { accountKeyFingerprint, encodeKey } from '@/security/vaultCrypto';

const state = vi.hoisted(() => ({ key: new Uint8Array(32).fill(6), inserted: null as Record<string, unknown> | null }));
vi.mock('expo-crypto', () => ({ getRandomBytes: (size: number) => new Uint8Array(randomBytes(size)) }));
vi.mock('@/storage/secureStorage', () => ({
  secureGet: async (key: string) => key.includes('account_key') ? encodeKey(state.key) : 'device-id',
  secureSet: async () => undefined,
}));
vi.mock('@/services/auth', () => ({
  getCurrentSession: async () => ({ user: { id: 'account-a' } }),
  getClient: () => ({ supabase: { from: (table: string) => {
    if (table === 'vault_pairings') return {
      // The server grants INSERT but no SELECT on pairing envelopes.
      insert: (row: Record<string, unknown>) => { state.inserted = row; return Promise.resolve({ error: null }); },
    };
    const query = { select: () => query, eq: () => query,
      maybeSingle: async () => ({ data: { key_fingerprint: accountKeyFingerprint(state.key) }, error: null }),
      upsert: async () => ({ error: null }),
    };
    return query;
  } } }),
}));
import { createDevicePairing } from '@/services/vault';

describe('device pairing', () => {
  test('creates an expiring code with insert-only table permissions', async () => {
    const before = Date.now();
    const pairing = await createDevicePairing();
    expect(pairing.code).toMatch(/^FS6-/);
    expect(state.inserted).not.toHaveProperty('expires_at');
    expect(new Date(pairing.expiresAt).getTime() - before).toBeGreaterThanOrEqual(299_000);
    expect(new Date(pairing.expiresAt).getTime() - before).toBeLessThanOrEqual(301_000);
    expect(JSON.stringify(state.inserted)).not.toContain(pairing.code);
  });
});
