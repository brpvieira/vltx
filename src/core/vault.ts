import { readFileSync, writeFileSync } from 'node:fs';
import { KeyObject, privateDecrypt } from 'node:crypto';
import { parsePrivateKey, parsePublicKey, derivePublicKey,
    DEFAULT_PUBLIC_ENCODING } from './rsa.js';
import { unstuffString } from './util.js';

export type PrivateKeyConfig = {
    privateKeyFilename?: string,
    privateKey?: string | KeyObject,
    passphrase?: string,
};

export type VaultConfig = {
    filename?: string,
    publicKey?: string | KeyObject
} & PrivateKeyConfig;

export default class Vault implements Map<string, string> {

    #filename?: string;

    #publicKey?: KeyObject;
    #privateKey?: KeyObject;



    #secrets: Map<string, string> = new Map();

    constructor(opts: VaultConfig) {
        if (opts.filename) {
            this.#filename = opts.filename;
            this.read();
        }

        this.setPrivateKey(opts);

        if (this.#privateKey && !this.#publicKey) {
            this.setPublicKey(derivePublicKey(this.#privateKey));
        }

    }

    setPrivateKey(opts: PrivateKeyConfig): Vault {
        const { privateKey, passphrase, privateKeyFilename } = opts;
        let keyStr: string = '';
        if (privateKey) {
            if (privateKey instanceof KeyObject) {
                this.#privateKey = privateKey;
                return this;
            }
            if (typeof privateKey === 'string') {
                keyStr = privateKey;
            }
        } else if (privateKeyFilename) {
            keyStr = readFileSync(privateKeyFilename, 'utf8');
        }

        if (!keyStr) { return this; }
        this.#privateKey = parsePrivateKey(keyStr, passphrase);
        return this;
    }

    setPublicKey(key: KeyObject): Vault {
        this.#publicKey = key;
        return this;
    }

    get publicKey(): KeyObject | undefined { return this.#publicKey; }

    get canEncrypt(): boolean { return Boolean(this.#publicKey); }

    get canDecrypt(): boolean { return Boolean(this.#privateKey); }


    read(filename?: string): Vault {
        filename = filename || this.#filename;
        if (!filename) {
            throw new Error('No filename available');
        }
        const raw = readFileSync(filename, 'utf8');
        const { publicKey, secrets } = JSON.parse(raw);

        this.setPublicKey(parsePublicKey(publicKey));
        return this.load(secrets);
    }

    write(filename?: string): this {
        filename = filename || this.#filename;
        if (!filename) {
            throw new Error('No filename available');
        }
        const data = JSON.stringify(this, null, 4);
        writeFileSync(filename, data);
        return this;
    }

    load(secrets: { [key: string]: string }) : Vault {
        this.#secrets.clear();
        Object.entries(secrets).forEach(([k, v]) => this.#secrets.set(k, v));
        return this;
    }

    toJSON(): any {
        const publicKey = this.#publicKey ?
        this.#publicKey.export(DEFAULT_PUBLIC_ENCODING) : null;

        const sortedEntries = [...this.entries()]
            .sort(([a], [b]) => a.localeCompare(b));

        return {
            publicKey,
            secrets: Object.fromEntries(sortedEntries)
        };
    }

    // Map interface

    get size(): number { return this.#secrets.size; }

    clear(): void { this.#secrets.clear(); }

    get [Symbol.toStringTag](): string {
        return 'Vault';
    }

    delete(key: string): boolean {
        return this.#secrets.delete(key);
    }

    forEach(callbackfn: (value: string, key: string, map: Map<string, string>) => void,
        thisArg?: any): void {
        this.#secrets.forEach((value, key) =>
        callbackfn.call(thisArg, value, key, this));
    }

    get(key: string): string | undefined {
        const raw = this.#secrets.get(key);
        if (!raw || !this.canDecrypt) { return raw; }
        const unstuffed = unstuffString(raw);
        if (!this.#privateKey) {
            throw new Error('Private key is required to decrypt secrets');
        }
        return privateDecrypt(this.#privateKey, unstuffed).toString('utf8');
    }

    has(key: string): boolean {
        return this.#secrets.has(key);
    }

    set(key: string, value: string): this {
        this.#secrets.set(key, value);
        return this;
    }

    entries(): MapIterator<[string, string]> {
        return this.#secrets.entries();
    }

    keys(): MapIterator<string> {
        return this.#secrets.keys();
    }

    values(): MapIterator<string> {
        return this.#secrets.values();
    }

    getOrInsert(key: string, value: string): string {
        return this.#secrets.getOrInsert(key, value);
    }

    getOrInsertComputed(key: string, callbackfn: (key: string) => string): string {
        return this.#secrets.getOrInsertComputed(key, callbackfn);
    }

    [Symbol.iterator](): MapIterator<[string, string]> {
        return this.#secrets.entries();
    }
}
