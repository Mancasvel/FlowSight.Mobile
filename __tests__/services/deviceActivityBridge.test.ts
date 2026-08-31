import { beforeEach, describe, expect, test, vi } from 'vitest';

const native = vi.hoisted(() => ({
  isAvailable: vi.fn().mockResolvedValue(true),
  checkAuthorization: vi.fn().mockResolvedValue({
    granted: true,
    platform: 'android',
    method: 'usage_stats',
    status: 'approved',
  }),
  requestAuthorization: vi.fn(),
  startSessionMonitoring: vi.fn().mockResolvedValue({ started: true, startMs: 1000 }),
  stopSessionMonitoring: vi.fn().mockResolvedValue({ stopped: true, startMs: 1000, endMs: 5000 }),
  getLastSessionWindow: vi.fn().mockResolvedValue({ startMs: 1000, endMs: 5000 }),
  getActivity: vi.fn().mockResolvedValue([
    { packageName: 'com.example.editor', appName: 'Editor', usageSeconds: 3.6, lastUsed: 4000 },
    { packageName: 'com.example.zero', appName: 'Zero', usageSeconds: 0, lastUsed: 3000 },
  ]),
  getTrackingStatus: vi.fn().mockResolvedValue({
    isTracking: true,
    platform: 'android',
    method: 'usage_stats',
  }),
}));

vi.mock('react-native', () => ({ Platform: { OS: 'android' } }));
vi.mock('expo-modules-core', () => ({ requireOptionalNativeModule: () => native }));

import {
  checkDeviceActivityPermission,
  getDeviceActivity,
  getLastSessionWindow,
  isNativeDeviceActivityAvailable,
  startSessionMonitoring,
  stopSessionMonitoring,
} from '../../modules/flowsight-device-activity/src';

describe('Android device activity bridge', () => {
  beforeEach(() => vi.clearAllMocks());

  test('exposes the native module and Usage Access state', async () => {
    expect(isNativeDeviceActivityAvailable()).toBe(true);
    await expect(checkDeviceActivityPermission()).resolves.toMatchObject({
      granted: true,
      platform: 'android',
      method: 'usage_stats',
    });
  });

  test('opens and restores the same Start-to-Stop window as iOS', async () => {
    await expect(startSessionMonitoring()).resolves.toMatchObject({ started: true, startMs: 1000 });
    await expect(stopSessionMonitoring()).resolves.toEqual({ startMs: 1000, endMs: 5000 });
    await expect(getLastSessionWindow()).resolves.toEqual({ startMs: 1000, endMs: 5000 });
  });

  test('normalizes local per-app usage rows', async () => {
    await expect(getDeviceActivity(new Date(1000), new Date(5000))).resolves.toEqual([
      {
        packageName: 'com.example.editor',
        appName: 'Editor',
        usageSeconds: 4,
        lastUsed: new Date(4000).toISOString(),
      },
    ]);
  });
});
