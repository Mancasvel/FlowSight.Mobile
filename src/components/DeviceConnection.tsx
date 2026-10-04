import { PRIVATE_SYNC_ENABLED } from '@/services/config';
import React, { useEffect, useState } from 'react';
import { useRouter } from 'expo-router';
import { Button, Card, ToggleRow, Typography } from '@/components';
import { useAuth } from '@/hooks';
import { getPrivacyConsent, updatePrivacyConsent } from '@/privacy/privacyService';
import { syncNow } from '@/services/sync';
import { getClient } from '@/services/auth';
import { spacing } from '@/theme/tokens';

export function DeviceConnection() {
  const router = useRouter();
  const { user, isAuthenticated } = useAuth();
  const [enabled, setEnabled] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  useEffect(() => {
    if (!PRIVATE_SYNC_ENABLED) return;
    let active = true;
    void getPrivacyConsent().then((consent) => { if (active) setEnabled(consent.cloudSync); });
    return () => { active = false; };
  }, [user?.id]);
  const toggle = async (next: boolean) => {
    setBusy(true);
    setMessage(null);
    try {
      await updatePrivacyConsent({ cloudSync: next });
      setEnabled(next);
      setMessage(next ? 'New timer totals can sync after private device access is set up. App names and per-app time stay on this device.' : 'Cloud sync is off on this device.');
    } catch (error) {
      const consent = await getPrivacyConsent();
      setEnabled(consent.cloudSync);
      setMessage(error instanceof Error ? error.message : 'Could not update cloud sync.');
    } finally { setBusy(false); }
  };
  const synchronize = async () => {
    setBusy(true);
    try {
      // Refresh account feature flags without trusting a previously signed-in account.
      const entitlement = await getClient().getEntitlements();
      if (!entitlement?.features.sync) {
        setMessage('This account does not have cloud sync enabled in its plan.');
        return;
      }
      const result = await syncNow();
      setMessage(result.message ?? 'Your sessions are up to date.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Could not sync. Try again when online.');
    } finally { setBusy(false); }
  };
  if (!PRIVATE_SYNC_ENABLED) return (
    <Card style={{ gap: spacing.md }}>
      <Typography variant="subtitle">Connect to FlowSight.AI</Typography>
      <Typography variant="caption">Private phone and computer sync is coming with FlowSight 6.0. This release saves your sessions on this device.</Typography>
      <Typography variant="caption">{isAuthenticated ? `Signed in as ${user?.email ?? 'your FlowSight account'}` : 'No account connected'}</Typography>
      {!isAuthenticated ? <Button label="Sign in to FlowSight" onPress={() => router.push('/auth')} /> : null}
    </Card>
  );
  return (
    <Card style={{ gap: spacing.md }}>
      <Typography variant="subtitle">Connect to FlowSight.AI</Typography>
      <Typography variant="caption">
        Sign in with the same account on your phone and computer to share timer totals. See shared history in Insights.
      </Typography>
      <Typography variant="caption">{isAuthenticated ? `Signed in as ${user?.email ?? 'your FlowSight account'}` : 'No account connected'}</Typography>
      {!isAuthenticated ? <Button label="Sign in to connect" onPress={() => router.push('/auth')} /> : null}
      <ToggleRow label="Cloud sync" caption="Opt in to syncing new timer session totals." value={enabled} onValueChange={(next) => void toggle(next)} disabled={busy} />
      {isAuthenticated ? <Button label="Sync now" variant="secondary" loading={busy} disabled={!enabled} onPress={() => void synchronize()} /> : null}
      <Button label="Link phone or computer" variant="secondary" onPress={() => router.push('/vault')} />
      {message ? <Typography variant="caption" accessibilityLiveRegion="polite">{message}</Typography> : null}
      <Typography variant="caption">Sign-in credentials are protected by your phone. Private sync encrypts session history before upload. Link a new device with a temporary code from an authorised device.</Typography>
    </Card>
  );
}
