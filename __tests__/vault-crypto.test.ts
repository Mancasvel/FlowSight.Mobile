import { randomBytes } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import {
  accountKeyFingerprint,
  createAccountKey,
  createPairingCode,
  decryptVaultRecord,
  encryptVaultRecord,
  pairingId,
  unwrapAccountKeyFromPairing,
  wrapAccountKeyForPairing,
} from '../src/security/vaultCrypto';
import { base64urlnopad } from '@scure/base';

const random = (length: number) => new Uint8Array(randomBytes(length));
const userId = '12345678-1234-4234-8234-123456789abc';
const recordId = '12345678-1234-4234-8234-123456789abd';

describe('FlowSight v6 account vault', () => {
  it('matches the desktop pairing and record wire vector', () => {
    const key = Uint8Array.from({ length: 32 }, (_, index) => index);
    const code = `FS6-${base64urlnopad.encode(Uint8Array.from({ length: 16 }, (_, index) => index + 16))}`;
    let randomCall = 0;
    const deterministicRandom = (length: number) => {
      const offset = randomCall++ * 32 + 64;
      return Uint8Array.from({ length }, (_, index) => offset + index);
    };
    const pairing = wrapAccountKeyForPairing(key, code, userId, deterministicRandom);
    expect(pairing).toEqual({
      pairing_id: 'fc2e2c73072bfa2bda03ff9307472debd3cc8105028a8a9e235e35ba8d2e37f4',
      salt: 'QEFCQ0RFRkdISUpLTE1OT1BRUlNUVVZXWFlaW1xdXl8',
      nonce: 'YGFiY2RlZmdoaWpr',
      ciphertext: 'fHBDzWPwlwJXuplQ7GLYFFkSyUsapZGWL1Ft7iqxYuwwOiuRpXmYIxK4mY-OII-v',
    });
    expect(unwrapAccountKeyFromPairing(pairing, code, userId, accountKeyFingerprint(key))).toEqual(key);
    expect(decryptVaultRecord(key, userId, recordId, {
      nonce: 'gIGCg4SFhoeIiYqL',
      ciphertext: 'G4cFci92w6u86nZELwXDUd4B0Ilv3nkoAd_lvtOSSdYT9rZ-1JuTALQ0lXlqWMatgdDWY06sV72Fe-vYyZWlTgs0qBWsJJAXnFWVa6tG4UP0DO_eFamKFPzJvp0GWLk8jh6pVRnCBBTAVgQxCHOw0KH_AOkAvA',
    })).toEqual({ kind: 'activity_event', event: { id: recordId, label: 'Write thesis' } });
  });

  it('transfers the same account key using a code from an authorised device', () => {
    const accountKey = createAccountKey(random);
    const code = createPairingCode(random);
    const envelope = wrapAccountKeyForPairing(accountKey, code, userId, random);
    const unlocked = unwrapAccountKeyFromPairing(
      envelope,
      code,
      userId,
      accountKeyFingerprint(accountKey),
    );
    expect(unlocked).toEqual(accountKey);
    expect(envelope.pairing_id).toBe(pairingId(code));
    expect(JSON.stringify(envelope)).not.toContain(Buffer.from(accountKey).toString('hex'));
  });

  it('rejects a different code, a different account and a tampered envelope', () => {
    const accountKey = createAccountKey(random);
    const code = createPairingCode(random);
    const envelope = wrapAccountKeyForPairing(accountKey, code, userId, random);
    const fingerprint = accountKeyFingerprint(accountKey);
    expect(() => unwrapAccountKeyFromPairing(
      envelope, createPairingCode(random), userId, fingerprint,
    )).toThrow();
    expect(() => unwrapAccountKeyFromPairing(
      envelope, code, 'other-account', fingerprint,
    )).toThrow();
    expect(() => unwrapAccountKeyFromPairing(
      { ...envelope, ciphertext: `${envelope.ciphertext[0] === 'A' ? 'B' : 'A'}${envelope.ciphertext.slice(1)}` },
      code, userId, fingerprint,
    )).toThrow();
  });

  it('authenticates each encrypted activity against its account and record ID', () => {
    const accountKey = createAccountKey(random);
    const activity = { kind: 'activity_event', duration_seconds: 1234, task_label: 'Write thesis' };
    const encrypted = encryptVaultRecord(accountKey, userId, recordId, activity, random);
    expect(decryptVaultRecord(accountKey, userId, recordId, encrypted)).toEqual(activity);
    expect(JSON.stringify(encrypted)).not.toContain('Write thesis');
    expect(() => decryptVaultRecord(accountKey, userId, 'different-record', encrypted)).toThrow();
    expect(() => decryptVaultRecord(accountKey, 'different-account', recordId, encrypted)).toThrow();
  });
});
