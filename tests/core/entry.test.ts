import { assert, describe, it } from 'vitest';
import { randomBytes } from 'node:crypto';
import { getRawEntry, rawEntryToString, EntryType, SecretEntry, LargeEntry, parseEntry,
    rsaEncrypt, rsaDecrypt, aesEncrypt, aesDecrypt, wrapAESPayload, unwrapAESPayload } from '../../src/core/entry.js';
import { generateRSAKeyPair, parsePublicKey, parsePrivateKey } from '../../src/core/rsa.js';

describe('getRawEntry / rawEntryToString', () => {
    describe('getRawEntry', () => {
        it('parses the $ prefix byte', () => {
            const str = rawEntryToString({
                prefix: '$',
                createdOn: new Date(0),
                modifiedOn: new Date(0),
                raw: Buffer.alloc(0)
            });
            assert.strictEqual(getRawEntry(str).prefix, '$');
        });

        it('parses the @ prefix byte', () => {
            const str = rawEntryToString({
                prefix: '@',
                createdOn: new Date(0),
                modifiedOn: new Date(0),
                raw: Buffer.alloc(0)
            });
            assert.strictEqual(getRawEntry(str).prefix, '@');
        });

        it('parses createdOn timestamp', () => {
            const createdOn = new Date(1_000_000_000_000);
            const str = rawEntryToString({
                prefix: '$',
                createdOn,
                modifiedOn: new Date(0),
                raw: Buffer.alloc(0)
            });
            assert.strictEqual(getRawEntry(str).createdOn.getTime(), createdOn.getTime());
        });

        it('parses modifiedOn timestamp', () => {
            const modifiedOn = new Date(2_000_000_000_000);
            const str = rawEntryToString({
                prefix: '$',
                createdOn: new Date(0),
                modifiedOn,
                raw: Buffer.alloc(0)
            });
            assert.strictEqual(getRawEntry(str).modifiedOn.getTime(), modifiedOn.getTime());
        });

        it('parses a text payload', () => {
            const raw = Buffer.from('hello vault');
            const str = rawEntryToString({
                prefix: '$',
                createdOn: new Date(0),
                modifiedOn: new Date(0),
                raw
            });
            assert.deepStrictEqual(getRawEntry(str).raw, raw);
        });

        it('parses an empty payload', () => {
            const str = rawEntryToString({
                prefix: '$',
                createdOn: new Date(0),
                modifiedOn: new Date(0),
                raw: Buffer.alloc(0)
            });
            assert.strictEqual(getRawEntry(str).raw.byteLength, 0);
        });

        it('parses a binary payload (e.g. ciphertext)', () => {
            const raw = randomBytes(512);
            const str = rawEntryToString({
                prefix: '$',
                createdOn: new Date(0),
                modifiedOn: new Date(0),
                raw
            });
            assert.deepStrictEqual(getRawEntry(str).raw, raw);
        });
    });

    describe('rawEntryToString', () => {
        it('returns a valid base64 string', () => {
            const str = rawEntryToString({
                prefix: '$',
                createdOn: new Date(0),
                modifiedOn: new Date(0),
                raw: Buffer.from('test')
            });
            assert.doesNotThrow(() => Buffer.from(str, 'base64'));
            assert.strictEqual(str, Buffer.from(str, 'base64').toString('base64'));
        });

        it('encodes different payloads differently', () => {
            const base = { prefix: '$' as const, createdOn: new Date(0), modifiedOn: new Date(0) };
            const s1 = rawEntryToString({ ...base, raw: Buffer.from('foo') });
            const s2 = rawEntryToString({ ...base, raw: Buffer.from('bar') });
            assert.notStrictEqual(s1, s2);
        });

        it('encodes different createdOn timestamps differently', () => {
            const base = { prefix: '$' as const, raw: Buffer.from('x'), modifiedOn: new Date(0) };
            const s1 = rawEntryToString({ ...base, createdOn: new Date(1000) });
            const s2 = rawEntryToString({ ...base, createdOn: new Date(2000) });
            assert.notStrictEqual(s1, s2);
        });

        it('encodes different modifiedOn timestamps differently', () => {
            const base = { prefix: '$' as const, raw: Buffer.from('x'), createdOn: new Date(0) };
            const s1 = rawEntryToString({ ...base, modifiedOn: new Date(1000) });
            const s2 = rawEntryToString({ ...base, modifiedOn: new Date(2000) });
            assert.notStrictEqual(s1, s2);
        });

        it('encodes different prefixes differently', () => {
            const base = { raw: Buffer.from('x'), createdOn: new Date(0), modifiedOn: new Date(0) };
            const s1 = rawEntryToString({ ...base, prefix: '$' });
            const s2 = rawEntryToString({ ...base, prefix: '@' });
            assert.notStrictEqual(s1, s2);
        });
    });

    describe('round-trip', () => {
        it('getRawEntry(rawEntryToString(x)) === x for all fields', () => {
            const prefix = '$' as const;
            const createdOn = new Date(1_700_000_000_000);
            const modifiedOn = new Date(1_700_000_001_234);
            const raw = Buffer.from('round-trip payload');

            const parsed = getRawEntry(rawEntryToString({ prefix, createdOn, modifiedOn, raw }));

            assert.strictEqual(parsed.prefix, prefix);
            assert.strictEqual(parsed.createdOn.getTime(), createdOn.getTime());
            assert.strictEqual(parsed.modifiedOn.getTime(), modifiedOn.getTime());
            assert.deepStrictEqual(parsed.raw, raw);
        });

        it('round-trips a binary payload', () => {
            const raw = randomBytes(512);
            const parsed = getRawEntry(rawEntryToString({
                prefix: '@',
                createdOn: new Date(42),
                modifiedOn: new Date(99),
                raw
            }));
            assert.deepStrictEqual(parsed.raw, raw);
        });

        it('rawEntryToString(getRawEntry(s)) === s', () => {
            const original = rawEntryToString({
                prefix: '$',
                createdOn: new Date(1_234_567_890_123),
                modifiedOn: new Date(9_876_543_210_987),
                raw: Buffer.from('idempotent')
            });
            const reparsed = getRawEntry(original);
            assert.strictEqual(rawEntryToString(reparsed), original);
        });
    });

    describe('SecretEntry', () => {
        const { privateKey: privPem, publicKey: pubPem } = generateRSAKeyPair();
        const pubKey = parsePublicKey(pubPem as string);
        const privKey = parsePrivateKey(privPem as string);

        it('has the correct prefix and type', () => {
            const entry = new SecretEntry();
            assert.strictEqual(entry.prefix, '$');
            assert.strictEqual(entry.type, EntryType.Secret);
        });

        it('decrypt returns the original value as a Buffer', () => {
            const entry = new SecretEntry();
            entry.setRaw(pubKey, 'top-secret');
            const result = entry.decrypt(privKey);
            assert.ok(Buffer.isBuffer(result));
            assert.strictEqual((result as Buffer).toString('utf8'), 'top-secret');
        });

        it('decrypt returns the original value as a string when encoding is given', () => {
            const entry = new SecretEntry();
            entry.setRaw(pubKey, 'top-secret');
            assert.strictEqual(entry.decrypt(privKey, 'utf8'), 'top-secret');
        });

        it('setRaw produces different ciphertext on each call due to random salt', () => {
            const entry1 = new SecretEntry();
            const entry2 = new SecretEntry();
            entry1.setRaw(pubKey, 'same value');
            entry2.setRaw(pubKey, 'same value');
            assert.notDeepEqual(entry1.getRaw(), entry2.getRaw());
        });

        it('setRaw updates modifiedOn', () => {
            const entry = new SecretEntry();
            const before = entry.modifiedOn;
            entry.setRaw(pubKey, 'updated');
            assert.ok(entry.modifiedOn.getTime() >= before.getTime());
        });

        it('parse preserves prefix, type, and timestamps', () => {
            const entry = new SecretEntry();
            entry.setRaw(pubKey, 'value');
            const parsed = SecretEntry.parse(entry.serialize());
            assert.strictEqual(parsed.prefix, '$');
            assert.strictEqual(parsed.type, EntryType.Secret);
            assert.strictEqual(parsed.createdOn.getTime(), entry.createdOn.getTime());
            assert.strictEqual(parsed.modifiedOn.getTime(), entry.modifiedOn.getTime());
        });

        it('decrypt after serialize and parse recovers the original value', () => {
            const entry = new SecretEntry();
            entry.setRaw(pubKey, 'persisted-secret');
            const parsed = SecretEntry.parse(entry.serialize());
            assert.strictEqual(parsed.decrypt(privKey, 'utf8'), 'persisted-secret');
        });

        it('throws when decrypting with the wrong private key', () => {
            const { privateKey: otherPrivPem } = generateRSAKeyPair();
            const otherPrivKey = parsePrivateKey(otherPrivPem as string);
            const entry = new SecretEntry();
            entry.setRaw(pubKey, 'secret');
            assert.throws(() => entry.decrypt(otherPrivKey));
        });

        it('getRaw returns an empty Buffer when no raw has been set', () => {
            const entry = new SecretEntry();
            const raw = entry.getRaw();
            assert.ok(Buffer.isBuffer(raw));
            assert.strictEqual(raw.byteLength, 0);
        });

        it('serialize returns a valid base64 string with empty payload when no raw has been set', () => {
            const entry = new SecretEntry();
            const str = entry.serialize();
            assert.doesNotThrow(() => Buffer.from(str, 'base64'));
        });

        it('modified is false immediately after construction', () => {
            const entry = new SecretEntry();
            assert.strictEqual(entry.modified, false);
        });

        it('modified is true after setRaw is called on an imported entry', async () => {
            const str = rawEntryToString({
                prefix: '$', createdOn: new Date(0), modifiedOn: new Date(0), raw: Buffer.alloc(0)
            });
            const entry = SecretEntry.parse(str); // #importedOn = now
            await new Promise((r) => setTimeout(r, 2)); // ensure next new Date() > #importedOn
            entry.setRaw(pubKey, 'value');
            assert.strictEqual(entry.modified, true);
        });
    });

    describe('LargeEntry', () => {
        const { privateKey: privPem, publicKey: pubPem } = generateRSAKeyPair();
        const pubKey = parsePublicKey(pubPem as string);
        const privKey = parsePrivateKey(privPem as string);

        it('has the correct instance prefix and type', () => {
            const entry = new LargeEntry();
            assert.strictEqual(entry.prefix, '@');
            assert.strictEqual(entry.type, EntryType.Large);
        });

        it('parse preserves prefix, type, and timestamps', () => {
            const entry = new LargeEntry();
            entry.setRaw(pubKey, 'large-value');
            const parsed = LargeEntry.parse(entry.serialize());
            assert.strictEqual(parsed.prefix, '@');
            assert.strictEqual(parsed.type, EntryType.Large);
            assert.strictEqual(parsed.createdOn.getTime(), entry.createdOn.getTime());
            assert.strictEqual(parsed.modifiedOn.getTime(), entry.modifiedOn.getTime());
        });

        it('decrypt after serialize and parse recovers the original value', () => {
            const entry = new LargeEntry();
            entry.setRaw(pubKey, 'large-secret');
            const parsed = LargeEntry.parse(entry.serialize());
            assert.strictEqual(parsed.decrypt(privKey, 'utf8'), 'large-secret');
        });
    });

    describe('parseEntry', () => {
        it('throws for an unknown prefix byte', () => {
            const buf = Buffer.alloc(17);
            buf[0] = 0x58; // 'X' — not a registered prefix
            assert.throws(() => parseEntry(buf.toString('base64')), /Unknown entry type/);
        });
    });
});

