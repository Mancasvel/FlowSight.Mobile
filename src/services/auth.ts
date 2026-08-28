/**
 * Auth Service  Supabase Auth with PKCE and secure session persistence.
 *
 * Tokens live in Keychain (iOS) / Keystore (Android) via expo-secure-store.
 */

import * as SecureStore from 'expo-secure-store';
import * as Linking from 'expo-linking';
import { createClient, type Session, type User, type AuthChangeEvent } from '@supabase/supabase-js';
import { FlowSightClient } from '@/api-client';
import { SUPABASE_URL, SUPABASE_ANON_KEY } from './config';
import { saveSession, clearSession } from '@/storage';

const ExpoSecureStoreAdapter = {
  getItem: (key: string) => SecureStore.getItemAsync(key),
  setItem: (key: string, value: string) => SecureStore.setItemAsync(key, value),
  removeItem: (key: string) => SecureStore.deleteItemAsync(key),
};

let client: FlowSightClient | null = null;

export function getClient(): FlowSightClient {
  if (!client) {
    if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
      throw new Error('Supabase is not configured');
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: {
        storage: ExpoSecureStoreAdapter,
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: false,
        flowType: 'pkce',
      },
    });

    client = new FlowSightClient(SUPABASE_URL, SUPABASE_ANON_KEY, supabase);
  }
  return client;
}

export async function signInWithEmail(email: string, password: string) {
  const { data, error } = await getClient().signInWithEmail(email, password);
  if (error) throw error;
  if (data.session) {
    await saveSession(data.session.access_token, data.session.refresh_token);
  }
  return data;
}

export async function signUpWithEmail(email: string, password: string) {
  const { data, error } = await getClient().signUpWithEmail(email, password);
  if (error) throw error;
  if (data.session) {
    await saveSession(data.session.access_token, data.session.refresh_token);
  }
  return data;
}

export async function signInWithGoogle() {
  const redirectTo = Linking.createURL('auth/callback');
  const { data, error } = await getClient().supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo,
      skipBrowserRedirect: true,
    },
  });
  if (error) throw error;
  if (data.url) {
    await Linking.openURL(data.url);
  }
  return data;
}

export async function handleOAuthCallback(url: string) {
  const parsed = Linking.parse(url);
  const code = typeof parsed.queryParams?.code === 'string' ? parsed.queryParams.code : null;
  if (!code) return null;

  const { data, error } = await getClient().supabase.auth.exchangeCodeForSession(code);
  if (error) throw error;
  if (data.session) {
    await saveSession(data.session.access_token, data.session.refresh_token);
  }
  return data.session;
}

export async function signOut() {
  await getClient().signOut();
  await clearSession();
}

export async function getCurrentSession(): Promise<Session | null> {
  try {
    const { data } = await getClient().getSession();
    return data.session;
  } catch {
    return null;
  }
}

export async function getCurrentUser(): Promise<User | null> {
  const session = await getCurrentSession();
  return session?.user ?? null;
}

export function onAuthStateChange(
  callback: (event: AuthChangeEvent, session: Session | null) => void
) {
  try {
    return getClient().supabase.auth.onAuthStateChange(callback);
  } catch {
    return { data: { subscription: { unsubscribe() {} } } };
  }
}
