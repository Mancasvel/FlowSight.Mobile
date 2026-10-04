import { PRIVATE_SYNC_ENABLED } from '@/services/config';
import { getRandomBytes } from 'expo-crypto';
import { getClient, getCurrentSession } from '@/services/auth';
import { secureGet, secureSet } from '@/storage/secureStorage';
import {
  accountKeyFingerprint,
  createAccountKey,
  createPairingCode,
  createVaultDeviceId,
  decodeKey,
  deviceKeyProof,
  encodeKey,
  pairingId,
  unwrapAccountKeyFromPairing,
  wrapAccountKeyForPairing,
} from '@/security/vaultCrypto';

type VaultState = 'signed_out' | 'unconfigured' | 'locked' | 'ready';

const accountKeyName = (userId: string) => `flowsight_v6_account_key_${userId}`;
const deviceIdName = (userId: string) => `flowsight_v6_device_id_${userId}`;

async function signedInUserId(): Promise<string | null> {
  if (!PRIVATE_SYNC_ENABLED) throw new Error('Private device sync will be available with FlowSight 6.0.');
  const session = await getCurrentSession();
  return session?.user.id ?? null;
}

async function getOrCreateVaultDeviceId(userId: string): Promise<string> {
  let id = await secureGet(deviceIdName(userId));
  if (!id) {
    id = createVaultDeviceId(getRandomBytes);
    await secureSet(deviceIdName(userId), id);
  }
  return id;
}

async function registerDevice(userId: string, accountKey: Uint8Array): Promise<string> {
  const deviceId = await getOrCreateVaultDeviceId(userId);
  const { error } = await getClient().supabase.from('vault_devices').upsert({
    user_id: userId,
    device_id: deviceId,
    device_label: 'FlowSight mobile',
    key_proof: deviceKeyProof(accountKey, userId, deviceId),
  }, { onConflict: 'user_id,device_id', ignoreDuplicates: true });
  if (error) throw new Error('Could not register this device for private sync.');
  return deviceId;
}

export async function getVaultState(): Promise<VaultState> {
  const userId = await signedInUserId();
  if (!userId) return 'signed_out';

  const { data: account, error } = await getClient().supabase
    .from('vault_accounts')
    .select('key_fingerprint')
    .eq('user_id', userId)
    .maybeSingle();
  if (error) throw new Error('Could not check private cloud sync.');

  const encoded = await secureGet(accountKeyName(userId));
  if (!account) {
    return 'unconfigured';
  }
  if (!encoded) return 'locked';
  if (accountKeyFingerprint(decodeKey(encoded)) !== account.key_fingerprint) {
    return 'locked';
  }
  return 'ready';
}

/** Called only after the user explicitly sets up private cloud sync. */
export async function initializeAccountVault(): Promise<void> {
  const userId = await signedInUserId();
  if (!userId) throw new Error('Sign in before setting up private sync.');
  const state = await getVaultState();
  if (state === 'ready') return;
  if (state !== 'unconfigured') throw new Error('Use a code from an authorised device.');

  const existing = await secureGet(accountKeyName(userId));
  const accountKey = existing ? decodeKey(existing) : createAccountKey(getRandomBytes);
  if (!existing) await secureSet(accountKeyName(userId), encodeKey(accountKey));
  const { error } = await getClient().supabase.from('vault_accounts').insert({
    user_id: userId,
    key_version: 1,
    key_fingerprint: accountKeyFingerprint(accountKey),
  });
  if (error) {
    const { data } = await getClient().supabase.from('vault_accounts')
      .select('key_fingerprint').eq('user_id', userId).maybeSingle();
    if (data?.key_fingerprint !== accountKeyFingerprint(accountKey)) {
      throw new Error('Could not create the private vault. Check this account on another device.');
    }
  }
  await registerDevice(userId, accountKey);
}

export async function getReadyVault(): Promise<{
  userId: string;
  deviceId: string;
  accountKey: Uint8Array;
}> {
  const userId = await signedInUserId();
  if (!userId || await getVaultState() !== 'ready') {
    throw new Error('Private sync needs a code from an authorised device.');
  }
  const encoded = await secureGet(accountKeyName(userId));
  if (!encoded) throw new Error('The device key is missing.');
  const accountKey = decodeKey(encoded);
  const deviceId = await registerDevice(userId, accountKey);
  return { userId, deviceId, accountKey };
}

/** Display this code on an authorised device; it expires on the server. */
export async function createDevicePairing(): Promise<{ code: string; expiresAt: string }> {
  const { userId, accountKey } = await getReadyVault();
  const code = createPairingCode(getRandomBytes);
  const envelope = wrapAccountKeyForPairing(accountKey, code, userId, getRandomBytes);
  // The server sets the actual five-minute expiry; device clock skew must
  // not invalidate an otherwise valid INSERT. This time is for the display.
  const expiresAt = new Date(Date.now() + 5 * 60_000).toISOString();
  const { error } = await getClient().supabase.from('vault_pairings')
    .insert({ user_id: userId, key_version: 1, ...envelope });
  if (error) throw new Error('Could not prepare the device code.');
  return { code, expiresAt };
}

/** Enter the code shown on another device signed in to this same account. */
export async function unlockVaultWithDeviceCode(code: string): Promise<void> {
  const userId = await signedInUserId();
  if (!userId) throw new Error('Sign in before entering the device code.');
  if (await getVaultState() !== 'locked') {
    throw new Error('This account does not need a device code.');
  }
  const client = getClient().supabase;
  const { data: account, error: accountError } = await client.from('vault_accounts')
    .select('key_fingerprint')
    .eq('user_id', userId)
    .single();
  if (accountError || !account) throw new Error('Could not verify the account vault.');
  const id = pairingId(code);
  const { data: envelopes, error } = await client.rpc('redeem_vault_pairing', {
    p_pairing_id: id,
  });
  const envelope = Array.isArray(envelopes) ? envelopes[0] : null;
  if (error || !envelope) throw new Error('Device code not found or expired.');
  const accountKey = unwrapAccountKeyFromPairing(
    envelope,
    code,
    userId,
    account.key_fingerprint,
  );
  await secureSet(accountKeyName(userId), encodeKey(accountKey));
  // The one-use code has already been redeemed. Registration can retry when
  // encrypted sync resumes if connectivity fails after the key is saved.
  await registerDevice(userId, accountKey).catch(() => undefined);
}
