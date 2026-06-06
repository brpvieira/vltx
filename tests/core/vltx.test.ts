import { assert, beforeAll, describe, expect, it } from 'vitest';
import { chmodSync, existsSync, mkdtempSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import Vltx, { MAX_SECRET_BYTES } from '../../src/core/vltx.js';
import { generateRSAKeyPair, parsePrivateKey, derivePublicKey } from '../../src/core/rsa.js';

let privateKeyPem: string;
let publicKeyPem: string;
let tmpDir: string;

beforeAll(() => {
    const kp = generateRSAKeyPair();
    privateKeyPem = kp.privateKey as string;
    publicKeyPem = kp.publicKey as string;
    tmpDir = mkdtempSync(join(__dirname, '../tmp' , 'test-'));
});

describe('Vltx constructor', () => {
    it('creates an empty vault with no options', () => {
        const v = new Vltx({});
        assert(!v.canEncrypt);
        assert(!v.canDecrypt);
        assert.equal(v.size, 0);
    });

    it('exposes filename via the getter', () => {
        const v = new Vltx({ filename: join(tmpDir, 'getter-test.vault.json') });
        assert.equal(v.filename, join(tmpDir, 'getter-test.vault.json'));
    });

    it('accepts a private key PEM string and derives the public key', () => {
        const v = new Vltx({ privateKey: privateKeyPem });
        assert(v.canDecrypt);
        assert(v.canEncrypt);
        assert(v.publicKey);
        assert.equal(v.publicKey!.type, 'public');
    });

    it('accepts a private key as a KeyObject', () => {
        const keyObj = parsePrivateKey(privateKeyPem);
        const v = new Vltx({ privateKey: keyObj });
        assert(v.canDecrypt);
        assert(v.canEncrypt);
    });

    it('loads a private key from a file path', () => {
        const keyPath = join(tmpDir, 'private.pem');
        writeFileSync(keyPath, privateKeyPem);
        const v = new Vltx({ privateKeyFilename: keyPath });
        assert(v.canDecrypt);
        assert(v.canEncrypt);
    });

    it('loads vault contents from a file when filename is provided', () => {
        const vaultPath = join(tmpDir, 'load.vault.json');
        writeFileSync(vaultPath, JSON.stringify({ publicKey: publicKeyPem, secrets: { foo: 'bar' } }));
        const v = new Vltx({ filename: vaultPath });
        assert(v.canEncrypt);
        assert(v.has('foo'));
    });
});

describe('Vltx.setPrivateKey', () => {
    it('sets a private key from a PEM string', () => {
        const v = new Vltx({});
        v.setPrivateKey({ privateKey: privateKeyPem });
        assert(v.canDecrypt);
    });

    it('sets a private key from a KeyObject', () => {
        const keyObj = parsePrivateKey(privateKeyPem);
        const v = new Vltx({});
        v.setPrivateKey({ privateKey: keyObj });
        assert(v.canDecrypt);
    });

    it('sets a private key from a file path', () => {
        const keyPath = join(tmpDir, 'priv2.pem');
        writeFileSync(keyPath, privateKeyPem);
        const v = new Vltx({});
        v.setPrivateKey({ privateKeyFilename: keyPath });
        assert(v.canDecrypt);
    });

    it('returns this for chaining', () => {
        const v = new Vltx({});
        const result = v.setPrivateKey({ privateKey: privateKeyPem });
        assert.strictEqual(result, v);
    });

    it('is a no-op when no key material is provided', () => {
        const v = new Vltx({});
        v.setPrivateKey({});
        assert(!v.canDecrypt);
    });

    it('is a no-op when privateKey is truthy but not a string or KeyObject', () => {
        const v = new Vltx({});
        v.setPrivateKey({ privateKey: 42 as unknown as string });
        assert(!v.canDecrypt);
    });
});

describe('Vltx.setPublicKey', () => {
    it('sets the public key and enables encryption', () => {
        const pubKeyObj = derivePublicKey(parsePrivateKey(privateKeyPem));
        const v = new Vltx({});
        assert(!v.canEncrypt);
        v.setPublicKey(pubKeyObj);
        assert(v.canEncrypt);
    });

    it('returns this for chaining', () => {
        const pubKeyObj = derivePublicKey(parsePrivateKey(privateKeyPem));
        const v = new Vltx({});
        const result = v.setPublicKey(pubKeyObj);
        assert.strictEqual(result, v);
    });
});

describe('Vltx.load', () => {
    it('populates secrets from a plain object', () => {
        const v = new Vltx({});
        v.load({ a: '1', b: '2' });
        assert.equal(v.size, 2);
        assert(v.has('a'));
        assert(v.has('b'));
    });

    it('replaces existing secrets on each call', () => {
        const v = new Vltx({});
        v.load({ a: '1' });
        v.load({ b: '2' });
        assert(!v.has('a'));
        assert(v.has('b'));
        assert.equal(v.size, 1);
    });

    it('returns this for chaining', () => {
        const v = new Vltx({});
        const result = v.load({ x: 'y' });
        assert.strictEqual(result, v);
    });
});

describe('Vltx.read / Vltx.write', () => {
    it('write throws when no filename is available', () => {
        const v = new Vltx({});
        assert.throws(() => v.write(), /No filename/);
    });

    it('read throws when no filename is available', () => {
        const v = new Vltx({});
        assert.throws(() => v.read(), /No filename/);
    });

    it('round-trips a vault file via write then read', () => {
        const vaultPath = join(tmpDir, 'roundtrip.vault.json');
        const v1 = new Vltx({ privateKey: privateKeyPem });
        v1.replace('hello', 'world');
        v1.write(vaultPath);

        const v2 = new Vltx({ filename: vaultPath });
        assert(v2.canEncrypt);
        assert(v2.has('hello'));
    });

    it('write uses the construction filename when none is passed', () => {
        const vaultPath = join(tmpDir, 'default-write.vault.json');
        // Bootstrap: write the file once so the constructor can read it.
        new Vltx({ privateKey: privateKeyPem }).write(vaultPath);
        const v = new Vltx({ filename: vaultPath });
        v.replace('k', 'v');
        assert.doesNotThrow(() => v.write());
    });

    it('tryRead silently ignores a missing file and returns this', () => {
        const v = new Vltx({});
        const result = v.tryRead(join(tmpDir, 'does-not-exist.vault.json'));
        assert.strictEqual(result, v);
        assert.equal(v.size, 0);
    });

    it('tryRead re-throws non-ENOENT node errors', () => {
        const vaultPath = join(tmpDir, 'no-read-perms.vault.json');
        new Vltx({ privateKey: privateKeyPem }).write(vaultPath);
        chmodSync(vaultPath, 0o000);
        const v = new Vltx({});
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
        const v = new Vltx({});
        assert.throws(() => v.tryRead(vaultPath), SyntaxError);
    });

    it('read throws a friendly error when publicKey is null', () => {
        const vaultPath = join(tmpDir, 'null-pubkey.vault.json');
        writeFileSync(vaultPath, JSON.stringify({ publicKey: null, secrets: {} }));
        const v = new Vltx({});
        assert.throws(() => v.read(vaultPath), /invalid publicKey/);
    });

    it('read throws a friendly error when publicKey is missing', () => {
        const vaultPath = join(tmpDir, 'missing-pubkey.vault.json');
        writeFileSync(vaultPath, JSON.stringify({ secrets: {} }));
        const v = new Vltx({});
        assert.throws(() => v.read(vaultPath), /invalid publicKey/);
    });

    it('read throws a friendly error when secrets is null', () => {
        const vaultPath = join(tmpDir, 'null-secrets.vault.json');
        writeFileSync(vaultPath, JSON.stringify({ publicKey: publicKeyPem, secrets: null }));
        const v = new Vltx({});
        assert.throws(() => v.read(vaultPath), /missing secrets/);
    });

    it('read throws a friendly error when secrets is missing', () => {
        const vaultPath = join(tmpDir, 'missing-secrets.vault.json');
        writeFileSync(vaultPath, JSON.stringify({ publicKey: publicKeyPem }));
        const v = new Vltx({});
        assert.throws(() => v.read(vaultPath), /missing secrets/);
    });

    it('persists secrets sorted by key', () => {
        const vaultPath = join(tmpDir, 'sorted.vault.json');
        const v = new Vltx({ privateKey: privateKeyPem });
        v.replace('z', '1');
        v.replace('a', '2');
        v.replace('m', '3');
        v.write(vaultPath);

        const parsed = JSON.parse(readFileSync(vaultPath, 'utf8'));
        const keys = Object.keys(parsed.secrets);
        assert.deepEqual(keys, [...keys].sort());
    });
});

describe('Vltx.toJSON', () => {
    it('returns null for publicKey when no key is set', () => {
        const v = new Vltx({});
        const json = v.toJSON();
        assert.strictEqual(json.publicKey, null);
    });

    it('returns the public key as a PEM string', () => {
        const v = new Vltx({ privateKey: privateKeyPem });
        const json = v.toJSON();
        assert(json.publicKey);
        assert.match(json.publicKey, /BEGIN PUBLIC KEY/);
    });

    it('includes all stored secrets', () => {
        const v = new Vltx({});
        v.load({ x: '1', y: '2' });
        const json = v.toJSON();
        assert.deepEqual(Object.keys(json.secrets).sort(), ['x', 'y']);
    });
});

describe('Vltx.set / Vltx.replace', () => {
    it('set inserts a new encrypted key', () => {
        const v = new Vltx({ privateKey: privateKeyPem });
        v.set('token', 'abc123');
        assert(v.has('token'));
    });

    it('set throws when the key already exists', () => {
        const v = new Vltx({ privateKey: privateKeyPem });
        v.replace('existing', 'value');
        assert.throws(() => v.set('existing', 'new'), /use .replace\(\) instead/);
    });

    it('set throws when no public key is available', () => {
        const v = new Vltx({});
        assert.throws(() => v.set('k', 'v'), /Public key is required/);
    });

    it('set returns this for chaining', () => {
        const v = new Vltx({ privateKey: privateKeyPem });
        const result = v.set('k', 'v');
        assert.strictEqual(result, v);
    });

    it('replace inserts a new key', () => {
        const v = new Vltx({ privateKey: privateKeyPem });
        v.replace('new-key', 'value');
        assert(v.has('new-key'));
    });

    it('replace overwrites an existing key without throwing', () => {
        const v = new Vltx({ privateKey: privateKeyPem });
        v.replace('k', 'first');
        assert.doesNotThrow(() => v.replace('k', 'second'));
        assert(v.has('k'));
    });

    it('replace throws when no public key is available', () => {
        const v = new Vltx({});
        assert.throws(() => v.replace('k', 'v'), /Public key is required/);
    });

    it('replace returns this for chaining', () => {
        const v = new Vltx({ privateKey: privateKeyPem });
        const result = v.replace('k', 'v');
        assert.strictEqual(result, v);
    });

    it('get decrypts a value written by set/replace', () => {
        const v = new Vltx({ privateKey: privateKeyPem });
        v.replace('secret', 'my-plaintext');
        expect(v.get('secret')).eq('my-plaintext');
    });

    it('set throws when value exceeds MAX_SECRET_BYTES', () => {
        const v = new Vltx({ privateKey: privateKeyPem });
        const oversized = 'a'.repeat(MAX_SECRET_BYTES + 1);
        assert.throws(() => v.set('k', oversized), /maximum secret size/);
    });

    it('replace throws when value exceeds MAX_SECRET_BYTES', () => {
        const v = new Vltx({ privateKey: privateKeyPem });
        const oversized = 'a'.repeat(MAX_SECRET_BYTES + 1);
        assert.throws(() => v.replace('k', oversized), /maximum secret size/);
    });

    it('set accepts a value exactly at MAX_SECRET_BYTES', () => {
        const v = new Vltx({ privateKey: privateKeyPem });
        const atLimit = 'a'.repeat(MAX_SECRET_BYTES);
        assert.doesNotThrow(() => v.set('k', atLimit));
    });

    it('replace accepts a value exactly at MAX_SECRET_BYTES', () => {
        const v = new Vltx({ privateKey: privateKeyPem });
        const atLimit = 'a'.repeat(MAX_SECRET_BYTES);
        assert.doesNotThrow(() => v.replace('k', atLimit));
    });
});

describe('Vltx.init', () => {
    it('creates the vault file on disk', () => {
        const vaultPath = join(tmpDir, 'init.vault.json');
        Vltx.init(vaultPath, { privateKey: privateKeyPem });
        assert(existsSync(vaultPath));
    });

    it('returned vault has both keys configured', () => {
        const vaultPath = join(tmpDir, 'init-keys.vault.json');
        const v = Vltx.init(vaultPath, { privateKey: privateKeyPem });
        assert(v.canEncrypt);
        assert(v.canDecrypt);
    });

    it('generates a private key file when it does not exist', () => {
        const keyPath = join(tmpDir, 'generated-init.pem');
        const vaultPath = join(tmpDir, 'init-genkey.vault.json');
        assert(!existsSync(keyPath));
        Vltx.init(vaultPath, { privateKeyFilename: keyPath });
        assert(existsSync(keyPath));
        assert(existsSync(vaultPath));
        assert.equal(statSync(keyPath).mode & 0o777, 0o600);
    });

    it('uses an existing private key file without regenerating', () => {
        const keyPath = join(tmpDir, 'existing-init.pem');
        writeFileSync(keyPath, privateKeyPem);
        const vaultPath = join(tmpDir, 'init-existing.vault.json');
        const v = Vltx.init(vaultPath, { privateKeyFilename: keyPath });
        assert(v.canDecrypt);
        const keyContent = readFileSync(keyPath, 'utf8');
        assert.equal(keyContent, privateKeyPem);
    });

    it('throws when no key material is provided', () => {
        const vaultPath = join(tmpDir, 'init-nokey.vault.json');
        assert.throws(
            () => Vltx.init(vaultPath, {}),
            /privateKey/,
        );
    });

    it('returned vault can immediately write secrets', () => {
        const vaultPath = join(tmpDir, 'init-write.vault.json');
        const v = Vltx.init(vaultPath, { privateKey: privateKeyPem });
        v.replace('hello', 'world');
        v.write();
        const v2 = new Vltx({
            filename: vaultPath,
            privateKey: privateKeyPem,
        });
        expect(v2.get('hello')).eq('world');
    });
});

describe('Vltx.open', () => {
    let keyPath: string;
    let vaultPath: string;

    beforeAll(() => {
        keyPath = join(tmpDir, 'generic-open-priv.pem');
        vaultPath = join(tmpDir, 'generic-open.vault.json');
        writeFileSync(keyPath, privateKeyPem);
        const v = Vltx.init(vaultPath, { privateKeyFilename: keyPath });
        v.replace('k', 'v');
        v.write();
    });

    it('throws when filename is provided but does not exist', () => {
        assert.throws(
            () => Vltx.open({ filename: join(tmpDir, 'missing.vault.json') }),
            /does not exist/,
        );
    });

    it('does not throw when filename is not provided', () => {
        assert.doesNotThrow(() => Vltx.open({}));
    });

    it('does not throw when filename exists', () => {
        assert.doesNotThrow(() => Vltx.open({ filename: vaultPath }));
    });

    it('returns a vault with canEncrypt when the file contains a public key', () => {
        const v = Vltx.open({ filename: vaultPath });
        assert(v.canEncrypt);
    });

    it('returns a vault with canDecrypt when a private key is supplied', () => {
        const v = Vltx.open({ filename: vaultPath, privateKeyFilename: keyPath });
        assert(v.canDecrypt);
    });

    it('returns a vault without canDecrypt when no private key is supplied', () => {
        const v = Vltx.open({ filename: vaultPath });
        assert(!v.canDecrypt);
    });
});

describe('Vltx.openForReading', () => {
    let keyPath: string;
    let vaultPath: string;

    beforeAll(() => {
        keyPath = join(tmpDir, 'open-priv.pem');
        vaultPath = join(tmpDir, 'open.vault.json');
        writeFileSync(keyPath, privateKeyPem);
        const v = Vltx.init(vaultPath, { privateKeyFilename: keyPath });
        v.replace('secret', 'value');
        v.write();
    });

    it('throws when filename is not provided', () => {
        assert.throws(
            () => Vltx.openForReading({ privateKeyFilename: keyPath }),
            /filename is required/,
        );
    });

    it('throws when the vault file does not exist', () => {
        assert.throws(
            () => Vltx.openForReading({ filename: join(tmpDir, 'missing.vault.json'), privateKeyFilename: keyPath }),
            /does not exist/,
        );
    });

    it('throws when no private key is provided', () => {
        assert.throws(
            () => Vltx.openForReading({ filename: vaultPath }),
            /private key is required/,
        );
    });

    it('returns a vault with canDecrypt', () => {
        const v = Vltx.openForReading({ filename: vaultPath, privateKeyFilename: keyPath });
        assert(v.canDecrypt);
    });

    it('returned vault loads secrets from the file', () => {
        const v = Vltx.openForReading({ filename: vaultPath, privateKeyFilename: keyPath });
        assert(v.has('secret'));
        expect(v.get('secret')).eq('value');
    });

    it('returned vault has canEncrypt', () => {
        const v = Vltx.openForReading({ filename: vaultPath, privateKeyFilename: keyPath });
        assert(v.canEncrypt);
    });

    it('throws when private key cannot decrypt (wrong key)', () => {
        const wrongKeyPath = join(tmpDir, 'open-wrong.pem');
        const { privateKey: otherKey } = generateRSAKeyPair();
        writeFileSync(wrongKeyPath, otherKey as string);
        const v = Vltx.openForReading({ filename: vaultPath, privateKeyFilename: wrongKeyPath });
        assert.throws(() => v.get('secret'));
    });

    it('throws when the key file is empty (canDecrypt is false)', () => {
        const emptyKeyPath = join(tmpDir, 'open-empty.pem');
        writeFileSync(emptyKeyPath, '');
        assert.throws(
            () => Vltx.openForReading({ filename: vaultPath, privateKeyFilename: emptyKeyPath }),
            /check private key/,
        );
    });

    it('opens a vault protected by a passphrase-encrypted private key', () => {
        const passphrase = 'hunter2';
        const encKeyPath = join(tmpDir, 'open-enc.pem');
        const encVaultPath = join(tmpDir, 'open-enc.vault.json');
        const { privateKey: encPem } = generateRSAKeyPair(passphrase);
        writeFileSync(encKeyPath, encPem as string);
        Vltx.init(encVaultPath, { privateKeyFilename: encKeyPath, passphrase });
        const v = Vltx.openForReading({
            filename: encVaultPath,
            privateKeyFilename: encKeyPath,
            passphrase,
        });
        assert(v.canDecrypt);
    });
});

describe('Vltx.openForWriting', () => {
    let keyPath: string;
    let vaultPath: string;

    beforeAll(() => {
        keyPath = join(tmpDir, 'write-priv.pem');
        vaultPath = join(tmpDir, 'write.vault.json');
        writeFileSync(keyPath, privateKeyPem);
        Vltx.init(vaultPath, { privateKeyFilename: keyPath });
    });

    it('throws when filename is not provided', () => {
        assert.throws(
            () => Vltx.openForWriting({}),
            /filename is required/,
        );
    });

    it('throws when the vault file does not exist', () => {
        assert.throws(
            () => Vltx.openForWriting({ filename: join(tmpDir, 'missing.vault.json') }),
            /does not exist/,
        );
    });

    it('returns a vault with canEncrypt', () => {
        const v = Vltx.openForWriting({ filename: vaultPath });
        assert(v.canEncrypt);
    });

    it('returns a vault without canDecrypt', () => {
        const v = Vltx.openForWriting({ filename: vaultPath });
        assert(!v.canDecrypt);
    });

    it('ignores private key material in opts', () => {
        const v = Vltx.openForWriting({ filename: vaultPath, privateKeyFilename: keyPath });
        assert(!v.canDecrypt);
    });

    it('written secrets are readable with the private key', () => {
        const v = Vltx.openForWriting({ filename: vaultPath });
        v.set('writeKey', 'writeValue');
        v.write();
        const r = Vltx.openForReading({ filename: vaultPath, privateKeyFilename: keyPath });
        expect(r.get('writeKey')).eq('writeValue');
    });
});

describe('lock and unlock', () => {
    let keyPath: string;
    let vaultPath: string;

    beforeAll(() => {
        keyPath = join(tmpDir, 'lock-priv.pem');
        vaultPath = join(tmpDir, 'lock.vault.json');
        writeFileSync(keyPath, privateKeyPem);
        const v = Vltx.init(vaultPath, { privateKeyFilename: keyPath });
        v.replace('secret', 'value');
        v.write();
    });

    it('lock removes the private key', () => {
        const v = Vltx.openForReading({ filename: vaultPath, privateKeyFilename: keyPath });
        v.lock();
        assert(!v.canDecrypt);
    });

    it('lock does not affect canEncrypt', () => {
        const v = Vltx.openForReading({ filename: vaultPath, privateKeyFilename: keyPath });
        v.lock();
        assert(v.canEncrypt);
    });

    it('lock does not affect stored secrets', () => {
        const v = Vltx.openForReading({ filename: vaultPath, privateKeyFilename: keyPath });
        v.lock();
        assert(v.has('secret'));
    });

    it('lock returns this for chaining', () => {
        const v = Vltx.openForReading({ filename: vaultPath, privateKeyFilename: keyPath });
        assert.strictEqual(v.lock(), v);
    });

    it('lock on a vault without a private key is a no-op', () => {
        const v = Vltx.openForWriting({ filename: vaultPath });
        v.lock();
        assert(!v.canDecrypt);
    });

    it('unlock loads a private key from a file', () => {
        const v = Vltx.openForWriting({ filename: vaultPath });
        v.unlock({ privateKeyFilename: keyPath });
        assert(v.canDecrypt);
    });

    it('unlock loads a private key from a PEM string', () => {
        const v = Vltx.openForWriting({ filename: vaultPath });
        v.unlock({ privateKey: privateKeyPem });
        assert(v.canDecrypt);
    });

    it('unlock loads a private key from a KeyObject', () => {
        const v = Vltx.openForWriting({ filename: vaultPath });
        v.unlock({ privateKey: parsePrivateKey(privateKeyPem) });
        assert(v.canDecrypt);
    });

    it('unlock enables decryption of existing secrets', () => {
        const v = Vltx.openForWriting({ filename: vaultPath });
        v.unlock({ privateKeyFilename: keyPath });
        expect(v.get('secret')).eq('value');
    });

    it('unlock returns this for chaining', () => {
        const v = Vltx.openForWriting({ filename: vaultPath });
        assert.strictEqual(v.unlock({ privateKeyFilename: keyPath }), v);
    });

    it('unlock with empty opts is a no-op', () => {
        const v = Vltx.openForWriting({ filename: vaultPath });
        v.unlock({});
        assert(!v.canDecrypt);
    });

    it('lock and unlock can be chained', () => {
        const v = Vltx.openForReading({ filename: vaultPath, privateKeyFilename: keyPath });
        v.lock().unlock({ privateKeyFilename: keyPath });
        assert(v.canDecrypt);
    });

    it('unlock derives the public key when none is loaded', () => {
        const v = new Vltx({});
        v.unlock({ privateKey: privateKeyPem });
        assert(v.canEncrypt);
        assert(v.canDecrypt);
    });

    it('unlock does not overwrite an existing public key', () => {
        const v = Vltx.openForWriting({ filename: vaultPath });
        const original = v.publicKey;
        v.unlock({ privateKeyFilename: keyPath });
        assert.strictEqual(v.publicKey, original);
    });
});

describe('Map interface', () => {
    it('has returns true for loaded keys', () => {
        const v = new Vltx({});
        v.load({ key: 'value' });
        assert(v.has('key'));
        assert(!v.has('missing'));
    });

    it('get returns raw value when no private key is set', () => {
        const v = new Vltx({});
        v.load({ key: 'raw-value' });
        expect(v.get('key')).eq('raw-value');
    });

    it('get returns undefined for a missing key', () => {
        const v = new Vltx({});
        assert.strictEqual(v.get('nonexistent'), undefined);
    });

    it('delete removes an existing key', () => {
        const v = new Vltx({});
        v.load({ k: 'v' });
        assert(v.delete('k'));
        assert(!v.has('k'));
    });

    it('delete returns false for a missing key', () => {
        const v = new Vltx({});
        assert(!v.delete('nope'));
    });

    it('clear removes all secrets', () => {
        const v = new Vltx({});
        v.load({ a: '1', b: '2' });
        v.clear();
        assert.equal(v.size, 0);
    });

    it('size reflects the current entry count', () => {
        const v = new Vltx({});
        assert.equal(v.size, 0);
        v.load({ x: '1' });
        assert.equal(v.size, 1);
        v.load({ x: '1', y: '2' });
        assert.equal(v.size, 2);
        v.delete('x');
        assert.equal(v.size, 1);
    });

    it('forEach iterates over all entries', () => {
        const v = new Vltx({});
        v.load({ a: '1', b: '2' });
        const collected: [string, string][] = [];
        v.forEach((value, key) => collected.push([key, value]));
        assert.equal(collected.length, 2);
    });

    it('keys() iterates over all keys', () => {
        const v = new Vltx({});
        v.load({ foo: 'bar', baz: 'qux' });
        const keys = [...v.keys()];
        assert.deepEqual(keys.sort(), ['baz', 'foo']);
    });

    it('values() iterates over all raw values', () => {
        const v = new Vltx({});
        v.load({ a: '1', b: '2' });
        const vals = [...v.values()];
        assert.deepEqual(vals.sort(), ['1', '2']);
    });

    it('entries() and [Symbol.iterator] yield the same pairs', () => {
        const v = new Vltx({});
        v.load({ x: '10', y: '20' });
        assert.deepEqual([...v.entries()], [...v]);
    });

    it('[Symbol.toStringTag] returns "Vltx"', () => {
        const v = new Vltx({});
        assert.equal(v[Symbol.toStringTag], 'Vltx');
    });

    it('getOrInsert returns the existing decrypted value without overwriting', () => {
        const v = new Vltx({ privateKey: privateKeyPem });
        v.replace('k', 'original');
        expect(v.getOrInsert('k', 'new')).eq('original');
        expect(v.get('k')).eq('original');
    });

    it('getOrInsert inserts, encrypts and returns value when key is absent', () => {
        const v = new Vltx({ privateKey: privateKeyPem });
        expect(v.getOrInsert('k', 'default')).eq('default');
        assert(v.has('k'));
        expect(v.get('k')).eq('default');
    });

    it('getOrInsertComputed calls the factory only when key is absent', () => {
        const v = new Vltx({ privateKey: privateKeyPem });
        let calls = 0;
        const factory = (key: string) => { calls++; return key + '-val'; };
        expect(v.getOrInsertComputed('k', factory)).eq('k-val');
        expect(v.getOrInsertComputed('k', factory)).eq('k-val');
        assert.equal(calls, 1);
    });
});
