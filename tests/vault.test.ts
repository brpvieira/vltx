import { assert, beforeAll, describe, expect, it } from 'vitest';
import { chmodSync, existsSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import Vault from '../src/core/vault.js';
import { generateRSAKeyPair, parsePrivateKey, derivePublicKey } from '../src/core/rsa.js';

let privateKeyPem: string;
let publicKeyPem: string;
let tmpDir: string;

beforeAll(() => {
    const kp = generateRSAKeyPair();
    privateKeyPem = kp.privateKey as string;
    publicKeyPem = kp.publicKey as string;
    tmpDir = mkdtempSync(join(__dirname, 'tmp' , 'test-'));
});

describe('Vault constructor', () => {
    it('creates an empty vault with no options', () => {
        const v = new Vault({});
        assert(!v.canEncrypt);
        assert(!v.canDecrypt);
        assert.equal(v.size, 0);
    });

    it('accepts a private key PEM string and derives the public key', () => {
        const v = new Vault({ privateKey: privateKeyPem });
        assert(v.canDecrypt);
        assert(v.canEncrypt);
        assert(v.publicKey);
        assert.equal(v.publicKey!.type, 'public');
    });

    it('accepts a private key as a KeyObject', () => {
        const keyObj = parsePrivateKey(privateKeyPem);
        const v = new Vault({ privateKey: keyObj });
        assert(v.canDecrypt);
        assert(v.canEncrypt);
    });

    it('loads a private key from a file path', () => {
        const keyPath = join(tmpDir, 'private.pem');
        writeFileSync(keyPath, privateKeyPem);
        const v = new Vault({ privateKeyFilename: keyPath });
        assert(v.canDecrypt);
        assert(v.canEncrypt);
    });

    it('loads vault contents from a file when filename is provided', () => {
        const vaultPath = join(tmpDir, 'load.vault.json');
        writeFileSync(vaultPath, JSON.stringify({ publicKey: publicKeyPem, secrets: { foo: 'bar' } }));
        const v = new Vault({ filename: vaultPath });
        assert(v.canEncrypt);
        assert(v.has('foo'));
    });
});

describe('Vault.setPrivateKey', () => {
    it('sets a private key from a PEM string', () => {
        const v = new Vault({});
        v.setPrivateKey({ privateKey: privateKeyPem });
        assert(v.canDecrypt);
    });

    it('sets a private key from a KeyObject', () => {
        const keyObj = parsePrivateKey(privateKeyPem);
        const v = new Vault({});
        v.setPrivateKey({ privateKey: keyObj });
        assert(v.canDecrypt);
    });

    it('sets a private key from a file path', () => {
        const keyPath = join(tmpDir, 'priv2.pem');
        writeFileSync(keyPath, privateKeyPem);
        const v = new Vault({});
        v.setPrivateKey({ privateKeyFilename: keyPath });
        assert(v.canDecrypt);
    });

    it('returns this for chaining', () => {
        const v = new Vault({});
        const result = v.setPrivateKey({ privateKey: privateKeyPem });
        assert.strictEqual(result, v);
    });

    it('is a no-op when no key material is provided', () => {
        const v = new Vault({});
        v.setPrivateKey({});
        assert(!v.canDecrypt);
    });

    it('is a no-op when privateKey is truthy but not a string or KeyObject', () => {
        const v = new Vault({});
        v.setPrivateKey({ privateKey: 42 as unknown as string });
        assert(!v.canDecrypt);
    });
});

describe('Vault.setPublicKey', () => {
    it('sets the public key and enables encryption', () => {
        const pubKeyObj = derivePublicKey(parsePrivateKey(privateKeyPem));
        const v = new Vault({});
        assert(!v.canEncrypt);
        v.setPublicKey(pubKeyObj);
        assert(v.canEncrypt);
    });

    it('returns this for chaining', () => {
        const pubKeyObj = derivePublicKey(parsePrivateKey(privateKeyPem));
        const v = new Vault({});
        const result = v.setPublicKey(pubKeyObj);
        assert.strictEqual(result, v);
    });
});

describe('Vault.load', () => {
    it('populates secrets from a plain object', () => {
        const v = new Vault({});
        v.load({ a: '1', b: '2' });
        assert.equal(v.size, 2);
        assert(v.has('a'));
        assert(v.has('b'));
    });

    it('replaces existing secrets on each call', () => {
        const v = new Vault({});
        v.load({ a: '1' });
        v.load({ b: '2' });
        assert(!v.has('a'));
        assert(v.has('b'));
        assert.equal(v.size, 1);
    });

    it('returns this for chaining', () => {
        const v = new Vault({});
        const result = v.load({ x: 'y' });
        assert.strictEqual(result, v);
    });
});

describe('Vault.read / Vault.write', () => {
    it('write throws when no filename is available', () => {
        const v = new Vault({});
        assert.throws(() => v.write(), /No filename/);
    });

    it('read throws when no filename is available', () => {
        const v = new Vault({});
        assert.throws(() => v.read(), /No filename/);
    });

    it('round-trips a vault file via write then read', () => {
        const vaultPath = join(tmpDir, 'roundtrip.vault.json');
        const v1 = new Vault({ privateKey: privateKeyPem });
        v1.replace('hello', 'world');
        v1.write(vaultPath);

        const v2 = new Vault({ filename: vaultPath });
        assert(v2.canEncrypt);
        assert(v2.has('hello'));
    });

    it('write uses the construction filename when none is passed', () => {
        const vaultPath = join(tmpDir, 'default-write.vault.json');
        // Bootstrap: write the file once so the constructor can read it.
        new Vault({ privateKey: privateKeyPem }).write(vaultPath);
        const v = new Vault({ filename: vaultPath });
        v.replace('k', 'v');
        assert.doesNotThrow(() => v.write());
    });

    it('tryRead silently ignores a missing file and returns this', () => {
        const v = new Vault({});
        const result = v.tryRead(join(tmpDir, 'does-not-exist.vault.json'));
        assert.strictEqual(result, v);
        assert.equal(v.size, 0);
    });

    it('tryRead re-throws non-ENOENT node errors', () => {
        const vaultPath = join(tmpDir, 'no-read-perms.vault.json');
        new Vault({ privateKey: privateKeyPem }).write(vaultPath);
        chmodSync(vaultPath, 0o000);
        const v = new Vault({});
        try {
            let thrown: unknown;
            try { v.tryRead(vaultPath); } catch (e) { thrown = e; }
            assert(thrown instanceof Error && 'code' in thrown);
            assert.equal((thrown as NodeJS.ErrnoException).code, 'EACCES');
        } finally {
            chmodSync(vaultPath, 0o644);
        }
    });

    it('tryRead re-throws non-node errors (e.g. malformed JSON)', () => {
        const vaultPath = join(tmpDir, 'bad-json.vault.json');
        writeFileSync(vaultPath, '{ not valid json }');
        const v = new Vault({});
        assert.throws(() => v.tryRead(vaultPath), SyntaxError);
    });

    it('persists secrets sorted by key', () => {
        const vaultPath = join(tmpDir, 'sorted.vault.json');
        const v = new Vault({ privateKey: privateKeyPem });
        v.replace('z', '1');
        v.replace('a', '2');
        v.replace('m', '3');
        v.write(vaultPath);

        const parsed = JSON.parse(readFileSync(vaultPath, 'utf8'));
        const keys = Object.keys(parsed.secrets);
        assert.deepEqual(keys, [...keys].sort());
    });
});

describe('Vault.toJSON', () => {
    it('returns null for publicKey when no key is set', () => {
        const v = new Vault({});
        const json = v.toJSON();
        assert.strictEqual(json.publicKey, null);
    });

    it('returns the public key as a PEM string', () => {
        const v = new Vault({ privateKey: privateKeyPem });
        const json = v.toJSON();
        assert(json.publicKey);
        assert.match(json.publicKey, /BEGIN PUBLIC KEY/);
    });

    it('includes all stored secrets', () => {
        const v = new Vault({});
        v.load({ x: '1', y: '2' });
        const json = v.toJSON();
        assert.deepEqual(Object.keys(json.secrets).sort(), ['x', 'y']);
    });
});

describe('Vault.set / Vault.replace', () => {
    it('set inserts a new encrypted key', () => {
        const v = new Vault({ privateKey: privateKeyPem });
        v.set('token', 'abc123');
        assert(v.has('token'));
    });

    it('set throws when the key already exists', () => {
        const v = new Vault({ privateKey: privateKeyPem });
        v.replace('existing', 'value');
        assert.throws(() => v.set('existing', 'new'), /use .replace\(\) instead/);
    });

    it('set throws when no public key is available', () => {
        const v = new Vault({});
        assert.throws(() => v.set('k', 'v'), /Public key is required/);
    });

    it('set returns this for chaining', () => {
        const v = new Vault({ privateKey: privateKeyPem });
        const result = v.set('k', 'v');
        assert.strictEqual(result, v);
    });

    it('replace inserts a new key', () => {
        const v = new Vault({ privateKey: privateKeyPem });
        v.replace('new-key', 'value');
        assert(v.has('new-key'));
    });

    it('replace overwrites an existing key without throwing', () => {
        const v = new Vault({ privateKey: privateKeyPem });
        v.replace('k', 'first');
        assert.doesNotThrow(() => v.replace('k', 'second'));
        assert(v.has('k'));
    });

    it('replace throws when no public key is available', () => {
        const v = new Vault({});
        assert.throws(() => v.replace('k', 'v'), /Public key is required/);
    });

    it('replace returns this for chaining', () => {
        const v = new Vault({ privateKey: privateKeyPem });
        const result = v.replace('k', 'v');
        assert.strictEqual(result, v);
    });

    it('get decrypts a value written by set/replace', () => {
        const v = new Vault({ privateKey: privateKeyPem });
        v.replace('secret', 'my-plaintext');
        expect(v.get('secret')).eq('my-plaintext');
    });
});

describe('Vault.init', () => {
    it('creates the vault file on disk', () => {
        const vaultPath = join(tmpDir, 'init.vault.json');
        Vault.init(vaultPath, { privateKey: privateKeyPem });
        assert(existsSync(vaultPath));
    });

    it('returned vault has both keys configured', () => {
        const vaultPath = join(tmpDir, 'init-keys.vault.json');
        const v = Vault.init(vaultPath, { privateKey: privateKeyPem });
        assert(v.canEncrypt);
        assert(v.canDecrypt);
    });

    it('generates a private key file when it does not exist', () => {
        const keyPath = join(tmpDir, 'generated-init.pem');
        const vaultPath = join(tmpDir, 'init-genkey.vault.json');
        assert(!existsSync(keyPath));
        Vault.init(vaultPath, { privateKeyFilename: keyPath });
        assert(existsSync(keyPath));
        assert(existsSync(vaultPath));
    });

    it('uses an existing private key file without regenerating', () => {
        const keyPath = join(tmpDir, 'existing-init.pem');
        writeFileSync(keyPath, privateKeyPem);
        const vaultPath = join(tmpDir, 'init-existing.vault.json');
        const v = Vault.init(vaultPath, { privateKeyFilename: keyPath });
        assert(v.canDecrypt);
        const keyContent = readFileSync(keyPath, 'utf8');
        assert.equal(keyContent, privateKeyPem);
    });

    it('throws when no key material is provided', () => {
        const vaultPath = join(tmpDir, 'init-nokey.vault.json');
        assert.throws(
            () => Vault.init(vaultPath, {}),
            /privateKey/,
        );
    });

    it('returned vault can immediately write secrets', () => {
        const vaultPath = join(tmpDir, 'init-write.vault.json');
        const v = Vault.init(vaultPath, { privateKey: privateKeyPem });
        v.replace('hello', 'world');
        v.write();
        const v2 = new Vault({
            filename: vaultPath,
            privateKey: privateKeyPem,
        });
        expect(v2.get('hello')).eq('world');
    });
});

describe('Vault.open', () => {
    let keyPath: string;
    let vaultPath: string;

    beforeAll(() => {
        keyPath = join(tmpDir, 'open-priv.pem');
        vaultPath = join(tmpDir, 'open.vault.json');
        writeFileSync(keyPath, privateKeyPem);
        const v = Vault.init(vaultPath, { privateKeyFilename: keyPath });
        v.replace('secret', 'value');
        v.write();
    });

    it('throws when the vault file does not exist', () => {
        assert.throws(
            () => Vault.open(join(tmpDir, 'missing.vault.json'), { privateKeyFilename: keyPath }),
            /does not exist/,
        );
    });

    it('throws when privateKeyFilename is not provided', () => {
        assert.throws(
            () => Vault.open(vaultPath, {}),
            /private key file name is required/,
        );
    });

    it('returns a vault with canDecrypt', () => {
        const v = Vault.open(vaultPath, { privateKeyFilename: keyPath });
        assert(v.canDecrypt);
    });

    it('returned vault loads secrets from the file', () => {
        const v = Vault.open(vaultPath, { privateKeyFilename: keyPath });
        assert(v.has('secret'));
        expect(v.get('secret')).eq('value');
    });

    it('returned vault has canEncrypt', () => {
        const v = Vault.open(vaultPath, { privateKeyFilename: keyPath });
        assert(v.canEncrypt);
    });

    it('throws when private key cannot decrypt (wrong key)', () => {
        const wrongKeyPath = join(tmpDir, 'open-wrong.pem');
        const { privateKey: otherKey } = generateRSAKeyPair();
        writeFileSync(wrongKeyPath, otherKey as string);
        const v = Vault.open(vaultPath, { privateKeyFilename: wrongKeyPath });
        assert.throws(() => v.get('secret'));
    });

    it('throws when the key file is empty (canDecrypt is false)', () => {
        const emptyKeyPath = join(tmpDir, 'open-empty.pem');
        writeFileSync(emptyKeyPath, '');
        assert.throws(
            () => Vault.open(vaultPath, { privateKeyFilename: emptyKeyPath }),
            /check private key/,
        );
    });

    it('opens a vault protected by a passphrase-encrypted private key', () => {
        const passphrase = 'hunter2';
        const encKeyPath = join(tmpDir, 'open-enc.pem');
        const encVaultPath = join(tmpDir, 'open-enc.vault.json');
        const { privateKey: encPem } = generateRSAKeyPair(passphrase);
        writeFileSync(encKeyPath, encPem as string);
        Vault.init(encVaultPath, { privateKeyFilename: encKeyPath, passphrase });
        const v = Vault.open(encVaultPath, {
            privateKeyFilename: encKeyPath,
            passphrase,
        });
        assert(v.canDecrypt);
    });
});

describe('Map interface', () => {
    it('has returns true for loaded keys', () => {
        const v = new Vault({});
        v.load({ key: 'value' });
        assert(v.has('key'));
        assert(!v.has('missing'));
    });

    it('get returns raw value when no private key is set', () => {
        const v = new Vault({});
        v.load({ key: 'raw-value' });
        expect(v.get('key')).eq('raw-value');
    });

    it('get returns undefined for a missing key', () => {
        const v = new Vault({});
        assert.strictEqual(v.get('nonexistent'), undefined);
    });

    it('delete removes an existing key', () => {
        const v = new Vault({});
        v.load({ k: 'v' });
        assert(v.delete('k'));
        assert(!v.has('k'));
    });

    it('delete returns false for a missing key', () => {
        const v = new Vault({});
        assert(!v.delete('nope'));
    });

    it('clear removes all secrets', () => {
        const v = new Vault({});
        v.load({ a: '1', b: '2' });
        v.clear();
        assert.equal(v.size, 0);
    });

    it('size reflects the current entry count', () => {
        const v = new Vault({});
        assert.equal(v.size, 0);
        v.load({ x: '1' });
        assert.equal(v.size, 1);
        v.load({ x: '1', y: '2' });
        assert.equal(v.size, 2);
        v.delete('x');
        assert.equal(v.size, 1);
    });

    it('forEach iterates over all entries', () => {
        const v = new Vault({});
        v.load({ a: '1', b: '2' });
        const collected: [string, string][] = [];
        v.forEach((value, key) => collected.push([key, value]));
        assert.equal(collected.length, 2);
    });

    it('keys() iterates over all keys', () => {
        const v = new Vault({});
        v.load({ foo: 'bar', baz: 'qux' });
        const keys = [...v.keys()];
        assert.deepEqual(keys.sort(), ['baz', 'foo']);
    });

    it('values() iterates over all raw values', () => {
        const v = new Vault({});
        v.load({ a: '1', b: '2' });
        const vals = [...v.values()];
        assert.deepEqual(vals.sort(), ['1', '2']);
    });

    it('entries() and [Symbol.iterator] yield the same pairs', () => {
        const v = new Vault({});
        v.load({ x: '10', y: '20' });
        assert.deepEqual([...v.entries()], [...v]);
    });

    it('[Symbol.toStringTag] returns "Vault"', () => {
        const v = new Vault({});
        assert.equal(v[Symbol.toStringTag], 'Vault');
    });

    it('getOrInsert returns the existing decrypted value without overwriting', () => {
        const v = new Vault({ privateKey: privateKeyPem });
        v.replace('k', 'original');
        expect(v.getOrInsert('k', 'new')).eq('original');
        expect(v.get('k')).eq('original');
    });

    it('getOrInsert inserts, encrypts and returns value when key is absent', () => {
        const v = new Vault({ privateKey: privateKeyPem });
        expect(v.getOrInsert('k', 'default')).eq('default');
        assert(v.has('k'));
        expect(v.get('k')).eq('default');
    });

    it('getOrInsertComputed calls the factory only when key is absent', () => {
        const v = new Vault({ privateKey: privateKeyPem });
        let calls = 0;
        const factory = (key: string) => { calls++; return key + '-val'; };
        expect(v.getOrInsertComputed('k', factory)).eq('k-val');
        expect(v.getOrInsertComputed('k', factory)).eq('k-val');
        assert.equal(calls, 1);
    });
});
