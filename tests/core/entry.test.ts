import { assert, describe, it } from 'vitest';
import { randomBytes } from 'node:crypto';
import { getRawEntry, rawEntryToString, EntryType, SecretEntry } from '../../src/core/entry.js';
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
    });
});
