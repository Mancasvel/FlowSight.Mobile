import React, { useEffect, useState } from 'react';
import { View, StyleSheet, Alert, Share, Pressable, ScrollView, Linking } from 'react-native';
import { useRouter } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Screen, Card, Button, Typography, ToggleRow } from '@/components';
import { PermissionsPanel } from '@/components/PermissionsPanel';
import { DeviceConnection } from '@/components/DeviceConnection';
import { useAuth } from '@/hooks';

import {
  deleteCloudAccount,
  deleteLocalData,
  exportLocalData,
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
  const { isAuthenticated } = useAuth();
  const [busy, setBusy] = useState(false);
  const [notify, setNotify] = useState(false);
  useEffect(() => { void areFocusNotificationsEnabled().then(setNotify); }, []);

  const toggleNotifications = async (next: boolean) => {
    const enabled = await setFocusNotificationsEnabled(next);
    setNotify(enabled);
    if (next && !enabled) {
      Alert.alert(
        'Notifications off',
        canUseFocusNotifications()
          ? 'FlowSight needs notification permission in Android Settings to send focus reminders.'
          : 'This install does not include reminder support yet. Rebuild the Android app to enable it.'
      );
    }
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
      'This removes sessions and preferences from this device. Android system usage history remains under Android Settings and was never copied into FlowSight.',
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

  const eraseAccount = () => {
    Alert.alert(
      'Delete account and cloud data',
      'This permanently deletes your FlowSight account and cloud data, then removes local data from this device. This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete account',
          style: 'destructive',
          onPress: () => {
            setBusy(true);
            void deleteCloudAccount()
              .then((result) => {
                if (!result.success) {
                  Alert.alert('Account not deleted', result.error ?? 'Please try again.');
                  return;
                }
                Alert.alert('Account deleted', 'Your FlowSight account and local data were deleted.');
              })
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
            <Typography variant="title">Settings</Typography>
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
            The timer saves start, stop, duration and pause count in SQLite on this device. Per-app activity is read from Android Usage Access and is never copied into our database, sent to a server, or used for ads.
          </Typography>
        </Card>

        <Card style={styles.card}>
          <Typography variant="kicker" color={theme.primary}>
            02
          </Typography>
          <Typography variant="subtitle">No in-app purchases</Typography>
          <Typography variant="caption">
            This app does not sell subscriptions or unlocks. Cloud sync is optional and follows your account’s existing access.
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



        <View style={styles.actions}>
          <Button
            label="Read privacy policy"
            variant="secondary"
            onPress={() => void Linking.openURL('https://flowsight.site/privacy-policy')}
            disabled={busy}
          />
          <Button
            label="Account deletion help"
            variant="secondary"
            onPress={() => void Linking.openURL('https://flowsight.site/delete-account')}
            disabled={busy}
          />
          <Button label="Export my data" variant="secondary" onPress={() => void exportData()} disabled={busy} />
          <Button label="Delete local data" variant="danger" onPress={eraseLocal} disabled={busy} />
          {isAuthenticated ? (
            <Button label="Delete account and cloud data" variant="danger" onPress={eraseAccount} disabled={busy} />
          ) : null}
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
