# vltx

**Simple, secure secret storage using asymmetric RSA encryption.**

Store encrypted secrets in a file you can safely commit to source control, package into a Docker image, or distribute to any environment. Secrets are unreadable without the private key — which never leaves your hands.

---

## How it works

`vltx` generates an RSA key pair. The **public key** lives inside the vault file alongside the encrypted secrets. The **private key** stays with you (or your deployment environment). Anyone can add secrets; only the private key holder can read them.

```
┌─────────────────────────────────┐     ┌──────────────────┐
│  .vltx  (commit to git)         │     │  .vltx.rsa       │
│                                 │     │  (keep private)  │
│  publicKey: "-----BEGIN..."     │     │                  │
│  secrets:                       │  ←  │  4096-bit RSA    │
│    DB_URL:  "a8Kx2..."          │     │  private key     │
│    API_KEY: "mN7pQ..."          │     │                  │
└─────────────────────────────────┘     └──────────────────┘
        safe to distribute                  decrypt only
```

---

## Installation

```sh
npm install vltx
```

This gives you both the **`vltx`** command and the **`vltx`** module for use in your application.

---

## Managing secrets

### 1. Initialize a vault

Creates a vault file and generates a 4096-bit RSA key pair.

```sh
npx vltx init
```

By default this creates `.vltx` (the encrypted store) and `.vltx.rsa` (your private key) in the current directory. Add `.vltx.rsa` to `.gitignore` immediately.

```sh
echo ".vltx.rsa" >> .gitignore
```

To use custom paths:

```sh
npx vltx init --vault-file secrets/production.vault --key-file ~/.keys/prod.rsa
```

Protect the private key with a passphrase:

```sh
# Interactive prompt (passphrase is never visible in shell history):
npx vltx init --passphrase

# Pipe it in from a password manager or clipboard:
pbpaste | npx vltx init --passphrase
```

---

### 2. Add secrets

```sh
npx vltx add DB_URL "postgres://user:pass@host/db"
npx vltx add API_KEY "sk-live-abc123"
npx vltx add SMTP_PASSWORD "hunter2"
```

`add` refuses to overwrite an existing key. To update a secret use `replace`:

```sh
npx vltx replace API_KEY "sk-live-newkey456"
```

Each secret value is limited to **190 UTF-8 bytes**. Values longer than this will be rejected at write time.

---

### 3. List keys

```sh
npx vltx list
```

```
.vltx (3 secrets)
  API_KEY
  DB_URL
  SMTP_PASSWORD
```

Key names are always shown. Values are never printed by `list`.

---

### 4. Read a secret

Decrypting requires the private key:

```sh
npx vltx get DB_URL
# postgres://user:pass@host/db

# With a non-default key file — passphrase entered at the prompt:
npx vltx get DB_URL --key-file ~/.keys/prod.rsa --passphrase
```

---

### 5. Delete a secret

```sh
npx vltx delete SMTP_PASSWORD
```

---

### Environment variables

Set these to avoid repeating paths on every command:

| Variable           | Purpose                        | Default      |
|--------------------|--------------------------------|--------------|
| `VLTX_FILE`       | Path to the vault file         | `.vltx`      |
| `VLTX_KEY_FILE`   | Path to the private key file   | `.vltx.rsa` |
| `VLTX_PASSPHRASE` | Passphrase for the private key | —            |

Place them in a `.env` file at the project root — the `vltx` CLI loads it automatically.

```sh
# .env
VLTX_FILE=secrets/production.vault
VLTX_KEY_FILE=~/.keys/prod.rsa
```

**Passphrase options — choose the right one for your context:**

| Context | Recommended approach |
|---|---|
| Local development | `--passphrase` flag → interactive prompt (never appears in shell history) |
| CI / automation | `VLTX_PASSPHRASE` in environment or `.env` — never pass the value inline |
| Scripted / piped | `pbpaste \| vltx get KEY --passphrase` or `cat secret.txt \| vltx get KEY --passphrase` |

> [!NOTE]
> `.env` loading is a CLI-only feature. When using the `vltx` package as a library, you may use dotenv followed by `dotenv.config()` before calling `setup()` if you rely on a `.env` file for `VLTX_FILE`, `VLTX_KEY_FILE`, or `VLTX_PASSPHRASE`.

---

## Using secrets in your application

Import `setup` from the package and call it once at startup. It loads the vault and returns a `Vltx` instance. Use the `tagFunction` property to obtain a tagged template literal function you can assign to any identifier.

### Quick start

**ESM (import)**
```js
import { setup } from 'vltx';

// reads .vltx and .vltx.rsa from cwd
const secret = setup().tagFunction;
```

**CommonJS (require)**
```js
const { setup } = require('vltx');

const secret = setup().tagFunction;
```

