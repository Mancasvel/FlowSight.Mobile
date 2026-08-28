import React from 'react';
import { View, StyleSheet, type ViewStyle } from 'react-native';
import { BlurView } from 'expo-blur';
import { useTheme } from '@/theme';
import { radius, shadows, layout } from '@/theme/tokens';

export function Card({
  children,
  style,
}: {
  children: React.ReactNode;
  style?: ViewStyle;
}) {
  const { theme } = useTheme();

  return (
    <BlurView
      intensity={42}
      tint={theme.statusBar === 'dark' ? 'light' : 'dark'}
      style={[
        styles.card,
        shadows.md,
        {
          backgroundColor: theme.card,
          borderColor: theme.glassBorder,
          shadowColor: theme.cardShadow,
        },
        style,
      ]}
    >
      <View style={[styles.highlight, { backgroundColor: theme.glassHighlight }]} />
      {children}
    </BlurView>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: radius.lg,
    borderWidth: 1,
    padding: layout.cardPadding,
    overflow: 'hidden',
  },
  highlight: {
    position: 'absolute',
    top: 0,
    left: 24,
    right: 24,
    height: StyleSheet.hairlineWidth,
  },
});
