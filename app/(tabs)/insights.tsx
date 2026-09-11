import React, { useCallback, useMemo, useState } from 'react';
import { View, StyleSheet, ScrollView, Pressable, ActivityIndicator } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { hasActivitySelection, isNativeDeviceActivityAvailable } from '../../modules/flowsight-device-activity/src/index';
import {
  Screen,
  Card,
  Typography,
  MetricTile,
  SectionHeader,
  Notice,
  StatusChip,
  HourlyBarChart,
  WeekStrip,
  ScreenTimeCapture,
  ProgressBar,
  Button,
  Input,
} from '@/components';
import { persistUsageSnapshot } from '@/services/deviceActivity';
import {
  acceptOnDeviceAiNotice,
  deferOnDeviceAiNotice,
  getOnDeviceAiConsent,
  ON_DEVICE_AI_NOTICE_BODY,
  ON_DEVICE_AI_NOTICE_TITLE,
  onDeviceAiOutputLabel,
} from '@/privacy/onDeviceAi';
import { askLocalStats, loadLocalPatterns, type LocalPatternStatus } from '@/services/localInsights';
import {
  ensureQwenWeight,
  getModelDownloadProgress,
  subscribeModelDownload,
  type DownloadProgress,
} from '@/services/localAi/download';
import { ASK_CHIPS } from '@/services/localAi/schemas';
import { QWEN_WEIGHT } from '@/services/localAi/assets';
import { markInsightCardsSeen, maybePrepareInsightNudge } from '@/services/localInsightNotify';
import {
  appsDuringSession,
  hourlyBucketsFromSources,
  loadRecentHourlyAppUsage,
  loadSessionsForPeriod,
  weekActivityFromSessions,
  type SessionPattern,
  type StoredAppUsage,
  type StoredSession,
} from '@/services/sessionInsights';
import { formatDurationShort, localDateKey } from '@/utils/format';
import { useTheme } from '@/theme';
import { radius, spacing } from '@/theme/tokens';

