import { requireOptionalNativeModule } from 'expo-modules-core';
import { Platform } from 'react-native';

export interface DeviceActivityData {
  packageName: string;
  appName: string;
  usageSeconds: number;
  lastUsed: string;
}

export interface HourlyDeviceActivityData extends DeviceActivityData {
  hour: number;
}

export interface DeviceActivityPermission {
  granted: boolean;
  platform: 'android' | 'unsupported';
  method: 'usage_stats' | 'none';
  status?: string;
  settingsOpened?: boolean;
  error?: string;
}

export type SessionWindow = {
  startMs: number;
  endMs: number;
};

type NativeActivityData = {
  packageName?: string;
  appName?: string;
  usageSeconds?: number;
  lastUsed?: string | number;
};

type NativeModule = {
  isAvailable: () => Promise<boolean>;
  checkAuthorization: () => Promise<DeviceActivityPermission>;
  requestAuthorization: () => Promise<DeviceActivityPermission>;
  startSessionMonitoring: () => Promise<{ started: boolean; startMs: number; error?: string }>;
  stopSessionMonitoring: () => Promise<{ stopped: boolean; startMs: number; endMs: number }>;
  getLastSessionWindow: () => Promise<SessionWindow | null>;
  getActivity: (startDateMs: number, endDateMs: number) => Promise<NativeActivityData[]>;
  getHourlyActivity: (
    startDateMs: number,
    endDateMs: number
  ) => Promise<(NativeActivityData & { hour?: number })[]>;
  getTrackingStatus: () => Promise<{ isTracking: boolean; platform: string; method: string }>;
};

const nativeModule = requireOptionalNativeModule<NativeModule>('FlowSightDeviceActivity');

const unsupportedPermission: DeviceActivityPermission = {
  granted: false,
  platform: 'unsupported',
  method: 'none',
};

export function isNativeDeviceActivityAvailable(): boolean {
  return Platform.OS === 'android' && nativeModule !== null;
}

export function isDeviceActivityAvailable(): boolean {
  return isNativeDeviceActivityAvailable();
}

export async function checkDeviceActivityPermission(): Promise<DeviceActivityPermission> {
  if (!isNativeDeviceActivityAvailable() || !nativeModule) return unsupportedPermission;
  try {
    return await nativeModule.checkAuthorization();
  } catch (error) {
    return {
      granted: false,
      platform: 'android',
      method: 'usage_stats',
      error: error instanceof Error ? error.message : 'authorization_check_failed',
    };
  }
}

export async function requestDeviceActivityPermission(): Promise<DeviceActivityPermission> {
  if (!isNativeDeviceActivityAvailable() || !nativeModule) return unsupportedPermission;
  try {
    return await nativeModule.requestAuthorization();
  } catch (error) {
    return {
      granted: false,
      platform: 'android',
      method: 'usage_stats',
      error: error instanceof Error ? error.message : 'settings_open_failed',
    };
  }
}

export async function startSessionMonitoring(): Promise<{
  started: boolean;
  startMs: number;
  error?: string;
}> {
  if (!nativeModule) {
    return { started: false, startMs: Date.now(), error: 'native_module_unavailable' };
  }
  return nativeModule.startSessionMonitoring();
}

export async function stopSessionMonitoring(): Promise<SessionWindow | null> {
  if (!nativeModule) return null;
  try {
    const result = await nativeModule.stopSessionMonitoring();
    if (!result.stopped || result.startMs <= 0 || result.endMs <= result.startMs) return null;
    return { startMs: result.startMs, endMs: result.endMs };
  } catch {
    return null;
  }
}

export async function getLastSessionWindow(): Promise<SessionWindow | null> {
  if (!nativeModule) return null;
  try {
    const result = await nativeModule.getLastSessionWindow();
    if (!result || result.startMs <= 0 || result.endMs <= result.startMs) return null;
    return result;
  } catch {
    return null;
  }
}

export async function getDeviceActivity(startDate: Date, endDate: Date): Promise<DeviceActivityData[]> {
  if (!nativeModule || endDate <= startDate) return [];
  const permission = await checkDeviceActivityPermission();
  if (!permission.granted) return [];

  const rows = await nativeModule.getActivity(startDate.getTime(), endDate.getTime());
  return rows
    .filter((row) => (row.usageSeconds ?? 0) > 0)
    .map((row) => ({
      packageName: row.packageName ?? '',
      appName: row.appName || row.packageName || 'Unknown app',
      usageSeconds: Math.max(0, Math.round(row.usageSeconds ?? 0)),
      lastUsed:
        typeof row.lastUsed === 'number'
          ? new Date(row.lastUsed).toISOString()
          : row.lastUsed ?? '',
    }));
}

export async function getHourlyDeviceActivity(
  startDate: Date,
  endDate: Date
): Promise<HourlyDeviceActivityData[]> {
  if (!nativeModule || endDate <= startDate) return [];
  const permission = await checkDeviceActivityPermission();
  if (!permission.granted) return [];

  const rows = await nativeModule.getHourlyActivity(startDate.getTime(), endDate.getTime());
  return rows
    .filter((row) => (row.usageSeconds ?? 0) > 0 && Number.isInteger(row.hour))
    .map((row) => ({
      hour: Math.min(23, Math.max(0, row.hour ?? 0)),
      packageName: row.packageName ?? '',
      appName: row.appName || row.packageName || 'Unknown app',
      usageSeconds: Math.max(0, Math.round(row.usageSeconds ?? 0)),
      lastUsed:
        typeof row.lastUsed === 'number'
          ? new Date(row.lastUsed).toISOString()
          : row.lastUsed ?? '',
    }));
}

export async function getTrackingStatus(): Promise<{
  isTracking: boolean;
  platform: string;
  method: string;
}> {
  if (!nativeModule) return { isTracking: false, platform: Platform.OS, method: 'none' };
  return nativeModule.getTrackingStatus();
}
