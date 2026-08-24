/**
 * Input — Text input with consistent styling.
 */

import React from 'react';
import { TextInput, type TextInputProps, type ViewStyle } from 'react-native';
import { useTheme } from '@/theme';
import { radius, spacing, fontSize } from '@/theme/tokens';

interface InputProps extends TextInputProps {
  containerStyle?: ViewStyle;
}

export function Input({ containerStyle, style, ...rest }: InputProps) {
  const { theme } = useTheme();

  return (
    <TextInput
      style={[
        {
          backgroundColor: theme.surfaceSecondary,
          borderRadius: radius.lg,
          paddingHorizontal: spacing.lg,
          paddingVertical: spacing.md,
          fontSize: fontSize.base,
          color: theme.text,
          minHeight: 48,
        },
        style,
      ]}
      placeholderTextColor={theme.textTertiary}
      {...rest}
    />
  );
}