describe('rsaEncrypt', () => {
    const { privateKey: privPem, publicKey: pubPem } = generateRSAKeyPair();
    const pubKey = parsePublicKey(pubPem);
    const privKey = parsePrivateKey(privPem);

    it('returns a Buffer', () => {
        assert.ok(Buffer.isBuffer(rsaEncrypt(pubKey, 'hello')));
    });

    it('produces different ciphertext on each call for the same string input', () => {
        const r1 = rsaEncrypt(pubKey, 'same');
        const r2 = rsaEncrypt(pubKey, 'same');
        assert.notDeepEqual(r1, r2);
    });

    it('decrypts back to the original string via rsaDecrypt', () => {
        const plaintext = 'vault-secret';
        const result = rsaDecrypt(rsaEncrypt(pubKey, plaintext), privKey);
        assert.strictEqual(result.toString('utf8'), plaintext);
    });

    it('accepts a Buffer as data and decrypts correctly', () => {
        const data = randomBytes(32);
        const result = rsaDecrypt(rsaEncrypt(pubKey, data), privKey);
        assert.deepStrictEqual(result, data);
    });
});

describe('aesEncrypt', () => {
    const { publicKey: pubPem } = generateRSAKeyPair();
    const pubKey = parsePublicKey(pubPem);

    it('returns an AESEnvelope with Buffer fields', () => {
        const env = aesEncrypt(pubKey, 'hello');
        assert.ok(Buffer.isBuffer(env.rsaEncryptedKey));
        assert.ok(Buffer.isBuffer(env.iv));
        assert.ok(Buffer.isBuffer(env.authTag));
        assert.ok(Buffer.isBuffer(env.chipher));
    });

    it('rsaEncryptedKey is 512 bytes', () => {
        assert.strictEqual(aesEncrypt(pubKey, 'test').rsaEncryptedKey.byteLength, 512);
    });

    it('iv is 12 bytes', () => {
        assert.strictEqual(aesEncrypt(pubKey, 'test').iv.byteLength, 12);
    });

    it('authTag is 16 bytes', () => {
        assert.strictEqual(aesEncrypt(pubKey, 'test').authTag.byteLength, 16);
    });

    it('produces a non-empty ciphertext', () => {
        assert.ok(aesEncrypt(pubKey, 'hello').chipher.byteLength > 0);
    });

    it('produces different envelopes on each call for the same input', () => {
        const e1 = aesEncrypt(pubKey, 'same');
        const e2 = aesEncrypt(pubKey, 'same');
        assert.notDeepEqual(e1.chipher, e2.chipher);
    });
});

