/**
 * Entry types for the vault, with RSA-OAEP-SHA-256 encryption and binary serialization.
 *
 * Each entry is a self-describing record: a 1-byte ASCII prefix, two 8-byte
 * big-endian millisecond timestamps (created/modified), and an RSA-OAEP
 * ciphertext payload prepended with a 16-byte random salt. Entries are
 * base64-encoded for storage in the vault JSON file.
 * @module
 */
import { type KeyObject, randomBytes, publicEncrypt, constants,
    privateDecrypt,
    createCipheriv, createDecipheriv} from 'node:crypto';

const SALT_LENGTH : number = 16 as const;


export enum EntryType {
    Secret = 'Secret',
    Large = 'Large'
}

export const PREFIX_TO_TYPE = {
    '$': EntryType.Secret,
    '@': EntryType.Large
} as const;

export type Prefix = keyof typeof PREFIX_TO_TYPE;

type RawEntry = {
    prefix: Prefix,
    createdOn: Date,
    modifiedOn: Date,
    raw: Buffer
};

/**
 * Parses a base64-encoded vault entry string into its constituent fields.
 * @param str - Base64 string produced by {@link rawEntryToString}.
 * @returns A {@link RawEntry} with the prefix byte, timestamps, and raw payload.
 */
export function getRawEntry(str: string) : RawEntry {
    const buf = Buffer.from(str, 'base64');
    const raw = Buffer.alloc(buf.byteLength - 17);
    buf.copy(raw, 0, 17);
    return {
        prefix: buf.toString('utf8', 0, 1) as Prefix,
        createdOn: new Date(Number(buf.readBigInt64BE(1))),
        modifiedOn: new Date(Number(buf.readBigInt64BE(9))),
        raw
    };
}


/**
 * Serializes a {@link RawEntry} to a base64 string for storage.
 * Wire format: `[1-byte prefix][8-byte createdOn ms BE][8-byte modifiedOn ms BE][payload]`.
 * @param rawEntry - The raw entry to serialize.
 * @returns A base64-encoded string.
 */
export function rawEntryToString(rawEntry: RawEntry) :string {
    const pBuf = Buffer.from(rawEntry.prefix);
    const tsLen = 8;
    const cLen = rawEntry.raw.byteLength || 0;
    const payload = Buffer.alloc(pBuf.byteLength + 2 * tsLen + cLen);
    pBuf.copy(payload, 0);
    payload.writeBigInt64BE(BigInt(rawEntry.createdOn.getTime()),
        pBuf.byteLength);
    payload.writeBigInt64BE(BigInt(rawEntry.modifiedOn.getTime()),
        pBuf.byteLength + tsLen);
    rawEntry.raw.copy(payload, pBuf.byteLength + 2 * tsLen);
    return payload.toString('base64');
}

/**
 * Encrypts `data` with RSA-OAEP-SHA-256, prepending a 16-byte random salt so
 * that identical plaintexts produce distinct ciphertexts.
 * @param publicKey - The RSA public key to encrypt with.
 * @param data - The plaintext to encrypt, as a Buffer or UTF-8 string.
 * @returns The RSA ciphertext as a Buffer.
 */
export function rsaEncrypt(publicKey: KeyObject,
    data: Buffer | string): Buffer {

    const dataBuf = typeof data === 'string' ? Buffer.from(data, 'utf8') :
        data;
    const payload = Buffer
    .alloc(SALT_LENGTH + dataBuf.byteLength);
    const salt = randomBytes(SALT_LENGTH);
    salt.copy(payload, 0);
    dataBuf.copy(payload, SALT_LENGTH);
    return publicEncrypt({
        key: publicKey,
        padding: constants.RSA_PKCS1_OAEP_PADDING,
        oaepHash: 'sha256'
    }, payload)
}

/**
 * Decrypts an RSA-OAEP-SHA-256 ciphertext and strips the 16-byte random salt
 * prepended by {@link BaseEntry#setRaw}.
 * @param raw - The RSA ciphertext buffer.
 * @param privateKey - The RSA private key matching the public key used to encrypt.
 * @returns The original plaintext as a Buffer, with the leading salt removed.
 */
export function rsaDecrypt(raw: Buffer, privateKey: KeyObject): Buffer {
    const decrypted = privateDecrypt({
        key: privateKey,
        padding: constants.RSA_PKCS1_OAEP_PADDING,
        oaepHash: 'sha256'
    }, raw);
    const buf = Buffer.alloc(decrypted.byteLength - SALT_LENGTH);
    decrypted.copy(buf, 0, SALT_LENGTH);
    return buf
}

type AESEnvelope = {
    rsaEncryptedKey: Buffer, // 512 bytes
    iv: Buffer, // 12 bytes
    authTag: Buffer, // 16 bytes
    cipher: Buffer // variable length
};

/**
 * Serializes an {@link AESEnvelope} into a single contiguous Buffer.
 *
 * Wire layout: `[512-byte rsaEncryptedKey][12-byte iv][16-byte authTag][ciphertext]`.
 * @param payload - The AES envelope to serialize.
 * @returns A Buffer containing all envelope fields concatenated in declaration order.
 */
