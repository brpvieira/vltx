import { readFileSync, writeFileSync } from 'node:fs';
import { KeyObject, privateDecrypt, publicEncrypt } from 'node:crypto';
import { parsePrivateKey, parsePublicKey, derivePublicKey,
    DEFAULT_PUBLIC_ENCODING } from './rsa.js';
import { stuffString, unstuffString } from './util.js';

/** Options for supplying a private key to a {@link Vault}. */
export type PrivateKeyConfig = {
    /** Path to a PEM file containing the private key. */
    privateKeyFilename?: string,
    /** Private key as a PEM string or an already-parsed `KeyObject`. */
    privateKey?: string | KeyObject,
    /** Passphrase used to decrypt an encrypted private key. */
    passphrase?: string,
};

/**
 * Configuration options for constructing a {@link Vault}.
 * Supply `filename` to load an existing vault file on disk.
 * Supply key material via the inherited {@link PrivateKeyConfig} fields or `publicKey`
 * to enable encryption/decryption without loading a file.
 */
export type VaultConfig = {
    /** Path to the vault JSON file to read from and write to. */
    filename?: string,
    /** Public key as a PEM string or `KeyObject`. Used only when no file is loaded. */
    publicKey?: string | KeyObject
} & PrivateKeyConfig;

/**
 * An encrypted key-value store that implements the `Map<string, string>` interface.
 *
 * Secrets are stored as RSA-encrypted strings with added entropy (see {@link stuffString}).
 * Reading a value transparently decrypts it when a private key is available;
 * without a private key the raw (encrypted) value is returned instead.
 *
 * Vault files are persisted as JSON containing the public key and the encrypted secrets map.
 */
export default class Vault implements Map<string, string> {

    #filename?: string;

    #publicKey?: KeyObject;
    #privateKey?: KeyObject;



    #secrets: Map<string, string> = new Map();

    /**
     * Creates a new Vault instance.
     *
     * If `opts.filename` is provided the vault file is read immediately, which
     * also sets the public key embedded in that file.
     * If a private key is provided (via `opts.privateKey` or `opts.privateKeyFilename`)
     * the public key is derived automatically when not already loaded from a file.
     * @param opts - Configuration options including key material and an optional file path.
     */
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

