/**
 * Secure Storage — Token and secret management via expo-secure-store.
 *
 * Backed by Keychain (iOS) and Android Keystore.
 * Never stores tokens in AsyncStorage.
 */

import * as SecureStore from 'expo-secure-store';
import { createId } from '@/utils/id';

const KEYS = {
  ACCESS_TOKEN: 'flowsight_access_token',
  REFRESH_TOKEN: 'flowsight_refresh_token',
  DEVICE_ID: 'flowsight_device_id',
  INSTALLATION_ID: 'flowsight_installation_id',
} as const;

// ─── Token Management ─────────────────────────────────────────────────────────

export async function saveSession(accessToken: string, refreshToken: string): Promise<void> {
  await Promise.all([
    SecureStore.setItemAsync(KEYS.ACCESS_TOKEN, accessToken),
    SecureStore.setItemAsync(KEYS.REFRESH_TOKEN, refreshToken),
  ]);
}

export async function getAccessToken(): Promise<string | null> {
  return SecureStore.getItemAsync(KEYS.ACCESS_TOKEN);
}

export async function getRefreshToken(): Promise<string | null> {
  return SecureStore.getItemAsync(KEYS.REFRESH_TOKEN);
}

export async function clearSession(): Promise<void> {
  await Promise.all([
    SecureStore.deleteItemAsync(KEYS.ACCESS_TOKEN),
    SecureStore.deleteItemAsync(KEYS.REFRESH_TOKEN),
  ]);
}

// ─── Device Identity ──────────────────────────────────────────────────────────

export async function getDeviceId(): Promise<string> {
  let deviceId = await SecureStore.getItemAsync(KEYS.DEVICE_ID);
  if (!deviceId) {
    deviceId = createId();
    await SecureStore.setItemAsync(KEYS.DEVICE_ID, deviceId);
  }
  return deviceId;
}

export async function getInstallationId(): Promise<string> {
  let installationId = await SecureStore.getItemAsync(KEYS.INSTALLATION_ID);
  if (!installationId) {
    installationId = createId();
    await SecureStore.setItemAsync(KEYS.INSTALLATION_ID, installationId);
  }
  return installationId;
}

// ─── Generic Secure Storage ───────────────────────────────────────────────────

export async function secureGet(key: string): Promise<string | null> {
  return SecureStore.getItemAsync(key);
}

export async function secureSet(key: string, value: string): Promise<void> {
  await SecureStore.setItemAsync(key, value);
}

export async function secureDelete(key: string): Promise<void> {
  await SecureStore.deleteItemAsync(key);
}
