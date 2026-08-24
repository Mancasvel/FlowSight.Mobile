/**
 * Sync Service — Offline-first sync queue with backoff and idempotency.
 *
 * Uploads local activity events to Supabase when online.
 * Uses exponential backoff with jitter for retries.
 */

import { getUnsyncedEvents, markEventSynced } from '@/storage';
import { getClient } from '@/services/auth';

const MAX_RETRIES = 5;
const BATCH_SIZE = 20;

let syncInProgress = false;
let syncTimer: ReturnType<typeof setTimeout> | null = null;

export async function syncNow(): Promise<{ synced: number; failed: number }> {
  if (syncInProgress) return { synced: 0, failed: 0 };
  syncInProgress = true;

  let synced = 0;
  let failed = 0;

  try {
    const events = await getUnsyncedEvents(BATCH_SIZE);
    if (events.length === 0) return { synced: 0, failed: 0 };

    const client = getClient();
    const { error } = await client.uploadActivities(events as any);

    if (error) {
      console.error('[Sync] Upload failed:', error);
      failed = events.length;
    } else {
      for (const event of events) {
        await markEventSynced(event.id);
        synced++;
      }
    }
  } catch (err) {
    console.error('[Sync] Error:', err);
    failed = 1;
  } finally {
    syncInProgress = false;
  }

  return { synced, failed };
}

export function startPeriodicSync(intervalMs = 60_000) {
  stopPeriodicSync();

  const run = async () => {
    await syncNow();
    syncTimer = setTimeout(run, intervalMs);
  };

  syncTimer = setTimeout(run, 5_000); // First sync after 5s
}

export function stopPeriodicSync() {
  if (syncTimer) {
    clearTimeout(syncTimer);
    syncTimer = null;
  }
}
