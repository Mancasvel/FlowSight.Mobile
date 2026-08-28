import React, { useEffect, useState } from 'react';
import { View, StyleSheet, Alert, Share, Pressable, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Screen, Card, Button, Typography, ToggleRow } from '@/components';
import {
  hasActivitySelection,
  isNativeDeviceActivityAvailable,
  presentActivityPicker,
} from '../modules/flowsight-device-activity/src/index';
import {
  deleteLocalData,
  exportLocalData,
  getPrivacyConsent,
  updatePrivacyConsent,
} from '@/privacy/privacyService';
import {
  areFocusNotificationsEnabled,
  canUseFocusNotifications,
  setFocusNotificationsEnabled,
} from '@/services/notifications';
import { useTheme } from '@/theme';
import { spacing } from '@/theme/tokens';

export default function SettingsScreen() {
  const router = useRouter();
  const { theme } = useTheme();
  const [busy, setBusy] = useState(false);
  const [cloudSync, setCloudSync] = useState(false);
  const [notify, setNotify] = useState(false);
  const [needsAppPicker, setNeedsAppPicker] = useState(false);
  const nativeScreenTime = isNativeDeviceActivityAvailable();

  useEffect(() => {
    void getPrivacyConsent().then((consent) => setCloudSync(consent.cloudSync));
    void areFocusNotificationsEnabled().then(setNotify);
    if (nativeScreenTime) {
      void hasActivitySelection().then((selected) => setNeedsAppPicker(!selected));
    }
  }, [nativeScreenTime]);

  const toggleSync = async (next: boolean) => {
    await updatePrivacyConsent({ cloudSync: next });
    setCloudSync(next);
    Alert.alert(
      'Cloud sync',
      next
        ? 'Timer session totals may sync if you sign in. Apple Screen Time (app names and per-app time) never leaves this iPhone.'
        : 'Cloud sync is off. New sessions stay only on this iPhone.'
    );
  };

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

  const chooseMeasuredApps = async () => {
    const result = await presentActivityPicker();
    if (result.saved) setNeedsAppPicker(false);
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
      'This removes sessions and preferences from this iPhone. Screen Time history stays in Apple Settings. We cannot delete Apple data.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            setBusy(true);
            void deleteLocalData()
              .then(() => Alert.alert('Done', 'Local FlowSight data was deleted.'))
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
            This app does not sell subscriptions or unlocks. Desktop coaching and computer sync are outside this binary.
          </Typography>
        </Card>

        {nativeScreenTime ? (
          <Card style={styles.card}>
            <Typography variant="kicker" color={theme.primary}>
              03
            </Typography>
            <Typography variant="subtitle">Measured apps</Typography>
            <Typography variant="caption">
              {needsAppPicker
                ? 'Add work apps one by one, then Social or Entertainment as categories so those do not count as focus.'
                : 'Apple Screen Time only measures the apps and categories you pick. Names never leave this iPhone.'}
            </Typography>
            <Button
              label={needsAppPicker ? 'Choose measured apps' : 'Change measured apps'}
              variant={needsAppPicker ? 'primary' : 'secondary'}
              onPress={() => {
                void chooseMeasuredApps();
              }}
              disabled={busy}
            />
          </Card>
        ) : null}

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
            label="Optional cloud sync"
            caption="Timer totals only. Screen Time never leaves this iPhone."
            value={cloudSync}
            onValueChange={(next) => {
              void toggleSync(next);
            }}
            disabled={busy}
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
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  hero: { gap: 4 },
  card: { gap: spacing.sm },
  actions: { gap: spacing.sm, marginTop: spacing.sm },
});
