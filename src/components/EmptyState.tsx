/**
 * EmptyState — Placeholder for empty lists and screens.
 */

import React from 'react';
import { View, type ViewStyle } from 'react-native';
import { Typography } from './Typography';
import { useTheme } from '@/theme';
import { spacing } from '@/theme/tokens';

interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  action?: React.ReactNode;
  style?: ViewStyle;
}

export function EmptyState({ icon, title, description, action, style }: EmptyStateProps) {
  const { theme } = useTheme();

  return (
    <View
      style={[
        {
          flex: 1,
          alignItems: 'center',
          justifyContent: 'center',
          padding: spacing.xxxl,
        },
        style,
      ]}
    >
      {icon && <View style={{ marginBottom: spacing.lg }}>{icon}</View>}
      <Typography variant="h3" align="center" style={{ marginBottom: spacing.sm }}>
        {title}
      </Typography>
      {description && (
        <Typography variant="body" color={theme.textSecondary} align="center">
          {description}
        </Typography>
      )}
      {action && <View style={{ marginTop: spacing.xl }}>{action}</View>}
    </View>
  );
}
