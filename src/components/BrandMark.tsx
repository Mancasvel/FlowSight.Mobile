import React from 'react';
import { Image, StyleSheet, View } from 'react-native';
import { useTheme } from '@/theme';
import { Typography } from './Typography';

const mark = require('../../assets/flowsight-mark.png');

export function BrandMark({
  showWordmark = true,
  size = 28,
}: {
  showWordmark?: boolean;
  size?: number;
}) {
  const { theme } = useTheme();

  return (
    <View style={styles.row}>
      <Image source={mark} style={{ width: size, height: size }} accessibilityIgnoresInvertColors />
      {showWordmark ? (
        <Typography variant="subtitle" color={theme.text} style={styles.wordmark}>
          FlowSight
        </Typography>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  wordmark: {
    letterSpacing: -0.6,
  },
});