describe('aesDecrypt', () => {
    const { privateKey: privPem, publicKey: pubPem } = generateRSAKeyPair();
    const pubKey = parsePublicKey(pubPem);
    const privKey = parsePrivateKey(privPem);

    function encryptAndUnwrapKey(payload: string) {
        const env = aesEncrypt(pubKey, payload);
        const aesKey = rsaDecrypt(env.rsaEncryptedKey, privKey);
        return { env, aesKey };
    }

    it('returns a Buffer when encoding is not provided', () => {
        const { env, aesKey } = encryptAndUnwrapKey('hello');
        assert.ok(Buffer.isBuffer(aesDecrypt(aesKey, env)));
    });

    it('returns a string when encoding is provided', () => {
        const { env, aesKey } = encryptAndUnwrapKey('hello');
        assert.strictEqual(typeof aesDecrypt(aesKey, env, 'utf8'), 'string');
    });

    it('recovers the original plaintext as a Buffer', () => {
        const { env, aesKey } = encryptAndUnwrapKey('my-secret');
        const result = aesDecrypt(aesKey, env) as Buffer;
        assert.strictEqual(result.toString('utf8'), 'my-secret');
    });

    it('recovers the original plaintext as a utf8 string', () => {
        const { env, aesKey } = encryptAndUnwrapKey('my-secret');
        assert.strictEqual(aesDecrypt(aesKey, env, 'utf8'), 'my-secret');
    });

    it('throws when the authTag is tampered with', () => {
        const { env, aesKey } = encryptAndUnwrapKey('tamper-test');
        const badEnv = { ...env, authTag: randomBytes(16) };
        assert.throws(() => aesDecrypt(aesKey, badEnv));
    });

    it('throws when the wrong AES key is used', () => {
        const { env } = encryptAndUnwrapKey('key-mismatch');
        assert.throws(() => aesDecrypt(randomBytes(32), env));
    });
});

