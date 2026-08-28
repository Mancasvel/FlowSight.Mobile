import React from 'react';
import { View, StyleSheet, type StyleProp, type ViewStyle } from 'react-native';
import { BlurView } from 'expo-blur';
import { useTheme } from '@/theme';
import { radius } from '@/theme/tokens';

export function Glass({
  children,
  style,
  intensity,
  radiusSize = 'glass',
}: {
  children?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  intensity?: number;
  radiusSize?: keyof typeof radius;
}) {
  const { theme, isDark } = useTheme();
  const corner = radius[radiusSize];
  const blurIntensity = intensity ?? (isDark ? 20 : 12);

  return (
    <View
      collapsable={false}
      style={[
        styles.shadow,
        {
          backgroundColor: 'transparent',
          borderRadius: corner,
          shadowColor: theme.cardShadow,
        },
        style,
      ]}
    >
      <View pointerEvents="none" collapsable={false} style={[styles.frost, { borderRadius: corner }]}>
        <BlurView
          intensity={blurIntensity}
          tint={isDark ? 'systemUltraThinMaterialDark' : 'systemUltraThinMaterialLight'}
          style={StyleSheet.absoluteFill}
        />
        <View
          style={[
            StyleSheet.absoluteFill,
            {
              backgroundColor: theme.card,
              borderWidth: 1,
              borderColor: theme.glassBorder,
              borderRadius: corner,
            },
          ]}
        />
      </View>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  shadow: {
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.05,
    shadowRadius: 18,
  },
  frost: {
    ...StyleSheet.absoluteFillObject,
    overflow: 'hidden',
  },
});
