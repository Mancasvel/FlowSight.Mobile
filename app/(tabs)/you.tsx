import React, { useCallback, useState } from 'react';
import { View, StyleSheet, ScrollView, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { Screen, Card, Button, Typography } from '@/components';
import { useAuth } from '@/hooks';
import { loadYouStats, type YouStats } from '@/services/sessionInsights';
import { formatDurationShort } from '@/utils/format';
import { useTheme } from '@/theme';
import { radius, spacing } from '@/theme/tokens';

export default function YouScreen() {
  const router = useRouter();
  const { theme } = useTheme();
  const { user, isAuthenticated, logout } = useAuth();
  const initial = user?.email?.charAt(0).toUpperCase() ?? 'F';
  const [stats, setStats] = useState<YouStats>({ todaySeconds: 0, sessionCount: 0, streak: 0 });

  useFocusEffect(
    useCallback(() => {
      void loadYouStats().then(setStats);
    }, [])
  );

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View>
          <Typography variant="caption" style={{ color: theme.primary }}>YOUR SPACE</Typography>
          <Typography variant="title">You</Typography>
        </View>

        <Card style={styles.profileCard}>
          <View style={styles.profileTop}>
            <View style={[styles.avatar, { backgroundColor: theme.surfaceTertiary, borderColor: theme.glassBorder }]}>
              <Typography variant="title" color={theme.primary}>{initial}</Typography>
            </View>
            <View style={styles.profileCopy}>
              <Typography variant="subtitle">
                {isAuthenticated ? user?.email?.split('@')[0] ?? 'Flow member' : 'Your focus, private'}
              </Typography>
              <Typography variant="caption">
                {isAuthenticated ? user?.email : 'Account is optional. The timer works without it.'}
              </Typography>
            </View>
          </View>
          <View style={[styles.divider, { backgroundColor: theme.borderLight }]} />
          <View style={styles.stats}>
            <View style={styles.stat}>
              <Typography variant="subtitle">{formatDurationShort(stats.todaySeconds)}</Typography>
              <Typography variant="caption">Today</Typography>
            </View>
            <View style={[styles.statDivider, { backgroundColor: theme.borderLight }]} />
            <View style={styles.stat}>
              <Typography variant="subtitle">{stats.sessionCount}</Typography>
              <Typography variant="caption">Sessions</Typography>
            </View>
            <View style={[styles.statDivider, { backgroundColor: theme.borderLight }]} />
            <View style={styles.stat}>
              <Typography variant="subtitle">{stats.streak}</Typography>
              <Typography variant="caption">Streak</Typography>
            </View>
          </View>
        </Card>

        <View style={styles.section}>
          <Typography variant="subtitle">Account & preferences</Typography>
          <Card style={styles.menuCard}>
            <MenuRow
              icon="settings-outline"
              label="Settings"
              color={theme.primary}
              onPress={() => router.push('/settings')}
            />
            <View style={[styles.divider, { backgroundColor: theme.borderLight }]} />
            <MenuRow
              icon="shield-checkmark-outline"
              label="Privacy controls"
              color="#18A9D5"
              onPress={() => router.push('/settings')}
            />
            <View style={[styles.divider, { backgroundColor: theme.borderLight }]} />
            <MenuRow
              icon="sparkles-outline"
              label="Replay onboarding"
              color="#F59E0B"
              onPress={() => router.push('/onboarding')}
            />
          </Card>
        </View>

        <Card style={styles.privacyCard}>
          <View style={[styles.privacyIcon, { backgroundColor: 'rgba(54, 211, 153, 0.13)' }]}>
            <Ionicons name="lock-closed" size={20} color="#1CA778" />
          </View>
          <View style={styles.privacyCopy}>
            <Typography variant="subtitle">On this iPhone</Typography>
          <Typography variant="caption">
              Screen Time stays in Apple's extension. Timer totals stay local unless you opt in to sync. No purchases in this app.
          </Typography>
          </View>
        </Card>

        {isAuthenticated ? (
          <Button label="Sign out" variant="secondary" onPress={() => void logout()} />
        ) : (
          <Button label="Sign in" onPress={() => router.push('/auth')} />
        )}
      </ScrollView>
    </Screen>
  );
}

function MenuRow({
  icon,
  label,
  color,
  onPress,
}: {
  icon: 'settings-outline' | 'shield-checkmark-outline' | 'sparkles-outline';
  label: string;
  color: string;
  onPress: () => void;
}) {
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={styles.menuRow}>
      <View style={[styles.menuIcon, { backgroundColor: `${color}18` }]}>
        <Ionicons name={icon} size={18} color={color} />
      </View>
      <Typography style={styles.menuLabel}>{label}</Typography>
      <Ionicons name="chevron-forward" size={18} color="#A09CAF" />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  content: { gap: spacing.xl, paddingBottom: 110 },
  profileCard: { gap: spacing.lg, borderRadius: radius.glass },
  profileTop: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  avatar: {
    width: 64,
    height: 64,
    borderRadius: 23,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  profileCopy: { flex: 1, gap: 3 },
  divider: { height: StyleSheet.hairlineWidth },
  stats: { flexDirection: 'row', alignItems: 'center' },
  stat: { flex: 1, alignItems: 'center', gap: 2 },
  statDivider: { width: StyleSheet.hairlineWidth, height: 34 },
  section: { gap: spacing.md },
  menuCard: { paddingVertical: spacing.xs },
  menuRow: { minHeight: 58, flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  menuIcon: {
    width: 34,
    height: 34,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  menuLabel: { flex: 1 },
  privacyCard: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  privacyIcon: {
    width: 44,
    height: 44,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  privacyCopy: { flex: 1, gap: 2 },
});