```js
const db = new Database(secret`DB_URL`);
const client = new ApiClient(secret`API_KEY`);
```

The tag function returns the decrypted string for a known key, or an empty string for an unknown one.

---

### Custom path and identifier

**ESM**
```js
import { setup } from 'vltx';

const secret = setup({ filename: 'secrets/production.vault' }).tagFunction;

const db = new Database(secret`DB_URL`);
```

**CommonJS**
```js
const { setup } = require('vltx');

const secret = setup({ filename: 'secrets/production.vault' }).tagFunction;
```

---

### Using `get()` directly

For explicit key lookups without a template literal, call `vault.get()`:

**ESM**
```js
import { setup } from 'vltx';

const vault = setup();

const dbUrl  = vault.get('DB_URL');
const apiKey = vault.get('API_KEY');
```

**CommonJS**
```js
const { setup } = require('vltx');

const vault = setup();

const dbUrl  = vault.get('DB_URL');
const apiKey = vault.get('API_KEY');
```

---

### TypeScript

The `tagFunction` property is typed automatically — no declaration file needed:

```ts
import { setup } from 'vltx';

const secret = setup().tagFunction;
const dbUrl: string = secret`DB_URL`;
```

---

### `setup()` options

| Option     | Type      | Default   | Description                           |
|------------|-----------|-----------|---------------------------------------|
| `filename` | `string`  | env / `'./.vltx'` | Path to the vault file           |
| `alias`    | `string`  | `'vltx'`  | Cache key for this vault instance     |

`setup()` is idempotent — repeated calls with the same alias return the cached `Vltx` instance. The vault file path is resolved from `filename`, then `VLTX_FILE`, then `.vltx` in the current directory.

---

### Cache management

Because ESM caches modules, the vault instances created by `setup()` persist for the entire process lifetime. Two functions let you bust that cache when needed.

#### `remove(alias)`

Removes one cached instance by its alias. The next `setup()` call with the same alias will create a fresh instance — useful when a vault needs to be reconfigured (e.g. a different file or key) without restarting the process.

```js
import { setup, remove } from 'vltx';

const v1 = setup({ alias: 'main', filename: 'dev.vault' });
remove('main');
const v2 = setup({ alias: 'main', filename: 'prod.vault' }); // fresh instance
```

Returns the removed `Vltx` instance, or `undefined` if the alias was not found.

#### `clearAll()`

Removes all cached instances at once. Intended primarily for test environments that need a clean slate between test cases.

```js
import { setup, clearAll } from 'vltx';

afterEach(() => {
    clearAll(); // each test starts with an empty cache
});
```

---

### Vltx class API

The `Vltx` class exposes three static factory methods and two key-lifecycle
instance methods. Using a factory method is the recommended approach — each
one validates its preconditions and makes the intent explicit. Full method
signatures and types are documented in [API.md](API.md).

> [!WARNING]
> **Map iteration returns raw ciphertext, not plaintext.**
>
> `Vltx` implements `Map<string, string>`, but iteration methods
> (`entries()`, `values()`, `[Symbol.iterator]`, `forEach()`) always yield
> the raw encrypted values stored on disk — no decryption occurs, even when a
> private key is loaded. Only `get(key)` decrypts.
>
> ```js
> const v = Vltx.openForWriting({ filename: '.vault' });
>
> // These look correct but produce encrypted base64 blobs:
> for (const [k, val] of v) { /* val is ciphertext */ }
> Object.fromEntries(v);  // { DB_URL: 'a8Kx2...', API_KEY: 'mN7pQ...' }
> [...v.values()]         // ['a8Kx2...', 'mN7pQ...']
>
> // Use get() to decrypt individual values:
> const dbUrl = v.get('DB_URL');  // plaintext (when canDecrypt is true)
> ```
>
> To export all secrets as plaintext, iterate the keys and call `get()` for
> each one:
>
> ```js
> const plain = Object.fromEntries([...v.keys()].map(k => [k, v.get(k)]));
> ```

---

#### [`Vltx.openForReading(opts)`](API.md#module_core/vltx--module.exports.openForReading) — decrypt secrets

Opens an existing vault file and loads the private key, enabling decryption.
Throws if the file does not exist, no private key is supplied, the key
cannot be parsed, or the private key does not match the vault's public key.

**ESM**
```js
import { Vltx } from 'vltx';

const v = Vltx.openForReading({
    filename: 'secrets/production.vault',
    privateKeyFilename: '/run/secrets/vault.rsa',
    passphrase: process.env.VLTX_PASSPHRASE, // optional
});

const dbUrl = v.get('DB_URL');
```

