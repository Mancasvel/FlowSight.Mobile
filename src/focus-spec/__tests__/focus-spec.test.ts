/**
 * Focus Spec — Parity tests against Rust focus_semantics.rs fixtures.
 *
 * These tests use the SAME fixture data as:
 *   apps/agent/src-tauri/testdata/focus_timeline_cases.json
 *
 * The TypeScript implementation must produce identical results to the Rust
 * implementation for all 12 scenarios.
 */

import { summarizeFocus, type ActivitySample, THRESHOLDS } from '../index';

// ─── Fixtures (from focus_timeline_cases.json) ────────────────────────────────

function sample(
  day: number,
  hour: number,
  minute: number,
  seconds: number,
  category: string,
  theme?: string | null
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
  test('writing_then_research_same_task: two samples, same theme → one deep session', () => {
    const samples = [
      sample(22, 9, 0, 900, 'Writing', 'Policy brief'),
      sample(22, 9, 15, 900, 'Research', 'Policy brief'),
    ];
    const result = summarizeFocus(samples);

    expect(result.deep_focus_seconds).toBe(1800);
    expect(result.deep_focus_sessions).toBe(1);
    expect(result.total_sessions).toBe(1);
    expect(result.interrupted_sessions).toBe(0);
    expect(result.theme_switches).toBe(0);
    expect(result.resume_events).toBe(0);
    expect(result.distraction_events).toBe(0);
    expect(result.context_work_seconds).toBe(0);
  });

  test('one_general_sensor_blip: General ≤ 60s is grace break, not interruption', () => {
    const samples = [
      sample(22, 9, 0, 720, 'Analysis', 'Forecast'),
      sample(22, 9, 12, 60, 'General', 'Forecast'),
      sample(22, 9, 13, 840, 'Analysis', 'Forecast'),
    ];
    const result = summarizeFocus(samples);

    expect(result.deep_focus_seconds).toBe(1560);
    expect(result.deep_focus_sessions).toBe(1);
    expect(result.total_sessions).toBe(1);
    expect(result.interrupted_sessions).toBe(1); // Grace break marks as interrupted
    expect(result.theme_switches).toBe(0);
    expect(result.distraction_events).toBe(0);
  });

  test('confirmed_browsing_break: Browsing ≥ 120s breaks deep focus', () => {
    const samples = [
      sample(22, 9, 0, 900, 'Design', 'Prototype'),
      sample(22, 9, 15, 120, 'Browsing'),
      sample(22, 9, 17, 900, 'Design', 'Prototype'),
    ];
    const result = summarizeFocus(samples);

    expect(result.deep_focus_seconds).toBe(0);
    expect(result.deep_focus_sessions).toBe(0);
    expect(result.total_sessions).toBe(2);
    expect(result.interrupted_sessions).toBe(1);
    expect(result.distraction_events).toBe(1);
  });

  test('meeting_between_two_deep_blocks: Meeting is context work, not distraction', () => {
    const samples = [
      sample(22, 9, 0, 1500, 'Writing', 'Proposal'),
      sample(22, 9, 25, 120, 'Meeting'),
      sample(22, 9, 27, 1500, 'Writing', 'Proposal'),
    ];
    const result = summarizeFocus(samples);

    expect(result.deep_focus_seconds).toBe(3000);
    expect(result.deep_focus_sessions).toBe(2);
    expect(result.total_sessions).toBe(2);
    expect(result.interrupted_sessions).toBe(1);
    expect(result.theme_switches).toBe(0);
    expect(result.resume_events).toBe(1);
    expect(result.distraction_events).toBe(0);
    expect(result.context_work_seconds).toBe(120);
  });

  test('explicit_task_change: different themes → theme switch', () => {
    const samples = [
      sample(22, 9, 0, 900, 'Research', 'Market study'),
      sample(22, 9, 15, 900, 'Analysis', 'Budget review'),
    ];
    const result = summarizeFocus(samples);

    expect(result.deep_focus_seconds).toBe(0);
    expect(result.deep_focus_sessions).toBe(0);
    expect(result.total_sessions).toBe(2);
    expect(result.interrupted_sessions).toBe(1);
    expect(result.theme_switches).toBe(1);
  });

  test('single_observation_crosses_midnight: splits at day boundary', () => {
    const samples = [
      sample(22, 23, 50, 1800, 'Documentation', 'Procedure'),
    ];
    const result = summarizeFocus(samples);

    // Crosses midnight → 2 sessions (one ending at 00:00, one starting at 00:00)
    expect(result.total_sessions).toBe(2);
    expect(result.interrupted_sessions).toBe(0);
  });

  test('non_developer_analysis_block: Analysis is focus-eligible', () => {
    const samples = [
      sample(22, 11, 0, 1500, 'Analysis', 'Survey results'),
    ];
    const result = summarizeFocus(samples);

    expect(result.deep_focus_seconds).toBe(1500);
    expect(result.deep_focus_sessions).toBe(1);
    expect(result.total_sessions).toBe(1);
  });

  test('valuable_coordination_only: Planning/Communication/Sales are context work', () => {
    const samples = [
      sample(22, 13, 0, 600, 'Planning', 'Launch'),
      sample(22, 13, 10, 600, 'Communication', 'Launch'),
      sample(22, 13, 20, 600, 'Sales', 'Launch'),
    ];
    const result = summarizeFocus(samples);

    expect(result.deep_focus_seconds).toBe(0);
    expect(result.deep_focus_sessions).toBe(0);
    expect(result.total_sessions).toBe(0);
    expect(result.context_work_seconds).toBe(1800);
    expect(result.distraction_events).toBe(0);
  });

  test('overlap_is_clipped: overlapping samples handled', () => {
    const samples = [
      sample(22, 14, 0, 900, 'Learning', 'Course'),
      sample(22, 14, 10, 900, 'Learning', 'Course'),
    ];
    const result = summarizeFocus(samples);

    expect(result.deep_focus_seconds).toBe(1500);
    expect(result.deep_focus_sessions).toBe(1);
    expect(result.total_sessions).toBe(1);
  });

  test('noise_beyond_grace_breaks: General > 60s breaks focus', () => {
    const samples = [
      sample(22, 15, 0, 900, 'Documentation', 'Handbook'),
      sample(22, 15, 15, 120, 'General', 'Handbook'),
      sample(22, 15, 17, 900, 'Documentation', 'Handbook'),
    ];
    const result = summarizeFocus(samples);

    // General > 60s is not a grace break, so it breaks the session
    expect(result.total_sessions).toBe(2);
    expect(result.interrupted_sessions).toBe(1);
  });

  test('meeting_then_different_explicit_task: Meeting + theme change', () => {
    const samples = [
      sample(22, 16, 0, 900, 'Writing', 'Customer proposal'),
      sample(22, 16, 15, 300, 'Meeting', 'Customer proposal'),
      sample(22, 16, 20, 900, 'Analysis', 'Quarterly forecast'),
    ];
    const result = summarizeFocus(samples);

    expect(result.deep_focus_seconds).toBe(0);
    expect(result.total_sessions).toBe(2);
    expect(result.interrupted_sessions).toBe(1);
    expect(result.theme_switches).toBe(1);
    expect(result.context_work_seconds).toBe(300);
  });

  test('two_uncertain_samples_are_not_a_micro_blip: multiple short breaks', () => {
    const samples = [
      sample(22, 17, 0, 600, 'Research', 'Literature review'),
      sample(22, 17, 10, 30, 'General', 'Literature review'),
      sample(22, 17, 10, 30, 'Idle', 'Literature review'),
      sample(22, 17, 11, 900, 'Writing', 'Literature review'),
    ];
    const result = summarizeFocus(samples);

    expect(result.deep_focus_seconds).toBe(0);
    expect(result.total_sessions).toBe(2);
    expect(result.interrupted_sessions).toBe(1);
  });
});