export default function InsightsScreen() {
  const { theme } = useTheme();
  const params = useLocalSearchParams<{ card?: string }>();
  const [sessions, setSessions] = useState<StoredSession[]>([]);
  const [appUsage, setAppUsage] = useState<StoredAppUsage[]>([]);
  const [patterns, setPatterns] = useState<SessionPattern[]>([]);
  const [note, setNote] = useState<string | null>(null);
  const [aiStatus, setAiStatus] = useState<LocalPatternStatus>('loading');
  const [aiDetail, setAiDetail] = useState<string | undefined>();
  const [engine, setEngine] = useState<'qwen' | 'apple' | 'none'>('none');
  const [canDownload, setCanDownload] = useState(false);
  const [aiWriting, setAiWriting] = useState(false);
  const [needAiNotice, setNeedAiNotice] = useState(true);
  const [noticeDismissed, setNoticeDismissed] = useState(false);
  const [download, setDownload] = useState<DownloadProgress>(getModelDownloadProgress());
  const [needsAppPicker, setNeedsAppPicker] = useState(false);
  const [ask, setAsk] = useState('');
  const [askFocused, setAskFocused] = useState(false);
  const [asking, setAsking] = useState(false);
  const [answer, setAnswer] = useState<string | null>(null);
  const [highlighted, setHighlighted] = useState<string | undefined>(
    typeof params.card === 'string' ? params.card : undefined
  );
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
  const hasSessions = sessions.length > 0;
  const modelReady = aiStatus === 'ready';

  const averageSeconds = useMemo(() => {
    if (sessions.length === 0) return 0;
    return Math.round(sessions.reduce((sum, session) => sum + session.duration_seconds, 0) / sessions.length);
  }, [sessions]);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      const unsub = subscribeModelDownload((progress) => {
        if (!cancelled) setDownload(progress);
      });
      const reload = async () => {
        await persistUsageSnapshot();
        const [rows, usage] = await Promise.all([
          loadSessionsForPeriod(),
          loadRecentHourlyAppUsage(7),
        ]);
        if (cancelled) return;
        setSessions(rows);
        setAppUsage(usage);
        const result = await loadLocalPatterns({ sessions: rows, appUsage: usage });
        if (cancelled) return;
        setPatterns(result.patterns);
        setNote(result.note);
        setAiStatus(result.status);
        setAiDetail(result.detail);
        setEngine(result.engine);
        setCanDownload(result.canDownload);
        const consent = await getOnDeviceAiConsent();
        if (cancelled) return;
        setAiWriting(consent.enabled);
        setNeedAiNotice(!consent.noticeCurrent);
        if (result.status === 'ready') {
          void markInsightCardsSeen(result.patterns.map((pattern) => pattern.id));
          void maybePrepareInsightNudge({ sessions: rows, appUsage: usage });
        }
      };
      void reload();
      if (nativeScreenTime) {
        void hasActivitySelection().then((selected) => {
          if (!cancelled) setNeedsAppPicker(!selected);
        });
      }
      const interval = setInterval(() => {
        if (!askFocused) void reload();
      }, 12_000);
      return () => {
        cancelled = true;
        unsub();
        clearInterval(interval);
      };
    }, [nativeScreenTime, askFocused])
  );

  const chip = chipFor(aiStatus, download.phase);

  const acceptAiNotice = async () => {
    await acceptOnDeviceAiNotice();
    setNeedAiNotice(false);
    setNoticeDismissed(false);
    setAiWriting(true);
    const result = await loadLocalPatterns({ sessions, appUsage });
    setPatterns(result.patterns);
    setNote(result.note);
    setAiStatus(result.status);
    setAiDetail(result.detail);
    setEngine(result.engine);
    setCanDownload(result.canDownload);
  };

  const deferAiNotice = async () => {
    await deferOnDeviceAiNotice();
    setNoticeDismissed(true);
    setAiWriting(false);
  };

  const startDownload = async () => {
    if (!aiWriting) return;
    try {
      await ensureQwenWeight();
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      const result = await loadLocalPatterns({ sessions, appUsage });
      setPatterns(result.patterns);
      setNote(result.note);
      setAiStatus(result.status);
      setAiDetail(result.detail);
      setEngine(result.engine);
      setCanDownload(result.canDownload);
    } catch (error) {
      setAiDetail(error instanceof Error ? error.message : 'Download failed.');
    }
  };

  const sendAsk = async (question: string) => {
    const trimmed = question.trim();
    if (!trimmed || asking || !modelReady || !hasSessions) return;
    setAsking(true);
    setAsk(trimmed);
    try {
      const result = await askLocalStats({ question: trimmed, sessions, appUsage });
      setAnswer(result.answer);
      void Haptics.selectionAsync();
    } catch {
      setAnswer('That question timed out. Nothing left this iPhone.');
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    } finally {
      setAsking(false);
    }
  };

  const showNotice = needAiNotice && !noticeDismissed;
  const showAiOffCard = !aiWriting && !showNotice;
  const showSetup =
    aiWriting &&
    (canDownload ||
      download.phase === 'downloading' ||
      download.phase === 'verifying' ||
      download.phase === 'error' ||
      aiStatus === 'unavailable');

  return (
    <Screen>
      <ScreenTimeCapture />
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        <View style={styles.heroCopy}>
          <Typography variant="kicker" color={theme.primary}>
            Start to stop
          </Typography>
          <Typography variant="title">Insights</Typography>
          <Typography variant="caption">
            Patterns from your blocks. Apps used each hour stay in local SQLite.
          </Typography>
          <View style={styles.chipWrap}>
            <StatusChip label={chip.label} tone={chip.tone} />
          </View>
        </View>

        {showNotice ? (
          <Card style={styles.setupCard}>
            <SectionHeader
              kicker="ON THIS IPHONE"
              title={ON_DEVICE_AI_NOTICE_TITLE}
              subtitle="One-time notice. Session rules stay until you accept."
            />
            <Notice tone="info" icon="sparkles-outline">
              {ON_DEVICE_AI_NOTICE_BODY}
            </Notice>
            <Button
              label="Accept"
              variant={hasSessions ? 'primary' : 'secondary'}
              onPress={() => {
                void acceptAiNotice();
              }}
            />
            <Button
              label="Not now"
              variant="secondary"
              onPress={() => {
                void deferAiNotice();
              }}
            />
          </Card>
        ) : null}

        {showAiOffCard ? (
          <Card style={styles.setupCard}>
            <SectionHeader
              kicker="ON THIS IPHONE"
              title="On-device AI writing"
              subtitle="Off. Session rules still work from your blocks."
            />
            <Button
              label={needAiNotice ? 'Review notice' : 'Turn on'}
              variant="secondary"
              onPress={() => {
                if (needAiNotice) {
                  setNoticeDismissed(false);
                  return;
                }
                void acceptAiNotice();
              }}
            />
          </Card>
        ) : null}

        {showSetup ? (
          <Card style={styles.setupCard}>
            <SectionHeader
              kicker="ON THIS IPHONE"
              title="On-device model"
              subtitle="About 484 MB, one time. Not in the App Store download. STATS never leave this iPhone."
            />
            {aiStatus === 'unavailable' && !canDownload ? (
              <Notice tone="warn" icon="phone-portrait-outline">
                {aiDetail || 'On-device writing is not in Simulator. Session rules still work from your blocks.'}
              </Notice>
            ) : download.phase === 'downloading' || download.phase === 'verifying' ? (
              <>
                <ProgressBar progress={download.percent / 100} />
                <Typography variant="caption">
                  {Math.round(download.downloadedBytes / 1_000_000)} MB of {Math.round(QWEN_WEIGHT.sizeBytes / 1_000_000)} MB · stays on this iPhone
                </Typography>
              </>
            ) : (
              <>
                <Notice tone="info" icon="wifi-outline">
                  Use Wi-Fi. You can keep using session rules until it finishes.
                </Notice>
                {download.phase === 'error' ? (
                  <Notice tone="error" icon="alert-circle-outline">
                    {download.error || aiDetail || 'Download failed.'}
                  </Notice>
                ) : null}
                <Button
                  label={download.phase === 'error' ? 'Resume download' : 'Download on this iPhone'}
                  variant={hasSessions ? 'primary' : 'secondary'}
                  onPress={() => {
                    void startDownload();
                  }}
                />
              </>
            )}
          </Card>
        ) : null}

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
            subtitle="Each color is a category in that hour. Saved on this iPhone."
          />
          <HourlyBarChart buckets={hourBuckets} />
          {nativeScreenTime && needsAppPicker ? (
            <Notice tone="info" icon="apps-outline">
              Choose measured apps in You. Add work apps one by one, then Social or Entertainment as categories so those do not count as focus.
            </Notice>
          ) : null}
        </Card>

        {hasSessions ? (
          <View style={styles.patternBlock}>
            <SectionHeader
              kicker="02"
              title="What the blocks say"
              subtitle={sectionSubtitle(aiStatus, engine)}
            />
            {patternNotice(aiStatus, engine, aiDetail)}
            {patterns.map((pattern, index) => (
              <Card
                key={pattern.id}
                style={[
                  styles.patternCard,
                  highlighted === pattern.id ? { borderColor: theme.primary, borderWidth: 1 } : null,
                ]}
              >
                <Typography variant="kicker" color={theme.primary} accessibilityElementsHidden>
                  {String(index + 1).padStart(2, '0')}
                </Typography>
                <View style={styles.patternCopy}>
                  <Typography variant="subtitle">{pattern.title}</Typography>
                  <Typography variant="caption">{pattern.body}</Typography>
                  {aiStatus === 'ready' ? (
                    <Typography variant="kicker">AI-GENERATED ON THIS IPHONE</Typography>
                  ) : null}
                </View>
              </Card>
            ))}
          </View>
        ) : null}

        {hasSessions && (note || aiStatus === 'loading' || aiStatus === 'ready') ? (
          <Card style={styles.listCard}>
            <SectionHeader
              kicker="03"
              title="This week's note"
              subtitle="A short read from the same local STATS. Not a full report."
            />
            {note ? (
              <>
                <Typography variant="body">{note}</Typography>
                <Typography variant="kicker">
                  {aiStatus === 'ready' && (engine === 'qwen' || engine === 'apple')
                    ? 'FROM LOCAL STATS · AI-GENERATED'
                    : 'FROM LOCAL STATS'}
                </Typography>
              </>
            ) : (
              <Typography variant="caption">Writing a short note from local STATS.</Typography>
            )}
          </Card>
        ) : null}

        {hasSessions ? (
          <Card style={styles.listCard}>
            <SectionHeader
              kicker="04"
              title="Ask this iPhone"
              subtitle="Questions about your STATS only. If the numbers are not here, it will say so."
            />
            {!modelReady ? (
              <Typography variant="caption">
                {aiStatus === 'opted-out' || !aiWriting
                  ? 'Ask is available after you turn on on-device AI writing.'
                  : aiStatus === 'download' || download.phase === 'downloading'
                    ? 'Ask is available after the on-device model is on this iPhone.'
                    : 'Available when the note is ready.'}
              </Typography>
            ) : (
              <>
                {!answer ? (
                  <View style={styles.chips}>
                    {ASK_CHIPS.map((chipLabel) => (
                      <Pressable
                        key={chipLabel}
                        accessibilityRole="button"
                        onPress={() => {
                          void sendAsk(chipLabel);
                        }}
                        style={[styles.askChip, { borderColor: theme.glassBorder, backgroundColor: theme.glass }]}
                      >
                        <Typography variant="caption">{chipLabel}</Typography>
                      </Pressable>
                    ))}
                  </View>
                ) : null}
                <View style={styles.askRow}>
                  <Input
                    value={ask}
                    onChangeText={setAsk}
                    placeholder="When do I pause most?"
                    returnKeyType="send"
                    maxLength={160}
                    onFocus={() => setAskFocused(true)}
                    onBlur={() => setAskFocused(false)}
                    onSubmitEditing={() => {
                      void sendAsk(ask);
                    }}
                    style={styles.askInput}
                    editable={!asking}
                  />
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Ask this iPhone"
                    disabled={asking || !ask.trim()}
                    onPress={() => {
                      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                      void sendAsk(ask);
                    }}
                    style={[
                      styles.send,
                      { borderColor: theme.glassBorder, backgroundColor: theme.glass, opacity: asking || !ask.trim() ? 0.5 : 1 },
                    ]}
                  >
                    {asking ? (
                      <ActivityIndicator color={theme.primary} />
                    ) : (
                      <Ionicons name="arrow-up" size={18} color={theme.primary} />
                    )}
                  </Pressable>
                </View>
                {asking ? <Typography variant="caption">Reading your local STATS.</Typography> : null}
                {answer ? (
                  <>
                    <Typography variant="kicker">AI-GENERATED ON THIS IPHONE</Typography>
                    <Notice tone="info" icon="chatbubble-ellipses-outline">
                      {answer}
                    </Notice>
                  </>
                ) : null}
                <Typography variant="caption">
                  Apps stay in local SQLite. This is not cloud coaching. Answers are AI-generated on this iPhone.
                </Typography>
              </>
            )}
          </Card>
        ) : null}

        {hasSessions ? (
          <Card style={styles.listCard}>
            <SectionHeader kicker="05" title="Recent blocks" subtitle="Duration relative to your longest recent session." />
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

function chipFor(
  status: LocalPatternStatus,
  phase: DownloadProgress['phase']
): { label: string; tone: 'ok' | 'paused' | 'idle' } {
  if (phase === 'downloading' || phase === 'verifying') return { label: 'Downloading', tone: 'paused' };
  if (status === 'ready') return { label: 'On-device', tone: 'ok' };
  if (status === 'loading') return { label: 'Writing locally', tone: 'paused' };
  if (status === 'download') return { label: 'Download', tone: 'idle' };
  if (status === 'opted-out') return { label: 'Session rules', tone: 'idle' };
  return { label: 'Session rules', tone: 'idle' };
}

function sectionSubtitle(status: LocalPatternStatus, engine: 'qwen' | 'apple' | 'none'): string {
  if (status === 'ready' && engine === 'apple') return 'How to improve, AI-generated on this iPhone by Apple Intelligence.';
  if (status === 'ready') return 'How to improve, AI-generated on this iPhone from local STATS.';
  if (status === 'loading') return 'Session rules until the on-device model finishes.';
  if (status === 'download') return 'Session rules. Download the on-device model to write from STATS.';
  if (status === 'opted-out') return 'Session rules. Turn on on-device AI writing to generate from STATS.';
  return 'Session rules. On-device model did not run.';
}

function patternNotice(status: LocalPatternStatus, engine: 'qwen' | 'apple' | 'none', detail?: string) {
  if (status === 'loading') {
    return (
      <Notice tone="info" icon="sparkles-outline">
        An on-device AI model is writing from local STATS. Nothing leaves this iPhone.
      </Notice>
    );
  }
  if (status === 'ready') {
    return (
      <Notice tone="info" icon="phone-portrait-outline">
        {onDeviceAiOutputLabel(engine)}
      </Notice>
    );
  }
  if (status === 'opted-out') {
    return (
      <Notice tone="info" icon="analytics-outline">
        Using session rules. On-device AI writing is off.
      </Notice>
    );
  }
  if (status === 'download') {
    return (
      <Notice tone="info" icon="cloud-download-outline">
        Downloading the on-device model. Session rules are showing until it is ready.
      </Notice>
    );
  }
  return (
    <Notice tone="warn" icon="analytics-outline">
      {detail || 'Using session rules. The on-device model was unavailable.'}
    </Notice>
  );
}

const styles = StyleSheet.create({
  content: { gap: spacing.xl, paddingBottom: 120 },
  heroCopy: { gap: 6 },
  chipWrap: { alignSelf: 'flex-start' },
  metrics: { flexDirection: 'row', gap: spacing.md },
  setupCard: { gap: spacing.md },
  reportCard: { gap: spacing.md },
  patternBlock: { gap: spacing.md },
  patternCard: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md },
  patternCopy: { flex: 1, gap: 4 },
  listCard: { gap: spacing.lg },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  askChip: {
    borderWidth: 1,
    borderRadius: radius.full,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  askRow: { flexDirection: 'row', gap: spacing.sm, alignItems: 'center' },
  askInput: { flex: 1 },
  send: {
    width: 52,
    height: 52,
    borderRadius: radius.lg,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
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
