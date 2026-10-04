import { Platform } from 'react-native';
import {
  checkDeviceActivityPermission,
  hasActivitySelection,
  isNativeDeviceActivityAvailable,
} from '../../modules/flowsight-device-activity/src/index';

export class RecordingPermissionError extends Error {}

export async function getRecordingAccess(): Promise<{ ready: boolean; message: string }> {
  const label = Platform.OS === 'android' ? 'Usage Access' : 'Screen Time';
  if (!isNativeDeviceActivityAvailable()) {
    return { ready: false, message: `Recording requires the native FlowSight app with ${label} support.` };
  }
  const permission = await checkDeviceActivityPermission();
  if (!permission.granted) {
    return { ready: false, message: `Allow ${label} in Settings → Permissions before starting a recording.` };
  }
  if (Platform.OS === 'ios' && !(await hasActivitySelection())) {
    return { ready: false, message: 'Choose measured apps in Settings → Permissions before starting a recording.' };
  }
  return { ready: true, message: `${label} is enabled. Ready to record.` };
}

export async function requireRecordingAccess(): Promise<void> {
  const access = await getRecordingAccess();
  if (!access.ready) throw new RecordingPermissionError(access.message);
}
