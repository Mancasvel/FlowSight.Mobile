/**
 * Screen — Base screen wrapper with safe area, keyboard handling, and theme.
 */

import React from 'react';
import { View, type ViewStyle, type StyleProp } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '@/theme';
import { spacing } from '@/theme/tokens';

interface ScreenProps {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  padded?: boolean;
  safeArea?: boolean;
}

export function Screen({
  children,
  style,
  padded = true,
  safeArea = true,
}: ScreenProps) {
  const { theme } = useTheme();

  const content = (
    <View
      style={[
        {
          flex: 1,
          backgroundColor: theme.background,
          paddingHorizontal: padded ? spacing.lg : 0,
        },
        style,
      ]}
    >
      {children}
    </View>
  );

  if (safeArea) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: theme.background }}>
        {content}
      </SafeAreaView>
    );
  }

  return content;
}
