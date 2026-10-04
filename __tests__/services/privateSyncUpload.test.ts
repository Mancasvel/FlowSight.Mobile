import { describe, expect, test, vi } from 'vitest';
import { randomBytes } from 'node:crypto';
import { decryptVaultRecord } from '@/security/vaultCrypto';

const state = vi.hoisted(() => ({
  currentUser: '11111111-1111-4111-8111-111111111111',
  owner: '11111111-1111-4111-8111-111111111111',
  uploaded: [] as Record<string, unknown>[],
  marked: [] as string[],
  key: new Uint8Array(32).fill(7),
}));
vi.mock('expo-crypto', () => ({ getRandomBytes: (length: number) => new Uint8Array(randomBytes(length)) }));
vi.mock('@/privacy/privacyService', () => ({ isConsentCurrent: async () => true, publishPrivacyPreferences: async () => undefined }));
vi.mock('@/services/vault', () => ({ getReadyVault: async () => ({ userId: state.currentUser, deviceId: '22222222-2222-4222-8222-222222222222', accountKey: state.key }) }));
vi.mock('@/storage', () => ({
  getPreference: async (key: string) => key.startsWith('vault_sync_cursor') ? null : 'true',
  setPreference: async () => undefined,
  getUnsyncedEvents: async () => [{
    id: '33333333-3333-4333-8333-333333333333', client_event_id: '33333333-3333-4333-8333-333333333333',
    user_id: state.owner, device_id: '22222222-2222-4222-8222-222222222222',
    source: 'manual_timer', source_platform: 'android', capture_source: 'manual',
    start_at: '2026-10-04T10:00:00.000Z', end_at: '2026-10-04T10:10:00.000Z',
    timezone: 'UTC', duration_seconds: 600, pause_count: 1, category: 'Coding',
    task_label: 'Private task', confidence: 1, schema_version: 1,
    created_at: '2026-10-04T10:10:00.000Z', updated_at: '2026-10-04T10:10:00.000Z',
  }],
  markEventSynced: async (id: string) => { state.marked.push(id); },
  importSyncedActivityEvent: async () => undefined,
}));
vi.mock('@/services/auth', () => ({
  getCurrentUser: async () => ({ id: state.currentUser }),
  getClient: () => ({
    getEntitlements: async () => ({ features: { sync: true } }),
    supabase: { from: () => {
      const query = {
        select: () => query, eq: () => query, order: () => query, limit: () => query,
        upsert: async (rows: Record<string, unknown>[]) => { state.uploaded.push(...rows); return { error: null }; },
        then: (resolve: (value: unknown) => unknown) => Promise.resolve(resolve({ data: [], error: null })),
      };
      return query;
    } },
  }),
}));
import { syncNow } from '@/services/sync';
describe('private sync uploads', () => {
  test('uploads authenticated ciphertext in the desktop format', async () => {
    expect(await syncNow()).toEqual(expect.objectContaining({ synced: 1, failed: 0 }));
    expect(state.uploaded).toHaveLength(1);
    const record = state.uploaded[0];
    expect(Object.keys(record).sort()).toEqual(['ciphertext', 'key_version', 'nonce', 'origin_device_id', 'record_id', 'user_id']);
    expect(JSON.stringify(record)).not.toContain('Private task');
    const payload = decryptVaultRecord<{ kind: string; event: { duration_seconds: number } }>(state.key, state.currentUser, String(record.record_id), record as { nonce: string; ciphertext: string });
    expect(payload.kind).toBe('activity_event');
    expect(payload.event.duration_seconds).toBe(600);
    expect(state.marked).toHaveLength(1);
  });
  test('rejects another account’s pending records', async () => {
    state.owner = '44444444-4444-4444-8444-444444444444';
    state.uploaded.length = 0;
    state.marked.length = 0;
    expect(await syncNow()).toEqual(expect.objectContaining({ synced: 0, failed: 1 }));
    expect(state.uploaded).toHaveLength(0);
    expect(state.marked).toHaveLength(0);
  });
});
