/**
 * Button — Primary, secondary, and ghost variants with haptic feedback.
 */

import React, { useCallback } from 'react';
import {
  Pressable,
  Text,
  type ViewStyle,
  type TextStyle,
  type StyleProp,
  ActivityIndicator,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { useTheme } from '@/theme';
import { radius, spacing, fontSize, fontWeight, layout } from '@/theme/tokens';

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
type ButtonSize = 'sm' | 'md' | 'lg';

interface ButtonProps {
  title: string;
  onPress: () => void;
  variant?: ButtonVariant;
  size?: ButtonSize;
  disabled?: boolean;
  loading?: boolean;
  icon?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}

export function Button({
  title,
  onPress,
  variant = 'primary',
  size = 'md',
  disabled = false,
  loading = false,
  icon,
  style,
}: ButtonProps) {
  const { theme } = useTheme();

  const handlePress = useCallback(() => {
    if (disabled || loading) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onPress();
  }, [disabled, loading, onPress]);

  const sizeStyles: Record<ButtonSize, { container: ViewStyle; text: TextStyle }> = {
    sm: {
      container: { paddingVertical: spacing.sm, paddingHorizontal: spacing.md },
      text: { fontSize: fontSize.sm },
    },
    md: {
      container: { paddingVertical: spacing.md, paddingHorizontal: spacing.lg },
      text: { fontSize: fontSize.base },
    },
    lg: {
      container: { paddingVertical: spacing.lg, paddingHorizontal: spacing.xl },
      text: { fontSize: fontSize.md },
    },
  };

  const variantStyles: Record<ButtonVariant, { container: ViewStyle; text: TextStyle }> = {
    primary: {
      container: { backgroundColor: disabled ? theme.textTertiary : theme.primary },
      text: { color: theme.primaryText },
    },
    secondary: {
      container: {
        backgroundColor: 'transparent',
        borderWidth: 1,
        borderColor: disabled ? theme.textTertiary : theme.primary,
      },
      text: { color: disabled ? theme.textTertiary : theme.primary },
    },
    ghost: {
      container: { backgroundColor: 'transparent' },
      text: { color: theme.primary },
    },
    danger: {
      container: { backgroundColor: disabled ? theme.textTertiary : '#EF4444' },
      text: { color: '#FFFFFF' },
    },
  };

  return (
    <Pressable
      onPress={handlePress}
      disabled={disabled || loading}
      style={({ pressed }) => [
        {
          borderRadius: radius.lg,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: layout.touchTargetIOS,
          opacity: pressed ? 0.8 : 1,
        },
        sizeStyles[size].container,
        variantStyles[variant].container,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator
          size="small"
          color={variantStyles[variant].text.color}
        />
      ) : (
        <>
          {icon}
          <Text
            style={[
              {
                fontWeight: fontWeight.semibold,
                textAlign: 'center',
              },
              sizeStyles[size].text,
              variantStyles[variant].text,
              icon ? { marginLeft: spacing.sm } : undefined,
            ]}
          >
            {title}
          </Text>
        </>
      )}
    </Pressable>
  );
}
