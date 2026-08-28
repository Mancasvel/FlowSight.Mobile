import React, { useCallback, useState } from 'react';
import { View, StyleSheet, ScrollView, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import {
  Screen,
  Card,
  Button,
  Typography,
  ListRow,
  ToggleRow,
} from '@/components';
import { useAuth } from '@/hooks';
import {
  hasActivitySelection,
  isNativeDeviceActivityAvailable,
  presentActivityPicker,
} from '../../modules/flowsight-device-activity/src/index';
import {
  areFocusNotificationsEnabled,
  canUseFocusNotifications,
  setFocusNotificationsEnabled,
} from '@/services/notifications';
import { useTheme } from '@/theme';
import { spacing } from '@/theme/tokens';

export default function YouScreen() {
  const router = useRouter();
  const { theme } = useTheme();
  const { user, isAuthenticated, logout } = useAuth();
  const initial = user?.email?.charAt(0).toUpperCase() ?? 'F';
  const [notify, setNotify] = useState(false);
  const [needsAppPicker, setNeedsAppPicker] = useState(false);
  const nativeScreenTime = isNativeDeviceActivityAvailable();

  useFocusEffect(
    useCallback(() => {
      void areFocusNotificationsEnabled().then(setNotify);
      if (nativeScreenTime) {
        void hasActivitySelection().then((selected) => setNeedsAppPicker(!selected));
      }
    }, [nativeScreenTime])
  );

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

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.heroCopy}>
          <Typography variant="kicker" color={theme.primary}>
            Your space
          </Typography>
          <Typography variant="title">You</Typography>
        </View>

        {!isAuthenticated ? (
          <Button label="Sign in" onPress={() => router.push('/auth')} />
        ) : (
          <Card style={styles.profileCard}>
            <View style={styles.profileTop}>
              <View style={[styles.avatar, { backgroundColor: theme.surfaceTertiary, borderColor: theme.glassBorder }]}>
                <Typography variant="title" color={theme.primary}>
                  {initial}
                </Typography>
              </View>
              <View style={styles.profileCopy}>
                <Typography variant="subtitle">{user?.email?.split('@')[0] ?? 'Flow member'}</Typography>
                <Typography variant="caption">{user?.email}</Typography>
              </View>
            </View>
          </Card>
        )}

        <View style={styles.section}>
          <Typography variant="kicker" color={theme.primary}>
            01
          </Typography>
          <Typography variant="subtitle">Account & preferences</Typography>
          <Card padded={false} style={styles.menuCard}>
            <View style={styles.menuInner}>
              <ListRow
                icon="settings-outline"
                label="Settings"
                color={theme.primary}
                onPress={() => router.push('/settings')}
              />
              <ListRow
                icon="shield-checkmark-outline"
                label="Privacy controls"
                color="#38BDF8"
                onPress={() => router.push('/settings')}
              />
              {nativeScreenTime ? (
                <ListRow
                  icon="apps-outline"
                  label={needsAppPicker ? 'Choose measured apps' : 'Change measured apps'}
                  color="#6366F1"
                  onPress={() => {
                    void chooseMeasuredApps();
                  }}
                />
              ) : null}
              <ListRow
                icon="sparkles-outline"
                label="Replay onboarding"
                color="#F59E0B"
                onPress={() => router.push('/onboarding')}
                last
              />
            </View>
          </Card>
          <Card style={styles.notifyCard}>
            <ToggleRow
              label="Focus reminders"
              caption="Morning nudge, afternoon if you have not started, and a quiet ping at 25 minutes."
              value={notify}
              onValueChange={(next) => {
                void toggleNotifications(next);
              }}
            />
          </Card>
        </View>

        {isAuthenticated ? (
          <Button label="Sign out" variant="secondary" onPress={() => void logout()} />
        ) : null}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { gap: spacing.xl, paddingBottom: 120 },
  heroCopy: { gap: 6 },
  profileCard: { gap: spacing.md },
  profileTop: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  avatar: {
    width: 64,
    height: 64,
    borderRadius: 22,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  profileCopy: { flex: 1, gap: 4 },
  section: { gap: spacing.sm },
  menuCard: {},
  menuInner: { paddingHorizontal: spacing.lg, paddingVertical: spacing.xs },
  notifyCard: {},
});
