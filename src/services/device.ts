/**
 * Device Service — Device registration and management.
 */

import { getClient } from './auth';
import { getDeviceId, getInstallationId } from '@/storage';
import { Platform } from 'react-native';
import Constants from 'expo-constants';

export async function registerDevice(): Promise<string | null> {
  try {
    const client = getClient();
    const installationId = await getInstallationId();
    const appVersion = Constants.expoConfig?.version ?? '0.1.0';
    const platform = Platform.OS as 'ios' | 'android';

    const { data, error } = await client.supabase.rpc('register_device', {
      p_platform: platform,
      p_installation_id: installationId,
      p_app_version: appVersion,
      p_capabilities: {
        manual_timer: true,
        device_activity: false,
        desktop_sync: true,
      },
    });

    if (error) {
      console.error('[Device] Registration error:', error);
      return null;
    }

    return data as string;
  } catch (err) {
    console.error('[Device] Registration failed:', err);
    return null;
  }
}

export async function getUserDevices() {
  const client = getClient();
  const { data, error } = await client.supabase.rpc('get_user_devices');
  if (error) {
    console.error('[Device] Fetch error:', error);
    return [];
  }
  return data ?? [];
}
