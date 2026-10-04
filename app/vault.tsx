import { PRIVATE_SYNC_ENABLED } from '@/services/config';
import React, { useCallback, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import { useAuth } from '@/hooks';
import { Ionicons } from '@expo/vector-icons';
import { Screen, Card, Button, Typography, Input } from '@/components';
import { useTheme } from '@/theme';
import { spacing } from '@/theme/tokens';
import {
  createDevicePairing,
  getVaultState,
  initializeAccountVault,
  unlockVaultWithDeviceCode,
} from '@/services/vault';
import { syncNow } from '@/services/sync';

type State = Awaited<ReturnType<typeof getVaultState>>;

export default function VaultScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const { theme } = useTheme();
  const [state, setState] = useState<State | 'loading'>('loading');
  const [busy, setBusy] = useState(false);
  const [code, setCode] = useState('');
  const [pairing, setPairing] = useState<{ code: string; expiresAt: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!PRIVATE_SYNC_ENABLED) { setState('signed_out'); setNotice('Private device sync will be available with FlowSight 6.0.'); return; }
    if (!user) { setState('signed_out'); setPairing(null); return; }
    setError(null);
    setPairing(null);
    setState('loading');
    try { setState(await getVaultState()); }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not check private sync.'); }
  }, [user]);
  useFocusEffect(useCallback(() => { void refresh(); }, [refresh]));

  const run = async (action: () => Promise<void>) => {
    setBusy(true);
    setError(null);
    try {
      await action();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Private sync failed.');
    } finally {
      setBusy(false);
    }
  };

  if (!PRIVATE_SYNC_ENABLED) return (
    <Screen>
      <ScrollView contentContainerStyle={styles.content}>
        <Button label="Back to Settings" variant="secondary" onPress={() => router.replace('/settings')} />
        <Typography variant="title">Connect to FlowSight.AI</Typography>
        <Typography>Private phone and computer sync will be available with FlowSight 6.0. Your sessions stay on this device.</Typography>
      </ScrollView>
    </Screen>
  );
  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.top}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Back"
            onPress={() => router.back()}
            style={[styles.back, { backgroundColor: theme.glass, borderColor: theme.glassBorder }]}
          >
            <Ionicons name="arrow-back" size={18} color={theme.text} />
          </Pressable>
          <Typography variant="kicker" color={theme.primary}>Private cloud</Typography>
        </View>

        <View style={styles.hero}>
          <Typography variant="title">Your account, your devices.</Typography>
          <Typography variant="caption">
            Your sessions are encrypted before they reach the cloud. To open them on a new device,
            sign in to the same account and enter a code shown on a device that already has access.
            No unlock code is sent by email.
          </Typography>
        </View>

        {state === 'signed_out' ? (
          <Card style={styles.card}>
            <Typography variant="subtitle">Sign in first</Typography>
            <Typography variant="caption">Private sync is linked to your FlowSight account.</Typography>
            <Button label="Sign in" onPress={() => router.push('/auth')} />
          </Card>
        ) : null}

        {state === 'unconfigured' ? (
          <Card style={styles.card}>
            <Typography variant="subtitle">Set up your private vault</Typography>
            <Typography variant="caption">
              This device will create your account key. Keep at least one authorised device:
              if all are lost, your encrypted history cannot be recovered.
            </Typography>
            <Button
              label="Set up private sync"
              loading={busy}
              onPress={() => void run(async () => {
                await initializeAccountVault();
                setState('ready');
              })}
            />
          </Card>
        ) : null}

        {state === 'locked' ? (
          <Card style={styles.card}>
            <Typography variant="subtitle">Enter a code from another device</Typography>
            <Typography variant="caption">
              On a device already using this account, open Private cloud and choose Link another device.
              The code expires after five minutes.
            </Typography>
            <Input
              autoCapitalize="none"
              autoCorrect={false}
              placeholder="FS6-..."
              value={code}
              onChangeText={setCode}
            />
            <Button
              label="Unlock this device"
              loading={busy}
              disabled={!code.trim()}
              onPress={() => void run(async () => {
                await unlockVaultWithDeviceCode(code);
                setCode('');
                setState('ready');
                await syncNow();
              })}
            />
          </Card>
        ) : null}

        {state === 'ready' ? (
          <Card style={styles.card}>
            <Typography variant="subtitle">This device has access</Typography>
            <Typography variant="caption">
              Generate a temporary code here and enter it on your new computer or phone after signing in.
              Anyone with this code and access to your account can read your private data until it expires.
            </Typography>
            <Button
              label="Link another device"
              loading={busy}
              onPress={() => void run(async () => {
                setPairing(await createDevicePairing());
              })}
            />
            {pairing ? (
              <View style={[styles.codeBox, { borderColor: theme.glassBorder }]}>
                <Typography variant="kicker">Device code</Typography>
                <Typography selectable style={styles.code}>{pairing.code}</Typography>
                <Typography variant="caption">
                  Expires at {new Date(pairing.expiresAt).toLocaleTimeString()}.
                  Select the code to copy it.
                </Typography>
              </View>
            ) : null}
          </Card>
        ) : null}

        {state === 'ready' ? (
          <Button label="Sync encrypted history now" variant="secondary" loading={busy} onPress={() => void run(async () => {
            const result = await syncNow();
            setNotice(result.message ?? 'Review cloud sync in Settings.');
          })} />
        ) : null}
        {notice ? <Typography variant="caption">{notice}</Typography> : null}
        {error ? <Typography variant="caption" color="#EF4444">{error}</Typography> : null}
        {state === 'loading' && error ? <Button label="Retry connection" variant="secondary" onPress={() => void refresh()} /> : null}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { gap: spacing.lg, paddingBottom: 40 },
  top: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  back: { width: 48, height: 48, borderWidth: 1, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  hero: { gap: spacing.sm },
  card: { gap: spacing.md },
  codeBox: { gap: spacing.sm, borderWidth: 1, borderRadius: 16, padding: spacing.md },
  code: { fontSize: 18, letterSpacing: 0.5, fontWeight: '700' },
});
