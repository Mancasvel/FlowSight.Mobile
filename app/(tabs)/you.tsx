/**
 * You Screen — Profile, settings, account management.
 */

import React from 'react';
import { View, ScrollView, Pressable } from 'react-native';
import { Screen, Card, Typography, Badge } from '@/components';
import { useTheme } from '@/theme';
import { spacing, radius } from '@/theme/tokens';

interface SettingsRowProps {
  label: string;
  value?: string;
  onPress?: () => void;
  badge?: string;
}

function SettingsRow({ label, value, onPress, badge }: SettingsRowProps) {
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
      <Typography variant="body">{label}</Typography>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
        {badge && <Badge label={badge} variant="info" />}
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

export default function YouScreen() {
  const { theme } = useTheme();

  return (
    <Screen>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: spacing.xxxxl }}
      >
        {/* Header */}
        <View style={{ marginTop: spacing.xl, marginBottom: spacing.xxl }}>
          <Typography variant="h1">You</Typography>
        </View>

        {/* Account */}
        <Card style={{ marginBottom: spacing.lg }}>
          <Typography variant="h3" style={{ marginBottom: spacing.md }}>
            Account & Plan
          </Typography>
          <SettingsRow label="Sign In" value="Free plan" onPress={() => {}} />
          <View style={{ height: 1, backgroundColor: theme.border }} />
          <SettingsRow label="Plan" value="Free" onPress={() => {}} />
        </Card>

        {/* Preferences */}
        <Card style={{ marginBottom: spacing.lg }}>
          <Typography variant="h3" style={{ marginBottom: spacing.md }}>
            Work Preferences
          </Typography>
          <SettingsRow label="Daily Goal" value="480 min" onPress={() => {}} />
          <View style={{ height: 1, backgroundColor: theme.border }} />
          <SettingsRow label="Roles" onPress={() => {}} />
          <View style={{ height: 1, backgroundColor: theme.border }} />
          <SettingsRow label="Activities" onPress={() => {}} />
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
          <SettingsRow label="Delete Local Data" onPress={() => {}} />
        </Card>

        {/* Appearance */}
        <Card style={{ marginBottom: spacing.lg }}>
          <Typography variant="h3" style={{ marginBottom: spacing.md }}>
            Appearance
          </Typography>
          <SettingsRow label="Theme" value="System" onPress={() => {}} />
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
