import { describe, expect, test, vi } from 'vitest';

const state = vi.hoisted(() => ({
  rows: Array.from({ length: 250 }, (_, index) => ({
    record_id: `id-${String(index).padStart(3, '0')}`,
    nonce: 'nonce',
    ciphertext: 'ciphertext',
    created_at: '2026-10-02T10:00:00.000000+00:00',
  })),
  seen: [] as string[],
  requests: [] as { after: string | null; offset: number }[],
  cursor: null as string | null,
}));

vi.mock('expo-crypto', () => ({ getRandomBytes: () => new Uint8Array(12) }));
vi.mock('@/privacy/privacyService', () => ({ isConsentCurrent: async () => true, publishPrivacyPreferences: async () => undefined }));
vi.mock('@/services/vault', () => ({
  getReadyVault: async () => ({
    userId: 'owner', deviceId: 'device', accountKey: new Uint8Array(32),
  }),
}));
vi.mock('@/security/vaultCrypto', () => ({
  decryptVaultRecord: (_key: unknown, _userId: string, recordId: string) => {
    state.seen.push(recordId);
    return { kind: 'other' };
  },
  encryptVaultRecord: () => { throw new Error('No upload expected'); },
}));
vi.mock('@/storage', () => ({
  getUnsyncedEvents: async () => [],
  importSyncedActivityEvent: async () => undefined,
  markEventSynced: async () => undefined,
  getPreference: async (key: string) => key.startsWith('vault_sync_cursor') ? null : 'true',
  setPreference: async (_key: string, value: string) => {
    state.cursor = value;
  },
}));
vi.mock('@/services/auth', () => ({
  getCurrentUser: async () => ({ id: 'owner' }),
  getClient: () => ({
    getEntitlements: async () => ({ features: { sync: true } }),
    supabase: {
      from: () => {
        let after: string | null = null;
        let offset = 0;
        let limit = 200;
        const query = {
          select: () => query,
          eq: () => query,
          order: () => query,
          limit: (count: number) => { limit = count; return query; },
          range: (start: number, end: number) => {
            offset = start;
            limit = end - start + 1;
            return query;
          },
          gte: () => query,
          or: (filter: string) => {
            after = /record_id\.gt\.([^)]*)/.exec(filter)?.[1] ?? null;
            return query;
          },
          then: (resolve: (value: unknown) => unknown) => {
            state.requests.push({ after, offset });
            const remaining = after
              ? state.rows.filter((row) => row.record_id > after!)
              : state.rows;
            const page = remaining.slice(offset, offset + limit);
            // Retention removes already-read rows between pages. An offset
            // query would now skip some of the records that remain.
            if (state.requests.length === 1) state.rows.splice(0, 40);
            return Promise.resolve(resolve({ data: page, error: null }));
          },
        };
        return query;
      },
    },
  }),
}));

import { syncNow } from '@/services/sync';

describe('private sync pagination', () => {
  test('reads every record when retention deletes an earlier page', async () => {
    expect(await syncNow()).toEqual(expect.objectContaining({ synced: 0, failed: 0 }));
    expect(state.seen).toHaveLength(250);
    expect(new Set(state.seen).size).toBe(250);
    expect(state.requests).toEqual([
      { after: null, offset: 0 },
      { after: 'id-199', offset: 0 },
    ]);
    expect(state.cursor).toBe('2026-10-02T10:00:00.000000+00:00');
  });
});
