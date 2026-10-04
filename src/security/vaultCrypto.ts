import { gcm } from '@noble/ciphers/aes';
import { hkdf } from '@noble/hashes/hkdf';
import { hmac } from '@noble/hashes/hmac';
import { sha256 } from '@noble/hashes/sha256';
import { bytesToHex, bytesToUtf8, utf8ToBytes } from '@noble/hashes/utils';
import { base64urlnopad } from '@scure/base';

/** FlowSight v6 wire format. Supply random bytes from an OS CSPRNG. */
export type RandomSource = (length: number) => Uint8Array;
export type VaultCiphertext = { nonce: string; ciphertext: string };
export type VaultPairingEnvelope = VaultCiphertext & { pairing_id: string; salt: string };

const KEY_LENGTH = 32;
const PAIRING_SECRET_LENGTH = 16; // 128-bit code, displayed by a trusted device.
const NONCE_LENGTH = 12;
const VERSION = 1;

function randomExact(random: RandomSource, length: number): Uint8Array {
  const bytes = random(length);
  if (bytes.length !== length) throw new Error('The device random source failed.');
  return bytes;
}

function decodeExact(encoded: string, length: number): Uint8Array {
  const bytes = base64urlnopad.decode(encoded);
  if (bytes.length !== length) throw new Error('Invalid vault key material.');
  return bytes;
}

export function createVaultDeviceId(random: RandomSource): string {
  const bytes = randomExact(random, 16);
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = bytesToHex(bytes);
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

export function createAccountKey(random: RandomSource): Uint8Array {
  return randomExact(random, KEY_LENGTH);
}

export function accountKeyFingerprint(accountKey: Uint8Array): string {
  if (accountKey.length !== KEY_LENGTH) throw new Error('Invalid account key.');
  return bytesToHex(sha256(accountKey));
}

export function createPairingCode(random: RandomSource): string {
  return `FS6-${base64urlnopad.encode(randomExact(random, PAIRING_SECRET_LENGTH))}`;
}

function pairingSecret(code: string): Uint8Array {
  const trimmed = code.trim();
  if (!trimmed.startsWith('FS6-')) throw new Error('Invalid device code.');
  return decodeExact(trimmed.slice(4), PAIRING_SECRET_LENGTH);
}

export function pairingId(code: string): string {
  return bytesToHex(sha256(pairingSecret(code)));
}

function pairingAad(userId: string): Uint8Array {
  return utf8ToBytes(`flowsight:v6:pairing:${userId}:${VERSION}`);
}

function pairingWrapKey(secret: Uint8Array, salt: Uint8Array): Uint8Array {
  return hkdf(
    sha256,
    secret,
    salt,
    utf8ToBytes('flowsight:v6:pairing-wrap:v1'),
    KEY_LENGTH,
  );
}

export function wrapAccountKeyForPairing(
  accountKey: Uint8Array,
  code: string,
  userId: string,
  random: RandomSource,
): VaultPairingEnvelope {
  if (accountKey.length !== KEY_LENGTH) throw new Error('Invalid account key.');
  const salt = randomExact(random, KEY_LENGTH);
  const nonce = randomExact(random, NONCE_LENGTH);
  return {
    pairing_id: pairingId(code),
    salt: base64urlnopad.encode(salt),
    nonce: base64urlnopad.encode(nonce),
    ciphertext: base64urlnopad.encode(
      gcm(pairingWrapKey(pairingSecret(code), salt), nonce, pairingAad(userId))
        .encrypt(accountKey),
    ),
  };
}

export function unwrapAccountKeyFromPairing(
  envelope: VaultPairingEnvelope,
  code: string,
  userId: string,
  expectedFingerprint: string,
): Uint8Array {
  if (pairingId(code) !== envelope.pairing_id) {
    throw new Error('The device code does not match this pairing.');
  }
  const accountKey = gcm(
    pairingWrapKey(pairingSecret(code), decodeExact(envelope.salt, KEY_LENGTH)),
    decodeExact(envelope.nonce, NONCE_LENGTH),
    pairingAad(userId),
  ).decrypt(base64urlnopad.decode(envelope.ciphertext));
  if (accountKeyFingerprint(accountKey) !== expectedFingerprint) {
    throw new Error('The device code does not match this account.');
  }
  return accountKey;
}

export function deviceKeyProof(accountKey: Uint8Array, userId: string, deviceId: string): string {
  if (accountKey.length !== KEY_LENGTH) throw new Error('Invalid account key.');
  return bytesToHex(hmac(sha256, accountKey, utf8ToBytes(`flowsight:v6:device:${userId}:${deviceId}`)));
}

function recordAad(userId: string, recordId: string): Uint8Array {
  return utf8ToBytes(`flowsight:v6:record:${userId}:${recordId}:${VERSION}`);
}

export function encryptVaultRecord(
  accountKey: Uint8Array,
  userId: string,
  recordId: string,
  payload: unknown,
  random: RandomSource,
): VaultCiphertext {
  if (accountKey.length !== KEY_LENGTH) throw new Error('Invalid account key.');
  const nonce = randomExact(random, NONCE_LENGTH);
  return {
    nonce: base64urlnopad.encode(nonce),
    ciphertext: base64urlnopad.encode(
      gcm(accountKey, nonce, recordAad(userId, recordId))
        .encrypt(utf8ToBytes(JSON.stringify(payload))),
    ),
  };
}

export function decryptVaultRecord<T>(
  accountKey: Uint8Array,
  userId: string,
  recordId: string,
  encrypted: VaultCiphertext,
): T {
  if (accountKey.length !== KEY_LENGTH) throw new Error('Invalid account key.');
  const plaintext = gcm(
    accountKey,
    decodeExact(encrypted.nonce, NONCE_LENGTH),
    recordAad(userId, recordId),
  ).decrypt(base64urlnopad.decode(encrypted.ciphertext));
  return JSON.parse(bytesToUtf8(plaintext)) as T;
}

export function encodeKey(key: Uint8Array): string {
  if (key.length !== KEY_LENGTH) throw new Error('Invalid vault key.');
  return base64urlnopad.encode(key);
}

export function decodeKey(encoded: string): Uint8Array {
  return decodeExact(encoded, KEY_LENGTH);
}
