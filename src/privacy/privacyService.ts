/**
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

const CURRENT_NOTICE_VERSION = '2026-08-28';

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
    cloudSync: cloudSync === 'true',
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
    await setPreference('consent_cloud_sync', String(updates.cloudSync));
    // Update server-side preference
    await updateServerPrivacyPreferences({ cloud_sync_enabled: updates.cloudSync });
  }
  if (updates.cloudAi !== undefined) {
    await setPreference('consent_cloud_ai', String(updates.cloudAi));
    await updateServerPrivacyPreferences({ cloud_ai_enabled: updates.cloudAi });
  }
  if (updates.analytics !== undefined) {
    await setPreference('consent_analytics', String(updates.analytics));
    await updateServerPrivacyPreferences({ analytics_enabled: updates.analytics });
  }

  await setPreference('consent_notice_version', CURRENT_NOTICE_VERSION);
  await setPreference('consent_timestamp', now);
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

  const events = await db.getAllAsync('SELECT * FROM activity_events');
  const preferences = await db.getAllAsync('SELECT * FROM user_preferences');
  const coachMessages = await db.getAllAsync('SELECT * FROM coach_messages');
  const hourlyAppUsage = await db.getAllAsync('SELECT * FROM hourly_app_usage');

  return {
    exportDate: new Date().toISOString(),
    appVersion: '0.1.0',
    platform: 'mobile',
    activityEvents: events,
    hourlyAppUsage,
    preferences: preferences,
    coachMessages: coachMessages,
    privacyNote: 'This export contains local FlowSight timer sessions, hourly app usage, and preferences. ' +
      'App names from Apple Screen Time stay on this iPhone and are not synced. ' +
      'Cloud data is included only if you opted in to sync and signed in.',
  };
}

/**
 * Delete all local data.
 * Does NOT delete cloud data — use deleteCloudAccount for that.
 */
export async function deleteLocalData(): Promise<void> {
  const db = await import('@/storage').then((m) => m.getDatabase());

  await db.execAsync(`
    DELETE FROM activity_events;
    DELETE FROM hourly_app_usage;
    DELETE FROM sync_queue;
    DELETE FROM coach_messages;
    DELETE FROM active_session;
    DELETE FROM user_preferences;
  `);

  await clearSession();
  clearEntitlementsCache();
  try {
    const { disableFocusNotifications } = await import('@/services/notifications');
    await disableFocusNotifications();
  } catch {
    // Native notifications may be unavailable.
  }
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

async function updateServerPrivacyPreferences(prefs: Record<string, boolean>) {
  try {
    const client = getClient();
    const { data: { user } } = await client.supabase.auth.getUser();
    if (!user) return;

    await client.supabase
      .from('privacy_preferences')
      .upsert({
        user_id: user.id,
        notice_version: CURRENT_NOTICE_VERSION,
        ...prefs,
        updated_at: new Date().toISOString(),
      })
      .eq('user_id', user.id);
  } catch {
    // Non-critical: local consent is still saved
    console.warn('[Privacy] Failed to sync server preferences');
  }
}
