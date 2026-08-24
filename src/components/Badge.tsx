/**
 * Badge — Small status indicator.
 */

import React from 'react';
import { View, Text, type ViewStyle } from 'react-native';
import { useTheme } from '@/theme';
import { radius, spacing, fontSize, fontWeight } from '@/theme/tokens';

type BadgeVariant = 'default' | 'success' | 'warning' | 'error' | 'info';

interface BadgeProps {
  label: string;
  variant?: BadgeVariant;
  style?: ViewStyle;
}

const variantColors: Record<BadgeVariant, { bg: string; text: string }> = {
  default: { bg: '#E2E8F0', text: '#475569' },
  success: { bg: '#D1FAE5', text: '#065F46' },
  warning: { bg: '#FEF3C7', text: '#92400E' },
  error: { bg: '#FEE2E2', text: '#991B1B' },
  info: { bg: '#DBEAFE', text: '#1E40AF' },
};

export function Badge({ label, variant = 'default', style }: BadgeProps) {
  const colors = variantColors[variant];

  return (
    <View
      style={[
        {
          backgroundColor: colors.bg,
          borderRadius: radius.full,
          paddingHorizontal: spacing.sm,
          paddingVertical: spacing.xs,
          alignSelf: 'flex-start',
        },
        style,
      ]}
    >
      <Text
        style={{
          color: colors.text,
          fontSize: fontSize.xs,
          fontWeight: fontWeight.medium,
        }}
      >
        {label}
      </Text>
    </View>
  );
}
