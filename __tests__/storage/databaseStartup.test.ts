import { expect, test, vi } from 'vitest';

const native = vi.hoisted(() => ({ open: vi.fn(), initialize: vi.fn(), close: vi.fn() }));
vi.mock('expo-sqlite', () => ({ openDatabaseAsync: native.open }));
vi.mock('@/utils/id', () => ({ createId: () => 'id' }));
import { getDatabase } from '@/storage/database';

test('concurrent readers wait for one complete database initialization, with retry on failure', async () => {
  let failInitialization!: (error: Error) => void;
  const firstInit = new Promise<void>((_resolve, reject) => { failInitialization = reject; });
  const database = {
    execAsync: native.initialize.mockImplementationOnce(() => firstInit).mockResolvedValue(undefined),
    closeAsync: native.close.mockResolvedValue(undefined),
    getAllAsync: async () => [{ name: 'pause_count' }, { name: 'user_id' }],
  };
  native.open.mockResolvedValue(database);
  let readerResolved = false;
  const first = getDatabase();
  const second = getDatabase().then((db) => { readerResolved = true; return db; });
  const outcomes = Promise.allSettled([first, second]);
  await Promise.resolve();
  await Promise.resolve();
  expect(native.open).toHaveBeenCalledTimes(1);
  expect(readerResolved).toBe(false);
  failInitialization(new Error('Initialization failed'));
  expect((await outcomes).every((result) => result.status === 'rejected')).toBe(true);
  expect(native.close).toHaveBeenCalledTimes(1);
  expect(await getDatabase()).toBe(database);
  expect(native.open).toHaveBeenCalledTimes(2);
});
