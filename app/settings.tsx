import React, { useEffect, useState } from 'react';
import { View, StyleSheet, Alert, Share, Pressable, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Screen, Card, Button, Typography, ToggleRow } from '@/components';
import { PermissionsPanel } from '@/components/PermissionsPanel';
import { DeviceConnection } from '@/components/DeviceConnection';
import {
  deleteLocalData,
  exportLocalData,
} from '@/privacy/privacyService';
import {
  acceptOnDeviceAiNotice,
  getOnDeviceAiConsent,
  ON_DEVICE_AI_NOTICE_BODY,
  ON_DEVICE_AI_NOTICE_TITLE,
  ON_DEVICE_AI_NUDGE_CAPTION,
  ON_DEVICE_AI_TOGGLE_CAPTION,
  setOnDeviceAiEnabled,
} from '@/privacy/onDeviceAi';
import {
  areFocusNotificationsEnabled,
  canUseFocusNotifications,
  setFocusNotificationsEnabled,
} from '@/services/notifications';
import {
  areInsightNudgesEnabled,
  setInsightNudgesEnabled,
} from '@/services/localInsightNotify';
import { useTheme } from '@/theme';
import { spacing } from '@/theme/tokens';

export default function SettingsScreen() {
  const router = useRouter();
  const { theme } = useTheme();
  const [busy, setBusy] = useState(false);
  const [notify, setNotify] = useState(false);
  const [insightNudge, setInsightNudge] = useState(false);
  const [aiWriting, setAiWriting] = useState(false);

  useEffect(() => {
    void areFocusNotificationsEnabled().then(setNotify);
    void areInsightNudgesEnabled().then(setInsightNudge);
    void getOnDeviceAiConsent().then((consent) => setAiWriting(consent.enabled));
  }, []);

  const toggleNotifications = async (next: boolean) => {
    const enabled = await setFocusNotificationsEnabled(next);
    setNotify(enabled);
    if (next && !enabled) {
      Alert.alert(
        'Notifications off',
        canUseFocusNotifications()
          ? 'FlowSight needs permission in iOS Settings to send focus reminders.'
          : 'This install does not include reminder support yet. Rebuild the iOS app to enable them.'
      );
    }
  };

  const toggleAiWriting = async (next: boolean) => {
    if (!next) {
      await setOnDeviceAiEnabled(false);
      setAiWriting(false);
      setInsightNudge(false);
      return;
    }
    const consent = await getOnDeviceAiConsent();
    if (consent.noticeCurrent) {
      const enabled = await setOnDeviceAiEnabled(true);
      setAiWriting(enabled);
      return;
    }
    Alert.alert(ON_DEVICE_AI_NOTICE_TITLE, ON_DEVICE_AI_NOTICE_BODY, [
      { text: 'Not now', style: 'cancel' },
      {
        text: 'Accept',
        onPress: () => {
          void acceptOnDeviceAiNotice().then(() => setAiWriting(true));
        },
      },
    ]);
  };

  const exportData = async () => {
    const payload = await exportLocalData();
    await Share.share({
      message: JSON.stringify(payload, null, 2),
    });
  };

  const eraseLocal = () => {
    Alert.alert(
      'Delete local data',
      'This removes FlowSight data for every account on this iPhone. Screen Time history stays in Apple Settings.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            setBusy(true);
            void deleteLocalData()
              .then(() => {
                setAiWriting(false);
                setInsightNudge(false);
                Alert.alert('Done', 'Local FlowSight data was deleted.');
              })
              .catch((cause) => Alert.alert(
                'Could not delete all local data',
                cause instanceof Error ? cause.message : 'Please try again.',
              ))
              .finally(() => setBusy(false));
          },
        },
      ]
    );
  };

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.top}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Back"
            onPress={() => router.back()}
            style={[styles.back, { borderColor: theme.glassBorder, backgroundColor: theme.glass }]}
          >
            <Ionicons name="chevron-back" size={20} color={theme.text} />
          </Pressable>
          <View style={styles.hero}>
            <Typography variant="kicker" color={theme.primary}>
              Privacy
            </Typography>
            <Typography variant="title">Data and rights</Typography>
          </View>
        </View>

        <PermissionsPanel />
        <DeviceConnection />

        <Card style={styles.card}>
          <Typography variant="kicker" color={theme.primary}>
            01
          </Typography>
          <Typography variant="subtitle">What we store</Typography>
          <Typography variant="caption">
            The timer saves start, stop, duration and pause count in SQLite on this iPhone. Per-app Screen Time is drawn by Apple's extension and is never copied into our database, never sent to a server, and never used for ads.
          </Typography>
        </Card>

        <Card style={styles.card}>
          <Typography variant="kicker" color={theme.primary}>
            02
          </Typography>
          <Typography variant="subtitle">No in-app purchases</Typography>
          <Typography variant="caption">
            This app does not sell subscriptions or unlocks. Use your existing FlowSight account. Private device sync is coming with FlowSight 6.0.
          </Typography>
        </Card>

        <Card style={styles.card}>
          <ToggleRow
            label="Focus reminders"
            caption="Morning, afternoon if you have not started, and a quiet ping when you hit 25 minutes."
            value={notify}
            onValueChange={(next) => {
              void toggleNotifications(next);
            }}
            disabled={busy}
          />
        </Card>

        <Card style={styles.card}>
          <ToggleRow
            label="On-device AI writing"
            caption={ON_DEVICE_AI_TOGGLE_CAPTION}
            value={aiWriting}
            onValueChange={(next) => {
              void toggleAiWriting(next);
            }}
            disabled={busy}
          />
        </Card>

        <Card style={styles.card}>
          <ToggleRow
            label="On-device insights"
            caption={ON_DEVICE_AI_NUDGE_CAPTION}
            value={insightNudge}
            onValueChange={(next) => {
              void setInsightNudgesEnabled(next).then(setInsightNudge);
            }}
            disabled={busy || !aiWriting}
          />
        </Card>

        <View style={styles.actions}>
          <Button label="Export my data" variant="secondary" onPress={() => void exportData()} disabled={busy} />
          <Button label="Delete local data" variant="danger" onPress={eraseLocal} disabled={busy} />
        </View>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { gap: spacing.lg, paddingBottom: 40 },
  top: { gap: spacing.lg },
  back: {
    width: 48,
    height: 48,
    borderRadius: 18,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  hero: { gap: 4 },
  card: { gap: spacing.sm },
  actions: { gap: spacing.sm, marginTop: spacing.sm },
});
