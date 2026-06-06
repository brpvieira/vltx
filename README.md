# vltx

**Simple, secure secret storage using asymmetric RSA encryption.**

Store encrypted secrets in a file you can safely commit to source control, package into a Docker image, or distribute to any environment. Secrets are unreadable without the private key — which never leaves your hands.

---

## How it works

`vltx` generates an RSA key pair. The **public key** lives inside the vault file alongside the encrypted secrets. The **private key** stays with you (or your deployment environment). Anyone can add secrets; only the private key holder can read them.

```
┌─────────────────────────────────┐     ┌──────────────────┐
│  .vltx  (commit to git)         │     │  .vltx.rsa      │
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
npx vltx init --passphrase "my passphrase"
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

npx vltx get DB_URL --key-file ~/.keys/prod.rsa --passphrase "my passphrase"
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

Place them in a `.env` file at the project root — `vltx` loads it automatically.

```sh
# .env
VLTX_FILE=secrets/production.vault
VLTX_KEY_FILE=~/.keys/prod.rsa
```

---

## Using secrets in your application

Import `setupVltx` from the package and call it once at startup. It loads the vault and — by default — registers a tagged template literal function on the global scope so your secrets are accessible anywhere without threading a reference through your codebase.

### Quick start

**ESM (import)**
```js
import { setupVltx } from 'vltx';

setupVltx(); // reads .vltx and .vltx.rsa from cwd, registers global `vltx` tag
```

**CommonJS (require)**
```js
const { setupVltx } = require('vltx');

setupVltx(); // reads .vltx and .vltx.rsa from cwd, registers global `vltx` tag
```

```js
// anywhere in your app — no import needed
const db = new Database(vltx`DB_URL`);
const client = new ApiClient(vltx`API_KEY`);
```

The tag returns the decrypted string for a known key, or an empty string for an unknown one.

---

### Custom alias and path

**ESM**
```js
import { setupVltx } from 'vltx';

setupVltx({
    filename: 'secrets/production.vault',
    alias: 'secret',        // registers global.secret instead of global.vltx
});
```

**CommonJS**
```js
const { setupVltx } = require('vltx');

setupVltx({
    filename: 'secrets/production.vault',
    alias: 'secret',
});
```

```js
const db = new Database(secret`DB_URL`);
```

---

### Without the global tag

If you prefer explicit access over global injection, disable injection and use the returned `Vltx` instance directly:

**ESM**
```js
import { setupVltx } from 'vltx';

const vault = setupVltx({ inject: false });

const dbUrl  = vault.get('DB_URL');
const apiKey = vault.get('API_KEY');
```

**CommonJS**
```js
const { setupVltx } = require('vltx');

const vault = setupVltx({ inject: false });

const dbUrl  = vault.get('DB_URL');
const apiKey = vault.get('API_KEY');
```

---

### TypeScript

When using the global tag in TypeScript, declare the tag function in a `.d.ts` file so the compiler knows it exists:

```ts
// globals.d.ts
declare function vltx(strings: TemplateStringsArray): string;
```

---

### `setupVltx()` options

| Option     | Type      | Default   | Description                           |
|------------|-----------|-----------|---------------------------------------|
| `filename` | `string`  | env / `'./.vltx'` | Path to the vault file                |
| `alias`    | `string`  | `'vltx'` | Name of the global tag function       |
| `inject`   | `boolean` | `true`    | Register the tag function on `global` |

`setupVltx()` is idempotent — repeated calls with the same alias return the cached `Vltx` instance. The vault file path is resolved from `filename`, then `VLTX_FILE`, then `.vltx` in the current directory.

---

### Vltx class API

The `Vltx` class exposes three static factory methods and two key-lifecycle
instance methods. Using a factory method is the recommended approach — each
one validates its preconditions and makes the intent explicit. Full method
signatures and types are documented in [API.md](API.md).

---

#### [`Vltx.openForReading(opts)`](API.md#module_core/vltx--module.exports.openForReading) — decrypt secrets

Opens an existing vault file and loads the private key, enabling decryption.
Throws if the file does not exist, no private key is supplied, or the key
cannot decrypt the vault.

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

- Encryption uses **RSA-OAEP** (Node.js native `crypto` — no third-party crypto libraries).
- Keys are **4096-bit**. Private keys can be protected with **AES-256-CBC** via a passphrase.
- Each value is salted with random bytes and a timestamp before encryption, so the same plaintext always produces a different ciphertext.
- The vault file contains only the public key and ciphertext — it is safe to commit, distribute, or embed in container images.
- The private key is **never** written into the vault file. Guard it as you would a production password.
