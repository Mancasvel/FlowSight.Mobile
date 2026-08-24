/**
 * Profile Service — User profile and preferences management.
 */

import { getClient } from './auth';
import type { Profile, PrivacyPreferences } from '@/contracts';
import { ProfileSchema, PrivacyPreferencesSchema } from '@/contracts';

export async function getProfile(userId: string): Promise<Profile | null> {
  const client = getClient();
  const { data, error } = await client.supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .single();

  if (error || !data) return null;
  return ProfileSchema.parse(data);
}

export async function updateProfile(userId: string, updates: { display_name?: string; avatar_url?: string }) {
  const client = getClient();
  return client.supabase
    .from('profiles')
    .update(updates)
    .eq('id', userId);
}

export async function getPrivacyPreferences(userId: string): Promise<PrivacyPreferences | null> {
  const client = getClient();
  const { data, error } = await client.supabase
    .from('privacy_preferences')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle();

  if (error || !data) return null;
  return PrivacyPreferencesSchema.parse(data);
}

export async function updatePrivacyPreferences(
  userId: string,
  prefs: Partial<{
    cloud_sync_enabled: boolean;
    cloud_ai_enabled: boolean;
    analytics_enabled: boolean;
    notifications_enabled: boolean;
    retention_days: number;
    notice_version: string;
  }>
) {
  const client = getClient();
  return client.supabase
    .from('privacy_preferences')
    .upsert({
      user_id: userId,
      notice_version: '2026-08-23',
      ...prefs,
      updated_at: new Date().toISOString(),
    })
    .eq('user_id', userId);
}

export async function getTeams() {
  const client = getClient();
  const { data: { user } } = await client.supabase.auth.getUser();
  if (!user) return [];

  const { data, error } = await client.supabase
    .from('teams')
    .select('*, team_members!inner(user_id, role)')
    .eq('team_members.user_id', user.id);

  if (error) {
    console.error('[Profile] Teams fetch error:', error);
    return [];
  }
  return data ?? [];
}
