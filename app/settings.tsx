/**
 * Settings Screen — Privacy, account, integrations settings.
 */

import React from 'react';
import { View, ScrollView, Pressable, Alert } from 'react-native';
import { router } from 'expo-router';
import { Screen, Card, Typography, Badge } from '@/components';
import { useTheme } from '@/theme';
import { spacing } from '@/theme/tokens';
import { signOut } from '@/services';

interface SettingsRowProps {
  label: string;
  value?: string;
  onPress?: () => void;
  badge?: string;
  badgeVariant?: 'default' | 'success' | 'warning' | 'error' | 'info';
  destructive?: boolean;
}

function SettingsRow({ label, value, onPress, badge, badgeVariant, destructive }: SettingsRowProps) {
  const { theme } = useTheme();

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => ({
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: spacing.md,
        opacity: pressed ? 0.7 : 1,
      })}
    >
      <Typography
        variant="body"
        color={destructive ? '#EF4444' : theme.text}
      >
        {label}
      </Typography>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
        {badge && <Badge label={badge} variant={badgeVariant ?? 'info'} />}
        {value && (
          <Typography variant="body" color={theme.textSecondary}>
            {value}
          </Typography>
        )}
        <Typography variant="body" color={theme.textTertiary}>
          ›
        </Typography>
      </View>
    </Pressable>
  );
}

export default function SettingsScreen() {
  const { theme } = useTheme();

  const handleLogout = () => {
    Alert.alert(
      'Sign Out',
      'Are you sure you want to sign out?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Sign Out',
          style: 'destructive',
          onPress: async () => {
            await signOut();
            router.replace('/(tabs)');
          },
        },
      ]
    );
  };

  return (
    <Screen>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: spacing.xxxxl }}
      >
        {/* Header */}
        <View style={{ marginTop: spacing.xl, marginBottom: spacing.xxl }}>
          <Typography variant="h1">Settings</Typography>
        </View>

        {/* Account */}
        <Card style={{ marginBottom: spacing.lg }}>
          <Typography variant="h3" style={{ marginBottom: spacing.md }}>
            Account
          </Typography>
          <SettingsRow label="Profile" onPress={() => {}} />
          <View style={{ height: 1, backgroundColor: theme.border }} />
          <SettingsRow label="Plan" value="Free" onPress={() => {}} />
          <View style={{ height: 1, backgroundColor: theme.border }} />
          <SettingsRow label="Teams" onPress={() => {}} />
        </Card>

        {/* Integrations */}
        <Card style={{ marginBottom: spacing.lg }}>
          <Typography variant="h3" style={{ marginBottom: spacing.md }}>
            Integrations
          </Typography>
          <SettingsRow label="Jira" onPress={() => {}} />
          <View style={{ height: 1, backgroundColor: theme.border }} />
          <SettingsRow label="Linear" onPress={() => {}} />
          <View style={{ height: 1, backgroundColor: theme.border }} />
          <SettingsRow label="Notion" onPress={() => {}} />
        </Card>

        {/* Privacy */}
        <Card style={{ marginBottom: spacing.lg }}>
          <Typography variant="h3" style={{ marginBottom: spacing.md }}>
            Privacy & Data
          </Typography>
          <SettingsRow label="Privacy Settings" onPress={() => {}} />
          <View style={{ height: 1, backgroundColor: theme.border }} />
          <SettingsRow label="Export Data" onPress={() => {}} />
          <View style={{ height: 1, backgroundColor: theme.border }} />
          <SettingsRow label="Delete Local Data" destructive onPress={() => {
            Alert.alert('Delete Local Data', 'This will remove all local activity data. This cannot be undone.', [
              { text: 'Cancel', style: 'cancel' },
              { text: 'Delete', style: 'destructive' },
            ]);
          }} />
        </Card>

        {/* Notifications */}
        <Card style={{ marginBottom: spacing.lg }}>
          <Typography variant="h3" style={{ marginBottom: spacing.md }}>
            Notifications
          </Typography>
          <SettingsRow label="Reminders" value="Off" onPress={() => {}} />
        </Card>

        {/* Appearance */}
        <Card style={{ marginBottom: spacing.lg }}>
          <Typography variant="h3" style={{ marginBottom: spacing.md }}>
            Appearance
          </Typography>
          <SettingsRow label="Theme" value="System" onPress={() => {}} />
        </Card>

        {/* Sign Out */}
        <Card style={{ marginBottom: spacing.lg }}>
          <SettingsRow label="Sign Out" onPress={handleLogout} destructive />
        </Card>

        {/* Version */}
        <Typography
          variant="caption"
          color={theme.textTertiary}
          align="center"
          style={{ marginTop: spacing.lg }}
        >
          FlowSight Mobile v0.1.0
        </Typography>
      </ScrollView>
    </Screen>
  );
}
