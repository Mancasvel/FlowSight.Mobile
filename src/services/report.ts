/**
 * Report Service ù Local deterministic insights plus optional cloud reports.
 */

import { getDailyStats, getWeeklyStats } from '@/storage';
import { getTodayDate, getWeekStartDate, formatDurationShort } from '@/utils/format';
import { summarizeFocus, type ActivitySample } from '@/focus-spec';
import { getClient } from './auth';
import { canCloudAI, getEntitlements } from './entitlements';

export interface LocalReport {
  date: string;
  totalSeconds: number;
  categories: Array<{ category: string; totalSeconds: number; sessionCount: number }>;
  focus: ReturnType<typeof summarizeFocus>;
}

export interface CloudReport {
  insight: unknown;
  generatedAt: string;
}

export async function generateLocalReport(date = getTodayDate()): Promise<LocalReport> {
  const { rows, totalSeconds } = await getDailyStats(date);

  const samples: ActivitySample[] = rows.map((row) => ({
    start_at: `${date}T09:00:00.000Z`,
    duration_seconds: row.total_seconds,
    category: row.category as ActivitySample['category'],
    theme_hint: null,
    source: 'manual_timer',
  }));

  return {
    date,
    totalSeconds,
    categories: rows.map((r) => ({
      category: r.category,
      totalSeconds: r.total_seconds,
      sessionCount: r.session_count,
    })),
    focus: summarizeFocus(samples),
  };
}

export async function generateCloudReport(periodDays = 7): Promise<CloudReport> {
  const entitlements = await getEntitlements();
  if (!canCloudAI(entitlements)) {
    throw new Error('Cloud insights are not available in this iPhone app');
  }

  const weekStart = getWeekStartDate();
  const weekly = await getWeeklyStats(weekStart, getTodayDate());
  const localReport = await generateLocalReport();

  const insight = await getClient().generateInsight({
    periodDays,
    localReport: { weekly, local: localReport },
  });

  return { insight, generatedAt: new Date().toISOString() };
}

export function formatReportText(report: LocalReport): string {
  const lines = [
    `FlowSight ù ${report.date}`,
    `Total: ${formatDurationShort(report.totalSeconds)}`,
    `Deep focus: ${formatDurationShort(report.focus.deep_focus_seconds)}`,
    '',
    ...report.categories.map(
      (c) => `${c.category}: ${formatDurationShort(c.totalSeconds)} (${c.sessionCount})`
    ),
  ];
  return lines.join('\n');
}
