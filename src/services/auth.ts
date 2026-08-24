/**
 * Auth Service — Supabase Auth with PKCE, deep links, and secure session.
 */

import { createFlowSightClient, type FlowSightClient } from '@/api-client';
import { saveSession, clearSession, getAccessToken } from '@/storage';
import { SUPABASE_URL, SUPABASE_ANON_KEY } from '@/services/config';

let client: FlowSightClient | null = null;

export function getClient(): FlowSightClient {
  if (!client) {
    client = createFlowSightClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  }
  return client;
}

export async function signInWithEmail(email: string, password: string) {
  const c = getClient();
  const { data, error } = await c.signInWithEmail(email, password);
  if (error) throw error;
  if (data.session) {
    await saveSession(data.session.access_token, data.session.refresh_token);
  }
  return data;
}

export async function signUpWithEmail(email: string, password: string) {
  const c = getClient();
  const { data, error } = await c.supabase.auth.signUp({ email, password });
  if (error) throw error;
  if (data.session) {
    await saveSession(data.session.access_token, data.session.refresh_token);
  }
  return data;
}

export async function signInWithGoogle() {
  const c = getClient();
  const { data, error } = await c.signInWithGoogle();
  if (error) throw error;
  return data;
}

export async function handleOAuthCallback(url: string) {
  const c = getClient();
  const { data, error } = await c.supabase.auth.exchangeCodeForSession(url);
  if (error) throw error;
  if (data.session) {
    await saveSession(data.session.access_token, data.session.refresh_token);
  }
  return data;
}

export async function signOut() {
  const c = getClient();
  await c.signOut();
  await clearSession();
}

export async function getCurrentSession() {
  const c = getClient();
  const { data: { session } } = await c.getSession();
  return session;
}

export async function getCurrentUser() {
  const session = await getCurrentSession();
  return session?.user ?? null;
}

export function onAuthStateChange(callback: (event: string, session: unknown) => void) {
  const c = getClient();
  return c.onAuthStateChange(callback);
}
