import { assert, describe, it } from 'vitest';
import { derivePublicKey, encrypt, decrypt, generateRSAKeyPair, parsePrivateKey,
    parsePublicKey, DEFAULT_PUBLIC_ENCODING } from '../../src/core/rsa.js';

describe('RSA', () => {
    it('generates a key pair without a password', () => {
        const { privateKey, publicKey } = generateRSAKeyPair();
        assert.match(privateKey, /---BEGIN PRIVATE KEY--/);
        assert.match(publicKey, /---BEGIN PUBLIC KEY---/);
    });

    it('generates a password-protected key pair', () => {
        const { privateKey, publicKey } = generateRSAKeyPair('foobar');
        assert.match(privateKey, /---BEGIN ENCRYPTED PRIVATE KEY--/);
        assert.match(publicKey, /---BEGIN PUBLIC KEY---/);
    });

    it('parses a public key from a string', () => {
        const { publicKey } = generateRSAKeyPair();
        const parsed = parsePublicKey(publicKey);
        assert(parsed);
        assert.deepStrictEqual(parsed.type, 'public');
        assert.deepStrictEqual(parsed.asymmetricKeyType, 'rsa');
        assert.deepStrictEqual(parsed.asymmetricKeyDetails?.modulusLength, 4096);
    });

    it('parses a private key from a string', () => {
        const { privateKey } = generateRSAKeyPair();
        const parsed = parsePrivateKey(privateKey);
        assert(parsed);
        assert.deepStrictEqual(parsed.type, 'private');
        assert.deepStrictEqual(parsed.asymmetricKeyType, 'rsa');
        assert.deepStrictEqual(parsed.asymmetricKeyDetails?.modulusLength, 4096);
    });

    it('parses an ecrypted private key from a string', () => {
        const { privateKey } = generateRSAKeyPair('foobar');
        const parsed = parsePrivateKey(privateKey, 'foobar');
        assert(parsed);
        assert.deepStrictEqual(parsed.type, 'private');
        assert.deepStrictEqual(parsed.asymmetricKeyType, 'rsa');
        assert.deepStrictEqual(parsed.asymmetricKeyDetails?.modulusLength, 4096);
    });

    it('derives the public key given a private key', () => {
        const { privateKey, publicKey } = generateRSAKeyPair();
        const parsed = parsePrivateKey(privateKey);
        const derived = derivePublicKey(parsed);
        assert(derived);
        assert.deepStrictEqual(derived.type, 'public');
        assert.deepStrictEqual(derived.asymmetricKeyType, 'rsa');
        assert.deepStrictEqual(derived.asymmetricKeyDetails?.modulusLength, 4096);
        const exported = derived.export(DEFAULT_PUBLIC_ENCODING).toString('utf8');
        assert.deepStrictEqual(publicKey, exported);
    });

    describe('encrypt and decrypt', () => {
        const { privateKey: privPem, publicKey: pubPem } = generateRSAKeyPair();
        const pubKey = parsePublicKey(pubPem);
        const privKey = parsePrivateKey(privPem);

        it('round-trips a plaintext string', () => {
            const plaintext = 'hello vault';
            const ciphertext = encrypt(pubKey, plaintext);
            const decrypted = decrypt(privKey, ciphertext);
            assert.strictEqual(decrypted.toString('utf8'), plaintext);
        });

        it('produces different ciphertext on each call due to OAEP randomness', () => {
            const ct1 = encrypt(pubKey, 'same input');
            const ct2 = encrypt(pubKey, 'same input');
            assert.notDeepEqual(ct1, ct2);
        });

        it('throws when decrypting with the wrong private key', () => {
            const { privateKey: otherPrivPem } = generateRSAKeyPair();
            const otherPrivKey = parsePrivateKey(otherPrivPem);
            const ciphertext = encrypt(pubKey, 'hello');
            assert.throws(() => decrypt(otherPrivKey, ciphertext));
        });
    });
});
