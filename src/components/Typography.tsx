import React from 'react';
import { Text, type TextProps, type TextStyle } from 'react-native';
import { useTheme } from '@/theme';
import { fontSize, fontWeight, lineHeight } from '@/theme/tokens';

type Variant = 'display' | 'title' | 'subtitle' | 'body' | 'caption';

export function Typography({
  children,
  variant = 'body',
  color,
  style,
  ...rest
}: TextProps & {
  variant?: Variant;
  color?: string;
}) {
  const { theme } = useTheme();
  const variantStyle: TextStyle =
    variant === 'display'
      ? {
          fontSize: fontSize.display,
          fontWeight: fontWeight.semibold,
          lineHeight: fontSize.display * lineHeight.tight,
          letterSpacing: -1.4,
          fontVariant: ['tabular-nums'],
        }
      : variant === 'title'
        ? {
            fontSize: fontSize.xxxl,
            fontWeight: fontWeight.bold,
            lineHeight: fontSize.xxxl * lineHeight.tight,
            letterSpacing: -1.2,
          }
        : variant === 'subtitle'
          ? { fontSize: fontSize.lg, fontWeight: fontWeight.semibold, letterSpacing: -0.3 }
          : variant === 'caption'
            ? { fontSize: fontSize.sm, fontWeight: fontWeight.medium, letterSpacing: 0.1 }
            : {
                fontSize: fontSize.base,
                fontWeight: fontWeight.regular,
                lineHeight: fontSize.base * lineHeight.relaxed,
              };

  return (
    <Text
      {...rest}
      style={[
        variantStyle,
        { color: color ?? (variant === 'caption' ? theme.textSecondary : theme.text) },
        style,
      ]}
    >
      {children}
    </Text>
  );
}
