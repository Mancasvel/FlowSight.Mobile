import React, { useEffect, useMemo, useRef, useState } from 'react';
import { View, StyleSheet, ScrollView, Pressable, Modal } from 'react-native';
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
import {
  DEFAULT_FOCUS_GOAL_MINUTES,
  MAX_FOCUS_GOAL_MINUTES,
  formatFocusGoal,
  getFocusGoalMinutes,
  setFocusGoalMinutes,
} from '@/services/focusGoal';
import { scheduleFocusGoalNotification } from '@/services/notifications';
import { useTheme } from '@/theme';
import { formatDuration } from '@/utils/format';
import { fontFamily, radius, spacing } from '@/theme/tokens';

const MAX_GOAL_HOURS = Math.floor(MAX_FOCUS_GOAL_MINUTES / 60);

export default function TodayScreen() {
  const { theme } = useTheme();
  const timer = useTimer();
  const [captureWarning, setCaptureWarning] = useState(getCaptureWarning);
  const [sessionWarnings, setSessionWarnings] = useState<string[]>([]);
  const [goalMinutes, setGoalMinutes] = useState(DEFAULT_FOCUS_GOAL_MINUTES);
  const [goalOpen, setGoalOpen] = useState(false);
  const [draftHours, setDraftHours] = useState(0);
  const [draftMinutes, setDraftMinutes] = useState(DEFAULT_FOCUS_GOAL_MINUTES);
  const goalSeconds = goalMinutes * 60;
  const progress = Math.min(timer.elapsed / Math.max(goalSeconds, 1), 1);
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
    void getFocusGoalMinutes().then(setGoalMinutes);
    return unsubscribeWarning;
  }, []);

  const warning = timer.session?.captureWarning ?? captureWarning;
  const nativeCapture = Boolean(timer.session?.deviceActivityStarted);
  const pauseCount = timer.session?.pauseCount ?? 0;
  const draftTotal = draftHours * 60 + draftMinutes;

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

  const applyGoal = async (minutes: number) => {
    const next = await setFocusGoalMinutes(minutes);
    setGoalMinutes(next);
    void Haptics.selectionAsync();
    if (!timer.isIdle) {
      void scheduleFocusGoalNotification(timer.elapsed);
    }
  };

  const openGoal = () => {
    setDraftHours(Math.floor(goalMinutes / 60));
    setDraftMinutes(goalMinutes % 60);
    setGoalOpen(true);
  };

  const saveGoal = () => {
    void applyGoal(draftTotal);
    setGoalOpen(false);
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
                ? 'Pause holds the clock. Stop ends the block.'
                : 'Timer only. Per-app time needs the native iOS build.'}
          </Typography>
        </View>

        <Card style={styles.timerCard}>
          <StatusChip label={statusLabel} tone={statusTone} />
          <Typography variant="display" style={styles.clock}>
            {formatDuration(timer.elapsed)}
          </Typography>
          <View style={styles.progressBlock}>
            <ProgressBar progress={progress} />
            <Typography variant="caption" color={theme.primary} style={styles.goalPct}>
              {Math.round(progress * 100)}%
            </Typography>
          </View>

          <View style={styles.metaRow}>
            <Meta label="Pauses" value={String(pauseCount)} />
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Edit focus goal"
              onPress={openGoal}
              style={({ pressed }) => [styles.meta, styles.metaEnd, pressed && styles.pressed]}
            >
              <Typography variant="kicker" color={theme.textTertiary}>
                Goal
              </Typography>
              <Typography variant="caption" color={theme.text}>
                {formatFocusGoal(goalMinutes)}
              </Typography>
            </Pressable>
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

      <Modal
        visible={goalOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setGoalOpen(false)}
      >
        <View style={styles.sheetBackdrop}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setGoalOpen(false)} />
          <View style={[styles.sheet, { backgroundColor: theme.background, borderColor: theme.glassBorder }]}>
            <Typography variant="kicker" color={theme.primary}>
              Focus goal
            </Typography>
            <Typography variant="title">{formatFocusGoal(draftTotal)}</Typography>
            <TrackSlider
              label="Hours"
              value={draftHours}
              min={0}
              max={MAX_GOAL_HOURS}
              format={(value) => `${value}h`}
              onChange={(hours) => {
                setDraftHours(hours);
                setDraftMinutes((mins) => {
                  if (hours === 0 && mins < 5) return 5;
                  if (hours === MAX_GOAL_HOURS) return 0;
                  return mins;
                });
              }}
            />
            <TrackSlider
              label="Minutes"
              value={draftMinutes}
              min={draftHours === 0 ? 5 : 0}
              max={draftHours === MAX_GOAL_HOURS ? 0 : 59}
              format={(value) => `${value}m`}
              onChange={setDraftMinutes}
            />
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Save focus goal"
              onPress={saveGoal}
              style={({ pressed }) => [styles.sheetSave, pressed && styles.pressed]}
            >
              <LinearGradient
                colors={['#6366F1', '#00B8A9']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.sheetSaveFill}
              >
                <Typography color="#FFFFFF" style={styles.primaryLabel}>
                  Save
                </Typography>
              </LinearGradient>
            </Pressable>
          </View>
        </View>
      </Modal>
    </Screen>
  );
}

