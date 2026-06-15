/**
 * Core {@link Vltx} class and associated configuration types.
 *
 * A `Vltx` is an encrypted key-value store backed by a JSON file.
 * Short secrets (≤ {@link MAX_SECRET_BYTES} UTF-8 bytes) are stored as
 * RSA-OAEP-SHA-256 encrypted {@link SecretEntry} values. Larger values
 * are stored as {@link LargeEntry} values using hybrid AES-256-GCM
 * encryption with an RSA-wrapped key — chosen automatically at write
 * time. Values are decrypted on demand when a private key is supplied.
 * The class implements the `Map<string, AnyEntry>` interface and exposes
 * static factory methods ({@link Vltx.open}, {@link Vltx.openForReading},
 * {@link Vltx.openForWriting}) plus instance-level key lifecycle
 * helpers ({@link Vltx#lock}, {@link Vltx#unlock}).
 * @module
 */
import { readFileSync, statSync, writeFileSync } from 'node:fs';
import { KeyObject } from 'node:crypto';
import { parsePrivateKey, parsePublicKey, derivePublicKey, generateRSAKeyPair,
    checkKeyPairMatches, DEFAULT_PUBLIC_ENCODING } from './rsa.js';
import { parseEntry, SecretEntry, LargeEntry, type AnyEntry } from './entry.js';

function isNodeError(error: unknown): error is NodeJS.ErrnoException {
    return error instanceof Error && 'code' in error;
}

/** Options for supplying a private key to a {@link Vltx}. */
export type PrivateKeyConfig = {
    /** Path to a PEM file containing the private key. */
    privateKeyFilename?: string | undefined,
    /** Private key as a PEM string or an already-parsed `KeyObject`. */
    privateKey?: string | KeyObject | undefined,
    /** Passphrase used to decrypt an encrypted private key. */
    passphrase?: string | undefined,
};

/**
 * Byte threshold above which values are stored as {@link LargeEntry}
 * (hybrid AES-256-GCM) rather than {@link SecretEntry} (RSA-OAEP-SHA-256).
 * Equal to the RSA-OAEP-SHA-256 plaintext cap for a 4096-bit key
 * (512-byte modulus − 66-byte OAEP overhead − 16-byte random salt).
 */
export const MAX_SECRET_BYTES = 430 as const;

/**
 * Configuration options for constructing a {@link Vltx}.
 * Supply `filename` to load an existing vault file on disk.
 * Supply key material via the inherited {@link PrivateKeyConfig}
 * fields or `publicKey` to enable encryption/decryption without
 * loading a file.
 */
export type VltxConfig = {
    /** Path to the vault JSON file to read from and write to. */
    filename?: string | undefined,
    /**
     * Public key as a PEM string or `KeyObject`. Used only when no
     * file is loaded.
     */
    publicKey?: string | KeyObject | undefined
} & PrivateKeyConfig;


/**
 * Tag function that looks up a secret by key in `vault`.
 *
 * This is the underlying implementation used by {@link Vltx#tagFunction}.
 * Prefer the instance getter for typical use; call this directly only when
 * you need to supply the vault explicitly.
 *
 * @param vault - The vault to read from.
 * @param strings - Template strings array; only `strings[0]` is used as the
 *   lookup key.
 * @param values - Must be empty — interpolation is not supported.
 * @returns The decrypted plaintext value, or an empty string if the key is
 *   absent or the template is empty.
 * @throws {Error} If interpolation values are passed.
 */
export function tagFunction(vault: Vltx, strings: TemplateStringsArray,
     ...values: unknown[]): string {
    if(values?.length > 0)  {
        throw new Error('Interpolation in not allowed.');
    }
    if (!strings[0]) { return ''; }
    return vault.decrypt(strings[0])?.toString('utf8') || '';
}

/**
 * An encrypted key-value store that implements the
 * `Map<string, AnyEntry>` interface.
 *
 * Short secrets (≤ {@link MAX_SECRET_BYTES} UTF-8 bytes) are stored as
 * RSA-OAEP-SHA-256 encrypted {@link SecretEntry} values with a random
 * per-encryption salt. Larger values are stored as {@link LargeEntry}
 * values using hybrid AES-256-GCM encryption. The entry type is chosen
 * automatically at write time.
 * Reading a value transparently decrypts it when a private key is
 * available; without a private key the raw (encrypted) value is
 * returned instead.
 *
 * Vltx files are persisted as JSON containing the public key and
 * the encrypted secrets map.
 */
