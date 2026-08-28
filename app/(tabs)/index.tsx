import React, { useEffect, useMemo, useState } from 'react';
import { View, StyleSheet, ScrollView, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Svg, { Circle, Defs, LinearGradient as SvgGradient, Stop } from 'react-native-svg';
import { LinearGradient } from 'expo-linear-gradient';
import { DeviceActivityReportView, isNativeDeviceActivityAvailable } from '../../modules/flowsight-device-activity/src/index';
import { Screen, Card, Typography } from '@/components';
import { useTimer } from '@/hooks';
import {
  getCaptureWarning,
  getLastSessionWindow,
  hydrateLastSessionWindow,
  subscribeCaptureWarning,
  subscribeSessionWindow,
} from '@/services/deviceActivity';
import { warningsForSession } from '@/services/sessionInsights';
import { useTheme } from '@/theme';
import { formatDuration } from '@/utils/format';
import { radius, spacing } from '@/theme/tokens';

const FOCUS_GOAL_SECONDS = 25 * 60;
const RING_SIZE = 250;
const RING_STROKE = 10;
const RING_RADIUS = (RING_SIZE - RING_STROKE) / 2;
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS;

export default function TodayScreen() {
  const { theme } = useTheme();
  const timer = useTimer();
  const [sessionWindow, setSessionWindow] = useState(getLastSessionWindow);
  const [captureWarning, setCaptureWarning] = useState(getCaptureWarning);
  const [sessionWarnings, setSessionWarnings] = useState<string[]>([]);
  const progress = Math.min(timer.elapsed / FOCUS_GOAL_SECONDS, 1);
  const dateLabel = useMemo(
    () =>
      new Intl.DateTimeFormat('en', {
        weekday: 'long',
        month: 'long',
        day: 'numeric',
      }).format(new Date()),
    []
  );

  useEffect(() => {
    void hydrateLastSessionWindow();
    const unsubscribeWindow = subscribeSessionWindow(setSessionWindow);
    const unsubscribeWarning = subscribeCaptureWarning(setCaptureWarning);
    return () => {
      unsubscribeWindow();
      unsubscribeWarning();
    };
  }, []);

  const warning = timer.session?.captureWarning ?? captureWarning;
  const nativeCapture = Boolean(timer.session?.deviceActivityStarted);
  const showReport = timer.isIdle && sessionWindow != null;

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
          <View>
            <Typography variant="caption" style={{ color: theme.primary }}>
              {dateLabel.toUpperCase()}
            </Typography>
            <Typography variant="title">Find your flow.</Typography>
          </View>
          <View style={[styles.avatar, { backgroundColor: theme.glassStrong, borderColor: theme.glassBorder }]}>
            <Ionicons name="sparkles" size={19} color={theme.primary} />
          </View>
        </View>

        <Card style={styles.timerCard}>
          <View style={styles.ringWrap}>
            <Svg width={RING_SIZE} height={RING_SIZE} style={styles.ring}>
              <Defs>
                <SvgGradient id="timerGradient" x1="0" y1="0" x2="1" y2="1">
                  <Stop offset="0" stopColor="#9B7CFF" />
                  <Stop offset="1" stopColor="#26C6F7" />
                </SvgGradient>
              </Defs>
              <Circle
                cx={RING_SIZE / 2}
                cy={RING_SIZE / 2}
                r={RING_RADIUS}
                stroke={theme.surfaceTertiary}
                strokeWidth={RING_STROKE}
                fill="transparent"
              />
              <Circle
                cx={RING_SIZE / 2}
                cy={RING_SIZE / 2}
                r={RING_RADIUS}
                stroke="url(#timerGradient)"
                strokeWidth={RING_STROKE}
                strokeLinecap="round"
                strokeDasharray={RING_CIRCUMFERENCE}
                strokeDashoffset={RING_CIRCUMFERENCE * (1 - progress)}
                fill="transparent"
                rotation="-90"
                origin={`${RING_SIZE / 2}, ${RING_SIZE / 2}`}
              />
            </Svg>
            <View style={styles.timerContent}>
              <View style={[styles.statusDot, { backgroundColor: timer.isRunning ? '#36D399' : theme.textTertiary }]} />
              <Typography variant="caption">
                {timer.isRunning ? 'IN FOCUS' : timer.isPaused ? 'PAUSED' : 'READY'}
              </Typography>
              <Typography variant="display" style={styles.clock}>
                {formatDuration(timer.elapsed)}
              </Typography>
              <Typography variant="caption">
                {timer.isIdle
                  ? `${Math.round(FOCUS_GOAL_SECONDS / 60)} min goal`
                  : nativeCapture
                    ? 'Measuring Screen Time'
                    : 'Timer only. Per-app time needs the native iOS build.'}
              </Typography>
            </View>
          </View>

          <Pressable
            accessibilityRole="button"
            accessibilityLabel={timer.isRunning ? 'Pause timer' : timer.isPaused ? 'Resume timer' : 'Start timer'}
            onPress={toggleTimer}
            style={({ pressed }) => [styles.mainAction, pressed && styles.pressed]}
          >
            <LinearGradient
              colors={['#9B7CFF', '#6241E9']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.mainActionGradient}
            >
              <Ionicons
                name={timer.isRunning ? 'pause' : 'play'}
                size={30}
                color="#FFFFFF"
                style={!timer.isRunning ? styles.playIcon : undefined}
              />
            </LinearGradient>
          </Pressable>

          {!timer.isIdle ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Stop and save session"
              onPress={() => void finishSession()}
              style={styles.stopAction}
            >
              <Ionicons name="stop" size={13} color={theme.textSecondary} />
              <Typography variant="caption">Finish session</Typography>
            </Pressable>
          ) : null}
        </Card>

        {timer.error ? (
          <View style={[styles.notice, { backgroundColor: 'rgba(232, 73, 103, 0.12)' }]}>
            <Ionicons name="alert-circle-outline" size={18} color="#E84967" />
            <Typography variant="caption" color="#E84967">
              {timer.error}
            </Typography>
          </View>
        ) : null}

        {!isNativeDeviceActivityAvailable() ? (
          <View style={[styles.notice, { backgroundColor: 'rgba(155, 124, 255, 0.12)' }]}>
            <Ionicons name="phone-portrait-outline" size={18} color={theme.primary} />
            <Typography variant="caption">
              Expo Go cannot see which apps you use. Apple only allows that in a native build with Family Controls (npx expo run:ios --device).
            </Typography>
          </View>
        ) : null}

        {warning && isNativeDeviceActivityAvailable() ? (
          <View style={[styles.notice, { backgroundColor: 'rgba(155, 124, 255, 0.12)' }]}>
            <Ionicons name="phone-portrait-outline" size={18} color={theme.primary} />
            <Typography variant="caption">{warning}</Typography>
          </View>
        ) : null}

        {sessionWarnings.map((message) => (
          <View key={message} style={[styles.notice, { backgroundColor: 'rgba(245, 158, 11, 0.14)' }]}>
            <Ionicons name="warning-outline" size={18} color="#F59E0B" />
            <Typography variant="caption">{message}</Typography>
          </View>
        ))}

        {showReport && sessionWindow ? (
          <Card style={styles.reportCard}>
            <View style={styles.sectionHeader}>
              <Typography variant="subtitle">This session</Typography>
              <Typography variant="caption">Time by app</Typography>
            </View>
            <DeviceActivityReportView
              startMs={sessionWindow.startMs}
              endMs={sessionWindow.endMs}
              segment="hourly"
              style={styles.reportView}
            />
          </Card>
        ) : (
          <Card style={styles.insightCard}>
            <View style={[styles.insightIcon, { backgroundColor: theme.surfaceTertiary }]}>
              <Ionicons name="apps-outline" size={21} color={theme.primary} />
            </View>
            <View style={styles.insightCopy}>
              <Typography variant="subtitle">
                {timer.isIdle ? 'Start to time a session' : 'Session in progress'}
              </Typography>
              <Typography variant="caption">
                {isNativeDeviceActivityAvailable()
                  ? timer.isIdle
                    ? 'Start opens a Screen Time window. Stop shows how long each app was used.'
                    : 'Pause only stops the timer. Screen Time covers Start to Stop.'
                  : 'The timer stores total minutes. App names are blocked in Expo Go by Apple.'}
              </Typography>
            </View>
          </Card>
        )}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { gap: spacing.xl, paddingBottom: 110 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  avatar: {
    width: 46,
    height: 46,
    borderRadius: 23,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  timerCard: {
    alignItems: 'center',
    paddingVertical: spacing.xxl,
    borderRadius: radius.glass,
  },
  ringWrap: {
    width: RING_SIZE,
    height: RING_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ring: { position: 'absolute' },
  timerContent: { alignItems: 'center', gap: 5 },
  statusDot: { width: 7, height: 7, borderRadius: 4 },
  clock: { fontSize: 43, lineHeight: 52 },
  mainAction: {
    width: 72,
    height: 72,
    borderRadius: 36,
    marginTop: -2,
    shadowColor: '#6241E9',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.32,
    shadowRadius: 20,
  },
  mainActionGradient: {
    flex: 1,
    borderRadius: 36,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.58)',
  },
  playIcon: { marginLeft: 3 },
  pressed: { transform: [{ scale: 0.95 }], opacity: 0.9 },
  stopAction: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingTop: spacing.md,
  },
  notice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: radius.md,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  reportCard: { borderRadius: radius.glass },
  reportView: { height: 280, width: '100%' },
  insightCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  insightIcon: {
    width: 46,
    height: 46,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  insightCopy: { flex: 1, gap: 2 },
});
