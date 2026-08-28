import React from 'react';
import { View, StyleSheet, type StyleProp, type ViewStyle } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '@/theme';
import { layout } from '@/theme/tokens';
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
      <SafeAreaView style={styles.safe} edges={['top']}>
        <View style={[styles.inner, padded ? styles.padded : null, style]}>{children}</View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  inner: { flex: 1 },
  padded: {
    paddingHorizontal: layout.screenPaddingHorizontal,
    paddingVertical: layout.screenPaddingVertical,
  },
});
