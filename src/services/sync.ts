import { PRIVATE_SYNC_ENABLED } from '@/services/config';
/** Offline-first sync of authenticated, encrypted account vault records. */
import { getRandomBytes } from 'expo-crypto';
import { ActivityEventSchema } from '@/contracts';
import {
  getUnsyncedEvents,
  importSyncedActivityEvent,
  markEventSynced,
  getPreference,
  setPreference,
} from '@/storage';
import { getClient, getCurrentUser } from '@/services/auth';
import { getReadyVault } from '@/services/vault';
import { decryptVaultRecord, encryptVaultRecord } from '@/security/vaultCrypto';
import { isConsentCurrent, publishPrivacyPreferences } from '@/privacy/privacyService';

const BATCH_SIZE = 20;
const DOWNLOAD_PAGE_SIZE = 200;
let syncInProgress = false;
let syncTimer: ReturnType<typeof setTimeout> | null = null;
let deletionRequested = false;
let periodicEnabled = false;
let currentSyncDone: Promise<void> | null = null;
let completeCurrentSync: (() => void) | null = null;

type VaultContext = Awaited<ReturnType<typeof getReadyVault>>;

async function downloadEncryptedEvents(vault: VaultContext): Promise<void> {
  const client = getClient().supabase;
  const cursorKey = `vault_sync_cursor_${vault.userId}`;
  const since = await getPreference(cursorKey);
  let pageAfter: { createdAt: string; recordId: string } | null = null;
  let lastCreatedAt: string | null = null;

  for (;;) {
    let query = client.from('vault_records')
      .select('record_id,nonce,ciphertext,created_at')
      .eq('user_id', vault.userId)
      .order('created_at', { ascending: true })
      .order('record_id', { ascending: true })
      .limit(DOWNLOAD_PAGE_SIZE);
    if (pageAfter) {
      // Keyset pagination survives rows expiring between requests. Offset
      // pagination could skip a row after an earlier row is deleted.
      const at = `"${pageAfter.createdAt}"`;
      query = query.or(
        `created_at.gt.${at},and(created_at.eq.${at},record_id.gt.${pageAfter.recordId})`,
      );
    } else if (since) {
      query = query.gte('created_at', since);
    }
    const { data: rows, error } = await query;
    if (error) throw new Error('Could not download private cloud records.');

    if ((await getCurrentUser())?.id !== vault.userId) throw new Error('The active account changed during sync.');
    for (const row of rows ?? []) {
      const payload = decryptVaultRecord<unknown>(
        vault.accountKey, vault.userId, row.record_id, row,
      );
      if (typeof payload === 'object' && payload !== null &&
          'kind' in payload && payload.kind === 'activity_event' &&
          'event' in payload) {
        const parsed = ActivityEventSchema.passthrough().safeParse(payload.event);
        if (!parsed.success || parsed.data.user_id !== vault.userId ||
            parsed.data.id !== row.record_id) {
          throw new Error('A private cloud activity record is invalid.');
        }
        await importSyncedActivityEvent(parsed.data, vault.userId);
      }
      lastCreatedAt = row.created_at;
      pageAfter = { createdAt: row.created_at, recordId: row.record_id };
    }
    if (!rows || rows.length < DOWNLOAD_PAGE_SIZE) break;
  }

  // Inclusive cursor: rows sharing the last timestamp are checked again next
  // time, so concurrent writes at that timestamp cannot be skipped.
  if ((await getCurrentUser())?.id !== vault.userId) throw new Error('The active account changed during sync.');
  if (lastCreatedAt) await setPreference(cursorKey, lastCreatedAt);
}

export async function syncNow(): Promise<{ synced: number; failed: number; message?: string }> {
  if (!PRIVATE_SYNC_ENABLED) return { synced: 0, failed: 0, message: 'Private device sync will be available with FlowSight 6.0. Your sessions stay on this device.' };
  if (syncInProgress || deletionRequested) return { synced: 0, failed: 0 };
  syncInProgress = true;
  currentSyncDone = new Promise<void>((resolve) => { completeCurrentSync = resolve; });
  let synced = 0;
  let failed = 0;
  let message: string | undefined;
  try {
    if (!await isConsentCurrent() || await getPreference('consent_cloud_sync') !== 'true'
        || deletionRequested) {
      return { synced: 0, failed: 0, message: 'Enable cloud sync in Settings before syncing.' };
    }
    if (!await getCurrentUser()) return { synced: 0, failed: 0, message: 'Sign in with your FlowSight.AI account.' };
    const entitlement = await getClient().getEntitlements();
    if (!entitlement?.features.sync) return { synced: 0, failed: 0, message: 'This account does not include cloud sync.' };
    await publishPrivacyPreferences();
    const vault = await getReadyVault();
    if (deletionRequested) return { synced: 0, failed: 0 };
    if ((await getCurrentUser())?.id !== vault.userId) throw new Error('The active account changed during sync.');
    const events = await getUnsyncedEvents(BATCH_SIZE) as (Record<string, unknown> & { id: string })[];
    if (events.length > 0) {
      const records = events.map((event) => {
        if (event.user_id !== vault.userId) throw new Error('The active account changed during sync.');
        const normalized = ActivityEventSchema.passthrough().parse({
          ...event,
        });
        const encrypted = encryptVaultRecord(
          vault.accountKey,
          vault.userId,
          event.id,
          { kind: 'activity_event', event: normalized },
          getRandomBytes,
        );
        return {
          user_id: vault.userId,
          record_id: event.id,
          origin_device_id: vault.deviceId,
          key_version: 1,
          ...encrypted,
        };
      });
      if ((await getCurrentUser())?.id !== vault.userId) throw new Error('The active account changed during sync.');
      const { error } = await getClient().supabase.from('vault_records').upsert(
        records,
        { onConflict: 'user_id,record_id', ignoreDuplicates: true },
      );
      if (error) throw new Error('Could not upload private cloud records.');
      if ((await getCurrentUser())?.id !== vault.userId) throw new Error('The active account changed during sync.');
      for (const event of events) {
        await markEventSynced(event.id);
        synced++;
      }
    }
    if (deletionRequested) return { synced, failed };
    await downloadEncryptedEvents(vault);
  } catch (error) {
    message = error instanceof Error ? error.message : 'Sync failed';
    failed = 1;
  } finally {
    syncInProgress = false;
    completeCurrentSync?.();
    completeCurrentSync = null;
    currentSyncDone = null;
  }
  return { synced, failed, message: message ?? (synced ? `${synced} session(s) synced securely.` : 'Private history is up to date.') };
}

export function startPeriodicSync(intervalMs = 60_000) {
  stopPeriodicSync();
  periodicEnabled = true;
  const run = async () => {
    await syncNow();
    if (periodicEnabled) syncTimer = setTimeout(run, intervalMs);
  };
  syncTimer = setTimeout(run, 5_000);
}

export function stopPeriodicSync() {
  periodicEnabled = false;
  if (syncTimer) clearTimeout(syncTimer);
  syncTimer = null;
}

/** Drain an in-flight sync before erasing databases or account keys. */
export async function pauseSyncForLocalDeletion(): Promise<() => void> {
  deletionRequested = true;
  stopPeriodicSync();
  await currentSyncDone;
  return () => { deletionRequested = false; };
}
