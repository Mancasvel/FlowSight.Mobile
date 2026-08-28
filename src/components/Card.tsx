import React from 'react';
import { StyleSheet, type StyleProp, type ViewStyle } from 'react-native';
import { layout } from '@/theme/tokens';
import { Glass } from './Glass';

export function Card({
  children,
  style,
  padded = true,
}: {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  padded?: boolean;
}) {
  return <Glass style={[padded ? styles.padded : null, style]}>{children}</Glass>;
}

const styles = StyleSheet.create({
  padded: {
    padding: layout.cardPadding,
  },
});
