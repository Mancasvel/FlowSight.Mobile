import React, { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import {
  DeviceActivityReportView,
  isNativeDeviceActivityAvailable,
} from '../../modules/flowsight-device-activity/src/index';
import { persistUsageSnapshot } from '@/services/deviceActivity';

function todayWindow() {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  return { startMs: start.getTime(), endMs: Date.now() };
}

/**
 * On-screen Device Activity report. Apple only runs the extension when the
 * view is in the window, so this stays in-layout (almost invisible) and
 * writes the snapshot we persist to SQLite.
 */
export function ScreenTimeCapture() {
  const [window, setWindow] = useState(todayWindow);

  useEffect(() => {
    if (!isNativeDeviceActivityAvailable()) return undefined;

    const tick = () => {
      setWindow(todayWindow());
      void persistUsageSnapshot();
    };

    const startup = setTimeout(tick, 2500);
    const interval = setInterval(tick, 8_000);
    return () => {
      clearTimeout(startup);
      clearInterval(interval);
    };
  }, []);

  if (!isNativeDeviceActivityAvailable()) return null;

  return (
    <View pointerEvents="none" style={styles.host}>
      <DeviceActivityReportView
        hidden
        startMs={window.startMs}
        endMs={window.endMs}
        segment="hourly"
        style={styles.report}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  host: {
    position: 'absolute',
    width: 8,
    height: 8,
    opacity: 0.02,
    overflow: 'hidden',
  },
  report: {
    width: 320,
    height: 240,
  },
});
