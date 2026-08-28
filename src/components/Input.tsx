import React from 'react';
import { TextInput, StyleSheet, type TextInputProps } from 'react-native';
import { useTheme } from '@/theme';
import { radius, fontSize, layout } from '@/theme/tokens';

export function Input(props: TextInputProps) {
  const { theme } = useTheme();

  return (
    <TextInput
      placeholderTextColor={theme.textTertiary}
      {...props}
      style={[
        styles.input,
        {
          backgroundColor: theme.surfaceSecondary,
          color: theme.text,
          borderColor: theme.border,
        },
        props.style,
      ]}
    />
  );
}

const styles = StyleSheet.create({
  input: {
    minHeight: layout.touchTargetIOS,
    borderRadius: radius.md,
    borderWidth: 1,
    paddingHorizontal: 14,
    fontSize: fontSize.base,
  },
});