    /**
     * Configures the vault's private key from the supplied options.
     * Accepts a `KeyObject` directly, a PEM string, or a path to a PEM file.
     * Has no effect when none of the key fields are provided.
     * @param opts - Private key material and optional passphrase.
     * @returns `this` for chaining.
     */
    setPrivateKey(opts: PrivateKeyConfig): this {
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

    /**
     * Sets the vault's public key, enabling encryption.
     * @param key - A parsed RSA public `KeyObject`.
     * @returns `this` for chaining.
     */
    setPublicKey(key: KeyObject): this {
        this.#publicKey = key;
        return this;
    }

    /** The vault's public key, or `undefined` if none has been set. */
    get publicKey(): KeyObject | undefined { return this.#publicKey; }

    /** `true` when a public key is available and the vault can encrypt new secrets. */
    get canEncrypt(): boolean { return Boolean(this.#publicKey); }

    /** `true` when a private key is available and the vault can decrypt stored secrets. */
    get canDecrypt(): boolean { return Boolean(this.#privateKey); }


    /**
     * Reads and parses a vault JSON file, replacing the current public key and secrets.
     * @param filename - Path to the vault file. Falls back to the filename supplied at construction.
     * @returns `this` for chaining.
     * @throws {Error} If no filename is available.
     */
    read(filename?: string): this {
        filename = filename || this.#filename;
        if (!filename) {
            throw new Error('No filename available');
        }
        const raw = readFileSync(filename, 'utf8');
        const { publicKey, secrets } = JSON.parse(raw);

        this.setPublicKey(parsePublicKey(publicKey));
        return this.load(secrets);
    }

    /**
     * Serializes the vault (public key + secrets) to a JSON file.
     * @param filename - Destination path. Falls back to the filename supplied at construction.
     * @returns `this` for chaining.
     * @throws {Error} If no filename is available.
     */
    write(filename?: string): this {
        filename = filename || this.#filename;
        if (!filename) {
            throw new Error('No filename available');
        }
        const data = JSON.stringify(this, null, 4);
        writeFileSync(filename, data);
        return this;
    }

    /**
     * Replaces the in-memory secrets map with the provided key-value pairs.
     * Existing entries are cleared before loading.
     * @param secrets - Plain object whose entries are loaded as secrets.
     * @returns `this` for chaining.
     */
    load(secrets: { [key: string]: string }) : this {
        this.#secrets.clear();
        Object.entries(secrets).forEach(([k, v]) => this.#secrets.set(k, v));
        return this;
    }

    /**
     * Returns a plain-object representation of the vault suitable for JSON serialization.
     * Secrets are sorted by key for deterministic output.
     * @returns An object with a PEM `publicKey` string (or `null`) and the `secrets` map.
     */
    toJSON(): { publicKey: string | null; secrets: Record<string, string> } {
        const publicKey = this.#publicKey ?
        this.#publicKey.export(DEFAULT_PUBLIC_ENCODING) as string : null;

        const sortedEntries = [...this.entries()]
            .sort(([a], [b]) => a.localeCompare(b));

        return {
            publicKey,
            secrets: Object.fromEntries(sortedEntries)
        };
    }

    // Map interface

    /** Number of secrets currently stored in the vault. */
    get size(): number { return this.#secrets.size; }

    /** Removes all secrets from the vault. */
    clear(): void { this.#secrets.clear(); }

    get [Symbol.toStringTag](): string {
        return 'Vault';
    }

    /**
     * Removes the secret with the given key.
     * @param key - The key to remove.
     * @returns `true` if the key existed and was removed, `false` otherwise.
     */
    delete(key: string): boolean {
        return this.#secrets.delete(key);
    }

    /**
     * Executes `callbackfn` once for each key-value pair in insertion order.
     * @param callbackfn - Function invoked with `(value, key, map)`.
     * @param thisArg - Value used as `this` inside the callback.
     */
    forEach(callbackfn: (_value: string, _key: string, _map: Map<string, string>) => void,
        thisArg?: unknown): void {
        this.#secrets.forEach((value, key) =>
        callbackfn.call(thisArg, value, key, this));
    }

    /**
     * Returns the value for `key`.
     * When a private key is loaded the stored (encrypted) value is decrypted before being returned.
     * When no private key is available the raw stored string is returned as-is.
     * @param key - The secret key to retrieve.
     * @returns The (decrypted) value, or `undefined` if the key does not exist.
     * @throws {Error} If decryption is attempted but the private key is unexpectedly absent.
     */
    get(key: string): string | undefined {
        const raw = this.#secrets.get(key);
        if (!raw || !this.canDecrypt) { return raw; }
        if (!this.#privateKey) {
            throw new Error('Private key is required to decrypt secrets');
        }
        const decrypted = privateDecrypt(this.#privateKey, Buffer.from(raw, 'base64'))
            .toString('utf8');
        return unstuffString(decrypted);
    }

    /**
     * Returns `true` if a secret with the given key exists in the vault.
     * @param key - The key to look up.
     */
    has(key: string): boolean {
        return this.#secrets.has(key);
    }

    // Encrypts value and stores it; called by set and replace.
    #doSet(key: string, value: string): this {
        if (!this.#publicKey) {
            throw new Error('Public key is required to update the vault');
        }
        const stuffed = stuffString(value);
        const encrypted = publicEncrypt(this.#publicKey, stuffed)
            .toString('base64');
        this.#secrets.set(key, encrypted);
        return this;
    }

    /**
     * Inserts a new encrypted secret under `key`.
     * The plaintext value is RSA-encrypted
     * with the vault's public key before storage.
     * Use {@link replace} to overwrite an existing key.
     * @param key - The secret key.
     * @param value - The plaintext value to encrypt and store.
     * @returns `this` for chaining.
     * @throws {Error} If no public key is available.
     * @throws {Error} If `key` already exists — use {@link replace} to overwrite.
     */
    set(key: string, value: string): this {
        if (this.has(key)) {
            throw new Error('Attempting to replace existing entry through .set(), use .replace() instead');
        }
        return this.#doSet(key, value);
    }

    /**
     * Inserts or overwrites a secret under `key` (upsert).
     * Behaves identically to {@link set} but does not throw when the key already exists,
     * making it safe for both initial population and updates.
     * @param key - The secret key.
     * @param value - The plaintext value to encrypt and store.
     * @returns `this` for chaining.
     * @throws {Error} If no public key is available.
     */
    replace(key: string, value: string): this {
        return this.#doSet(key, value);
    }

    /** Returns an iterator over `[key, value]` pairs in insertion order. */
    entries(): MapIterator<[string, string]> {
        return this.#secrets.entries();
    }

    /** Returns an iterator over the secret keys in insertion order. */
    keys(): MapIterator<string> {
        return this.#secrets.keys();
    }

    /** Returns an iterator over the raw (encrypted) values in insertion order. */
    values(): MapIterator<string> {
        return this.#secrets.values();
    }

    /**
     * Returns the value for `key`, inserting `value` if the key does not yet exist.
     * @param key - The key to look up or insert.
     * @param value - Default value to insert when the key is absent.
     * @returns The existing or newly inserted value.
     */
    getOrInsert(key: string, value: string): string {
        if (!this.has(key)) {
            this.set(key, value);
        }
        return this.get(key) as string;
    }

    /**
     * Returns the value for `key`, inserting the result of `callbackfn(key)` if absent.
     * @param key - The key to look up or insert.
     * @param callbackfn - Factory called with `key` to produce the default value.
     * @returns The existing or newly computed value.
     */
    getOrInsertComputed(key: string, callbackfn: (_key: string) => string): string {
        if (!this.has(key)) {
            this.set(key, callbackfn(key));
        }
        return this.get(key) as string;
    }

    /** Returns an iterator over `[key, value]` pairs, making `Vault` iterable with `for…of`. */
    [Symbol.iterator](): MapIterator<[string, string]> {
        return this.#secrets.entries();
    }
}
