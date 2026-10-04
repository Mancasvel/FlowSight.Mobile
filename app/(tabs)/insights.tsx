import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { AppState, View, StyleSheet, ScrollView } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { isNativeDeviceActivityAvailable } from '../../modules/flowsight-device-activity/src/index';
import {
  Screen,
  Card,
  Typography,
  MetricTile,
  SectionHeader,
  Notice,
  HourlyBarChart,
  WeekStrip,
  Button,
} from '@/components';
import { hasUsageAccess, openUsageAccessSettings } from '@/services/deviceActivity';
import {
  appsDuringSession,
  hourlyBucketsFromSources,
  loadHourlyAppUsage,
  loadRecentSessions,
  patternsFromSessions,
  weekActivityFromSessions,
  type SessionPattern,
  type StoredAppUsage,
  type StoredSession,
} from '@/services/sessionInsights';
import { formatDurationShort, localDateKey } from '@/utils/format';
import { useTheme } from '@/theme';
import { SharedSessions } from '@/components/SharedSessions';
import { spacing } from '@/theme/tokens';

export default function InsightsScreen() {
  const { theme } = useTheme();
  const [sessions, setSessions] = useState<StoredSession[]>([]);
  const [appUsage, setAppUsage] = useState<StoredAppUsage[]>([]);
  const [patterns, setPatterns] = useState<SessionPattern[]>([]);
  const [usageAccess, setUsageAccess] = useState(false);
  const nativeScreenTime = isNativeDeviceActivityAvailable();
  const todayKey = localDateKey(new Date());
  const todaySeconds = sessions
    .filter((session) => localDateKey(new Date(session.start_at)) === todayKey)
    .reduce((sum, session) => sum + session.duration_seconds, 0);
  const maxDuration = Math.max(1, ...sessions.slice(0, 8).map((session) => session.duration_seconds));
  const hourBuckets = useMemo(
    () => hourlyBucketsFromSources(sessions, appUsage),
    [sessions, appUsage]
  );
  const weekDays = useMemo(() => weekActivityFromSessions(sessions), [sessions]);

  const averageSeconds = useMemo(() => {
    if (sessions.length === 0) return 0;
    return Math.round(sessions.reduce((sum, session) => sum + session.duration_seconds, 0) / sessions.length);
  }, [sessions]);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      const reload = async () => {
        const [rows, usage] = await Promise.all([
          loadRecentSessions(),
          loadHourlyAppUsage(localDateKey(new Date())),
        ]);
        if (cancelled) return;
        setSessions(rows);
        setAppUsage(usage);
        setPatterns(patternsFromSessions(rows));
      };
      void reload();
      if (nativeScreenTime) {
        void hasUsageAccess().then((granted) => {
          if (!cancelled) setUsageAccess(granted);
        });
      }
      const interval = setInterval(() => {
        void reload();
      }, 12_000);
      return () => {
        cancelled = true;
        clearInterval(interval);
      };
    }, [nativeScreenTime])
  );

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active' && nativeScreenTime) void hasUsageAccess().then(setUsageAccess);
    });
    return () => subscription.remove();
  }, [nativeScreenTime]);

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.heroCopy}>
          <Typography variant="kicker" color={theme.primary}>
            Start to stop
          </Typography>
          <Typography variant="title">Insights</Typography>
          <Typography variant="caption">
            Patterns from your blocks. Hourly app activity is calculated on this device and kept in memory.
          </Typography>
        </View>

        <SharedSessions />
        <WeekStrip days={weekDays} />

        <View style={styles.metrics}>
          <MetricTile label="Timed today" value={formatDurationShort(todaySeconds)} hint="Across today's blocks" />
          <MetricTile
            label="Sessions"
            value={sessions.length}
            hint={sessions.length > 0 ? `Avg ${formatDurationShort(averageSeconds)}` : 'Recent window'}
          />
        </View>

        <Card style={styles.reportCard}>
          <SectionHeader
            kicker="01"
            title="Hourly timeline"
            subtitle="Each color is a category in that hour. Calculated locally from Android Usage Access."
          />
          <HourlyBarChart buckets={hourBuckets} />
          {nativeScreenTime && !usageAccess ? (
            <Notice tone="info" icon="apps-outline">
              Enable Usage Access to see hourly categories. Recording requires this permission.
            </Notice>
          ) : null}
          {nativeScreenTime && !usageAccess ? (
            <Button label="Open Usage Access" variant="secondary" onPress={() => void openUsageAccessSettings()} />
          ) : null}
          {!nativeScreenTime ? (
            <Notice tone="info" icon="phone-portrait-outline">
              The hourly app timeline needs the native Android build.
            </Notice>
          ) : null}
        </Card>

        <View style={styles.patternBlock}>
          <SectionHeader kicker="02" title="What the blocks say" />
          {patterns.map((pattern, index) => (
            <Card key={pattern.id} style={styles.patternCard}>
              <Typography variant="kicker" color={theme.primary}>
                {String(index + 1).padStart(2, '0')}
              </Typography>
              <View style={styles.patternCopy}>
                <Typography variant="subtitle">{pattern.title}</Typography>
                <Typography variant="caption">{pattern.body}</Typography>
              </View>
            </Card>
          ))}
        </View>

        {sessions.length > 0 ? (
          <Card style={styles.listCard}>
            <SectionHeader kicker="03" title="Recent blocks" subtitle="Duration relative to your longest recent session." />
            {sessions.slice(0, 8).map((session) => {
              const apps = appsDuringSession(session, appUsage)
                .slice(0, 3)
                .map((app) => app.name)
                .join(', ');
              return (
              <View key={session.id} style={styles.sessionRow}>
                <View style={styles.sessionMeta}>
                  <Typography>
                    {new Intl.DateTimeFormat(undefined, { weekday: 'short', hour: 'numeric', minute: '2-digit' }).format(
                      new Date(session.start_at)
                    )}
                  </Typography>
                  <Typography variant="caption">
                    {formatDurationShort(session.duration_seconds)}
                    {session.pause_count > 0 ? `, ${session.pause_count} pauses` : ''}
                  </Typography>
                </View>
                {apps ? (
                  <Typography variant="caption">{apps}</Typography>
                ) : session.category && session.category !== 'Focus' && session.category !== 'General' ? (
                  <Typography variant="caption">{session.category}</Typography>
                ) : null}
                <View style={[styles.barTrack, { backgroundColor: theme.surfaceTertiary }]}>
                  <View
                    style={[
                      styles.barFill,
                      {
                        backgroundColor: theme.primary,
                        width: `${Math.max(8, (session.duration_seconds / maxDuration) * 100)}%`,
                      },
                    ]}
                  />
                </View>
              </View>
              );
            })}
          </Card>
        ) : (
          <Card style={styles.emptyCard}>
            <Ionicons name="timer-outline" size={22} color={theme.primary} />
            <View style={styles.patternCopy}>
              <Typography variant="subtitle">No blocks yet</Typography>
              <Typography variant="caption">Start and stop a session on Today to see patterns here.</Typography>
            </View>
          </Card>
        )}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { gap: spacing.xl, paddingBottom: 120 },
  heroCopy: { gap: 6 },
  metrics: { flexDirection: 'row', gap: spacing.md },
  reportCard: { gap: spacing.md },
  patternBlock: { gap: spacing.md },
  patternCard: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md },
  patternCopy: { flex: 1, gap: 4 },
  listCard: { gap: spacing.lg },
  sessionRow: { gap: spacing.sm },
  sessionMeta: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
  },
  barTrack: {
    height: 6,
    borderRadius: 3,
    overflow: 'hidden',
  },
  barFill: {
    height: 6,
    borderRadius: 3,
  },
  emptyCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
});
