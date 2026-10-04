import React from 'react';
import { View, StyleSheet, useWindowDimensions, type StyleProp, type ViewStyle } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '@/theme';
import { layout, spacing } from '@/theme/tokens';
import { GridBackground } from './GridBackground';

export function Screen({
  children,
  style,
  padded = true,
}: {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  padded?: boolean;
}) {
  const { theme, isDark } = useTheme();
  const { width, height } = useWindowDimensions();
  const horizontalPadding = width >= 700 ? spacing.xl : layout.screenPaddingHorizontal;
  const verticalPadding = height < 620 ? spacing.md : layout.screenPaddingVertical;

  return (
    <View style={[styles.safe, { backgroundColor: theme.background }]}>
      <GridBackground />
      <LinearGradient
        colors={
          isDark
            ? ['rgba(7,11,12,0.18)', 'rgba(7,11,12,0)', 'rgba(7,11,12,0.12)']
            : ['rgba(251,252,251,0.16)', 'rgba(251,252,251,0)', 'rgba(251,252,251,0.08)']
        }
        locations={[0, 0.22, 1]}
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      />
      <SafeAreaView style={styles.safe} edges={['top', 'left', 'right', 'bottom']}>
        <View
          style={[
            styles.inner,
            padded ? { paddingHorizontal: horizontalPadding, paddingVertical: verticalPadding } : null,
            style,
          ]}
        >
          {children}
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  inner: {
    flex: 1,
    width: '100%',
    maxWidth: 880,
    alignSelf: 'center',
  },
});
