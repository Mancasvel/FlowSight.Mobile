import React, { useEffect, useMemo, useState } from 'react';
import { View, StyleSheet, ScrollView, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { isNativeDeviceActivityAvailable } from '../../modules/flowsight-device-activity/src/index';
import {
  Screen,
  Card,
  Typography,
  BrandMark,
  StatusChip,
  Notice,
  ProgressBar,
} from '@/components';
import { useTimer } from '@/hooks';
import {
  getCaptureWarning,
  subscribeCaptureWarning,
} from '@/services/deviceActivity';
import { warningsForSession } from '@/services/sessionInsights';
import { useTheme } from '@/theme';
import { formatDuration } from '@/utils/format';
import { fontFamily, radius, spacing } from '@/theme/tokens';
import { FOCUS_GOAL_SECONDS } from '@/services/notifications';

export default function TodayScreen() {
  const { theme } = useTheme();
  const timer = useTimer();
  const [captureWarning, setCaptureWarning] = useState(getCaptureWarning);
  const [sessionWarnings, setSessionWarnings] = useState<string[]>([]);
  const progress = Math.min(timer.elapsed / FOCUS_GOAL_SECONDS, 1);
  const dateLabel = useMemo(
    () =>
      new Intl.DateTimeFormat('en', {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
      }).format(new Date()),
    []
  );

  useEffect(() => {
    const unsubscribeWarning = subscribeCaptureWarning(setCaptureWarning);
    return unsubscribeWarning;
  }, []);

  const warning = timer.session?.captureWarning ?? captureWarning;
  const nativeCapture = Boolean(timer.session?.deviceActivityStarted);
  const pauseCount = timer.session?.pauseCount ?? 0;

  const headline = timer.isRunning
    ? 'In flow.'
    : timer.isPaused
      ? 'On hold.'
      : "What's next?";

  const statusTone = timer.isRunning ? 'live' : timer.isPaused ? 'paused' : 'idle';
  const statusLabel = timer.isRunning ? 'Live' : timer.isPaused ? 'Paused' : 'Ready';

  const toggleTimer = () => {
    if (timer.isIdle) {
      setSessionWarnings([]);
      void timer.start();
    } else if (timer.isRunning) {
      void timer.pause();
    } else {
      void timer.resume();
    }
  };

  const finishSession = async () => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const result = await timer.stop();
    if (!result) return;
    setSessionWarnings(
      warningsForSession({
        durationSeconds: result.durationSeconds,
        pauseCount: result.pauseCount,
        captureStarted: result.captureStarted,
      })
    );
  };

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <BrandMark />
          <View style={[styles.dateChip, { borderColor: theme.glassBorder, backgroundColor: theme.glass }]}>
            <Typography variant="caption">{dateLabel}</Typography>
          </View>
        </View>

        <View style={styles.heroCopy}>
          <Typography variant="kicker" color={theme.primary}>
            Today
          </Typography>
          <Typography variant="title">{headline}</Typography>
          <Typography variant="caption">
            {timer.isIdle
              ? 'Start a block. Screen Time is measured only while the timer runs.'
              : nativeCapture
                ? 'Pause holds the clock. Capture continues until you stop.'
                : 'Timer only. Per-app time needs the native iOS build.'}
          </Typography>
        </View>

        <Card style={styles.timerCard}>
          <StatusChip label={statusLabel} tone={statusTone} />
          <Typography variant="display" style={styles.clock}>
            {formatDuration(timer.elapsed)}
          </Typography>
          <View style={styles.goalRow}>
            <Typography variant="caption">25m focus goal</Typography>
            <Typography variant="caption" color={theme.primary}>
              {Math.round(progress * 100)}%
            </Typography>
          </View>
          <ProgressBar progress={progress} />

          <View style={styles.metaRow}>
            <Meta label="Capture" value={nativeCapture ? 'On device' : 'Timer'} />
            <Meta label="Pauses" value={String(pauseCount)} />
            <Meta label="Goal" value="25m" />
          </View>

          <View style={styles.actions}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={timer.isRunning ? 'Pause timer' : timer.isPaused ? 'Resume timer' : 'Start timer'}
              onPress={toggleTimer}
              style={({ pressed }) => [styles.primaryAction, pressed && styles.pressed]}
            >
              <LinearGradient
                colors={['#6366F1', '#00B8A9']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.primaryGradient}
              >
                <Ionicons
                  name={timer.isRunning ? 'pause' : 'play'}
                  size={18}
                  color="#FFFFFF"
                  style={!timer.isRunning ? styles.playIcon : undefined}
                />
                <Typography color="#FFFFFF" style={styles.primaryLabel}>
                  {timer.isRunning ? 'Pause' : timer.isPaused ? 'Resume' : 'Start block'}
                </Typography>
              </LinearGradient>
            </Pressable>

            {!timer.isIdle ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Stop session"
                onPress={() => void finishSession()}
                style={({ pressed }) => [
                  styles.stopAction,
                  { borderColor: theme.glassBorder, backgroundColor: theme.glass },
                  pressed && styles.pressed,
                ]}
              >
                <Ionicons name="stop" size={12} color={theme.text} />
                <Typography variant="caption" color={theme.text}>
                  Stop
                </Typography>
              </Pressable>
            ) : null}
          </View>
        </Card>

        {timer.error ? (
          <Notice tone="error" icon="alert-circle-outline">
            {timer.error}
          </Notice>
        ) : null}

        {!isNativeDeviceActivityAvailable() ? (
          <Notice tone="info" icon="phone-portrait-outline">
            Expo Go cannot see which apps you use. Apple only allows that in a native build with Family Controls.
          </Notice>
        ) : null}

        {warning && isNativeDeviceActivityAvailable() ? (
          <Notice tone="info" icon="phone-portrait-outline">
            {warning}
          </Notice>
        ) : null}

        {sessionWarnings.map((message) => (
          <Notice key={message} tone="warn" icon="warning-outline">
            {message}
          </Notice>
        ))}
      </ScrollView>
    </Screen>
  );
}

function Meta({ label, value }: { label: string; value: string }) {
  const { theme } = useTheme();
  return (
    <View style={styles.meta}>
      <Typography variant="kicker" color={theme.textTertiary}>
        {label}
      </Typography>
      <Typography variant="caption" color={theme.text}>
        {value}
      </Typography>
    </View>
  );
}

const styles = StyleSheet.create({
  content: { gap: spacing.xl, paddingBottom: 120 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  dateChip: {
    borderWidth: 1,
    borderRadius: radius.full,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  heroCopy: { gap: 6 },
  timerCard: {
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.xxl,
  },
  clock: { fontSize: 52, lineHeight: 58 },
  goalRow: {
    width: '100%',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  metaRow: {
    width: '100%',
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingTop: spacing.sm,
  },
  meta: { alignItems: 'flex-start', gap: 2, flex: 1 },
  actions: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingTop: spacing.sm,
  },
  primaryAction: {
    flex: 1,
    height: 52,
    borderRadius: radius.lg,
    shadowColor: '#0F766E',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.28,
    shadowRadius: 16,
  },
  primaryGradient: {
    flex: 1,
    borderRadius: radius.lg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.42)',
  },
  primaryLabel: {
    fontFamily: fontFamily.bodySemibold,
    fontSize: 16,
  },
  playIcon: { marginLeft: 2 },
  pressed: { transform: [{ scale: 0.98 }], opacity: 0.9 },
  stopAction: {
    height: 52,
    paddingHorizontal: 16,
    borderRadius: radius.lg,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
});
