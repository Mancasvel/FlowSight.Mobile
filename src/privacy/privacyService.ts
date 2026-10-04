import { PRIVATE_SYNC_ENABLED } from '@/services/config';
import { getOnDeviceAiConsent, getOnDeviceAiEventLog, onDeviceAiExportPayload } from '@/privacy/onDeviceAi';
﻿/**
 * Privacy Service — Consent management, data export, and deletion.
 *
 * Implements per-purpose consent (tracking, sync, cloud AI, analytics).
 * All consent is versioned, affirmative, and revocable.
 */

import { getPreference, setPreference } from '@/storage';
import { clearSession } from '@/storage';
import { getClient } from '@/services/auth';
import { clearEntitlementsCache } from '@/services/entitlements';

export interface PrivacyConsent {
  tracking: boolean;
  cloudSync: boolean;
  cloudAi: boolean;
  analytics: boolean;
  noticeVersion: string;
  consentedAt: string;
}

const CURRENT_NOTICE_VERSION = '2026-09-28';

/**
 * Get current privacy consent status.
 */
export async function getPrivacyConsent(): Promise<PrivacyConsent> {
  const tracking = await getPreference('consent_tracking');
  const cloudSync = await getPreference('consent_cloud_sync');
  const cloudAi = await getPreference('consent_cloud_ai');
  const analytics = await getPreference('consent_analytics');
  const version = await getPreference('consent_notice_version');
  const consentedAt = await getPreference('consent_timestamp');

  return {
    tracking: tracking === 'true',
    cloudSync: PRIVATE_SYNC_ENABLED && cloudSync === 'true',
    cloudAi: cloudAi === 'true',
    analytics: analytics === 'true',
    noticeVersion: version ?? '',
    consentedAt: consentedAt ?? '',
  };
}

/**
 * Update privacy consent.
 * Each purpose can be toggled independently.
 */
export async function updatePrivacyConsent(
  updates: Partial<Omit<PrivacyConsent, 'noticeVersion' | 'consentedAt'>>
): Promise<void> {
  const now = new Date().toISOString();

  if (updates.tracking !== undefined) {
    await setPreference('consent_tracking', String(updates.tracking));
  }
  if (updates.cloudSync !== undefined) {
    await setPreference('consent_cloud_sync', String(PRIVATE_SYNC_ENABLED && updates.cloudSync));
    // Update server-side preference
  }
  if (updates.cloudAi !== undefined) {
    await setPreference('consent_cloud_ai', String(updates.cloudAi));
  }
  if (updates.analytics !== undefined) {
    await setPreference('consent_analytics', String(updates.analytics));
  }

  await setPreference('consent_notice_version', CURRENT_NOTICE_VERSION);
  await setPreference('consent_timestamp', now);
  if (updates.cloudSync !== undefined || updates.cloudAi !== undefined) await publishPrivacyPreferences();
}

/**
 * Check if consent is current (matches notice version).
 */
export async function isConsentCurrent(): Promise<boolean> {
  const version = await getPreference('consent_notice_version');
  return version === CURRENT_NOTICE_VERSION;
}

/**
 * Export all local data as JSON.
 */
export async function exportLocalData(): Promise<Record<string, unknown>> {
  const db = await import('@/storage').then((m) => m.getDatabase());

  const { getCurrentUser } = await import('@/services/auth');
  const owner = await getCurrentUser();
  const events = await db.getAllAsync('SELECT * FROM activity_events WHERE user_id IS ?', [owner?.id ?? null]);
  const preferences = await db.getAllAsync(`SELECT * FROM user_preferences WHERE (key NOT LIKE 'consent_cloud_%' AND key NOT LIKE 'consent_notice_%' AND key NOT LIKE 'consent_timestamp_%' AND key NOT LIKE 'vault_sync_cursor_%') OR key LIKE ?`, [`%_${owner?.id ?? 'guest'}`]);
  const coachMessages = await db.getAllAsync('SELECT * FROM coach_messages WHERE user_id IS ?', [owner?.id ?? null]);
  const hourlyAppUsage = await db.getAllAsync('SELECT * FROM hourly_app_usage');

  const onDeviceAiConsent = await getOnDeviceAiConsent();
  const onDeviceAiEvents = await getOnDeviceAiEventLog();
  return {
    onDeviceAi: onDeviceAiExportPayload({ enabled: onDeviceAiConsent.enabled, noticeVersion: onDeviceAiConsent.noticeVersion, events: onDeviceAiEvents }),
    exportDate: new Date().toISOString(),
    appVersion: '1.4.0',
    platform: 'mobile',
    activityEvents: events,
    hourlyAppUsage,
    preferences: preferences,
    coachMessages: coachMessages,
    privacyNote: 'This export contains local FlowSight timer sessions, hourly app usage, and preferences. ' +
      'App names from Apple Screen Time stay on this iPhone and are not synced. ' +
      'Private cloud sync is not enabled in this release.',
  };
}

/**
 * Delete all local data.
 * Does NOT delete cloud data — use deleteCloudAccount for that.
 */
export async function deleteLocalData(): Promise<void> {
  const { pauseSyncForLocalDeletion } = await import('@/services/sync');
  const resume = await pauseSyncForLocalDeletion();
  try {
    const { discardTimerRuntime } = await import('@/services/timer');
    await discardTimerRuntime();
    const db = await import('@/storage').then((m) => m.getDatabase());

    await db.execAsync(`
      DELETE FROM sync_queue;
      DELETE FROM activity_events;
      DELETE FROM hourly_app_usage;
      DELETE FROM coach_messages;
      DELETE FROM active_session;
      DELETE FROM user_preferences;
    `);

    await clearSession();
    clearEntitlementsCache();
    try { await getClient().signOut(); } catch { /* Local data remains erased while offline. */ }
    try {
      const { disableFocusNotifications } = await import('@/services/notifications');
      await disableFocusNotifications();
    } catch {
      // Native notifications may be unavailable.
    }
    const { deleteQwenWeights } = await import('@/services/localAi/download');
    await deleteQwenWeights();
    const { setInsightNudgesEnabled } = await import('@/services/localInsightNotify');
    await setInsightNudgesEnabled(false);
  } finally { resume(); }
}

/**
 * Delete cloud account and all associated data.
 * Requires recent authentication.
 */
export async function deleteCloudAccount(): Promise<{ success: boolean; error?: string }> {
  try {
    const client = getClient();
    const { data: { session } } = await client.supabase.auth.getSession();
    if (!session) {
      return { success: false, error: 'Not authenticated' };
    }

    const response = await fetch(
      `${client.url}/functions/v1/privacy-rights`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ action: 'delete_account' }),
      }
    );

    if (!response.ok) {
      const json = await response.json();
      return { success: false, error: json.error ?? 'Failed to delete account' };
    }

    // Clear local data after successful cloud deletion
    await deleteLocalData();

    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message ?? 'Unknown error' };
  }
}

// ─── Internal Helpers ──────────────────────────────────────────────────────────

export async function publishPrivacyPreferences(): Promise<void> {
  const consent = await getPrivacyConsent();
  const client = getClient();
  const { data: { session } } = await client.getSession();
  if (!session) return;
  const { error } = await client.supabase.functions.invoke('privacy-rights', {
    body: {
      action: 'update_preferences',
      notice_version: CURRENT_NOTICE_VERSION,
      cloud_sync_enabled: consent.cloudSync,
      cloud_ai_enabled: consent.cloudAi,
    },
  });
  if (error) throw new Error('Could not save cloud privacy preferences. Try again when online.');
}