export function wrapAESPayload(payload: AESEnvelope): Buffer {
    const totalLength: number = Object.values(payload)
        .reduce((acc, b) => acc + b.byteLength, 0);
    return Buffer.concat(Object.values(payload), totalLength);
}

/**
 * Encrypts `payload` with AES-256-GCM using a freshly generated random key and
 * IV, then RSA-wraps the AES key via {@link rsaEncrypt}.
 * @param publicKey - The RSA public key used to wrap the AES key.
 * @param payload - The UTF-8 plaintext to encrypt.
 * @returns An {@link AESEnvelope} with the RSA-wrapped key, IV, authentication
 *   tag, and ciphertext.
 */
export function aesEncrypt(publicKey: KeyObject, payload: string): AESEnvelope {
    const aesKey = randomBytes(32);
    const iv = randomBytes(12);
    const gcm = createCipheriv('aes-256-gcm', aesKey, iv);
    const cipher = Buffer.concat([
        gcm.update(payload, 'utf8'),
        gcm.final()
    ]);
    const authTag = gcm.getAuthTag();
    return {
        rsaEncryptedKey: rsaEncrypt(publicKey, aesKey),
        iv,
        authTag,
        cipher
    };
}

/**
 * Decrypts an AES-256-GCM ciphertext from an {@link AESEnvelope} using the
 * supplied raw AES key. Throws if the authentication tag does not match.
 * @param aesKey - The 32-byte AES key (already RSA-decrypted).
 * @param payload - The {@link AESEnvelope} containing the IV, authentication
 *   tag, and ciphertext.
 * @param encoding - Optional encoding; when provided the decrypted bytes are
 *   returned as a string instead of a Buffer.
 * @returns The plaintext as a `Buffer`, or as a string when `encoding` is given.
 */
export function aesDecrypt(aesKey: Buffer, payload: AESEnvelope,
    encoding?: BufferEncoding) : Buffer | string {

    const decipher = createDecipheriv(
        'aes-256-gcm',
        aesKey,
        payload.iv
    );

    decipher.setAuthTag(payload.authTag);

    const decrypted = Buffer.concat([
        decipher.update(payload.cipher),
        decipher.final()]
    );

    if (encoding) {
        return decrypted.toString(encoding);
    }

    return decrypted;
}


/**
 * Parses a contiguous Buffer back into an {@link AESEnvelope}.
 *
 * Inverse of {@link wrapAESPayload}. Expects the wire layout produced by that function.
 * @param buf - A Buffer produced by {@link wrapAESPayload}.
 * @returns The deserialized {@link AESEnvelope}.
 */
export function unwrapAESPayload(buf: Buffer): AESEnvelope {
    return {
        rsaEncryptedKey: buf.subarray(0, 512),
        iv: buf.subarray(512, 524), // 12 bytes
        authTag: buf.subarray(524, 540), // 16 bytes
        cipher: buf.subarray(540)
    };
}

/**
 * Public interface for all vault entries.
 *
 * Entries carry an RSA-encrypted payload and expose methods to re-encrypt
 * ({@link IEntry#setRaw}) and decrypt ({@link IEntry#decrypt}) it, plus
 * round-trip serialization via {@link IEntry#serialize}.
 */
export interface IEntry {
    readonly type: EntryType;
    readonly prefix: Prefix;
    readonly createdOn: Date;
    modifiedOn: Date;
    modified: boolean;

    getRaw() : Buffer;
    setRaw(publicKey: KeyObject, value: string): void;

    decrypt(privateKey: KeyObject, encoding?: BufferEncoding): Buffer | string;
    serialize(): string;
}

/**
 * Static-side interface for entry classes, enabling type-safe prefix-based
 * dispatch in {@link parseEntry}.
 */
export interface EntryClass<T extends IEntry = IEntry> {
    readonly prefix: Prefix;
    readonly type: EntryType;
    parse(base64Str: string): T;
}

/**
 * Abstract base for all vault entry types.
 *
 * Manages the encrypted payload and implements the shared RSA-OAEP-SHA-256
 * encrypt/decrypt cycle. A 16-byte random salt is prepended to each plaintext
 * before encryption so that identical values produce distinct ciphertexts.
 * Subclasses must declare their own {@link IEntry#prefix} and {@link IEntry#type}.
 */
export abstract class BaseEntry implements IEntry {
    abstract readonly type: EntryType;
    abstract readonly prefix: Prefix;
    readonly createdOn: Date;
    modifiedOn: Date;
    readonly #importedOn: Date;

    protected raw: Buffer | null = null;

    constructor(createdOn?: Date, modifiedOn?: Date, raw?: Buffer) {
        this.createdOn = createdOn || new Date();
        this.modifiedOn = modifiedOn || this.createdOn;
        this.#importedOn = new Date();

        if (raw) {
            this.raw = raw;
        }
    }

