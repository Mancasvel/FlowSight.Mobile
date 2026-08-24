/**
 * Card — Elevated surface with rounded corners and shadow.
 */

import React from 'react';
import { View, type ViewStyle, type StyleProp, type ViewProps } from 'react-native';
import { useTheme } from '@/theme';
import { radius, spacing, shadows } from '@/theme/tokens';

interface CardProps extends ViewProps {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  variant?: 'default' | 'elevated' | 'flat';
}

export function Card({ children, style, variant = 'default', ...rest }: CardProps) {
  const { theme } = useTheme();

  const baseStyle: ViewStyle = {
    backgroundColor: variant === 'flat' ? theme.surfaceSecondary : theme.card,
    borderRadius: radius.xl,
    padding: spacing.lg,
  };

  const variantStyle: ViewStyle =
    variant === 'elevated'
      ? { ...shadows.md }
      : variant === 'default'
        ? { ...shadows.sm }
        : {};

  return (
    <View style={[baseStyle, variantStyle, style]} {...rest}>
      {children}
    </View>
  );
}