**CommonJS**
```js
const { Vltx } = require('vltx');

const v = Vltx.openForReading({
    filename: 'secrets/production.vault',
    privateKeyFilename: '/run/secrets/vault.rsa',
    passphrase: process.env.VLTX_PASSPHRASE,
});

const dbUrl = v.get('DB_URL');
```

---

#### [`Vltx.openForWriting(opts)`](API.md#module_core/vltx--module.exports.openForWriting) — add or replace secrets

Opens an existing vault file without loading a private key. The public key
embedded in the file is loaded automatically, enabling encryption.
No decryption capability is available. Useful in environments that only need
to write secrets (e.g., a CI pipeline that rotates credentials).

`set` throws if the key already exists — use `replace` to overwrite. Both
methods throw if the value exceeds **190 UTF-8 bytes** (`MAX_SECRET_BYTES`).

**ESM**
```js
import { Vltx } from 'vltx';

const v = Vltx.openForWriting({ filename: 'secrets/production.vault' });
v.set('NEW_SECRET', 'super-secret-value');
v.replace('API_KEY', 'sk-live-newkey456');
v.write();
```

**CommonJS**
```js
const { Vltx } = require('vltx');

const v = Vltx.openForWriting({ filename: 'secrets/production.vault' });
v.set('NEW_SECRET', 'super-secret-value');
v.write();
```

---

#### [`Vltx.open(opts)`](API.md#module_core/vltx--module.exports.open) — full control

Generic opener. Passes the full `VaultConfig` directly to the constructor.
Only throws if `opts.filename` is provided but does not exist. No other
validation is performed — `canEncrypt` and `canDecrypt` reflect whatever
key material `opts` contains.

**ESM**
```js
import { Vltx } from 'vltx';

// Read and write in one call
const v = Vltx.open({
    filename: 'secrets/production.vault',
    privateKeyFilename: '/run/secrets/vault.rsa',
});

// Or open with no file at all (useful for in-memory vaults)
const mem = Vltx.open({ publicKey: myPublicKeyPem });
```

**CommonJS**
```js
const { Vltx } = require('vltx');

const v = Vltx.open({
    filename: 'secrets/production.vault',
    privateKeyFilename: '/run/secrets/vault.rsa',
});
```

---

#### [`lock()`](API.md#module_core/vault--module.exports+lock) and [`unlock()`](API.md#module_core/vault--module.exports+unlock) — key lifecycle

`lock()` discards the private key, leaving the vault in encrypt-only mode.
`unlock(opts)` loads a new private key. Both return `this` for chaining.
Use them to limit the window during which decryption key material is held in
memory.

**ESM**
```js
import { Vltx } from 'vltx';

const v = Vltx.openForReading({
    filename: 'secrets/production.vault',
    privateKeyFilename: '/run/secrets/vault.rsa',
});

const dbUrl = v.get('DB_URL'); // decrypt while key is loaded

v.lock(); // discard the private key
// v.canDecrypt === false — safe to pass around read-only

// Restore decryption when needed
v.unlock({ privateKeyFilename: '/run/secrets/vault.rsa' });
// v.canDecrypt === true again
```

**CommonJS**
```js
const { Vltx } = require('vltx');

const v = Vltx.openForReading({
    filename: 'secrets/production.vault',
    privateKeyFilename: '/run/secrets/vault.rsa',
});

v.get('DB_URL');
v.lock();
v.unlock({ privateKeyFilename: '/run/secrets/vault.rsa' });
```

---

#### Direct instantiation (advanced)

`new Vltx(opts)` is equivalent to `Vltx.open()` but skips the
file-existence check. **Using a factory method is the recommended approach.**

```js
import { Vltx } from 'vltx';

const v = new Vltx({
    filename: 'secrets/production.vault',
    privateKeyFilename: '/run/secrets/vault.rsa',
});
```

---

## Security notes

- Encryption uses **RSA-OAEP-SHA-256** (Node.js native `crypto` — no third-party crypto libraries).
- Keys are **4096-bit**. Private keys can be protected with **AES-256-CBC** via a passphrase.
- Each value is salted with random bytes and a timestamp before encryption, so the same plaintext always produces a different ciphertext.
- Secret values are limited to **190 UTF-8 bytes** — a constraint of RSA block encryption (the stuffed form must fit the 446-byte OAEP payload). Use a reference (e.g. a filename or URL) for larger payloads.
- The vault file contains only the public key and ciphertext — it is safe to commit, distribute, or embed in container images.
- The private key is **never** written into the vault file. Guard it as you would a production password.
- The `--passphrase` flag **never accepts a value on the command line**. It either prompts interactively (TTY) or reads from stdin (pipe), so the passphrase is never exposed in shell history or `/proc/<pid>/cmdline`. Use `VLTX_PASSPHRASE` for non-interactive environments.
