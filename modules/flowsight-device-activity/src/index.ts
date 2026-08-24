/**
 * Device Activity Module — Expo Module for platform-specific device activity tracking.
 *
 * iOS: Screen Time / Family Controls (requires Apple entitlement)
 * Android: UsageStatsManager (requires Usage Access permission)
 *
 * This module provides a unified API for both platforms.
 * The base app works without this module — it's an optional enhancement.
 */

import { Platform, NativeModules } from 'react-native';

export interface DeviceActivityData {
  packageName: string;      // Android package or iOS opaque token
  appName: string;          // Human-readable name (Android only, empty on iOS)
  usageSeconds: number;
  lastUsed: string;         // ISO 8601
}

export interface DeviceActivityPermission {
  granted: boolean;
  platform: 'ios' | 'android';
  method: 'family_controls' | 'usage_stats' | 'none';
}

/**
 * Check if device activity tracking is available on this platform.
 */
export function isDeviceActivityAvailable(): boolean {
  return Platform.OS === 'ios' || Platform.OS === 'android';
}

/**
 * Check current permission status.
 */
export async function checkDeviceActivityPermission(): Promise<DeviceActivityPermission> {
  if (Platform.OS === 'ios') {
    // iOS: Check Family Controls authorization
    // This requires the Family Controls entitlement from Apple
    // In production, this would call the native Swift module
    return {
      granted: false,
      platform: 'ios',
      method: 'family_controls',
    };
  }

  if (Platform.OS === 'android') {
    // Android: Check Usage Access permission
    // This requires the user to grant Usage Access in Settings
    // In production, this would call the native Kotlin module
    return {
      granted: false,
      platform: 'android',
      method: 'usage_stats',
    };
  }

  return { granted: false, platform: Platform.OS as any, method: 'none' };
}

/**
 * Request device activity permission.
 *
 * iOS: Opens Family Controls authorization dialog
 * Android: Opens Usage Access Settings
 */
export async function requestDeviceActivityPermission(): Promise<DeviceActivityPermission> {
  if (Platform.OS === 'ios') {
    // In production: call native module to request Family Controls authorization
    // The user must grant individual authorization
    // If entitlement is not approved, this will fail gracefully
    return {
      granted: false,
      platform: 'ios',
      method: 'family_controls',
    };
  }

  if (Platform.OS === 'android') {
    // In production: open Usage Access settings
    // The user must manually enable the permission
    return {
      granted: false,
      platform: 'android',
      method: 'usage_stats',
    };
  }

  return { granted: false, platform: Platform.OS as any, method: 'none' };
}

/**
 * Get device activity data for a given time range.
 *
 * iOS: Returns opaque app tokens (no app names per Apple policy)
 * Android: Returns package names and usage time
 */
export async function getDeviceActivity(
  startDate: Date,
  endDate: Date
): Promise<DeviceActivityData[]> {
  const permission = await checkDeviceActivityPermission();
  if (!permission.granted) {
    return [];
  }

  if (Platform.OS === 'ios') {
    // In production: call native Swift module
    // Returns opaque tokens, not app names
    // iOS DeviceActivity data is limited to:
    // - Total usage time per app category
    // - Number of pickups
    // - Notification count
    // Does NOT include: window titles, URLs, content, screenshots
    return [];
  }

  if (Platform.OS === 'android') {
    // In production: call native Kotlin module
    // Uses UsageStatsManager to get app usage data
    // Returns: package name, usage time, last used
    // Does NOT include: window content, intent, productivity inference
    return [];
  }

  return [];
}

/**
 * Get the current tracking status.
 */
export async function getTrackingStatus(): Promise<{
  isTracking: boolean;
  platform: string;
  method: string;
}> {
  return {
    isTracking: false,
    platform: Platform.OS,
    method: Platform.OS === 'ios' ? 'family_controls' : 'usage_stats',
  };
}
