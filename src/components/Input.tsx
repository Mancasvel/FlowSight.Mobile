import React from 'react';
import { TextInput, StyleSheet, type TextInputProps } from 'react-native';
import { useTheme } from '@/theme';
import { fontFamily, fontSize, radius } from '@/theme/tokens';

export function Input(props: TextInputProps) {
  const { theme } = useTheme();

  return (
    <TextInput
      placeholderTextColor={theme.textTertiary}
      {...props}
      style={[
        styles.input,
        {
          backgroundColor: theme.glass,
          color: theme.text,
          borderColor: theme.glassBorder,
          fontFamily: fontFamily.body,
        },
        props.style,
      ]}
    />
  );
}

const styles = StyleSheet.create({
  input: {
    minHeight: 52,
    borderRadius: radius.lg,
    borderWidth: 1,
    paddingHorizontal: 16,
    fontSize: fontSize.base,
  },
});
