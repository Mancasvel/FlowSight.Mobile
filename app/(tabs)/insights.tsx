/**
 * Insights Screen — Summary, categories, timeline, Deep Focus.
 *
 * Uses the canonical focus-spec algorithm for Deep Focus detection.
 * Shows data source provenance and coverage.
 */

import React, { useState, useEffect, useCallback } from 'react';
import { View, ScrollView, Pressable, Share } from 'react-native';
import { Screen, Card, Typography, Badge, EmptyState, Button } from '@/components';
import { useTheme } from '@/theme';
import { spacing, radius, colors, fontSize, fontWeight } from '@/theme/tokens';
import { getDailyStats, getWeeklyStats, getPreference } from '@/storage';
import { summarizeFocus, type ActivitySample, CANONICAL_CATEGORIES } from '@/focus-spec';
import { formatDurationShort, getTodayDate, getWeekStartDate, formatPercent } from '@/utils/format';

type Period = 'today' | 'week' | 'month';

export default function InsightsScreen() {
  const { theme } = useTheme();
  const [period, setPeriod] = useState<Period>('today');
  const [totalSeconds, setTotalSeconds] = useState(0);
  const [categoryBreakdown, setCategoryBreakdown] = useState<Array<{ category: string; seconds: number }>>([]);
  const [focusSummary, setFocusSummary] = useState<ReturnType<typeof summarizeFocus> | null>(null);
  const [dailyGoalMinutes, setDailyGoalMinutes] = useState(480);

  const loadStats = useCallback(async () => {
    const goal = await getPreference('daily_goal_minutes');
    if (goal) setDailyGoalMinutes(parseInt(goal) || 480);

    let stats: { rows: Array<{ category: string; total_seconds: number }>; totalSeconds: number };

    if (period === 'today') {
      const today = getTodayDate();
      stats = await getDailyStats(today);
    } else {
      const startDate = getWeekStartDate();
      const today = getTodayDate();
      const weeklyRows = await getWeeklyStats(startDate, today);
      const totalSec = weeklyRows.reduce((sum, r) => sum + r.total_seconds, 0);
      // For weekly, we need category breakdown from daily stats
      const todayStats = await getDailyStats(today);
      stats = { rows: todayStats.rows, totalSeconds: totalSec };
    }

    setTotalSeconds(stats.totalSeconds);
    setCategoryBreakdown(
      stats.rows.map((r) => ({ category: r.category, seconds: r.total_seconds }))
    );

    // Calculate focus summary
    if (stats.rows.length > 0) {
      const samples: ActivitySample[] = stats.rows.map((r) => ({
        start_at: new Date().toISOString(),
        duration_seconds: r.seconds,
        category: r.category as any,
        source: 'manual_timer',
      }));
      const summary = summarizeFocus(samples);
      setFocusSummary(summary);
    } else {
      setFocusSummary(null);
    }
  }, [period]);

  useEffect(() => {
    loadStats();
  }, [loadStats]);

  const handleShare = useCallback(async () => {
    const text = [
      `FlowSight ${period === 'today' ? 'Today' : 'This Week'}`,
      `Total: ${formatDurationShort(totalSeconds)}`,
      focusSummary ? `Deep Focus: ${formatDurationShort(focusSummary.deep_focus_seconds)}` : '',
      ...categoryBreakdown.slice(0, 5).map((c) => `• ${c.category}: ${formatDurationShort(c.seconds)}`),
    ].filter(Boolean).join('\n');

    try {
      await Share.share({ message: text });
    } catch {}
  }, [period, totalSeconds, focusSummary, categoryBreakdown]);

  const topCategories = categoryBreakdown.slice(0, 8);
  const maxCategorySeconds = topCategories[0]?.seconds ?? 1;

  return (
    <Screen>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: spacing.xxxxl }}
      >
        {/* Header */}
        <View style={{ marginTop: spacing.xl, marginBottom: spacing.lg }}>
          <Typography variant="h1">Insights</Typography>
          <Typography variant="body" color={theme.textSecondary} style={{ marginTop: spacing.xs }}>
            Your work patterns at a glance
          </Typography>
        </View>

        {/* Period Selector */}
        <View style={{ flexDirection: 'row', marginBottom: spacing.lg, gap: spacing.sm }}>
          {(['today', 'week', 'month'] as Period[]).map((p) => (
            <Pressable
              key={p}
              onPress={() => setPeriod(p)}
              style={{
                paddingHorizontal: spacing.lg,
                paddingVertical: spacing.sm,
                borderRadius: radius.full,
                backgroundColor: period === p ? theme.primary : theme.surfaceSecondary,
              }}
            >
              <Typography
                variant="bodySmall"
                color={period === p ? '#FFFFFF' : theme.text}
                weight={period === p ? 'semibold' : 'regular'}
              >
                {p === 'today' ? 'Today' : p === 'week' ? 'This Week' : 'This Month'}
              </Typography>
            </Pressable>
          ))}
        </View>

        {/* Total Time */}
        <Card variant="elevated" style={{ marginBottom: spacing.lg }}>
          <Typography variant="label" color={theme.textSecondary}>
            Total Focus Time
          </Typography>
          <Typography variant="display" color={theme.primary} style={{ marginTop: spacing.xs, fontVariant: ['tabular-nums'] }}>
            {formatDurationShort(totalSeconds)}
          </Typography>
          {totalSeconds === 0 && (
            <Typography variant="bodySmall" color={theme.textTertiary} style={{ marginTop: spacing.xs }}>
              Start a timer to begin tracking
            </Typography>
          )}
        </Card>

        {/* Deep Focus */}
        <Card style={{ marginBottom: spacing.lg }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <Typography variant="label" color={theme.textSecondary}>
              Deep Focus
            </Typography>
            <Badge label="Proxy" variant="default" />
          </View>
          <Typography variant="h2" style={{ marginTop: spacing.sm, fontVariant: ['tabular-nums'] }}>
            {focusSummary ? formatDurationShort(focusSummary.deep_focus_seconds) : '0m'}
          </Typography>
          {focusSummary && focusSummary.deep_focus_sessions > 0 && (
            <Typography variant="bodySmall" color={theme.textSecondary} style={{ marginTop: spacing.xs }}>
              {focusSummary.deep_focus_sessions} session{focusSummary.deep_focus_sessions !== 1 ? 's' : ''} = 25 min
            </Typography>
          )}
          <Typography variant="caption" color={theme.textTertiary} style={{ marginTop: spacing.sm }}>
            Sustained focus-eligible activity without theme change. Not a measure of flow or productivity.
          </Typography>
        </Card>

        {/* Sessions & Fragmentation */}
        {focusSummary && focusSummary.total_sessions > 0 && (
          <Card style={{ marginBottom: spacing.lg }}>
            <Typography variant="h3" style={{ marginBottom: spacing.md }}>
              Sessions
            </Typography>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: spacing.sm }}>
              <Typography variant="body" color={theme.textSecondary}>Total sessions</Typography>
              <Typography variant="body" weight="semibold">{focusSummary.total_sessions}</Typography>
            </View>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: spacing.sm }}>
              <Typography variant="body" color={theme.textSecondary}>Interrupted</Typography>
              <Typography variant="body" weight="semibold">{focusSummary.interrupted_sessions}</Typography>
            </View>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: spacing.sm }}>
              <Typography variant="body" color={theme.textSecondary}>Theme switches</Typography>
              <Typography variant="body" weight="semibold">{focusSummary.theme_switches}</Typography>
            </View>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <Typography variant="body" color={theme.textSecondary}>Fragmentation</Typography>
              <Typography variant="body" weight="semibold">{formatPercent(focusSummary.fragmentation_pct)}</Typography>
            </View>
          </Card>
        )}

        {/* Category Breakdown */}
        <Card style={{ marginBottom: spacing.lg }}>
          <Typography variant="h3" style={{ marginBottom: spacing.md }}>
            Categories
          </Typography>
          {topCategories.length === 0 ? (
            <EmptyState
              title="No activity yet"
              description="Your category breakdown will appear here"
            />
          ) : (
            topCategories.map((cat) => (
              <View key={cat.category} style={{ marginBottom: spacing.md }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: spacing.xs }}>
                  <Typography variant="body">{cat.category}</Typography>
                  <Typography variant="body" color={theme.textSecondary}>
                    {formatDurationShort(cat.seconds)}
                  </Typography>
                </View>
                <View
                  style={{
                    height: 6,
                    backgroundColor: theme.surfaceSecondary,
                    borderRadius: radius.full,
                    overflow: 'hidden',
                  }}
                >
                  <View
                    style={{
                      width: `${(cat.seconds / maxCategorySeconds) * 100}%`,
                      height: '100%',
                      backgroundColor: colors.category[cat.category as keyof typeof colors.category] ?? colors.primary,
                      borderRadius: radius.full,
                    }}
                  />
                </View>
              </View>
            ))
          )}
        </Card>

        {/* Context Work */}
        {focusSummary && focusSummary.context_work_seconds > 0 && (
          <Card style={{ marginBottom: spacing.lg }}>
            <Typography variant="h3" style={{ marginBottom: spacing.sm }}>
              Context Work
            </Typography>
            <Typography variant="body" color={theme.textSecondary}>
              {formatDurationShort(focusSummary.context_work_seconds)} in meetings, planning, communication, admin, or sales.
            </Typography>
            <Typography variant="caption" color={theme.textTertiary} style={{ marginTop: spacing.xs }}>
              Context work is valuable and not counted as distraction.
            </Typography>
          </Card>
        )}

        {/* Distraction Events */}
        {focusSummary && focusSummary.distraction_events > 0 && (
          <Card style={{ marginBottom: spacing.lg }}>
            <Typography variant="h3" style={{ marginBottom: spacing.sm }}>
              Distraction Events
            </Typography>
            <Typography variant="body">
              {focusSummary.distraction_events} event{focusSummary.distraction_events !== 1 ? 's' : ''} ({formatDurationShort(focusSummary.distraction_seconds)})
            </Typography>
            <Typography variant="caption" color={theme.textTertiary} style={{ marginTop: spacing.xs }}>
              Sustained non-work browsing = 2 minutes.
            </Typography>
          </Card>
        )}

        {/* Export */}
        <Button
          title="Share Summary"
          onPress={handleShare}
          variant="secondary"
          style={{ marginBottom: spacing.lg }}
        />

        {/* Coverage Note */}
        <Card variant="flat">
          <Typography variant="caption" color={theme.textTertiary}>
            Deep Focus is an observable proxy of sustained work. It does not measure
            psychological flow, productivity, or work quality. Theme continuity is only
            known from explicit labels or tickets. Unlabelled task switches may be missed.
          </Typography>
        </Card>
      </ScrollView>
    </Screen>
  );
}
