import { describe, test, expect } from 'vitest';
/**
 * Focus Spec — Parity tests against Rust focus_semantics.rs fixtures.
 */

import { summarizeFocus, type ActivitySample, THRESHOLDS } from '../../src/focus-spec/index';

function sample(
  day: number, hour: number, minute: number,
  seconds: number, category: string, theme?: string | null
): ActivitySample {
  const start = new Date(2026, 7, day, hour, minute, 0);
  return {
    start_at: start.toISOString(),
    duration_seconds: seconds,
    category: category as any,
    theme_hint: theme ?? null,
    source: 'manual_timer',
  };
}

describe('focus-spec parity with Rust fixtures', () => {
  test('writing_then_research_same_task: same theme ? one deep session', () => {
    const result = summarizeFocus([
      sample(22, 9, 0, 900, 'Writing', 'Policy brief'),
      sample(22, 9, 15, 900, 'Research', 'Policy brief'),
    ]);
    expect(result.deep_focus_seconds).toBe(1800);
    expect(result.deep_focus_sessions).toBe(1);
    expect(result.total_sessions).toBe(1);
    expect(result.interrupted_sessions).toBe(0);
    expect(result.theme_switches).toBe(0);
    expect(result.distraction_events).toBe(0);
  });

  test('one_general_sensor_blip: General = 60s is grace break', () => {
    const result = summarizeFocus([
      sample(22, 9, 0, 720, 'Analysis', 'Forecast'),
      sample(22, 9, 12, 60, 'General', 'Forecast'),
      sample(22, 9, 13, 840, 'Analysis', 'Forecast'),
    ]);
    expect(result.deep_focus_seconds).toBe(1560);
    expect(result.deep_focus_sessions).toBe(1);
    expect(result.total_sessions).toBe(1);
    expect(result.interrupted_sessions).toBe(1);
  });

  test('confirmed_browsing_break: Browsing = 120s breaks deep focus', () => {
    const result = summarizeFocus([
      sample(22, 9, 0, 900, 'Design', 'Prototype'),
      sample(22, 9, 15, 120, 'Browsing'),
      sample(22, 9, 17, 900, 'Design', 'Prototype'),
    ]);
    expect(result.deep_focus_seconds).toBe(0);
    expect(result.total_sessions).toBe(2);
    expect(result.distraction_events).toBe(1);
  });

  test('meeting_between_two_deep_blocks: Meeting is context work', () => {
    const result = summarizeFocus([
      sample(22, 9, 0, 1500, 'Writing', 'Proposal'),
      sample(22, 9, 25, 120, 'Meeting'),
      sample(22, 9, 27, 1500, 'Writing', 'Proposal'),
    ]);
    expect(result.deep_focus_seconds).toBe(3000);
    expect(result.deep_focus_sessions).toBe(2);
    expect(result.context_work_seconds).toBe(120);
    expect(result.distraction_events).toBe(0);
  });

  test('explicit_task_change: different themes ? theme switch', () => {
    const result = summarizeFocus([
      sample(22, 9, 0, 900, 'Research', 'Market study'),
      sample(22, 9, 15, 900, 'Analysis', 'Budget review'),
    ]);
    expect(result.theme_switches).toBe(1);
    expect(result.total_sessions).toBe(2);
  });

  test('single_observation_crosses_midnight: splits at day boundary', () => {
    const result = summarizeFocus([
      sample(22, 23, 50, 1800, 'Documentation', 'Procedure'),
    ]);
    expect(result.total_sessions).toBe(2);
  });

  test('non_developer_analysis_block: Analysis is focus-eligible', () => {
    const result = summarizeFocus([
      sample(22, 11, 0, 1500, 'Analysis', 'Survey results'),
    ]);
    expect(result.deep_focus_seconds).toBe(1500);
    expect(result.deep_focus_sessions).toBe(1);
  });

  test('valuable_coordination_only: context categories are not distraction', () => {
    const result = summarizeFocus([
      sample(22, 13, 0, 600, 'Planning', 'Launch'),
      sample(22, 13, 10, 600, 'Communication', 'Launch'),
      sample(22, 13, 20, 600, 'Sales', 'Launch'),
    ]);
    expect(result.deep_focus_seconds).toBe(0);
    expect(result.context_work_seconds).toBe(1800);
    expect(result.distraction_events).toBe(0);
  });

  test('meeting_then_different_explicit_task: Meeting + theme change', () => {
    const result = summarizeFocus([
      sample(22, 16, 0, 900, 'Writing', 'Customer proposal'),
      sample(22, 16, 15, 300, 'Meeting', 'Customer proposal'),
      sample(22, 16, 20, 900, 'Analysis', 'Quarterly forecast'),
    ]);
    expect(result.theme_switches).toBe(1);
    expect(result.context_work_seconds).toBe(300);
  });
});

describe('focus-spec edge cases', () => {
  test('empty samples ? zero summary', () => {
    const r = summarizeFocus([]);
    expect(r.deep_focus_seconds).toBe(0);
    expect(r.total_sessions).toBe(0);
    expect(r.sessions).toEqual([]);
  });

  test('single short sample is not deep', () => {
    const r = summarizeFocus([sample(22, 9, 0, 300, 'Coding')]);
    expect(r.deep_focus_seconds).toBe(0);
  });

  test('single = 25 min sample is deep', () => {
    const r = summarizeFocus([sample(22, 9, 0, 1500, 'Coding')]);
    expect(r.deep_focus_seconds).toBe(1500);
    expect(r.deep_focus_sessions).toBe(1);
  });

  test('Browsing < 120s is not distraction', () => {
    const r = summarizeFocus([
      sample(22, 9, 0, 900, 'Coding'),
      sample(22, 9, 15, 60, 'Browsing'),
      sample(22, 9, 16, 900, 'Coding'),
    ]);
    expect(r.distraction_events).toBe(0);
  });

  test('Idle is never distraction', () => {
    const r = summarizeFocus([
      sample(22, 9, 0, 900, 'Coding'),
      sample(22, 9, 15, 300, 'Idle'),
      sample(22, 9, 20, 900, 'Coding'),
    ]);
    expect(r.distraction_events).toBe(0);
  });

  test('proxy disclaimer always present', () => {
    const r = summarizeFocus([sample(22, 9, 0, 900, 'Coding')]);
    expect(r.proxy_disclaimer).toContain('observable proxy');
  });
});
