import { assert, describe, it } from 'vitest';
import { derivePublicKey, generateRSAKeyPair, parsePrivateKey,
    parsePublicKey, DEFAULT_PUBLIC_ENCODING, checkKeyPairMatches } from '../../src/core/rsa.js';
import { createPublicKey, KeyObject } from 'node:crypto';

function decodePublicKey(base64Str: string): KeyObject {
    return createPublicKey({
        key: Buffer.from(base64Str, 'base64'),
        ...DEFAULT_PUBLIC_ENCODING
    });
}

function assertPublicKey(key: string | KeyObject) : KeyObject {
    let publicKey: KeyObject;
    if (typeof key === 'string') {
        publicKey = decodePublicKey(key as string);
    } else {
        publicKey = key as KeyObject;
    }
    assert.strictEqual(publicKey.type, 'public');
    assert.strictEqual(publicKey.asymmetricKeyType, 'rsa');
    assert.strictEqual(publicKey.asymmetricKeyDetails?.modulusLength, 4096);
    return publicKey;
}

function assertPrivateKey(key: KeyObject) {
        assert.strictEqual(key.type, 'private');
        assert.strictEqual(key.asymmetricKeyType, 'rsa');
        assert.strictEqual(key.asymmetricKeyDetails?.modulusLength, 4096);
}

describe('RSA', () => {
    it('generates a key pair without a password', () => {
        const { privateKey, publicKey } = generateRSAKeyPair();
        assert.match(privateKey as string, /---BEGIN PRIVATE KEY--/);
        assertPublicKey(publicKey as string);
    });

    it('generates a password-protected key pair', () => {
        const { privateKey, publicKey } = generateRSAKeyPair('foobar');
        assert.match(privateKey as string, /---BEGIN ENCRYPTED PRIVATE KEY--/);
        assertPublicKey(publicKey as string);
    });

    it('parses a public key from a string', () => {
        const { publicKey } = generateRSAKeyPair();
        const parsed = parsePublicKey(publicKey as string);
        assertPublicKey(parsed);
    });

    it('parses a private key from a string', () => {
        const { privateKey } = generateRSAKeyPair();
        const parsed = parsePrivateKey(privateKey as string);
        assertPrivateKey(parsed);
    });

    it('parses an ecrypted private key from a string', () => {
        const { privateKey } = generateRSAKeyPair('foobar');
        const parsed = parsePrivateKey(privateKey as string, 'foobar');
        assertPrivateKey(parsed);
    });

    it('derives the public key given a private key', () => {
        const { privateKey, publicKey } = generateRSAKeyPair();
        const parsed = parsePrivateKey(privateKey as string);
        const derived = derivePublicKey(parsed);
        assert(derived);
        assertPublicKey(derived);
        const exported = derived.export(DEFAULT_PUBLIC_ENCODING).toString('base64');
        assert.deepStrictEqual(publicKey, exported);
    });

    describe('checkKeyPairMatches', () => {
        it('returns true for a matching key pair', () => {
            const { privateKey: privPem, publicKey: pubB64Der } = generateRSAKeyPair();
            assert(checkKeyPairMatches(parsePrivateKey(privPem as string),
                parsePublicKey(pubB64Der as string)));
        });

        it('returns false for a mismatched key pair', () => {
            const { privateKey: privPem } = generateRSAKeyPair();
            const { publicKey: otherPubB64Der } = generateRSAKeyPair();
            assert(!checkKeyPairMatches(parsePrivateKey(privPem as string),
                parsePublicKey(otherPubB64Der as string)));
        });

        it('returns false when sign throws (e.g. public key passed as private)', () => {
            const { publicKey: pubB64Der } = generateRSAKeyPair();
            const pub = parsePublicKey(pubB64Der);
            assert(!checkKeyPairMatches(pub as unknown as ReturnType<typeof parsePublicKey>, pub));
        });
    });
});
