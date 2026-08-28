/**
 * Integration Service — Jira, Linear, and Notion connections.
 *
 * OAuth flows use server-side exchange (no client secrets in bundle).
 * Tokens are stored server-side (encrypted) or in Keychain/Keystore.
 */

import { getClient } from './auth';
import { getEntitlements, canIntegrations } from './entitlements';
import * as Linking from 'expo-linking';

// ─── Jira ──────────────────────────────────────────────────────────────────────

export async function connectJira(): Promise<string | null> {
  const entitlements = await getEntitlements();
  if (!canIntegrations(entitlements)) {
    throw new Error('Desktop integrations are not available in this iPhone app');
  }

  // The actual OAuth URL is generated server-side
  // For now, return a placeholder that would open the Jira OAuth flow
  const client = getClient();
  const { data: { session } } = await client.supabase.auth.getSession();
  if (!session) throw new Error('Not authenticated');

  // In production, this would call an Edge Function to generate the OAuth URL
  // with PKCE and proper state
  return null;
}

export async function fetchJiraTasks() {
  const client = getClient();
  const { data, error } = await client.supabase.functions.invoke('jira-tasks');
  if (error) throw error;
  return data;
}

// ─── Linear ────────────────────────────────────────────────────────────────────

export async function connectLinear(): Promise<string | null> {
  const entitlements = await getEntitlements();
  if (!canIntegrations(entitlements)) {
    throw new Error('Desktop integrations are not available in this iPhone app');
  }

  const client = getClient();
  const { data: { session } } = await client.supabase.auth.getSession();
  if (!session) throw new Error('Not authenticated');

  return null;
}

export async function fetchLinearTasks() {
  const client = getClient();
  const { data, error } = await client.supabase.functions.invoke('linear-tasks');
  if (error) throw error;
  return data;
}

// ─── Notion ────────────────────────────────────────────────────────────────────

export async function getNotionStatus() {
  const client = getClient();
  const { data, error } = await client.supabase
    .from('notion_connections')
    .select('workspace_id, workspace_name, workspace_icon, connected_at')
    .eq('user_id', (await client.supabase.auth.getUser()).data.user?.id)
    .maybeSingle();

  if (error) return null;
  return data;
}

export async function startNotionOAuth() {
  const entitlements = await getEntitlements();
  if (!canIntegrations(entitlements)) {
    throw new Error('Desktop integrations are not available in this iPhone app');
  }

  const client = getClient();
  const { data: { session } } = await client.supabase.auth.getSession();
  if (!session) throw new Error('Not authenticated');

  // Call the notion-oauth Edge Function
  const response = await fetch(
    `${client.url}/functions/v1/notion-oauth`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${session.access_token}`,
        'Content-Type': 'application/json',
      },
    }
  );

  const json = await response.json();
  if (json.url) {
    // Open in browser for OAuth flow
    const supported = await Linking.canOpenURL(json.url);
    if (supported) {
      await Linking.openURL(json.url);
    }
  }
  return json;
}

export async function disconnectNotion() {
  const client = getClient();
  const { error } = await client.supabase
    .from('notion_connections')
    .delete()
    .eq('user_id', (await client.supabase.auth.getUser()).data.user?.id);

  if (error) throw error;
}

export async function searchNotionDestinations(query?: string) {
  const client = getClient();
  const { data: { session } } = await client.supabase.auth.getSession();
  if (!session) throw new Error('Not authenticated');

  const response = await fetch(
    `${client.url}/functions/v1/notion-destinations`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${session.access_token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ query }),
    }
  );

  return response.json();
}

export async function publishNotionReport(options: {
  destinationId: string;
  reportMode: 'period_page' | 'live_page';
  periodStart: string;
  periodEnd: string;
  content: Record<string, unknown>;
}) {
  const client = getClient();
  const { data: { session } } = await client.supabase.auth.getSession();
  if (!session) throw new Error('Not authenticated');

  const response = await fetch(
    `${client.url}/functions/v1/publish-notion-report`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${session.access_token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(options),
    }
  );

  return response.json();
}
