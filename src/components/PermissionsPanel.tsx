import React, { useCallback, useEffect, useState } from 'react';
import { AppState, Linking } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Button, Card, Typography } from '@/components';
import { getRecordingAccess } from '@/services/recordingPermissions';
import { spacing } from '@/theme/tokens';
import { requestDeviceActivityPermission, presentActivityPicker } from '../../modules/flowsight-device-activity/src/index';

export function PermissionsPanel() {
  const [ready, setReady] = useState(false);
  const [message, setMessage] = useState('Checking recording permission…');
  const [busy, setBusy] = useState(false);
  const refresh = useCallback(async () => {
    try {
      const access = await getRecordingAccess();
      setReady(access.ready);
      setMessage(access.message);
    } catch { setReady(false); setMessage('Could not check permission. Review FlowSight in system Settings.'); }
  }, []);
  useFocusEffect(useCallback(() => { void refresh(); }, [refresh]));
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => { if (state === 'active') void refresh(); });
    return () => subscription.remove();
  }, [refresh]);
  const grant = async () => {
    setBusy(true);
    try {
      const permission = await requestDeviceActivityPermission();
      if (!permission.granted) throw new Error('Screen Time permission was not granted. Review FlowSight in iPhone Settings.');
      await presentActivityPicker();
      await refresh();
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Could not open permissions.'); }
    finally { setBusy(false); }
  };
  return (
    <Card style={{ gap: spacing.md }}>
      <Typography variant="subtitle">Permissions</Typography>
      <Typography variant="caption" accessibilityLiveRegion="polite">{message}</Typography>
      <Typography variant="caption">Recording starts only after activity permission is enabled. Notifications are optional.</Typography>
      <Button label={ready ? 'Review activity permission' : 'Allow activity permission'} variant={ready ? 'secondary' : 'primary'} loading={busy} onPress={() => void grant()} />
      <Button label="Choose measured apps" variant="secondary" disabled={busy} onPress={() => void grant()} />
      <Button label="Open FlowSight system settings" variant="secondary" onPress={() => { void Linking.openSettings().catch(() => setMessage('Could not open system Settings.')); }} />
    </Card>
  );
}
