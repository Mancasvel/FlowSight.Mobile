/**
 * Device Activity Module — Screen Time (iOS) / UsageStats (Android).
 *
 * iOS cannot return app names to JavaScript. Per-app breakdown is rendered
 * inside a Device Activity Report Extension via DeviceActivityReportView.
 * Expo Go does not include this native module; use `npx expo run:ios`.
 */

import { Platform } from 'react-native';

export {
  DeviceActivityReportView,
  type DeviceActivityReportViewProps,
} from './DeviceActivityReportView';

export interface DeviceActivityData {
  packageName: string;
  appName: string;
  usageSeconds: number;
  lastUsed: string;
}

export interface DeviceActivityPermission {
  granted: boolean;
  platform: 'ios' | 'android';
  method: 'family_controls' | 'usage_stats' | 'none';
  status?: string;
  error?: string;
}

export type SessionWindow = {
  startMs: number;
  endMs: number;
};

type NativeModule = {
  isAvailable: () => Promise<boolean>;
  checkAuthorization: () => Promise<DeviceActivityPermission & Record<string, unknown>>;
  requestAuthorization: () => Promise<DeviceActivityPermission & Record<string, unknown>>;
  hasSelection: () => Promise<boolean>;
  presentActivityPicker: () => Promise<{ saved: boolean; error?: string }>;
  startSessionMonitoring: () => Promise<{ started: boolean; startMs: number; error?: string }>;
  stopSessionMonitoring: () => Promise<{ stopped: boolean; startMs: number; endMs: number }>;
  getLastSessionWindow: () => Promise<SessionWindow | null>;
  getActivity: (startDateMs: number, endDateMs: number) => Promise<DeviceActivityData[]>;
  getTrackingStatus: () => Promise<{ isTracking: boolean; platform: string; method: string }>;
};

function getNative(): NativeModule | null {
  try {
    const core = require('expo-modules-core') as Record<string, unknown>;
    const optional = core.requireOptionalNativeModule as
      | ((name: string) => NativeModule | null)
      | undefined;
    if (typeof optional === 'function') {
      return optional('FlowSightDeviceActivity');
    }
    const required = core.requireNativeModule as ((name: string) => NativeModule) | undefined;
    return required ? required('FlowSightDeviceActivity') : null;
  } catch {
    return null;
  }
}

export function isNativeDeviceActivityAvailable(): boolean {
  return getNative() != null;
}

export function isDeviceActivityAvailable(): boolean {
  return Platform.OS === 'ios' || Platform.OS === 'android';
}

function fallbackPermission(granted = false): DeviceActivityPermission {
  if (Platform.OS === 'ios') {
    return { granted, platform: 'ios', method: 'family_controls' };
  }
  if (Platform.OS === 'android') {
    return { granted, platform: 'android', method: 'usage_stats' };
  }
  return { granted: false, platform: 'ios', method: 'none' };
}

export async function checkDeviceActivityPermission(): Promise<DeviceActivityPermission> {
  const native = getNative();
  if (!native) return fallbackPermission(false);
  try {
    const result = await native.checkAuthorization();
    return {
      granted: Boolean(result.granted),
      platform: (result.platform as DeviceActivityPermission['platform']) ?? fallbackPermission().platform,
      method: (result.method as DeviceActivityPermission['method']) ?? fallbackPermission().method,
      status: typeof result.status === 'string' ? result.status : undefined,
      error: typeof result.error === 'string' ? result.error : undefined,
    };
  } catch {
    return fallbackPermission(false);
  }
}

export async function requestDeviceActivityPermission(): Promise<DeviceActivityPermission> {
  const native = getNative();
  if (!native) return fallbackPermission(false);
  try {
    const result = await native.requestAuthorization();
    return {
      granted: Boolean(result.granted),
      platform: (result.platform as DeviceActivityPermission['platform']) ?? fallbackPermission().platform,
      method: (result.method as DeviceActivityPermission['method']) ?? fallbackPermission().method,
      status: typeof result.status === 'string' ? result.status : undefined,
      error: typeof result.error === 'string' ? result.error : undefined,
    };
  } catch {
    return fallbackPermission(false);
  }
}

export async function hasActivitySelection(): Promise<boolean> {
  const native = getNative();
  if (!native?.hasSelection) return false;
  try {
    return Boolean(await native.hasSelection());
  } catch {
    return false;
  }
}

export async function presentActivityPicker(): Promise<{ saved: boolean }> {
  const native = getNative();
  if (!native?.presentActivityPicker) return { saved: false };
  try {
    return await native.presentActivityPicker();
  } catch {
    return { saved: false };
  }
}

export async function startSessionMonitoring(): Promise<{
  started: boolean;
  startMs: number;
  error?: string;
}> {
  const native = getNative();
  if (!native?.startSessionMonitoring) {
    return { started: false, startMs: Date.now() };
  }
  return native.startSessionMonitoring();
}

export async function stopSessionMonitoring(): Promise<SessionWindow | null> {
  const native = getNative();
  if (!native?.stopSessionMonitoring) return null;
  try {
    const result = await native.stopSessionMonitoring();
    if (!result?.startMs || result.startMs <= 0 || !result.endMs) return null;
    return { startMs: result.startMs, endMs: result.endMs };
  } catch {
    return null;
  }
}

export async function getLastSessionWindow(): Promise<SessionWindow | null> {
  const native = getNative();
  if (!native?.getLastSessionWindow) return null;
  try {
    return await native.getLastSessionWindow();
  } catch {
    return null;
  }
}

export async function getDeviceActivity(
  startDate: Date,
  endDate: Date
): Promise<DeviceActivityData[]> {
  const permission = await checkDeviceActivityPermission();
  if (!permission.granted) return [];

  const native = getNative();
  if (!native) return [];
  try {
    return await native.getActivity(startDate.getTime(), endDate.getTime());
  } catch {
    return [];
  }
}

export async function getTrackingStatus(): Promise<{
  isTracking: boolean;
  platform: string;
  method: string;
}> {
  const native = getNative();
  if (!native?.getTrackingStatus) {
    return {
      isTracking: false,
      platform: Platform.OS,
      method: Platform.OS === 'ios' ? 'family_controls' : 'usage_stats',
    };
  }
  return native.getTrackingStatus();
}