export default class Vltx implements Map<string, AnyEntry> {

    #filename?: string;
    get filename(): string { return  this.#filename as string; }

    #loaded: boolean = false;
    /** `true` after the vault file has been successfully read and parsed. */
    get loaded() { return this.#loaded; }

    #publicKey?: KeyObject;
    #privateKey?: KeyObject | undefined;



    #secrets: Map<string, AnyEntry> = new Map();

    /**
     * Creates a new Vltx instance.
     *
     * If `opts.filename` is provided the vault file is read
     * immediately, which also sets the public key embedded in that
     * file.
     * If a private key is provided (via `opts.privateKey` or
     * `opts.privateKeyFilename`) the public key is derived
     * automatically when not already loaded from a file.
     * @param opts - Configuration options including key material and
     *   an optional file path.
     */
    constructor(opts: VltxConfig) {
        if (opts.filename) {
            this.#filename = opts.filename;
            this.tryRead();
        }

        this.setPrivateKey(opts);

        if (this.#privateKey && !this.#publicKey) {
            this.setPublicKey(derivePublicKey(this.#privateKey));
        }

    }

    /**
     * Configures the vault's private key from the supplied options.
     * Accepts a `KeyObject` directly, a PEM string, or a path to a
     * PEM file. Has no effect when none of the key fields are
     * provided.
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

    /**
     * `true` when a public key is available and the vault can
     * encrypt new secrets.
     */
    get canEncrypt(): boolean { return Boolean(this.#publicKey); }

    /**
     * `true` when a private key is available and the vault can
     * decrypt stored secrets.
     */
    get canDecrypt(): boolean { return Boolean(this.#privateKey); }


    /**
     * `true` when both a private key and a public key are loaded and they form
     * a matching pair.
     */
    get keyPairMatches(): boolean {
        return checkKeyPairMatches(this.#privateKey!, this.#publicKey!);
    }

    /**
     * Removes the private key, leaving the vault in encrypt-only
     * mode. Useful for limiting the window during which key
     * material is held in memory.
     * @returns `this` for chaining.
     */
    lock(): this {
        this.#privateKey = undefined;
        return this;
    }

    /**
     * Loads a private key into the vault, enabling decryption.
     * When no public key is already loaded, it is derived
     * automatically from the private key. Has no effect when no
     * key fields in `opts` are set.
     * @param opts - Private key material and optional passphrase.
     * @returns `this` for chaining.
     */
    unlock(opts: PrivateKeyConfig): this {
        this.setPrivateKey(opts);
        if (this.#privateKey && !this.#publicKey) {
            this.setPublicKey(derivePublicKey(this.#privateKey));
        }
        return this;
    }

    /**
     * Reads and parses a vault JSON file, replacing the current
     * public key and secrets. Sets {@link loaded} to `true` on
     * success; resets it to `false` at the start of each call.
     * @param filename - Path to the vault file. Falls back to the
     *   filename supplied at construction.
     * @returns `this` for chaining.
     * @throws {Error} If no filename is available.
     * @throws {Error} If the vault file is missing or has an invalid
     *   `publicKey` field.
     * @throws {Error} If the vault file is missing the `secrets`
     *   field.
     */
    read(filename?: string): this {
        filename = filename || this.#filename;
        if (!filename) {
            throw new Error('No filename available');
        }
        this.#loaded = false;
        const raw = readFileSync(filename, 'utf8');
        const { publicKey, secrets } = JSON.parse(raw);

        if (!publicKey || typeof publicKey !== 'string') {
            throw new Error('Vault file is missing or has an invalid publicKey');
        }
        if (!secrets || typeof secrets !== 'object') {
            throw new Error('Vault file is missing secrets');
        }

        this.setPublicKey(parsePublicKey(publicKey));
        this.load(secrets);
        this.#loaded = true;
        return this;
    }

    /**
     * Reads a vault file like {@link read}, but silently ignores the
     * file not existing (`ENOENT`). All other errors are re-thrown.
     * @param filename - Path to the vault file. Falls back to the
     *   filename supplied at construction.
     * @returns `this` for chaining.
     * @throws {Error} For any filesystem error other than `ENOENT`.
     */
    tryRead(filename?: string): this {
        try {
            this.read(filename);
        } catch (err: unknown) {
            if (isNodeError(err)) {
                if (err.code !== 'ENOENT') {
                    throw err;
                }
                return this;
            }
            throw err;
        }
        return this;
    }

    /**
     * Serializes the vault (public key + secrets) to a JSON file.
     * @param filename - Destination path. Falls back to the filename
     *   supplied at construction.
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
     * Replaces the in-memory secrets map with the provided key-value
     * pairs. Existing entries are cleared before loading.
     * @param secrets - Plain object whose entries are loaded as
     *   secrets.
     * @returns `this` for chaining.
     */
    load(secrets: { [key: string]: string }) : this {
        this.#secrets.clear();
        Object.entries(secrets).forEach(([k, v]) => {
            const entry = parseEntry(v);
            this.#secrets.set(k, entry);
        });
        return this;
    }

    decrypt(key: string): Buffer | string | undefined {
        if (!this.canDecrypt) {
            throw Error('A private key is needed to read secrets.');
        }
        const entry = this.get(key);
        if (!entry) { return undefined; }
        return entry.decrypt(this.#privateKey!);
    }

    /**
     * Returns a plain-object representation of the vault suitable for JSON
     * serialization. Secrets are serialized to base64 and sorted by key for
     * deterministic output.
     * @returns An object with a base64-encoded DER `publicKey` string (or
     *   `null`) and the `secrets` map as base64-encoded entry strings.
     */
    toJSON(): { publicKey: string | null; secrets: Record<string, string> } {
        const publicKey = this.#publicKey ?
        this.#publicKey.export(DEFAULT_PUBLIC_ENCODING).toString('base64') : null;

        const sortedEntries = [...this.entries()]
            .sort(([a], [b]) => a.localeCompare(b));

        return {
            publicKey,
            secrets: Object.fromEntries(sortedEntries.map(([k, v]) => [k, v.serialize()]))
        };
    }

    // Map interface

    /** Number of secrets currently stored in the vault. */
    get size(): number { return this.#secrets.size; }

    /** Removes all secrets from the vault. */
    clear(): void { this.#secrets.clear(); }

    get [Symbol.toStringTag](): string {
        return 'Vltx';
    }

    /**
     * Removes the secret with the given key.
     * @param key - The key to remove.
     * @returns `true` if the key existed and was removed, `false`
     *   otherwise.
     */
    delete(key: string): boolean {
        return this.#secrets.delete(key);
    }

    /**
     * Executes `callbackfn` once for each key-value pair in
     * insertion order.
     * @param callbackfn - Function invoked with `(value, key, map)`.
     * @param thisArg - Value used as `this` inside the callback.
     */
    forEach(callbackfn: (
        _value: AnyEntry, _key: string, _map: Map<string, AnyEntry>,
    ) => void, thisArg?: unknown): void {
        this.#secrets.forEach((value, key) =>
        callbackfn.call(thisArg, value, key, this.#secrets));
    }

    /**
     * Returns the raw {@link AnyEntry} stored under `key`, or `undefined` if
     * the key does not exist. Use {@link Vltx#decrypt} to obtain the plaintext.
     * @param key - The secret key to look up.
     * @returns The entry, or `undefined` if `key` does not exist.
     */
    get(key: string): AnyEntry | undefined {
        if (this.has(key)) {
            return this.#secrets.get(key);
        }
        return undefined;
    }

    /**
     * Returns a tag function bound to this vault instance.
     *
     * Assign it to any identifier to use it as a tagged template
     * literal; the key is looked up in this vault and the decrypted
     * value is returned. An unknown key or an empty template returns
     * an empty string. Interpolation is not supported and will throw.
     *
     * ```js
     * const secret = vault.tagFunction;
     * const dbUrl = secret`DB_URL`;
     * ```
     */
    get tagFunction() {
        return tagFunction.bind(null, this);
    }

    /**
     * Returns `true` if a secret with the given key exists in the
     * vault.
     * @param key - The key to look up.
     */
    has(key: string): boolean {
        return this.#secrets.has(key);
    }

    // Encrypts value and stores it; uses LargeEntry for values over MAX_SECRET_BYTES.
    #doSet(key: string, value: string | AnyEntry): this {
        if (!this.#publicKey) {
            throw new Error('Public key is required to update the vault');
        }

        if (typeof value === 'string') {
            const EntryClass = Buffer.byteLength(value, 'utf8') > MAX_SECRET_BYTES ?
                LargeEntry :
                SecretEntry;
            const entry = new EntryClass();
            entry.setRaw(this.#publicKey!, value);
            this.#secrets.set(key, entry);
        } else {
            this.#secrets.set(key, value);
        }
        return this;
    }

    /**
     * Inserts a new encrypted secret under `key`.
     * Values within {@link MAX_SECRET_BYTES} UTF-8 bytes are stored as
     * a {@link SecretEntry} (RSA-OAEP-SHA-256); larger values are stored
     * automatically as a {@link LargeEntry} (hybrid AES-256-GCM).
     * Use {@link replace} to overwrite an existing key.
     * @param key - The secret key.
     * @param value - The plaintext value to encrypt and store.
     * @returns `this` for chaining.
     * @throws {Error} If no public key is available.
     * @throws {Error} If `key` already exists — use {@link replace}
     *   to overwrite.
     */
    set(key: string, value: string | AnyEntry): this {
        if (this.has(key)) {
            throw new Error(
                'Attempting to replace existing entry ' +
                'through .set(), use .replace() instead',
            );
        }
        return this.#doSet(key, value);
    }

    /**
     * Inserts or overwrites a secret under `key` (upsert).
     * Behaves identically to {@link set} but does not throw when
     * the key already exists, making it safe for both initial
     * population and updates. Values within {@link MAX_SECRET_BYTES}
     * UTF-8 bytes use RSA-OAEP-SHA-256; larger values use hybrid
     * AES-256-GCM encryption automatically.
     * @param key - The secret key.
     * @param value - The plaintext value to encrypt and store.
     * @returns `this` for chaining.
     * @throws {Error} If no public key is available.
     */
    replace(key: string, value: string): this {
        return this.#doSet(key, value);
    }

    /**
     * Returns an iterator over `[key, encryptedValue]` pairs in insertion
     * order.
     *
     * **Note:** values are always the raw ciphertext stored on disk,
     * regardless of whether a private key is loaded. Unlike {@link get},
     * no decryption occurs. Spread or destructure with care:
     * `Object.fromEntries(vault)` and `for (const [k, v] of vault.entries())`
     * will produce encrypted base64 blobs, not plaintext.
     */
    entries(): MapIterator<[string, AnyEntry]> {
        return this.#secrets.entries();
    }

    /** Returns an iterator over the secret keys in insertion order. */
    keys(): MapIterator<string> {
        return this.#secrets.keys();
    }

    /**
     * Returns an iterator over raw (encrypted) values in insertion order.
     *
     * **Note:** values are always the raw ciphertext stored on disk,
     * regardless of whether a private key is loaded. Unlike {@link get},
     * no decryption occurs. Use {@link get} to retrieve a decrypted value
     * for a specific key.
     */
    values(): MapIterator<AnyEntry> {
        return this.#secrets.values();
    }

    /**
     * Returns the value for `key`, inserting `value` if the key
     * does not yet exist.
     * @param key - The key to look up or insert.
     * @param value - Default value to insert when the key is absent.
     * @returns The existing or newly inserted value.
     */
    getOrInsert(key: string, value: AnyEntry | string): AnyEntry {
        if (!this.has(key)) {
            this.set(key, value);
        }
        return this.get(key) as AnyEntry;
    }

    /**
     * Returns the value for `key`, inserting the result of
     * `callbackfn(key)` if absent.
     * @param key - The key to look up or insert.
     * @param callbackfn - Factory called with `key` to produce the
     *   default value.
     * @returns The existing or newly computed value.
     */
    getOrInsertComputed(
        key: string, callbackfn: (_key: string) => AnyEntry,
    ): AnyEntry {
        if (!this.has(key)) {
            this.set(key, callbackfn(key));
        }
        return this.get(key) as AnyEntry;
    }

    /**
     * Returns an iterator over `[key, encryptedValue]` pairs, making `Vltx`
     * iterable with `for…of`.
     *
     * **Note:** values are always the raw ciphertext stored on disk,
     * regardless of whether a private key is loaded. Unlike {@link get},
     * no decryption occurs. Spread or destructure with care:
     * `Object.fromEntries(vault)` and `for (const [k, v] of vault)` will
     * produce encrypted base64 blobs, not plaintext.
     */
    [Symbol.iterator](): MapIterator<[string, AnyEntry]> {
        return this.#secrets.entries();
    }

    /**
     * Creates a new vault file at `filename` and persists it to
     * disk.
     *
     * When `privateKeyOpts.privateKeyFilename` is provided and that
     * path does not yet exist, a fresh 4096-bit RSA key pair is
     * generated and the private key is written there before the
     * vault is created.
     *
     * The returned instance has its filename stored and is ready
     * for both encryption and decryption.
     *
     * @param filename - Destination path for the vault JSON file.
     * @param privateKeyOpts - Key material. Must include either
     *   `privateKey` or `privateKeyFilename`.
     * @returns A configured {@link Vltx} backed by `filename`.
     * @throws {Error} If neither `privateKey` nor
     *   `privateKeyFilename` is provided.
     */
    static init(
        filename: string, privateKeyOpts: PrivateKeyConfig,
    ): Vltx {
        if (!privateKeyOpts.privateKey &&
            !privateKeyOpts.privateKeyFilename) {
            throw new Error(
                'Either privateKey or privateKeyFilename must be ' +
                'provided to initialize a vault',
            );
        }

        const { privateKeyFilename, passphrase } = privateKeyOpts;
        if (privateKeyFilename) {
            try {
                statSync(privateKeyFilename);
            } catch (err: unknown) {
                if (isNodeError(err) && err.code === 'ENOENT') {
                    const { privateKey } = generateRSAKeyPair(passphrase);
                    writeFileSync(privateKeyFilename, privateKey as string,
                        { mode: 0o600 });
                } else {
                    throw err;
                }
            }
        }

        const v = new Vltx({ ...privateKeyOpts, filename });
        v.write();
        return v;
    }

    /**
     * Opens a vault from the supplied configuration.
     *
     * Passes `opts` directly to the {@link Vltx} constructor.
     * If `opts.filename` is provided the file must already exist;
     * all other validation is left to the caller.
     *
     * @param opts - Full vault configuration.
     * @returns A configured {@link Vltx} instance.
     * @throws {Error} If `opts.filename` is provided but does not exist.
     */
    static open(opts: VltxConfig): Vltx {
        const { filename } = opts;
        const v = new Vltx(opts);
        if (filename && !v.loaded) {
            throw new Error(`Unable to open safe. ${filename} does not exist`);
        }

        return v;
    }

    /**
     * Opens an existing vault file for writing (encryption only).
     *
     * Reads `opts.filename` to load the embedded public key; no
     * private key material from `opts` is forwarded to the
     * constructor, so the returned vault has `canDecrypt` false.
     *
     * @param opts - Full vault configuration. Only `filename` is
     *   used; all key material is ignored.
     * @returns A {@link Vltx} with `canEncrypt` true and
     *   `canDecrypt` false.
     * @throws {Error} If `opts.filename` is not provided.
     * @throws {Error} If `opts.filename` does not exist.
     */
    static openForWriting(opts: VltxConfig): Vltx {
        const { filename } = opts;

        if (!filename) {
            throw new Error('A filename is required to open the vault');
        }

        const v = new Vltx({ filename });
        if (!v.loaded) {
            throw new Error(`Unable to open vault. ${filename} does not exist`);
        }

        return v;
    }

    /**
     * Opens an existing vault file for reading (decryption).
     *
     * Reads `opts.filename`, loads the embedded public key and
     * secrets, then unlocks the vault with the private key in
     * `opts`.
     *
     * @param opts - Full vault configuration. `filename` and at
     *   least one of `privateKeyFilename` or `privateKey` are
     *   required.
     * @returns A {@link Vltx} with `canDecrypt` true.
     * @throws {Error} If `opts.filename` is not provided.
     * @throws {Error} If no private key is provided.
     * @throws {Error} If `opts.filename` does not exist.
     * @throws {Error} If the private key cannot decrypt the vault.
     */
    static openForReading(opts: VltxConfig): Vltx {
        const { filename, privateKeyFilename, privateKey } = opts;

        if (!filename) {
            throw new Error('A filename is required to open the vault');
        }

        if (!privateKeyFilename && !privateKey) {
            throw new Error('A private key is required to open the vault');
        }

        const v = new Vltx(opts);
        if (!v.loaded) {
            throw new Error(`Unable to open safe. ${filename} does not exist`);
        }

        if (!v.canDecrypt) {
            throw new Error('Unable to open safe, check private key and passphrase');
        }

        if (!v.keyPairMatches) {
            throw new Error('Private key does not match vault\'s public key');
        }

        return v;
    }
}
