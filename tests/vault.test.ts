import { assert, describe, it } from 'vitest';
import { generateRSAKeyPair, parsePrivateKey, parsePublicKey } from '../src/core/vault.js';

describe('vault', () => {
    it('generates a RSA key pair without a password', () => {
        const { privateKey, publicKey } = generateRSAKeyPair();
        assert.match(privateKey, /---BEGIN PRIVATE KEY--/);
        assert.match(publicKey, /---BEGIN PUBLIC KEY---/);
    });

    it('generates a password-protected RSA key pair', () => {
        const { privateKey, publicKey } = generateRSAKeyPair('foobar');
        assert.match(privateKey, /---BEGIN ENCRYPTED PRIVATE KEY--/);
        assert.match(publicKey, /---BEGIN PUBLIC KEY---/);
    });

    it('parses a RSA public key from a string', () => {
        const { publicKey } = generateRSAKeyPair();
        const parsed = parsePublicKey(publicKey);
        assert(parsed);
        assert.deepStrictEqual(parsed.type, 'public');
        assert.deepStrictEqual(parsed.asymmetricKeyType, 'rsa');
        assert.deepStrictEqual(parsed.asymmetricKeyDetails?.modulusLength, 4096);
    });

    it('parses a RSA private key from a string', () => {
        const { privateKey } = generateRSAKeyPair();
        const parsed = parsePrivateKey(privateKey);
        assert(parsed);
        assert.deepStrictEqual(parsed.type, 'private');
        assert.deepStrictEqual(parsed.asymmetricKeyType, 'rsa');
        assert.deepStrictEqual(parsed.asymmetricKeyDetails?.modulusLength, 4096);
    });

    it('parses an ecrypted RSA private key from a string', () => {
        const { privateKey } = generateRSAKeyPair('foobar');
        const parsed = parsePrivateKey(privateKey, 'foobar');
        assert(parsed);
        assert.deepStrictEqual(parsed.type, 'private');
        assert.deepStrictEqual(parsed.asymmetricKeyType, 'rsa');
        assert.deepStrictEqual(parsed.asymmetricKeyDetails?.modulusLength, 4096);
    });
});
