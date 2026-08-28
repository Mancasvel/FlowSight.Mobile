/**
 * Profile Service — User profile, privacy preferences, and teams.
 */

import type { Profile, PrivacyPreferences, Team } from '@/contracts';
import { getClient } from './auth';

export async function getProfile(): Promise<Profile | null> {
  const { data } = await getClient().supabase.auth.getUser();
  if (!data.user) return null;
  return getClient().getProfile(data.user.id);
}

export async function updateProfile(updates: Partial<Profile>) {
  const { data } = await getClient().supabase.auth.getUser();
  if (!data.user) throw new Error('Not authenticated');
  return getClient().updateProfile(data.user.id, updates);
}

export async function getPrivacyPreferences(): Promise<PrivacyPreferences | null> {
  const { data } = await getClient().supabase.auth.getUser();
  if (!data.user) return null;
  return getClient().getPrivacyPreferences(data.user.id);
}

export async function updatePrivacyPreferences(prefs: Partial<PrivacyPreferences>) {
  const { data } = await getClient().supabase.auth.getUser();
  if (!data.user) throw new Error('Not authenticated');
  return getClient().updatePrivacyPreferences(data.user.id, prefs);
}

export async function getTeams(): Promise<Team[]> {
  const { data, error } = await getClient().getUserTeams();
  if (error || !data) return [];
  return data as Team[];
}
