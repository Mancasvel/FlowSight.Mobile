/**
 * Device activity capture for timer sessions.
 *
 * The timer remains the source of session duration. Native Screen Time
 * monitoring opens a window on Start and closes it on Stop so the report
 * extension can render per-app time. Failures never crash the timer.
 */

import { Platform } from 'react-native';
import {
  checkDeviceActivityPermission,
  getLastSessionWindow as getNativeLastWindow,
  hasActivitySelection,
  isNativeDeviceActivityAvailable,
  presentActivityPicker,
  requestDeviceActivityPermission,
  startSessionMonitoring,
  stopSessionMonitoring,
  type SessionWindow,
} from '../../modules/flowsight-device-activity/src/index';

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
  if (Platform.OS !== 'ios' || !isNativeDeviceActivityAvailable()) return null;
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

  if (Platform.OS !== 'ios') {
    const result = { started: false, warning: null };
    setWarning(null);
    return result;
  }

  if (!isNativeDeviceActivityAvailable()) {
    const result = {
      started: false,
      warning:
        'Expo Go cannot read other apps. Per-app time needs a native iPhone build (npx expo run:ios --device) and Apple Family Controls.',
    };
    setWarning(result.warning);
    return result;
  }

  let permission = await checkDeviceActivityPermission();
  if (!permission.granted) {
    permission = await requestDeviceActivityPermission();
  }

  if (!permission.granted) {
    const result = {
      started: false,
      warning: permission.error
        ? `Screen Time is unavailable (${permission.error}). The timer still runs.`
        : 'Screen Time permission was not granted. The timer still runs. Apple must approve the Family Controls entitlement for per-app reports.',
    };
    setWarning(result.warning);
    return result;
  }

  try {
    const selected = await hasActivitySelection();
    if (!selected) {
      await presentActivityPicker();
    }
  } catch {
    // Picker is optional if the user already authorized Screen Time.
  }

  const monitoring = await startSessionMonitoring();
  if (!monitoring.started) {
    const result = {
      started: false,
      warning: monitoring.error
        ? `Could not start Screen Time monitoring (${monitoring.error}). The timer still runs.`
        : 'Could not start Screen Time monitoring. The timer still runs.',
    };
    setWarning(result.warning);
    return result;
  }

  setWarning(null);
  return { started: true, warning: null };
}

export async function stopDeviceActivityCapture(): Promise<SessionWindow | null> {
  if (Platform.OS !== 'ios' || !isNativeDeviceActivityAvailable()) {
    return lastWindow;
  }

  const window = (await stopSessionMonitoring()) ?? (await getNativeLastWindow());
  if (window && window.startMs > 0 && window.endMs > window.startMs) {
    setWindow(window);
    return window;
  }
  return lastWindow;
}
