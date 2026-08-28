import React from 'react';
import { View, StyleSheet, type ViewStyle } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '@/theme';
import { layout } from '@/theme/tokens';

export function Screen({
  children,
  style,
}: {
  children: React.ReactNode;
  style?: ViewStyle;
}) {
  const { theme } = useTheme();

  return (
    <View style={[styles.safe, { backgroundColor: theme.background }]}>
      <LinearGradient
        colors={[theme.background, theme.background, theme.surfaceTertiary]}
        locations={[0, 0.62, 1]}
        style={StyleSheet.absoluteFill}
      />
      <View style={[styles.orb, styles.orbTop, { backgroundColor: theme.orbPrimary }]} />
      <View style={[styles.orb, styles.orbBottom, { backgroundColor: theme.orbAccent }]} />
      <SafeAreaView style={styles.safe} edges={['top']}>
        <View style={[styles.inner, style]}>{children}</View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  inner: {
    flex: 1,
    paddingHorizontal: layout.screenPaddingHorizontal,
    paddingVertical: layout.screenPaddingVertical,
  },
  orb: {
    position: 'absolute',
    width: 280,
    height: 280,
    borderRadius: 140,
    transform: [{ scaleX: 1.18 }],
  },
  orbTop: {
    top: -130,
    right: -110,
  },
  orbBottom: {
    bottom: 20,
    left: -170,
  },
});
