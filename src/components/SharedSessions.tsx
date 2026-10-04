import { PRIVATE_SYNC_ENABLED } from '@/services/config';
import React, { useCallback, useState } from 'react';
import { View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useRouter } from 'expo-router';
import { Button, Card, Typography } from '@/components';
import { getPrivacyConsent } from '@/privacy/privacyService';
import { getClient } from '@/services/auth';
import { syncNow } from '@/services/sync';
import { useAuth } from '@/hooks';
import { formatDurationShort } from '@/utils/format';
import { spacing } from '@/theme/tokens';

type SharedSession = {
  id: string;
  source_platform: string;
  duration_seconds: number;
  created_at: string;
};

export function SharedSessions() {
  const router = useRouter();
  const { user } = useAuth();
  const [rows, setRows] = useState<SharedSession[]>([]);
  const [enabled, setEnabled] = useState(false);
  const [message, setMessage] = useState('Loading shared sessions…');
  useFocusEffect(useCallback(() => {
    if (!PRIVATE_SYNC_ENABLED) return;
    let active = true;
    setRows([]);
    void (async () => {
      const consent = await getPrivacyConsent();
      if (!active) return;
      setEnabled(consent.cloudSync);
      if (!consent.cloudSync) return;
      if (!user) throw new Error('Sign in to see encrypted shared history.');
      const result = await syncNow();
      if (result.failed) throw new Error(result.message ?? 'Could not sync private history.');
      const client = getClient();
      const { data, error } = await client.getSharedSessions();
      if (error) throw error;
      if (!active) return;
      setRows(data ?? []);
      setMessage(data?.length ? '' : 'Your synced phone and computer sessions will appear here.');
    })().catch((error) => {
      if (active) setMessage(error instanceof Error ? error.message : 'Could not load shared sessions.');
    });
    return () => { active = false; };
  }, [user]));
  if (!PRIVATE_SYNC_ENABLED || !enabled) return null;
  return (
    <Card style={{ gap: spacing.md }}>
      <Typography variant="subtitle">Across your devices</Typography>
      <Typography variant="caption">Session totals from your FlowSight account. App usage stays on each device.</Typography>
      {message ? <Typography variant="caption">{message}</Typography> : null}
      {rows.map((row) => (
        <View key={row.id} style={{ gap: 4 }}>
          <Typography>{row.source_platform === 'ios' ? 'iPhone' : row.source_platform === 'android' ? 'Android' : 'Computer'} · {formatDurationShort(row.duration_seconds)}</Typography>
          <Typography variant="caption">{new Date(row.created_at).toLocaleString()}</Typography>
        </View>
      ))}
      <Button label="Manage device connection" variant="secondary" onPress={() => router.push('/settings')} />
    </Card>
  );
}
