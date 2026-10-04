import { afterEach, expect, test, vi } from 'vitest';

afterEach(() => { vi.unstubAllEnvs(); vi.resetModules(); });

test('production release cannot start encrypted sync or create a pairing code before v6 deployment', async () => {
  vi.stubEnv('EXPO_PUBLIC_PRIVATE_SYNC_ENABLED', 'false');
  vi.resetModules();
  const { syncNow } = await import('@/services/sync');
  const result = await syncNow();
  expect(result).toEqual(expect.objectContaining({ synced: 0, failed: 0 }));
  expect(result.message).toContain('FlowSight 6.0');
  const { createDevicePairing } = await import('@/services/vault');
  await expect(createDevicePairing()).rejects.toThrow('FlowSight 6.0');
});

vi.mock('expo-crypto', () => ({ getRandomBytes: vi.fn() }));
vi.mock('@/storage', () => ({}));
vi.mock('@/storage/secureStorage', () => ({}));
vi.mock('@/services/auth', () => ({ getClient: () => { throw new Error('Unexpected network call'); } }));
vi.mock('@/privacy/privacyService', () => ({}));
