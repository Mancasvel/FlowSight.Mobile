import React, { useMemo } from 'react';
import { StyleSheet, useWindowDimensions, View } from 'react-native';
import Svg, { Line } from 'react-native-svg';
import { useTheme } from '@/theme';
import { layout } from '@/theme/tokens';

export function GridBackground() {
  const { theme } = useTheme();
  const { width, height } = useWindowDimensions();
  const size = layout.gridSize;

  const lines = useMemo(() => {
    const cols = Math.ceil(width / size);
    const rows = Math.ceil(height / size);
    const nodes: React.ReactNode[] = [];
    for (let i = 0; i <= cols; i += 1) {
      nodes.push(
        <Line
          key={`v-${i}`}
          x1={i * size}
          y1={0}
          x2={i * size}
          y2={height}
          stroke={theme.grid}
          strokeWidth={1}
        />
      );
    }
    for (let j = 0; j <= rows; j += 1) {
      nodes.push(
        <Line
          key={`h-${j}`}
          x1={0}
          y1={j * size}
          x2={width}
          y2={j * size}
          stroke={theme.grid}
          strokeWidth={1}
        />
      );
    }
    return nodes;
  }, [height, size, theme.grid, width]);

  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <Svg width={width} height={height} style={StyleSheet.absoluteFill}>
        {lines}
      </Svg>
    </View>
  );
}
