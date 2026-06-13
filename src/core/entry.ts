import { type KeyObject, randomBytes, publicEncrypt, constants,
    privateDecrypt  } from 'node:crypto';

const SALT_LENGTH : number = 16 as const;


export enum EntryType {
    Secret = 'Secret',
    File = 'File'
}

export const PREFIX_TO_TYPE = {
    '$': EntryType.Secret,
    '@': EntryType.File
} as const;

export type Prefix = keyof typeof PREFIX_TO_TYPE;

type RawEntry = {
    prefix: Prefix,
    createdOn: Date,
    modifiedOn: Date,
    raw: Buffer
};

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

export interface IEntry {
    readonly type: EntryType;
    readonly prefix: Prefix;
    readonly createdOn: Date;
    modifiedOn: Date;

    getRaw() : Buffer;
    setRaw(publicKey: KeyObject, value: string): void;

    decrypt(privateKey: KeyObject, encoding?: BufferEncoding): Buffer | string;
    serialize(): string;
}

export interface EntryClass<T extends IEntry = IEntry> {
    readonly prefix: Prefix;
    readonly type: EntryType;
    parse(base64Str: string): T;
}

export abstract class BaseEntry implements IEntry {
    abstract readonly type: EntryType;
    abstract readonly prefix: Prefix;
    readonly createdOn: Date;
    modifiedOn: Date;
    #raw: Buffer | null = null;

    constructor(createdOn?: Date, modifiedOn?: Date, raw?: Buffer) {
        this.createdOn = createdOn || new Date();
        this.modifiedOn = modifiedOn || this.createdOn;
        if (raw) {
            this.#raw = raw;
        }
    }

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

export class SecretEntry extends BaseEntry {
    readonly prefix: Prefix = '$';
    readonly type = EntryType.Secret;
    static parse(base64Str: string) : SecretEntry {
        const { createdOn, modifiedOn, raw } = getRawEntry(base64Str);
        return new SecretEntry(createdOn, modifiedOn, raw);
    }
}
