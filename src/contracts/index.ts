/**
 * FlowSight Contracts — Zod schemas and types shared between desktop and mobile.
 */

import { z } from 'zod';

// ─── Canonical Categories ──────────────────────────────────────────────────────

export const CanonicalCategorySchema = z.enum([
  'Analysis', 'Writing', 'Coding', 'Debugging', 'CodeReview',
  'Testing', 'Documentation', 'Design', 'Planning', 'Meeting',
  'Communication', 'Research', 'Learning', 'DevOps', 'Database',
  'Sales', 'Admin', 'Browsing', 'Idle', 'General',
]);

export type CanonicalCategory = z.infer<typeof CanonicalCategorySchema>;

// ─── Data Sources ──────────────────────────────────────────────────────────────

export const DataSourceSchema = z.enum([
  'manual_timer', 'desktop_sync', 'ios_device_activity',
  'android_usage_stats', 'cloud_integration', 'explicit_import', 'unknown',
]);

export type DataSource = z.infer<typeof DataSourceSchema>;

// ─── Platform ──────────────────────────────────────────────────────────────────

export const PlatformSchema = z.enum(['windows', 'ios', 'android']);

export type Platform = z.infer<typeof PlatformSchema>;

// ─── Activity Event ────────────────────────────────────────────────────────────

export const ActivityEventSchema = z.object({
  id: z.string().uuid(),
  client_event_id: z.string().uuid(),
  user_id: z.string().uuid(),
  device_id: z.string().uuid(),
  source: DataSourceSchema,
  source_platform: PlatformSchema,
  capture_source: z.string(),
  start_at: z.string().datetime(),
  end_at: z.string().datetime(),
  timezone: z.string(),
  duration_seconds: z.number().int().nonnegative(),
  category: CanonicalCategorySchema,
  task_label: z.string().nullable().optional(),
  ticket_ref: z.string().nullable().optional(),
  description: z.string().nullable().optional(),
  confidence: z.number().min(0).max(1),
  schema_version: z.number().int().positive(),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
  synced_at: z.string().datetime().nullable().optional(),
  expires_at: z.string().datetime().nullable().optional(),
});

export type ActivityEvent = z.infer<typeof ActivityEventSchema>;

// ─── Entitlements ──────────────────────────────────────────────────────────────

export const EntitlementsSchema = z.object({
  plan: z.string().nullable(),
  status: z.string(),
  team_ids: z.array(z.string().uuid()),
  active_team_id: z.string().uuid().nullable(),
  features: z.object({
    sync: z.boolean(),
    cloud_ai: z.boolean(),
    integrations: z.boolean(),
  }),
});

export type Entitlements = z.infer<typeof EntitlementsSchema>;

// ─── Profile ───────────────────────────────────────────────────────────────────

export const ProfileSchema = z.object({
  id: z.string().uuid(),
  display_name: z.string().nullable(),
  avatar_url: z.string().url().nullable(),
  role: z.enum(['pm', 'worker']),
  created_at: z.string().datetime(),
});

export type Profile = z.infer<typeof ProfileSchema>;

// ─── Team ──────────────────────────────────────────────────────────────────────

export const TeamSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  owner_id: z.string().uuid(),
  is_active: z.boolean(),
  created_at: z.string().datetime(),
});

export type Team = z.infer<typeof TeamSchema>;

// ─── Coach Message ─────────────────────────────────────────────────────────────

export const CoachMessageSchema = z.object({
  id: z.string(),
  role: z.enum(['user', 'assistant']),
  content: z.string(),
  created_at: z.string().datetime(),
  usage: z.object({
    used: z.number().int(),
    limit: z.number().int(),
    remaining: z.number().int(),
  }).nullable().optional(),
});

export type CoachMessage = z.infer<typeof CoachMessageSchema>;

// ─── Coach Request / Response ──────────────────────────────────────────────────

export const CoachRequestSchema = z.object({
  message: z.string().min(1).max(500),
  team_id: z.string().uuid().optional(),
  history: z.array(z.object({
    role: z.enum(['user', 'assistant']),
    content: z.string(),
  })).optional(),
  local_context: z.record(z.unknown()).optional(),
});

export const CoachResponseSchema = z.object({
  reply: z.string(),
  reasoning: z.string().nullable().optional(),
  usage: z.object({
    used: z.number().int(),
    limit: z.number().int(),
    remaining: z.number().int(),
    planId: z.string(),
    allowed: z.boolean(),
  }),
});

// ─── Privacy Preferences ──────────────────────────────────────────────────────

export const PrivacyPreferencesSchema = z.object({
  notice_version: z.string(),
  cloud_sync_enabled: z.boolean(),
  cloud_ai_enabled: z.boolean(),
});

export type PrivacyPreferences = z.infer<typeof PrivacyPreferencesSchema>;

// ─── Sync Queue ────────────────────────────────────────────────────────────────

export const SyncStatusSchema = z.enum(['pending', 'sending', 'synced', 'failed']);

export const SyncQueueItemSchema = z.object({
  id: z.string().uuid(),
  event_id: z.string().uuid(),
  status: SyncStatusSchema,
  retry_count: z.number().int().nonnegative(),
  last_error: z.string().nullable(),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
});

export type SyncQueueItem = z.infer<typeof SyncQueueItemSchema>;

// ─── Device Registration ──────────────────────────────────────────────────────

export const DeviceRegistrationSchema = z.object({
  id: z.string().uuid(),
  user_id: z.string().uuid(),
  platform: PlatformSchema,
  installation_id: z.string(),
  app_version: z.string(),
  capabilities: z.object({
    manual_timer: z.boolean(),
    device_activity: z.boolean(),
    desktop_sync: z.boolean(),
  }),
  last_seen_at: z.string().datetime(),
  created_at: z.string().datetime(),
  revoked_at: z.string().datetime().nullable(),
});

export type DeviceRegistration = z.infer<typeof DeviceRegistrationSchema>;

// ─── User Preferences (mobile) ────────────────────────────────────────────────

export const UserPreferencesSchema = z.object({
  display_name: z.string().min(1).max(100),
  roles: z.array(z.string()),
  activities: z.array(z.string()),
  objectives: z.array(z.string()),
  daily_goal_minutes: z.number().int().min(1).max(1440),
  onboarding_completed: z.boolean(),
  theme: z.enum(['light', 'dark', 'system']),
  notifications_enabled: z.boolean(),
  retention_days: z.number().int().min(1).max(365),
});

export type UserPreferences = z.infer<typeof UserPreferencesSchema>;

// ─── Insight Report ────────────────────────────────────────────────────────────

export const InsightReportSchema = z.object({
  id: z.string().uuid(),
  period_start: z.string(),
  period_end: z.string(),
  insight_type: z.string(),
  content: z.record(z.unknown()),
  created_at: z.string().datetime(),
});

export type InsightReport = z.infer<typeof InsightReportSchema>;
