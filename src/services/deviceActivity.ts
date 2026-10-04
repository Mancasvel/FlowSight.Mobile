/**
 * Android Usage Access capture for focus sessions.
 *
 * The timer remains the source of truth for session duration. Android's local
 * UsageStats data is queried only for the Start-to-Stop window and is never
 * persisted or uploaded by this service.
 */

import { Alert, Platform } from 'react-native';
import {
  checkDeviceActivityPermission,
  getDeviceActivity,
  getHourlyDeviceActivity,
  getLastSessionWindow as getNativeLastWindow,
  isNativeDeviceActivityAvailable,
  requestDeviceActivityPermission,
  startSessionMonitoring,
  stopSessionMonitoring,
  type DeviceActivityData,
  type HourlyDeviceActivityData,
  type SessionWindow,
} from '../../modules/flowsight-device-activity/src/index';

export type { SessionWindow } from '../../modules/flowsight-device-activity/src/index';

export type CaptureResult = {
  started: boolean;
  warning: string | null;
};

type WindowListener = (window: SessionWindow | null) => void;
type WarningListener = (warning: string | null) => void;

let lastWindow: SessionWindow | null = null;
let lastWarning: string | null = null;
const windowListeners: WindowListener[] = [];
const warningListeners: WarningListener[] = [];

export async function hydrateLastSessionWindow(): Promise<SessionWindow | null> {
  if (lastWindow) return lastWindow;
  if (Platform.OS !== 'android' || !isNativeDeviceActivityAvailable()) return null;
  const window = await getNativeLastWindow();
  if (window && window.startMs > 0 && window.endMs > window.startMs) {
    setWindow(window);
    return window;
  }
  return null;
}

export function getLastSessionWindow(): SessionWindow | null {
  return lastWindow;
}

export function getCaptureWarning(): string | null {
  return lastWarning;
}

export async function hasUsageAccess(): Promise<boolean> {
  const permission = await checkDeviceActivityPermission();
  if (permission.granted && lastWarning?.startsWith('Usage Access is off')) {
    setWarning(null);
  }
  return permission.granted;
}

export async function openUsageAccessSettings(): Promise<void> {
  const confirmed = await new Promise<boolean>((resolve) => {
    Alert.alert(
      'Allow Usage Access?',
      'If you continue, Android Settings will ask you to give FlowSight Usage Access.\n\n' +
        'FlowSight will then read app names and how long each app was in the foreground, only between Start and Stop. That data stays on this device, is not uploaded, and is not used for ads.\n\n' +
        'You can decline. Recording stays off until Usage Access is enabled.',
      [
        { text: 'Not now', style: 'cancel', onPress: () => resolve(false) },
        { text: 'Continue', onPress: () => resolve(true) },
      ]
    );
  });
  if (!confirmed) return;
  await requestDeviceActivityPermission();
}

export async function loadUsageForWindow(window: SessionWindow): Promise<DeviceActivityData[]> {
  return getDeviceActivity(new Date(window.startMs), new Date(window.endMs));
}

export async function loadHourlyUsageForWindow(
  window: SessionWindow
): Promise<HourlyDeviceActivityData[]> {
  return getHourlyDeviceActivity(new Date(window.startMs), new Date(window.endMs));
}

export function subscribeSessionWindow(listener: WindowListener) {
  windowListeners.push(listener);
  return () => {
    const index = windowListeners.indexOf(listener);
    if (index >= 0) windowListeners.splice(index, 1);
  };
}

export function subscribeCaptureWarning(listener: WarningListener) {
  warningListeners.push(listener);
  return () => {
    const index = warningListeners.indexOf(listener);
    if (index >= 0) warningListeners.splice(index, 1);
  };
}

function setWindow(window: SessionWindow | null) {
  lastWindow = window;
  for (const listener of windowListeners) listener(window);
}

function setWarning(warning: string | null) {
  lastWarning = warning;
  for (const listener of warningListeners) listener(warning);
}

export async function startDeviceActivityCapture(): Promise<CaptureResult> {
  setWindow(null);

  if (Platform.OS !== 'android') {
    setWarning(null);
    return { started: false, warning: null };
  }

  if (!isNativeDeviceActivityAvailable()) {
    const warning =
      'Per-app activity needs the native Android build. Run npm run android instead of Expo Go.';
    setWarning(warning);
    return { started: false, warning };
  }

  const permission = await checkDeviceActivityPermission();
  if (!permission.granted) {
    const warning =
      'Usage Access is off. Enable FlowSight in Android Settings, then start a new session. Recording stays off until permission is enabled.';
    setWarning(warning);
    return { started: false, warning };
  }

  const monitoring = await startSessionMonitoring();
  if (!monitoring.started) {
    const warning = 'Could not open the Android activity window. Recording has not started.';
    setWarning(warning);
    return { started: false, warning };
  }

  setWarning(null);
  return { started: true, warning: null };
}

export async function stopDeviceActivityCapture(): Promise<SessionWindow | null> {
  if (Platform.OS !== 'android' || !isNativeDeviceActivityAvailable()) return lastWindow;

  const window = (await stopSessionMonitoring()) ?? (await getNativeLastWindow());
  if (window && window.startMs > 0 && window.endMs > window.startMs) {
    setWindow(window);
    return window;
  }
  return lastWindow;
}