function TrackSlider({
  label,
  value,
  min,
  max,
  format,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  format: (value: number) => string;
  onChange: (value: number) => void;
}) {
  const { theme } = useTheme();
  const trackRef = useRef<View>(null);
  const originX = useRef(0);
  const trackWidth = useRef(1);
  const span = Math.max(1, max - min);
  const ratio = Math.min(1, Math.max(0, (value - min) / span));

  const measureTrack = () => {
    trackRef.current?.measureInWindow((x, _y, width) => {
      originX.current = x;
      trackWidth.current = Math.max(1, width);
    });
  };

  const setFromPageX = (pageX: number) => {
    const nextRatio = Math.min(1, Math.max(0, (pageX - originX.current) / trackWidth.current));
    onChange(Math.round(min + nextRatio * span));
  };

  return (
    <View style={styles.sliderBlock}>
      <View style={styles.sliderHeader}>
        <Typography variant="kicker" color={theme.textTertiary}>
          {label}
        </Typography>
        <Typography variant="caption">{format(value)}</Typography>
      </View>
      <View
        ref={trackRef}
        onLayout={measureTrack}
        onStartShouldSetResponder={() => min !== max}
        onMoveShouldSetResponder={() => min !== max}
        onResponderGrant={(event) => {
          measureTrack();
          setFromPageX(event.nativeEvent.pageX);
        }}
        onResponderMove={(event) => setFromPageX(event.nativeEvent.pageX)}
        style={[styles.sliderTrack, { backgroundColor: theme.surfaceTertiary }]}
      >
        <View style={[styles.sliderFill, { width: `${ratio * 100}%`, backgroundColor: theme.primary }]} />
        <View
          pointerEvents="none"
          style={[
            styles.sliderThumb,
            {
              left: `${ratio * 100}%`,
              backgroundColor: theme.background,
              borderColor: theme.primary,
            },
          ]}
        />
      </View>
    </View>
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
  progressBlock: {
    width: '100%',
    gap: 8,
  },
  goalPct: {
    textAlign: 'right',
  },
  metaRow: {
    width: '100%',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingTop: spacing.sm,
  },
  meta: { alignItems: 'flex-start', gap: 2, flex: 1 },
  metaEnd: { alignItems: 'flex-end' },
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
  sheetBackdrop: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(15, 23, 42, 0.32)',
    padding: spacing.md,
  },
  sheet: {
    gap: spacing.lg,
    borderWidth: 1,
    borderRadius: radius.xl,
    padding: spacing.xl,
  },
  sliderBlock: { gap: 10 },
  sliderHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
  },
  sliderTrack: {
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
  },
  sliderFill: {
    height: 8,
    borderRadius: 4,
    marginHorizontal: 10,
  },
  sliderThumb: {
    position: 'absolute',
    width: 22,
    height: 22,
    marginLeft: -11,
    borderRadius: 11,
    borderWidth: 2,
  },
  sheetSave: {
    height: 52,
    borderRadius: radius.lg,
  },
  sheetSaveFill: {
    flex: 1,
    borderRadius: radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