describe('rsaDecrypt', () => {
    const { privateKey: privPem, publicKey: pubPem } = generateRSAKeyPair();
    const pubKey = parsePublicKey(pubPem as string);
    const privKey = parsePrivateKey(privPem as string);

    it('returns the original plaintext as a Buffer', () => {
        const entry = new SecretEntry();
        entry.setRaw(pubKey, 'hello');
        const result = rsaDecrypt(entry.getRaw(), privKey);
        assert.ok(Buffer.isBuffer(result));
        assert.strictEqual(result.toString('utf8'), 'hello');
    });

    it('strips the 16-byte salt, returning only the plaintext bytes', () => {
        const plaintext = 'hello vault';
        const entry = new SecretEntry();
        entry.setRaw(pubKey, plaintext);
        const result = rsaDecrypt(entry.getRaw(), privKey);
        assert.strictEqual(result.byteLength, Buffer.byteLength(plaintext, 'utf8'));
    });

    it('decrypts binary-safe plaintext correctly', () => {
        const plaintext = randomBytes(64).toString('hex');
        const entry = new SecretEntry();
        entry.setRaw(pubKey, plaintext);
        const result = rsaDecrypt(entry.getRaw(), privKey);
        assert.strictEqual(result.toString('utf8'), plaintext);
    });

    it('throws when decrypting with the wrong private key', () => {
        const { privateKey: otherPrivPem } = generateRSAKeyPair();
        const otherPrivKey = parsePrivateKey(otherPrivPem as string);
        const entry = new SecretEntry();
        entry.setRaw(pubKey, 'secret');
        assert.throws(() => rsaDecrypt(entry.getRaw(), otherPrivKey));
    });
});

