import React, { useCallback, useState } from 'react';
import { View, StyleSheet, ScrollView } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import {
  DeviceActivityReportView,
  hasActivitySelection,
  isNativeDeviceActivityAvailable,
  presentActivityPicker,
} from '../../modules/flowsight-device-activity/src/index';
import { Screen, Card, Typography, Button } from '@/components';
import {
  hydrateLastSessionWindow,
  getLastSessionWindow,
  type SessionWindow,
} from '@/services/deviceActivity';
import {
  loadRecentSessions,
  patternsFromSessions,
  type SessionPattern,
  type StoredSession,
} from '@/services/sessionInsights';
import { formatDurationShort } from '@/utils/format';
import { useTheme } from '@/theme';
import { radius, spacing } from '@/theme/tokens';

export default function InsightsScreen() {
  const { theme } = useTheme();
  const [sessions, setSessions] = useState<StoredSession[]>([]);
  const [patterns, setPatterns] = useState<SessionPattern[]>([]);
  const [sessionWindow, setSessionWindow] = useState<SessionWindow | null>(getLastSessionWindow);
  const [reportEpoch, setReportEpoch] = useState(0);
  const [needsAppPicker, setNeedsAppPicker] = useState(false);
  const nativeScreenTime = isNativeDeviceActivityAvailable();
  const todaySeconds = sessions
    .filter((session) => session.start_at.slice(0, 10) === new Date().toISOString().slice(0, 10))
    .reduce((sum, session) => sum + session.duration_seconds, 0);

  useFocusEffect(
    useCallback(() => {
      void loadRecentSessions().then((rows) => {
        setSessions(rows);
        setPatterns(patternsFromSessions(rows));
      });
      void hydrateLastSessionWindow().then((window) => {
        if (window) setSessionWindow(window);
      });
      if (nativeScreenTime) {
        void hasActivitySelection().then((selected) => setNeedsAppPicker(!selected));
      }
    }, [nativeScreenTime])
  );

  const chooseApps = async () => {
    const result = await presentActivityPicker();
    if (result.saved) {
      setNeedsAppPicker(false);
      setReportEpoch((value) => value + 1);
    }
  };

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <View>
            <Typography variant="caption" style={{ color: theme.primary }}>START TO STOP</Typography>
            <Typography variant="title">Insights</Typography>
          </View>
          <View style={[styles.headerIcon, { backgroundColor: theme.glassStrong, borderColor: theme.glassBorder }]}>
            <Ionicons name="analytics-outline" size={22} color={theme.primary} />
          </View>
        </View>

        <View style={styles.metrics}>
          <Card style={styles.metricCard}>
            <Typography variant="caption">Timed today</Typography>
            <Typography variant="title" style={styles.metricValue}>
              {formatDurationShort(todaySeconds)}
            </Typography>
          </Card>
          <Card style={styles.metricCard}>
            <Typography variant="caption">Sessions</Typography>
            <Typography variant="title" style={styles.metricValue}>{sessions.length}</Typography>
          </Card>
        </View>

        <Card style={styles.reportCard}>
          <Typography variant="subtitle">Last session timeline</Typography>
          <Typography variant="caption">
            Apple Screen Time between Start and Stop. App names never leave this iPhone.
          </Typography>
          {nativeScreenTime ? (
            <>
              {needsAppPicker ? (
                <Typography variant="caption" style={styles.nativeHint}>
                  Choose the apps to include. A blank picker means Apple reports zero time.
                </Typography>
              ) : null}
              <Button
                label={needsAppPicker ? 'Choose apps to measure' : 'Change measured apps'}
                variant={needsAppPicker ? 'primary' : 'secondary'}
                onPress={() => {
                  void chooseApps();
                }}
              />
              {sessionWindow ? (
                <DeviceActivityReportView
                  key={`${reportEpoch}-${sessionWindow.startMs}-${sessionWindow.endMs}`}
                  startMs={sessionWindow.startMs}
                  endMs={sessionWindow.endMs}
                  segment="hourly"
                  style={styles.reportView}
                />
              ) : (
                <Typography variant="caption" style={styles.nativeHint}>
                  Finish a session on Today to fill this timeline.
                </Typography>
              )}
            </>
          ) : (
            <Typography variant="caption" style={styles.nativeHint}>
              Per-app time needs the native iPhone build. Expo Go cannot read Screen Time.
            </Typography>
          )}
        </Card>

        {patterns.map((pattern) => (
          <Card key={pattern.id} style={styles.patternCard}>
            <Ionicons name="pulse-outline" size={20} color={theme.primary} />
            <View style={styles.patternCopy}>
              <Typography variant="subtitle">{pattern.title}</Typography>
              <Typography variant="caption">{pattern.body}</Typography>
            </View>
          </Card>
        ))}

        {sessions.length > 0 ? (
          <Card style={styles.listCard}>
            <Typography variant="subtitle">Recent blocks</Typography>
            {sessions.slice(0, 8).map((session) => (
              <View key={session.id} style={styles.sessionRow}>
                <Typography style={styles.sessionWhen}>
                  {new Intl.DateTimeFormat(undefined, { weekday: 'short', hour: 'numeric', minute: '2-digit' }).format(
                    new Date(session.start_at)
                  )}
                </Typography>
                <Typography variant="caption">
                  {formatDurationShort(session.duration_seconds)}
                  {session.pause_count > 0 ? ` · ${session.pause_count} pauses` : ''}
                </Typography>
              </View>
            ))}
          </Card>
        ) : null}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { gap: spacing.xl, paddingBottom: 110 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  headerIcon: {
    width: 46,
    height: 46,
    borderRadius: 23,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  metrics: { flexDirection: 'row', gap: spacing.md },
  metricCard: { flex: 1, gap: spacing.sm },
  metricValue: { fontSize: 28 },
  reportCard: { borderRadius: radius.glass, gap: spacing.md },
  reportView: { height: 280, width: '100%' },
  nativeHint: { lineHeight: 18 },
  patternCard: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md },
  patternCopy: { flex: 1, gap: 2 },
  listCard: { gap: spacing.md, borderRadius: radius.glass },
  sessionRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  sessionWhen: { flex: 1 },
});