    get modified() { return this.modifiedOn > this.#importedOn; }
    getRaw() : Buffer {

        return this.raw ?? Buffer.alloc(0);
    }

    setRaw(publicKey: KeyObject, data: string): void {
        this.modifiedOn = new Date();
        this.raw = rsaEncrypt(publicKey, data);
    }

    serialize(): string {
        return rawEntryToString({
            prefix: this.prefix,
            createdOn: this.createdOn,
            modifiedOn: this.modifiedOn,
            raw: this.raw ?? Buffer.alloc(0)
        });
    }

    decrypt(privateKey: KeyObject, encoding?: BufferEncoding): Buffer | string {
        const decrypted = rsaDecrypt(this.raw!, privateKey);
        if (encoding) {
            return decrypted.toString(encoding!);
        }
        return decrypted;
    }

}

/** A vault entry for short secrets (≤ {@link MAX_SECRET_BYTES} UTF-8 bytes), identified by the `$` prefix. */
export class SecretEntry extends BaseEntry {
    readonly prefix: Prefix = '$';
    readonly type = EntryType.Secret;
    static readonly prefix: Prefix = '$';
    static readonly type = EntryType.Secret;

    static parse(base64Str: string) : SecretEntry {
        const { createdOn, modifiedOn, raw } = getRawEntry(base64Str);
        return new SecretEntry(createdOn, modifiedOn, raw);
    }
}

/**
 * A vault entry for larger payloads, identified by the `@` prefix.
 *
 * Uses hybrid encryption: the plaintext is AES-256-GCM encrypted with
 * a fresh random key, and that key is RSA-OAEP-SHA-256 wrapped. The
 * serialized payload follows the {@link AESEnvelope} wire layout
 * produced by {@link wrapAESPayload}.
 */
export class LargeEntry extends BaseEntry {
    readonly prefix: Prefix = '@';
    readonly type = EntryType.Large;
    static readonly prefix: Prefix = '@';
    static readonly type = EntryType.Large;

    /**
     * Encrypts `data` with AES-256-GCM using a fresh random key, then
     * RSA-OAEP-SHA-256 wraps that key and stores the serialized
     * {@link AESEnvelope} as the raw payload.
     * @param publicKey - RSA public key used to wrap the AES key.
     * @param data - UTF-8 plaintext to encrypt.
     */
    override setRaw(publicKey: KeyObject, data: string): void {
        this.modifiedOn = new Date();
        const aesPayload = aesEncrypt(publicKey, data);
        this.raw = wrapAESPayload(aesPayload);
    }

    /**
     * Unwraps the RSA-encrypted AES key with `privateKey`, then
     * decrypts the AES-256-GCM ciphertext. Throws if the GCM
     * authentication tag does not match.
     * @param privateKey - RSA private key matching the one used in
     *   {@link LargeEntry#setRaw}.
     * @param encoding - Optional encoding; returns a string when set,
     *   Buffer otherwise.
     * @returns Plaintext as a `Buffer`, or as a string when `encoding`
     *   is given.
     * @throws {Error} If the GCM auth tag fails or `privateKey` does
     *   not match.
     */
    override decrypt(privateKey: KeyObject, encoding?: BufferEncoding): Buffer | string {
        const aesPayload = unwrapAESPayload(this.raw!);
        const aesKey = rsaDecrypt(aesPayload.rsaEncryptedKey, privateKey);
        return aesDecrypt(aesKey, aesPayload, encoding);
    }

    /**
     * Parses a base64-encoded vault entry into a {@link LargeEntry}.
     * @param base64Str - A serialized entry from
     *   {@link BaseEntry#serialize}.
     * @returns A new {@link LargeEntry} with the parsed payload.
     */
    static parse(base64Str: string) : LargeEntry {
        const { createdOn, modifiedOn, raw } = getRawEntry(base64Str);
        return new LargeEntry(createdOn, modifiedOn, raw);
    }
}

export type AnyEntry =
    | SecretEntry
    | LargeEntry;

const ENTRY_CLASSES = [
  SecretEntry,
  LargeEntry
] as const satisfies readonly EntryClass<AnyEntry>[];

const BY_PREFIX: ReadonlyMap<Prefix, EntryClass<AnyEntry>> = new Map(
  ENTRY_CLASSES.map((c) => [c.prefix, c] as const),
);

/**
 * Parses a base64-encoded vault entry and returns the appropriate concrete
 * instance based on the prefix byte.
 * @param base64Str - A serialized entry produced by {@link BaseEntry#serialize}.
 * @returns A concrete {@link AnyEntry} instance.
 * @throws {Error} If the prefix byte does not match any registered entry type.
 */
export function parseEntry(base64Str: string) : AnyEntry {
    const prefix = Buffer.from(base64Str, 'base64').toString('utf8', 0, 1);
    const cls = BY_PREFIX.get(prefix as Prefix);
    if (!cls) {
        throw new Error(`Unknown entry type: ${prefix}`);
    }
    return cls.parse(base64Str);
}
