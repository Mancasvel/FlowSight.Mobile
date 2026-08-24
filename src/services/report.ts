/**
 * Report Service — Deterministic local reports and cloud AI reports.
 *
 * Local reports work offline and without entitlement.
 * Cloud reports require entitlement and cloud_ai consent.
 */

import { getDailyStats, getWeeklyStats, getPreference } from '@/storage';
import { summarizeFocus, type ActivitySample } from '@/focus-spec';
import { getClient } from './auth';
import { getEntitlements, canCloudAI } from './entitlements';
import { formatDurationShort, getTodayDate, getWeekStartDate } from '@/utils/format';

export interface LocalReport {
  type: 'local';
  period: string;
  totalHours: number;
  totalSeconds: number;
  dailyGoalMinutes: number;
  goalProgress: number;
  deepFocusHours: number;
  deepFocusSessions: number;
  topCategories: Array<{ category: string; hours: number }>;
  dailyTotals: Array<{ date: string; seconds: number }>;
  focusSemantics: {
    fragmentation_pct: number;
    theme_switches: number;
    distraction_events: number;
    context_work_seconds: number;
    proxy_disclaimer: string;
  };
  generatedAt: string;
}

export interface CloudReport {
  type: 'cloud';
  content: Record<string, unknown>;
  model: string;
  generatedAt: string;
}

/**
 * Generate a deterministic local report.
 * Works offline, no entitlement required.
 */
export async function generateLocalReport(periodDays: number = 7): Promise<LocalReport> {
  const today = getTodayDate();
  const goalStr = await getPreference('daily_goal_minutes');
  const dailyGoalMinutes = parseInt(goalStr ?? '480') || 480;

  // Get stats for the period
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - periodDays);
  const startDateStr = startDate.toISOString().split('T')[0];

  const weeklyRows = await getWeeklyStats(startDateStr, today);
  const totalSeconds = weeklyRows.reduce((sum, r) => sum + r.total_seconds, 0);

  // Get today's detailed stats for category breakdown
  const todayStats = await getDailyStats(today);
  const categoryBreakdown = todayStats.rows.map((r) => ({
    category: r.category,
    hours: Math.round((r.total_seconds / 3600) * 10) / 10,
  }));

  // Calculate focus summary
  const samples: ActivitySample[] = todayStats.rows.map((r) => ({
    start_at: new Date().toISOString(),
    duration_seconds: r.total_seconds,
    category: r.category as any,
    source: 'manual_timer',
  }));
  const focus = summarizeFocus(samples);

  const todayMinutes = Math.round(todayStats.totalSeconds / 60);

  return {
    type: 'local',
    period: `${periodDays} days`,
    totalHours: Math.round((totalSeconds / 3600) * 10) / 10,
    totalSeconds,
    dailyGoalMinutes,
    goalProgress: Math.min(todayMinutes / dailyGoalMinutes, 1),
    deepFocusHours: Math.round((focus.deep_focus_seconds / 3600) * 10) / 10,
    deepFocusSessions: focus.deep_focus_sessions,
    topCategories: categoryBreakdown.slice(0, 8),
    dailyTotals: weeklyRows.map((r) => ({ date: r.date, seconds: r.total_seconds })),
    focusSemantics: {
      fragmentation_pct: focus.fragmentation_pct,
      theme_switches: focus.theme_switches,
      distraction_events: focus.distraction_events,
      context_work_seconds: focus.context_work_seconds,
      proxy_disclaimer: focus.proxy_disclaimer,
    },
    generatedAt: new Date().toISOString(),
  };
}

/**
 * Generate a cloud AI report.
 * Requires entitlement and cloud_ai consent.
 */
export async function generateCloudReport(
  periodDays: number = 7,
  localReport?: LocalReport
): Promise<CloudReport> {
  const entitlements = await getEntitlements();
  if (!canCloudAI(entitlements)) {
    throw new Error('Cloud AI requires an active subscription');
  }

  const client = getClient();
  const result = await client.generateInsight({
    periodDays,
    localReport: localReport as unknown as Record<string, unknown>,
  });

  return {
    type: 'cloud',
    content: result.insight?.content ?? {},
    model: result.insight?.content?.model ?? 'unknown',
    generatedAt: new Date().toISOString(),
  };
}

/**
 * Format a local report as shareable text.
 */
export function formatReportText(report: LocalReport): string {
  const lines = [
    `FlowSight Report — ${report.period}`,
    '',
    `Total: ${formatDurationShort(report.totalSeconds)}`,
    `Deep Focus: ${formatDurationShort(report.deepFocusHours * 3600)} (${report.deepFocusSessions} sessions)`,
    `Goal: ${Math.round(report.goalProgress * 100)}%`,
    '',
    'Top Categories:',
    ...report.topCategories.map((c) => `  • ${c.category}: ${c.hours}h`),
    '',
    `Fragmentation: ${report.focusSemantics.fragmentation_pct}%`,
    `Theme switches: ${report.focusSemantics.theme_switches}`,
    `Distraction events: ${report.focusSemantics.distraction_events}`,
    '',
    report.focusSemantics.proxy_disclaimer,
  ];

  return lines.join('\n');
}
