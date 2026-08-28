/**
 * FlowSight API Client
 *
 * Supabase client wrapper with Zod validation, typed queries,
 * and adapter layer to decouple screens from Supabase internals.
 */

import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import {
  EntitlementsSchema,
  type Entitlements,
  ProfileSchema,
  type Profile,
  PrivacyPreferencesSchema,
  type PrivacyPreferences,
  CoachResponseSchema,
  type ActivityEvent,
} from '@/contracts';

// --- Client Factory ------------------------------------------------------------

export function createFlowSightClient(
  supabaseUrl: string,
  supabaseAnonKey: string
): FlowSightClient {
  return new FlowSightClient(supabaseUrl, supabaseAnonKey);
}

// --- FlowSight Client ----------------------------------------------------------

export class FlowSightClient {
  supabase: SupabaseClient;
  readonly url: string;

  constructor(supabaseUrl: string, supabaseAnonKey: string, supabase?: SupabaseClient) {
    this.url = supabaseUrl;
    this.supabase =
      supabase ??
      createClient(supabaseUrl, supabaseAnonKey, {
        auth: {
          autoRefreshToken: true,
          persistSession: true,
          detectSessionInUrl: true,
        },
      });
  }

  // -- Auth ------------------------------------------------------------------

  async signInWithEmail(email: string, password: string) {
    return this.supabase.auth.signInWithPassword({ email, password });
  }

  async signUpWithEmail(email: string, password: string) {
    return this.supabase.auth.signUp({ email, password });
  }

  async signInWithGoogle() {
    return this.supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: 'flowsight://auth/callback',
        skipBrowserRedirect: true,
      },
    });
  }

  async signOut() {
    return this.supabase.auth.signOut();
  }

  async getSession() {
    return this.supabase.auth.getSession();
  }

  onAuthStateChange(callback: (event: string, session: unknown) => void) {
    return this.supabase.auth.onAuthStateChange(callback);
  }

  // -- Profile ---------------------------------------------------------------

  async getProfile(userId: string): Promise<Profile | null> {
    const { data, error } = await this.supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single();

    if (error || !data) return null;
    return ProfileSchema.parse(data);
  }

  async updateProfile(userId: string, updates: Partial<Profile>) {
    return this.supabase
      .from('profiles')
      .update(updates)
      .eq('id', userId);
  }

  // -- Entitlements ----------------------------------------------------------

  async getEntitlements(): Promise<Entitlements | null> {
    const { data, error } = await this.supabase.rpc('get_user_entitlements');
    if (error || !data) return null;
    return EntitlementsSchema.parse(data);
  }

  // -- Privacy Preferences ---------------------------------------------------

  async getPrivacyPreferences(userId: string): Promise<PrivacyPreferences | null> {
    const { data, error } = await this.supabase
      .from('privacy_preferences')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle();

    if (error || !data) return null;
    return PrivacyPreferencesSchema.parse(data);
  }

  async updatePrivacyPreferences(
    userId: string,
    prefs: Partial<PrivacyPreferences>
  ) {
    return this.supabase
      .from('privacy_preferences')
      .upsert({ user_id: userId, ...prefs })
      .eq('user_id', userId);
  }

  // -- Activity Sync ---------------------------------------------------------

  async uploadActivities(events: ActivityEvent[]) {
    const rows = events.map((e) => ({
      user_id: e.user_id,
      device_id: e.device_id,
      source_platform: e.source_platform,
      capture_source: e.capture_source,
      client_event_id: e.client_event_id,
      schema_version: e.schema_version,
      start_at: e.start_at,
      end_at: e.end_at,
      timezone: e.timezone,
      duration_seconds: e.duration_seconds,
      category: e.category,
      task_label: e.task_label,
      ticket_ref: e.ticket_ref,
      confidence: e.confidence,
    }));

    return this.supabase
      .from('activity_reports')
      .upsert(rows, {
        onConflict: 'user_id,device_id,client_event_id',
        ignoreDuplicates: true,
      });
  }

  // -- Coach -----------------------------------------------------------------

  async sendCoachMessage(message: string, options?: {
    teamId?: string;
    history?: Array<{ role: 'user' | 'assistant'; content: string }>;
    localContext?: Record<string, unknown>;
  }) {
    const { data: { session } } = await this.supabase.auth.getSession();
    if (!session) throw new Error('Not authenticated');

    const response = await fetch(
      `${this.url}/functions/v1/coach-chat`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message,
          team_id: options?.teamId,
          history: options?.history,
          local_context: options?.localContext,
        }),
      }
    );

    const json = await response.json();
    if (!response.ok) {
      throw new Error(json.error || 'Coach request failed');
    }

    return CoachResponseSchema.parse(json);
  }

  // -- Insights --------------------------------------------------------------

  async generateInsight(options?: {
    teamId?: string;
    periodDays?: number;
    localReport?: Record<string, unknown>;
  }) {
    const { data: { session } } = await this.supabase.auth.getSession();
    if (!session) throw new Error('Not authenticated');

    const response = await fetch(
      `${this.url}/functions/v1/generate-insights`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          team_id: options?.teamId,
          period_days: options?.periodDays ?? 7,
          local_report: options?.localReport,
        }),
      }
    );

    const json = await response.json();
    if (!response.ok) {
      throw new Error(json.error || 'Insight generation failed');
    }

    return json;
  }

  // -- Teams -----------------------------------------------------------------

  async getUserTeams() {
    return this.supabase
      .from('teams')
      .select('*, team_members!inner(user_id, role)')
      .eq('team_members.user_id', (await this.supabase.auth.getUser()).data.user?.id);
  }
}
