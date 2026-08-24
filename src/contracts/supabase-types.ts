/**
 * Supabase Database Types — Generated from schema.
 *
 * These types represent the deployed Supabase schema.
 * Update after running migrations.
 */

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          display_name: string | null;
          avatar_url: string | null;
          role: 'pm' | 'worker';
          jira_cloud_id: string | null;
          jira_tokens: Record<string, unknown> | null;
          last_seen_at: string | null;
          created_at: string;
        };
        Insert: {
          id: string;
          display_name?: string | null;
          avatar_url?: string | null;
          role?: 'pm' | 'worker';
        };
        Update: {
          display_name?: string | null;
          avatar_url?: string | null;
          last_seen_at?: string | null;
        };
      };
      devices: {
        Row: {
          id: string;
          user_id: string;
          platform: 'windows' | 'ios' | 'android';
          installation_id: string;
          app_version: string;
          capabilities: {
            manual_timer: boolean;
            device_activity: boolean;
            desktop_sync: boolean;
          };
          last_seen_at: string;
          created_at: string;
          revoked_at: string | null;
        };
        Insert: {
          user_id: string;
          platform: 'windows' | 'ios' | 'android';
          installation_id: string;
          app_version?: string;
          capabilities?: Record<string, boolean>;
        };
        Update: {
          last_seen_at?: string;
          app_version?: string;
          capabilities?: Record<string, boolean>;
          revoked_at?: string | null;
        };
      };
      mobile_activity_events: {
        Row: {
          id: string;
          user_id: string;
          device_id: string;
          client_event_id: string;
          source_platform: 'windows' | 'ios' | 'android';
          capture_source: string;
          schema_version: number;
          start_at: string;
          end_at: string;
          timezone: string;
          duration_seconds: number;
          category: string;
          task_label: string | null;
          ticket_ref: string | null;
          description: string | null;
          confidence: number;
          created_at: string;
          updated_at: string;
          expires_at: string | null;
        };
        Insert: {
          user_id: string;
          device_id: string;
          client_event_id: string;
          source_platform: 'windows' | 'ios' | 'android';
          capture_source: string;
          schema_version?: number;
          start_at: string;
          end_at: string;
          timezone: string;
          duration_seconds: number;
          category: string;
          task_label?: string | null;
          ticket_ref?: string | null;
          description?: string | null;
          confidence?: number;
        };
        Update: {
          updated_at?: string;
        };
      };
      privacy_preferences: {
        Row: {
          user_id: string;
          notice_version: string;
          cloud_sync_enabled: boolean;
          cloud_ai_enabled: boolean;
          analytics_enabled: boolean;
          notifications_enabled: boolean;
          retention_days: number;
          updated_at: string;
        };
        Insert: {
          user_id: string;
          notice_version: string;
          cloud_sync_enabled?: boolean;
          cloud_ai_enabled?: boolean;
          analytics_enabled?: boolean;
          notifications_enabled?: boolean;
          retention_days?: number;
        };
        Update: {
          cloud_sync_enabled?: boolean;
          cloud_ai_enabled?: boolean;
          analytics_enabled?: boolean;
          notifications_enabled?: boolean;
          retention_days?: number;
          updated_at?: string;
        };
      };
      teams: {
        Row: {
          id: string;
          name: string;
          owner_id: string;
          license_id: string;
          jira_project_key: string | null;
          is_active: boolean;
          created_at: string;
        };
      };
      team_members: {
        Row: {
          id: string;
          team_id: string;
          user_id: string;
          role: 'admin' | 'member';
          invited_by: string | null;
          joined_at: string;
        };
      };
      work_sessions: {
        Row: {
          id: string;
          user_id: string;
          team_id: string | null;
          duration_seconds: number;
          summary: string | null;
          category_breakdown: Record<string, number>;
          jira_breakdown: Record<string, unknown>;
          session_date: string;
          created_at: string;
          expires_at: string | null;
        };
      };
      activity_reports: {
        Row: {
          id: string;
          user_id: string;
          team_id: string | null;
          description: string | null;
          category: string;
          jira_ticket_id: string | null;
          duration_seconds: number;
          captured_at: string;
          expires_at: string | null;
        };
      };
      cloud_insights: {
        Row: {
          id: string;
          user_id: string;
          team_id: string | null;
          period_start: string;
          period_end: string;
          insight_type: string;
          content: Record<string, unknown>;
          created_at: string;
          expires_at: string | null;
        };
      };
      notion_connections: {
        Row: {
          user_id: string;
          workspace_id: string;
          workspace_name: string | null;
          workspace_icon: string | null;
          bot_id: string | null;
          connected_at: string;
        };
      };
      notion_destinations: {
        Row: {
          id: string;
          user_id: string;
          notion_object_id: string;
          destination_type: 'page' | 'data_source';
          title: string;
          title_property: string | null;
          report_mode: 'period_page' | 'live_page';
          is_default: boolean;
          created_at: string;
        };
      };
    };
    Functions: {
      get_user_entitlements: {
        Returns: {
          plan: string | null;
          status: string;
          team_ids: string[];
          features: {
            sync: boolean;
            cloud_ai: boolean;
            integrations: boolean;
          };
        };
      };
      register_device: {
        Args: {
          p_platform: string;
          p_installation_id: string;
          p_app_version: string;
          p_capabilities?: Record<string, boolean>;
        };
        Returns: string;
      };
      get_user_devices: {
        Returns: Database['public']['Tables']['devices']['Row'][];
      };
      cloud_sync_permitted: {
        Args: { p_user_id: string };
        Returns: boolean;
      };
    };
  };
};
