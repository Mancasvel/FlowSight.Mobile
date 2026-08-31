import React from 'react';
import { Text, type TextProps, type TextStyle } from 'react-native';
import { useTheme } from '@/theme';
import { fontFamily, fontSize, lineHeight } from '@/theme/tokens';

type Variant = 'display' | 'title' | 'subtitle' | 'body' | 'caption' | 'kicker' | 'metric';

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
          fontFamily: fontFamily.display,
          fontSize: fontSize.display,
          lineHeight: fontSize.display * lineHeight.tight,
          letterSpacing: -1.8,
          fontVariant: ['tabular-nums'],
        }
      : variant === 'title'
        ? {
            fontFamily: fontFamily.display,
            fontSize: fontSize.xxl,
            lineHeight: fontSize.xxl * lineHeight.tight,
            letterSpacing: -1.2,
          }
        : variant === 'subtitle'
          ? {
              fontFamily: fontFamily.display,
              fontSize: fontSize.lg,
              letterSpacing: -0.4,
            }
          : variant === 'metric'
            ? {
                fontFamily: fontFamily.display,
                fontSize: fontSize.xl,
                letterSpacing: -0.8,
                fontVariant: ['tabular-nums'],
              }
            : variant === 'kicker'
              ? {
                  fontFamily: fontFamily.bodySemibold,
                  fontSize: fontSize.xs,
                  letterSpacing: 1.4,
                  textTransform: 'uppercase',
                }
              : variant === 'caption'
                ? {
                    fontFamily: fontFamily.bodyMedium,
                    fontSize: fontSize.sm,
                    letterSpacing: 0.1,
                    lineHeight: fontSize.sm * lineHeight.normal,
                  }
                : {
                    fontFamily: fontFamily.body,
                    fontSize: fontSize.base,
                    lineHeight: fontSize.base * lineHeight.relaxed,
                  };

  const defaultColor =
    variant === 'caption' || variant === 'kicker' ? theme.textSecondary : theme.text;

  return (
    <Text {...rest} style={[variantStyle, { color: color ?? defaultColor }, style]}>
      {children}
    </Text>
  );
}