describe('wrapAESPayload / unwrapAESPayload', () => {
    function makeEnvelope() {
        return {
            rsaEncryptedKey: randomBytes(512),
            iv: randomBytes(12),
            authTag: randomBytes(16),
            chipher: randomBytes(64)
        };
    }

    describe('wrapAESPayload', () => {
        it('returns a Buffer whose length equals the sum of all field lengths', () => {
            const env = makeEnvelope();
            const result = wrapAESPayload(env);
            assert.strictEqual(result.byteLength, 512 + 12 + 16 + 64);
        });

        it('places rsaEncryptedKey in bytes 0–511', () => {
            const env = makeEnvelope();
            assert.deepStrictEqual(wrapAESPayload(env).subarray(0, 512), env.rsaEncryptedKey);
        });

        it('places iv in bytes 512–523', () => {
            const env = makeEnvelope();
            assert.deepStrictEqual(wrapAESPayload(env).subarray(512, 524), env.iv);
        });

        it('places authTag in bytes 524–539', () => {
            const env = makeEnvelope();
            assert.deepStrictEqual(wrapAESPayload(env).subarray(524, 540), env.authTag);
        });

        it('places ciphertext starting at byte 540', () => {
            const env = makeEnvelope();
            assert.deepStrictEqual(wrapAESPayload(env).subarray(540), env.chipher);
        });
    });

    describe('unwrapAESPayload', () => {
        it('recovers rsaEncryptedKey (512 bytes)', () => {
            const env = makeEnvelope();
            assert.deepStrictEqual(unwrapAESPayload(wrapAESPayload(env)).rsaEncryptedKey, env.rsaEncryptedKey);
        });

        it('recovers iv (12 bytes)', () => {
            const env = makeEnvelope();
            assert.deepStrictEqual(unwrapAESPayload(wrapAESPayload(env)).iv, env.iv);
        });

        it('recovers authTag (16 bytes)', () => {
            const env = makeEnvelope();
            assert.deepStrictEqual(unwrapAESPayload(wrapAESPayload(env)).authTag, env.authTag);
        });

        it('recovers ciphertext', () => {
            const env = makeEnvelope();
            assert.deepStrictEqual(unwrapAESPayload(wrapAESPayload(env)).chipher, env.chipher);
        });
    });

    describe('round-trip', () => {
        it('wrap then unwrap then rewrap produces the same bytes', () => {
            const env = makeEnvelope();
            const wrapped = wrapAESPayload(env);
            assert.deepStrictEqual(wrapAESPayload(unwrapAESPayload(wrapped)), wrapped);
        });
    });
});
