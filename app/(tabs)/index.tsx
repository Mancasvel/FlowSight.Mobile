/**
 * Today Screen — Main screen with timer, progress, streak, and task selector.
 *
 * Timer uses persisted timestamps (not setInterval) for reliability.
 * Survives backgrounding, suspension, and relaunch.
 */

import React, { useState, useEffect, useCallback } from 'react';
import { View, ScrollView, Pressable } from 'react-native';
import { router } from 'expo-router';
import { Screen, Card, Typography, Button, Badge } from '@/components';
import { useTheme } from '@/theme';
import { useTimer } from '@/hooks';
import { spacing, radius, colors, fontSize, fontWeight } from '@/theme/tokens';
import { getPreference, getDailyStats } from '@/storage';
import { formatDuration } from '@/utils/format';

export default function TodayScreen() {
  const { theme } = useTheme();
  const timer = useTimer();
  const [userName, setUserName] = useState('');
  const [dailyGoalMinutes, setDailyGoalMinutes] = useState(480);
  const [todayMinutes, setTodayMinutes] = useState(0);
  const [streak, setStreak] = useState(0);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

  // Load preferences
  useEffect(() => {
    (async () => {
      const name = await getPreference('display_name');
      if (name) setUserName(name);
      const goal = await getPreference('daily_goal_minutes');
      if (goal) setDailyGoalMinutes(parseInt(goal) || 480);
    })();
  }, []);

  // Load today's stats
  useEffect(() => {
    (async () => {
      const today = new Date().toISOString().split('T')[0];
      const stats = await getDailyStats(today);
      setTodayMinutes(Math.round(stats.totalSeconds / 60));
    })();
  }, [timer.state]); // Refresh when timer state changes

  const goalProgress = Math.min(todayMinutes / dailyGoalMinutes, 1);
  const goalPct = Math.round(goalProgress * 100);

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 17) return 'Good afternoon';
    return 'Good evening';
  };

  const handleStartStop = useCallback(async () => {
    if (timer.isIdle) {
      await timer.start({ category: selectedCategory ?? undefined });
    } else {
      const result = await timer.stop();
      if (result) {
        // Refresh stats
        const today = new Date().toISOString().split('T')[0];
        const stats = await getDailyStats(today);
        setTodayMinutes(Math.round(stats.totalSeconds / 60));
      }
    }
  }, [timer, selectedCategory]);

  const handlePauseResume = useCallback(async () => {
    if (timer.isRunning) {
      await timer.pause();
    } else if (timer.isPaused) {
      await timer.resume();
    }
  }, [timer]);

  const categories = [
    'Coding', 'Writing', 'Research', 'Design', 'Meeting',
    'Planning', 'Debugging', 'Testing', 'Documentation', 'Communication',
  ];

  return (
    <Screen>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: spacing.xxxxl }}
      >
        {/* Header */}
        <View style={{ marginTop: spacing.xl, marginBottom: spacing.xxl }}>
          <Typography variant="bodySmall" color={theme.textSecondary}>
            {getGreeting()}{userName ? `, ${userName}` : ''}
          </Typography>
          <Typography variant="h1" style={{ marginTop: spacing.xs }}>
            Today
          </Typography>
        </View>

        {/* Daily Goal Progress */}
        <Card variant="elevated" style={{ marginBottom: spacing.lg }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <View>
              <Typography variant="label" color={theme.textSecondary}>
                Daily Goal
              </Typography>
              <Typography variant="h2" style={{ marginTop: spacing.xs }}>
                {todayMinutes} / {dailyGoalMinutes} min
              </Typography>
            </View>
            <Badge
              label={`${goalPct}%`}
              variant={goalPct >= 100 ? 'success' : goalPct >= 50 ? 'info' : 'default'}
            />
          </View>
          {/* Progress bar */}
          <View
            style={{
              marginTop: spacing.md,
              height: 8,
              backgroundColor: theme.surfaceSecondary,
              borderRadius: radius.full,
              overflow: 'hidden',
            }}
          >
            <View
              style={{
                width: `${goalPct}%`,
                height: '100%',
                backgroundColor: goalPct >= 100 ? colors.success : colors.primary,
                borderRadius: radius.full,
              }}
            />
          </View>
        </Card>

        {/* Timer */}
        <Card style={{ marginBottom: spacing.lg, alignItems: 'center', paddingVertical: spacing.xxl }}>
          {/* Circular progress indicator */}
          <View style={{ position: 'relative', width: 200, height: 200, justifyContent: 'center', alignItems: 'center' }}>
            {/* Background circle */}
            <View
              style={{
                position: 'absolute',
                width: 200,
                height: 200,
                borderRadius: 100,
                borderWidth: 8,
                borderColor: theme.surfaceSecondary,
              }}
            />
            {/* Progress circle (simplified) */}
            {timer.isRunning && (
              <View
                style={{
                  position: 'absolute',
                  width: 200,
                  height: 200,
                  borderRadius: 100,
                  borderWidth: 8,
                  borderColor: 'transparent',
                  borderTopColor: theme.primary,
                  borderRightColor: goalProgress > 0.25 ? theme.primary : 'transparent',
                  borderBottomColor: goalProgress > 0.5 ? theme.primary : 'transparent',
                  borderLeftColor: goalProgress > 0.75 ? theme.primary : 'transparent',
                  transform: [{ rotate: '-90deg' }],
                }}
              />
            )}
            {/* Timer display */}
            <Typography
              variant="display"
              color={timer.isRunning ? theme.primary : timer.isPaused ? colors.warning : theme.text}
              style={{ fontVariant: ['tabular-nums'] }}
            >
              {formatDuration(timer.elapsed)}
            </Typography>
          </View>

          {/* Status */}
          <Typography variant="bodySmall" color={theme.textSecondary} style={{ marginTop: spacing.md }}>
            {timer.isIdle
              ? 'Start a focus session'
              : timer.isRunning
                ? 'Focusing...'
                : 'Paused'}
          </Typography>

          {/* Category selector (when idle) */}
          {timer.isIdle && (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={{ marginTop: spacing.lg, maxHeight: 40 }}
              contentContainerStyle={{ gap: spacing.sm }}
            >
              {categories.map((cat) => (
                <Pressable
                  key={cat}
                  onPress={() => setSelectedCategory(selectedCategory === cat ? null : cat)}
                  style={{
                    paddingHorizontal: spacing.md,
                    paddingVertical: spacing.sm,
                    borderRadius: radius.full,
                    backgroundColor: selectedCategory === cat ? theme.primary : theme.surfaceSecondary,
                  }}
                >
                  <Typography
                    variant="caption"
                    color={selectedCategory === cat ? '#FFFFFF' : theme.text}
                  >
                    {cat}
                  </Typography>
                </Pressable>
              ))}
            </ScrollView>
          )}

          {/* Controls */}
          <View style={{ flexDirection: 'row', marginTop: spacing.xl, gap: spacing.md }}>
            {timer.isIdle ? (
              <Button title="Start Focus" onPress={handleStartStop} size="lg" />
            ) : (
              <>
                <Button
                  title={timer.isRunning ? 'Pause' : 'Resume'}
                  onPress={handlePauseResume}
                  variant="secondary"
                  size="lg"
                />
                <Button title="Stop" onPress={handleStartStop} variant="danger" size="lg" />
              </>
            )}
          </View>
        </Card>

        {/* Source Indicator */}
        <Card variant="flat" style={{ marginBottom: spacing.lg }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <Typography variant="label" color={theme.textSecondary}>
              Data Source
            </Typography>
            <Badge label="Manual Timer" variant="default" />
          </View>
          <Typography variant="bodySmall" color={theme.textTertiary} style={{ marginTop: spacing.xs }}>
            Time tracked by you. No device permissions required.
          </Typography>
        </Card>

        {/* Streak */}
        <Card variant="flat" style={{ marginBottom: spacing.lg }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <Typography variant="label" color={theme.textSecondary}>
              Streak
            </Typography>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
              <Typography variant="h3">?? {streak}</Typography>
              <Typography variant="bodySmall" color={theme.textSecondary}>
                {streak === 1 ? 'day' : 'days'}
              </Typography>
            </View>
          </View>
        </Card>

        {/* Quick Actions */}
        <View style={{ flexDirection: 'row', gap: spacing.md }}>
          <Pressable
            onPress={() => router.push('/(tabs)/insights')}
            style={({ pressed }) => ({
              flex: 1,
              backgroundColor: theme.surfaceSecondary,
              borderRadius: radius.xl,
              padding: spacing.lg,
              opacity: pressed ? 0.8 : 1,
            })}
          >
            <Typography variant="bodySmall" color={theme.textSecondary}>View</Typography>
            <Typography variant="label">Insights ?</Typography>
          </Pressable>
          <Pressable
            onPress={() => router.push('/(tabs)/coach')}
            style={({ pressed }) => ({
              flex: 1,
              backgroundColor: theme.surfaceSecondary,
              borderRadius: radius.xl,
              padding: spacing.lg,
              opacity: pressed ? 0.8 : 1,
            })}
          >
            <Typography variant="bodySmall" color={theme.textSecondary}>Ask</Typography>
            <Typography variant="label">Coach ?</Typography>
          </Pressable>
        </View>
      </ScrollView>
    </Screen>
  );
}
