import React, { useEffect, useState } from 'react';
import { View, StyleSheet, Alert, Share } from 'react-native';
import { Screen, Card, Button, Typography } from '@/components';
import {
  deleteLocalData,
  exportLocalData,
  getPrivacyConsent,
  updatePrivacyConsent,
} from '@/privacy/privacyService';
import { spacing } from '@/theme/tokens';

export default function SettingsScreen() {
  const [busy, setBusy] = useState(false);
  const [cloudSync, setCloudSync] = useState(false);

  useEffect(() => {
    void getPrivacyConsent().then((consent) => setCloudSync(consent.cloudSync));
  }, []);

  const toggleSync = async () => {
    const next = !cloudSync;
    await updatePrivacyConsent({ cloudSync: next });
    setCloudSync(next);
    Alert.alert(
      'Cloud sync',
      next
        ? 'Timer session totals may sync if you sign in. Apple Screen Time (app names and per-app time) never leaves this iPhone.'
        : 'Cloud sync is off. New sessions stay only on this iPhone.'
    );
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
      <Typography variant="caption">Privacy</Typography>
      <Typography variant="title">Data and rights</Typography>

      <View style={styles.stack}>
        <Card>
          <Typography variant="subtitle">What we store</Typography>
          <Typography variant="caption">
            The timer saves start, stop, duration and pause count in SQLite on this iPhone.
            Per-app Screen Time is drawn by Apple's extension and is never copied into our database, never sent to a server, and never used for ads.
          </Typography>
        </Card>
        <Card>
          <Typography variant="subtitle">No in-app purchases</Typography>
          <Typography variant="caption">
            This app does not sell subscriptions or unlocks. Desktop coaching and computer sync are outside this binary.
          </Typography>
        </Card>
        <Button
          label={cloudSync ? 'Turn off optional cloud sync' : 'Turn on optional cloud sync'}
          variant="secondary"
          onPress={() => void toggleSync()}
          disabled={busy}
        />
        <Button label="Export my data" variant="secondary" onPress={() => void exportData()} disabled={busy} />
        <Button label="Delete local data" variant="danger" onPress={eraseLocal} disabled={busy} />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  stack: { gap: spacing.md, marginTop: spacing.lg },
});
