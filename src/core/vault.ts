import { generateKeyPairSync, createPublicKey,
    createPrivateKey } from 'node:crypto';
import type { KeyPairExportResult, RSAKeyPairOptions,
    PrivateKeyExportOptions, PublicKeyExportOptions,
    KeyObject, PrivateKeyInput, PublicKeyInput } from 'node:crypto';

/** Default private key export options: PKCS#8, PEM, no encryption. */
export const DEFAULT_PRIVATE_ENCODING: PrivateKeyExportOptions<'pkcs8'> = {
        type: 'pkcs8',
        format: 'pem'

};

/** Default public key export options: SPKI, PEM. */
export const DEFAULT_PUBLIC_ENCODING: PublicKeyExportOptions<'spki'>  = {
    type: 'spki',
    format: 'pem'
};

/** Default RSA key-pair generation options: 4096-bit modulus with {@link DEFAULT_PRIVATE_ENCODING} and {@link DEFAULT_PUBLIC_ENCODING}. */
export const RSA_OPTIONS: RSAKeyPairOptions = {
    modulusLength: 4096,
    privateKeyEncoding: { ...DEFAULT_PRIVATE_ENCODING },
    publicKeyEncoding: { ...DEFAULT_PUBLIC_ENCODING }
};

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
        ...DEFAULT_PRIVATE_ENCODING
    };

    if (passphrase) {
        Object.assign(privateKeyEncoding, {
            passphrase,
            cipher: 'aes-256-cbc'
        });
    }

    const opts: RSAKeyPairOptions = { ...RSA_OPTIONS, privateKeyEncoding };

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

type DerivePublicKeyInput = PublicKeyInput | string | Buffer | KeyObject;

/**
 * Derives a public key from an existing key object, PEM/DER string, or Buffer.
 * @param input - The source key material to derive the public key from.
 * @returns A `KeyObject` representing the derived public key.
 */
export function derivePublicKey(input: DerivePublicKeyInput): KeyObject {
    return createPublicKey(input);
}
