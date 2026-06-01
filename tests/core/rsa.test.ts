import { assert, describe, it } from 'vitest';
import { derivePublicKey, generateRSAKeyPair, parsePrivateKey,
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
});
