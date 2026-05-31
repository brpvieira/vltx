import { generateKeyPairSync, createPublicKey,
    createPrivateKey } from 'node:crypto';
import type { KeyPairExportResult, RSAKeyPairOptions,
    PrivateKeyExportOptions, PublicKeyExportOptions,
    KeyObject, PrivateKeyInput } from 'node:crypto';

/**
 * Generates a 4096-bit RSA key pair in PEM format.
 * The private key is encoded as PKCS#8; if a passphrase is provided it is
 * encrypted with AES-256-CBC.
 * @param passphrase - Optional passphrase to encrypt the private key.
 * @returns An object with `publicKey` and `privateKey` PEM strings.
 */
export function generateRSAKeyPair(passphrase?: string):
    KeyPairExportResult<RSAKeyPairOptions> {
    const privateKeyEncoding: PrivateKeyExportOptions<'pkcs8'> = {
        type: 'pkcs8',
        format: 'pem'
    }

    if (passphrase) {
        Object.assign(privateKeyEncoding, {
            passphrase,
            cipher: 'aes-256-cbc'
        });
    }

    const publicKeyEncoding: PublicKeyExportOptions<'spki'> = {
        type: 'spki',
        format: 'pem'
    };

    const opts: RSAKeyPairOptions = {
        modulusLength: 4096,
        publicKeyEncoding,
        privateKeyEncoding
    };

    return generateKeyPairSync('rsa', opts);
}

/**
 * Parses a PEM-encoded public key.
 * @param str - PEM string containing the public key.
 * @returns A `KeyObject` representing the public key.
 */
export function parsePublicKey(str: string): KeyObject {
    return createPublicKey(str);
}

/**
 * Parses a PEM-encoded private key.
 * @param str - PEM string containing the private key.
 * @param passphrase - Optional passphrase if the private key is encrypted.
 * @returns A `KeyObject` representing the private key.
 */
export function parsePrivateKey(str: string, passphrase?: string): KeyObject {
    const key: PrivateKeyInput = {
        key: str
    };
    if (passphrase) {
        Object.assign(key, { passphrase });
    }
    return createPrivateKey(key);
}
