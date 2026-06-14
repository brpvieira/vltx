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
    privateDecrypt  } from 'node:crypto';

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

    #raw: Buffer | null = null;

    constructor(createdOn?: Date, modifiedOn?: Date, raw?: Buffer) {
        this.createdOn = createdOn || new Date();
        this.modifiedOn = modifiedOn || this.createdOn;
        this.#importedOn = new Date();

        if (raw) {
            this.#raw = raw;
        }
    }

    get modified() { return this.modifiedOn > this.#importedOn; }
    getRaw() : Buffer {

        return this.#raw ?? Buffer.alloc(0);
    }

    setRaw(publicKey: KeyObject, data: string): void {
        this.modifiedOn = new Date();
        const payload = Buffer
            .alloc(SALT_LENGTH + Buffer.byteLength(data, 'utf8'));
        const salt = randomBytes(SALT_LENGTH);
        salt.copy(payload, 0);
        Buffer.from(data).copy(payload, SALT_LENGTH);
        this.#raw = publicEncrypt({
            key: publicKey,
            padding: constants.RSA_PKCS1_OAEP_PADDING,
            oaepHash: 'sha256'
        }, payload)
    }

    serialize(): string {
        return rawEntryToString({
            prefix: this.prefix,
            createdOn: this.createdOn,
            modifiedOn: this.modifiedOn,
            raw: this.#raw ?? Buffer.alloc(0)
        });
    }

    decrypt(privateKey: KeyObject, encoding?: BufferEncoding): Buffer | string {
        const decrypted = privateDecrypt({
            key: privateKey,
            padding: constants.RSA_PKCS1_OAEP_PADDING,
            oaepHash: 'sha256'
        }, this.#raw!);
        const buf = Buffer.alloc(decrypted.byteLength - SALT_LENGTH);
        decrypted.copy(buf, 0, SALT_LENGTH);
        if (encoding) {
            return buf.toString(encoding!);
        }
        return buf;
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

/** A vault entry for larger payloads, identified by the `@` prefix. */
export class LargeEntry extends BaseEntry {
    readonly prefix: Prefix = '@';
    readonly type = EntryType.Large;
    static readonly prefix: Prefix = '@';
    static readonly type = EntryType.Large;

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
