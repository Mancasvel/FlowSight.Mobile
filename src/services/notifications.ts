/**
 * Local reminders that motivate a daily block and protect concentration.
 * Native expo-notifications is never imported here: that package loads
 * ExpoPushTokenManager at module eval and crashes binaries that lack it.
 */

import { requireOptionalNativeModule } from 'expo-modules-core';
import { getPreference, setPreference } from '@/storage';

export const FOCUS_GOAL_SECONDS = 25 * 60;
const PREFERENCE_KEY = 'notifications_enabled';

type NativeNotifications = {
  setFocusNotificationsEnabled: (enabled: boolean) => Promise<boolean>;
  hydrateFocusNotifications: () => Promise<void>;
  disableFocusNotifications: () => Promise<void>;
  scheduleFocusGoalNotification: (elapsedSeconds: number) => Promise<void>;
  cancelFocusGoalNotification: () => Promise<void>;
  markFocusDayCompleted: () => Promise<void>;
};

let native: NativeNotifications | null | undefined;

export function canUseFocusNotifications(): boolean {
  return (
    requireOptionalNativeModule('ExpoPushTokenManager') != null &&
    requireOptionalNativeModule('ExpoNotificationScheduler') != null
  );
}

function loadNative(): NativeNotifications | null {
  if (native !== undefined) return native;
  if (!canUseFocusNotifications()) {
    native = null;
    return null;
  }

  try {
    // Delayed until native modules exist. Keep the package name out of this
    // file or Metro evaluates it on boot.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    native = require('./notificationsNative') as NativeNotifications;
    return native;
  } catch {
    native = null;
    return null;
  }
}

export async function areFocusNotificationsEnabled(): Promise<boolean> {
  try {
    return (await getPreference(PREFERENCE_KEY)) === 'true';
  } catch {
    return false;
  }
}

export async function setFocusNotificationsEnabled(enabled: boolean): Promise<boolean> {
  try {
    if (!enabled) {
      await disableFocusNotifications();
      return false;
    }

    const impl = loadNative();
    if (!impl) {
      await setPreference(PREFERENCE_KEY, 'false');
      return false;
    }

    return await impl.setFocusNotificationsEnabled(true);
  } catch {
    return false;
  }
}

export async function hydrateFocusNotifications(): Promise<void> {
  try {
    if (!(await areFocusNotificationsEnabled())) return;
    await loadNative()?.hydrateFocusNotifications();
  } catch {
    // Native module missing (old binary) or permission prompt unavailable.
  }
}

export async function disableFocusNotifications(): Promise<void> {
  try {
    await setPreference(PREFERENCE_KEY, 'false');
    await loadNative()?.disableFocusNotifications();
  } catch {
    await setPreference(PREFERENCE_KEY, 'false');
  }
}

export async function scheduleFocusGoalNotification(elapsedSeconds: number): Promise<void> {
  try {
    await loadNative()?.scheduleFocusGoalNotification(elapsedSeconds);
  } catch {
    // Scheduling is best-effort.
  }
}

export async function cancelFocusGoalNotification(): Promise<void> {
  try {
    await loadNative()?.cancelFocusGoalNotification();
  } catch {
    // Best-effort.
  }
}

export async function markFocusDayCompleted(): Promise<void> {
  try {
    await loadNative()?.markFocusDayCompleted();
  } catch {
    // Best-effort.
  }
}
