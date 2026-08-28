import React from 'react';
import {
  Platform,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

export type DeviceActivityReportViewProps = {
  startMs: number;
  endMs: number;
  segment?: 'hourly' | 'daily';
  style?: StyleProp<ViewStyle>;
};

function hasNativeModule(): boolean {
  try {
    const core = require('expo-modules-core') as Record<string, unknown>;
    const optional = core.requireOptionalNativeModule as
      | ((name: string) => unknown)
      | undefined;
    if (typeof optional === 'function') {
      return optional('FlowSightDeviceActivity') != null;
    }
    return false;
  } catch {
    return false;
  }
}

function getNativeReportView(): React.ComponentType<DeviceActivityReportViewProps> | null {
  if (Platform.OS !== 'ios' || !hasNativeModule()) return null;
  try {
    const core = require('expo-modules-core') as Record<string, unknown>;
    const loader =
      (core.requireNativeViewManager as
        | ((name: string) => React.ComponentType<DeviceActivityReportViewProps>)
        | undefined) ??
      (core.requireNativeView as
        | ((name: string) => React.ComponentType<DeviceActivityReportViewProps>)
        | undefined);
    return loader ? loader('FlowSightDeviceActivity') : null;
  } catch {
    return null;
  }
}

const NativeReportView = getNativeReportView();

function Fallback({ style }: { style?: StyleProp<ViewStyle> }) {
  return (
    <View style={[styles.fallback, style]}>
      <Text style={styles.fallbackTitle}>Per-app breakdown</Text>
      <Text style={styles.fallbackCopy}>
          {Platform.OS === 'ios'
            ? 'Apple blocks app names in Expo Go. Use npx expo run:ios --device with Family Controls to see time by app.'
            : 'Per-app Screen Time reports are iOS-only.'}
      </Text>
    </View>
  );
}

export function DeviceActivityReportView({
  startMs,
  endMs,
  segment = 'hourly',
  style,
}: DeviceActivityReportViewProps) {
  if (Platform.OS !== 'ios' || !NativeReportView || !startMs || !endMs) {
    return <Fallback style={style} />;
  }

  return (
    <NativeReportView startMs={startMs} endMs={endMs} segment={segment} style={style} />
  );
}

const styles = StyleSheet.create({
  fallback: {
    minHeight: 88,
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 8,
  },
  fallbackTitle: {
    color: 'rgba(255,255,255,0.82)',
    fontSize: 14,
    fontWeight: '600',
  },
  fallbackCopy: {
    color: 'rgba(255,255,255,0.55)',
    fontSize: 12,
    lineHeight: 17,
  },
});
