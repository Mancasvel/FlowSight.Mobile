import React from 'react';
import { Pressable, Text, StyleSheet, ActivityIndicator, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '@/theme';
import { fontFamily, fontSize, layout, radius } from '@/theme/tokens';
import { Glass } from './Glass';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';

export function Button({
  label,
  onPress,
  variant = 'primary',
  disabled = false,
  loading = false,
}: {
  label: string;
  onPress: () => void;
  variant?: Variant;
  disabled?: boolean;
  loading?: boolean;
}) {
  const { theme } = useTheme();
  const color =
    variant === 'primary' || variant === 'danger' ? theme.primaryText : theme.text;

  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled || loading}
      onPress={() => {
        void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        onPress();
      }}
      style={({ pressed }) => [
        styles.pressable,
        {
          opacity: disabled ? 0.5 : pressed ? 0.86 : 1,
          transform: [{ scale: pressed ? 0.985 : 1 }],
        },
      ]}
    >
      {variant === 'primary' ? (
        <LinearGradient
          colors={['#2DD4BF', '#00B8A9']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[styles.fill, { borderColor: 'rgba(255,255,255,0.45)' }]}
        >
          <Content color="#FFFFFF" label={label} loading={loading} />
        </LinearGradient>
      ) : variant === 'danger' ? (
        <LinearGradient
          colors={['#F87171', '#EF4444']}
          style={[styles.fill, { borderColor: 'rgba(255,255,255,0.35)' }]}
        >
          <Content color="#FFFFFF" label={label} loading={loading} />
        </LinearGradient>
      ) : variant === 'secondary' ? (
        <Glass style={styles.glass} radiusSize="lg">
          <Content color={color} label={label} loading={loading} />
        </Glass>
      ) : (
        <View style={styles.ghost}>
          <Content color={theme.textSecondary} label={label} loading={loading} />
        </View>
      )}
    </Pressable>
  );
}

function Content({
  color,
  label,
  loading,
}: {
  color: string;
  label: string;
  loading: boolean;
}) {
  return (
    <View style={styles.content}>
      {loading ? (
        <ActivityIndicator color={color} />
      ) : (
        <Text style={[styles.label, { color }]}>{label}</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  pressable: {
    minHeight: layout.touchTargetIOS,
    borderRadius: radius.lg,
  },
  fill: {
    width: '100%',
    minHeight: layout.touchTargetIOS,
    borderRadius: radius.lg,
    borderWidth: 1,
    overflow: 'hidden',
    justifyContent: 'center',
  },
  glass: {
    width: '100%',
    minHeight: layout.touchTargetIOS,
    justifyContent: 'center',
  },
  ghost: {
    minHeight: layout.touchTargetIOS,
    justifyContent: 'center',
  },
  content: {
    minHeight: layout.touchTargetIOS,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  label: {
    fontFamily: fontFamily.bodySemibold,
    fontSize: fontSize.md,
  },
});