describe('focus-spec edge cases', () => {
  test('empty samples returns zero summary', () => {
    const result = summarizeFocus([]);
    expect(result.deep_focus_seconds).toBe(0);
    expect(result.total_sessions).toBe(0);
    expect(result.sessions).toEqual([]);
  });

  test('single short sample is not deep focus', () => {
    const samples = [sample(22, 9, 0, 300, 'Coding')];
    const result = summarizeFocus(samples);
    expect(result.deep_focus_seconds).toBe(0);
    expect(result.deep_focus_sessions).toBe(0);
  });

  test('single deep sample (≥ 25 min) counts as deep focus', () => {
    const samples = [sample(22, 9, 0, 1500, 'Coding')];
    const result = summarizeFocus(samples);
    expect(result.deep_focus_seconds).toBe(1500);
    expect(result.deep_focus_sessions).toBe(1);
  });

  test('Browsing < 120s is not a distraction event', () => {
    const samples = [
      sample(22, 9, 0, 900, 'Coding'),
      sample(22, 9, 15, 60, 'Browsing'),
      sample(22, 9, 16, 900, 'Coding'),
    ];
    const result = summarizeFocus(samples);
    expect(result.distraction_events).toBe(0);
  });

  test('Browsing ≥ 120s is a distraction event', () => {
    const samples = [
      sample(22, 9, 0, 900, 'Coding'),
      sample(22, 9, 15, 120, 'Browsing'),
      sample(22, 9, 17, 900, 'Coding'),
    ];
    const result = summarizeFocus(samples);
    expect(result.distraction_events).toBe(1);
    expect(result.distraction_seconds).toBe(120);
  });

  test('Idle is never a distraction', () => {
    const samples = [
      sample(22, 9, 0, 900, 'Coding'),
      sample(22, 9, 15, 300, 'Idle'),
      sample(22, 9, 20, 900, 'Coding'),
    ];
    const result = summarizeFocus(samples);
    expect(result.distraction_events).toBe(0);
  });

  test('Meeting is context work, never distraction', () => {
    const samples = [
      sample(22, 9, 0, 3600, 'Meeting'),
    ];
    const result = summarizeFocus(samples);
    expect(result.distraction_events).toBe(0);
    expect(result.context_work_seconds).toBe(3600);
  });

  test('proxy disclaimer is always present', () => {
    const result = summarizeFocus([sample(22, 9, 0, 900, 'Coding')]);
    expect(result.proxy_disclaimer).toContain('observable proxy');
    expect(result.proxy_disclaimer).toContain('not');
  });
});
