import { describe, test, expect } from 'vitest';
/**
 * Contracts — Zod schema validation tests.
 */

import {
  ActivityEventSchema,
  EntitlementsSchema,
  CanonicalCategorySchema,
  DataSourceSchema,
  CoachRequestSchema,
  PrivacyPreferencesSchema,
  UserPreferencesSchema,
} from '../../src/contracts/index';

describe('ActivityEventSchema', () => {
  const validEvent = {
    id: '123e4567-e89b-12d3-a456-426614174000',
    client_event_id: '123e4567-e89b-12d3-a456-426614174001',
    user_id: '123e4567-e89b-12d3-a456-426614174002',
    device_id: '123e4567-e89b-12d3-a456-426614174003',
    source: 'manual_timer',
    source_platform: 'ios',
    capture_source: 'manual',
    start_at: '2026-08-22T09:00:00.000Z',
    end_at: '2026-08-22T10:00:00.000Z',
    timezone: 'Europe/Madrid',
    duration_seconds: 3600,
    category: 'Coding',
    confidence: 1.0,
    schema_version: 1,
    created_at: '2026-08-22T09:00:00.000Z',
    updated_at: '2026-08-22T09:00:00.000Z',
  };

  test('accepts valid event', () => {
    expect(() => ActivityEventSchema.parse(validEvent)).not.toThrow();
  });

  test('rejects invalid UUID', () => {
    expect(() => ActivityEventSchema.parse({ ...validEvent, id: 'not-a-uuid' })).toThrow();
  });

  test('rejects invalid category', () => {
    expect(() => ActivityEventSchema.parse({ ...validEvent, category: 'Invalid' })).toThrow();
  });

  test('rejects confidence > 1', () => {
    expect(() => ActivityEventSchema.parse({ ...validEvent, confidence: 1.5 })).toThrow();
  });

  test('rejects negative duration', () => {
    expect(() => ActivityEventSchema.parse({ ...validEvent, duration_seconds: -1 })).toThrow();
  });
});

describe('CanonicalCategorySchema', () => {
  test('accepts all 20 categories', () => {
    const cats = [
      'Analysis', 'Writing', 'Coding', 'Debugging', 'CodeReview',
      'Testing', 'Documentation', 'Design', 'Planning', 'Meeting',
      'Communication', 'Research', 'Learning', 'DevOps', 'Database',
      'Sales', 'Admin', 'Browsing', 'Idle', 'General',
    ];
    for (const cat of cats) {
      expect(() => CanonicalCategorySchema.parse(cat)).not.toThrow();
    }
  });

  test('rejects unknown category', () => {
    expect(() => CanonicalCategorySchema.parse('Productivity')).toThrow();
  });
});

describe('EntitlementsSchema', () => {
  test('accepts valid entitlements', () => {
    expect(() => EntitlementsSchema.parse({
      plan: 'individual', status: 'active', team_ids: [], active_team_id: null,
      features: { sync: true, cloud_ai: true, integrations: true },
    })).not.toThrow();
  });

  test('accepts free entitlements', () => {
    expect(() => EntitlementsSchema.parse({
      plan: null, status: 'free', team_ids: [], active_team_id: null,
      features: { sync: false, cloud_ai: false, integrations: false },
    })).not.toThrow();
  });
});

describe('CoachRequestSchema', () => {
  test('accepts valid request', () => {
    expect(() => CoachRequestSchema.parse({ message: 'How is my focus?' })).not.toThrow();
  });

  test('rejects empty message', () => {
    expect(() => CoachRequestSchema.parse({ message: '' })).toThrow();
  });

  test('rejects message > 500 chars', () => {
    expect(() => CoachRequestSchema.parse({ message: 'x'.repeat(501) })).toThrow();
  });
});

describe('UserPreferencesSchema', () => {
  test('accepts valid preferences', () => {
    expect(() => UserPreferencesSchema.parse({
      display_name: 'Test', roles: ['Engineer'], activities: ['Coding'],
      objectives: ['Focus'], daily_goal_minutes: 480, onboarding_completed: true,
      theme: 'system', notifications_enabled: false, retention_days: 365,
    })).not.toThrow();
  });

  test('rejects daily_goal < 1', () => {
    expect(() => UserPreferencesSchema.parse({
      display_name: 'Test', roles: [], activities: [], objectives: [],
      daily_goal_minutes: 0, onboarding_completed: false, theme: 'system',
      notifications_enabled: false, retention_days: 365,
    })).toThrow();
  });
});
