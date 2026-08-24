/**
 * Typography — Text components with consistent styling.
 */

import React from 'react';
import { Text, type TextProps, type TextStyle } from 'react-native';
import { useTheme } from '@/theme';
import { fontSize, fontWeight, lineHeight } from '@/theme/tokens';

interface TypographyProps extends TextProps {
  variant?: 'display' | 'h1' | 'h2' | 'h3' | 'body' | 'bodySmall' | 'caption' | 'label';
  color?: string;
  align?: TextStyle['textAlign'];
  weight?: keyof typeof fontWeight;
}

const variantStyles: Record<string, TextStyle> = {
  display: { fontSize: fontSize.display, lineHeight: fontSize.display * lineHeight.tight, fontWeight: fontWeight.bold },
  h1: { fontSize: fontSize.xxxl, lineHeight: fontSize.xxxl * lineHeight.tight, fontWeight: fontWeight.bold },
  h2: { fontSize: fontSize.xxl, lineHeight: fontSize.xxl * lineHeight.tight, fontWeight: fontWeight.semibold },
  h3: { fontSize: fontSize.xl, lineHeight: fontSize.xl * lineHeight.tight, fontWeight: fontWeight.semibold },
  body: { fontSize: fontSize.base, lineHeight: fontSize.base * lineHeight.normal, fontWeight: fontWeight.regular },
  bodySmall: { fontSize: fontSize.sm, lineHeight: fontSize.sm * lineHeight.normal, fontWeight: fontWeight.regular },
  caption: { fontSize: fontSize.xs, lineHeight: fontSize.xs * lineHeight.normal, fontWeight: fontWeight.regular },
  label: { fontSize: fontSize.sm, lineHeight: fontSize.sm * lineHeight.normal, fontWeight: fontWeight.medium },
};

export function Typography({
  variant = 'body',
  color,
  align,
  weight,
  style,
  children,
  ...rest
}: TypographyProps) {
  const { theme } = useTheme();

  return (
    <Text
      style={[
        variantStyles[variant],
        { color: color ?? theme.text },
        align ? { textAlign: align } : undefined,
        weight ? { fontWeight: fontWeight[weight] } : undefined,
        style,
      ]}
      {...rest}
    >
      {children}
    </Text>
  );
}
