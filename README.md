# vault

**Simple, secure secret storage using asymmetric RSA encryption.**

Store encrypted secrets in a file you can safely commit to source control, package into a Docker image, or distribute to any environment. Secrets are unreadable without the private key — which never leaves your hands.

---

## How it works

`vault` generates an RSA key pair. The **public key** lives inside the vault file alongside the encrypted secrets. The **private key** stays with you (or your deployment environment). Anyone can add secrets; only the private key holder can read them.

```
┌─────────────────────────────────┐     ┌──────────────────┐
│  .vault  (commit to git)        │     │  .vault.rsa      │
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
npm install vault
```

This gives you both the **`vault-cli`** command and the **`vault`** module for use in your application.

---

## Managing secrets

### 1. Initialize a vault

Creates a vault file and generates a 4096-bit RSA key pair.

```sh
npx vault-cli init
```

By default this creates `.vault` (the encrypted store) and `.vault.rsa` (your private key) in the current directory. Add `.vault.rsa` to `.gitignore` immediately.

```sh
echo ".vault.rsa" >> .gitignore
```

To use custom paths:

```sh
npx vault-cli init --vault-file secrets/production.vault --key-file ~/.keys/prod.rsa
```

Protect the private key with a passphrase:

```sh
npx vault-cli init --passphrase "my passphrase"
```

---

### 2. Add secrets

```sh
npx vault-cli add DB_URL "postgres://user:pass@host/db"
npx vault-cli add API_KEY "sk-live-abc123"
npx vault-cli add SMTP_PASSWORD "hunter2"
```

`add` refuses to overwrite an existing key. To update a secret use `replace`:

```sh
npx vault-cli replace API_KEY "sk-live-newkey456"
```

---

### 3. List keys

```sh
npx vault-cli list
```

```
.vault (3 secrets)
  API_KEY
  DB_URL
  SMTP_PASSWORD
```

Key names are always shown. Values are never printed by `list`.

---

### 4. Read a secret

Decrypting requires the private key:

```sh
npx vault-cli get DB_URL
# postgres://user:pass@host/db

npx vault-cli get DB_URL --key-file ~/.keys/prod.rsa --passphrase "my passphrase"
```

---

### 5. Delete a secret

```sh
npx vault-cli delete SMTP_PASSWORD
```

---

### Environment variables

Set these to avoid repeating paths on every command:

| Variable           | Purpose                        | Default      |
|--------------------|--------------------------------|--------------|
| `VAULT_FILE`       | Path to the vault file         | `.vault`     |
| `VAULT_KEY_FILE`   | Path to the private key file   | `.vault.rsa` |
| `VAULT_PASSPHRASE` | Passphrase for the private key | —            |

Place them in a `.env` file at the project root — `vault-cli` loads it automatically.

```sh
# .env
VAULT_FILE=secrets/production.vault
VAULT_KEY_FILE=~/.keys/prod.rsa
```

---

## Using secrets in your application

Import `setupVault` from the package and call it once at startup. It loads the vault and — by default — registers a tagged template literal function on the global scope so your secrets are accessible anywhere without threading a reference through your codebase.

### Quick start

**ESM (import)**
```js
import { setupVault } from 'vault';

setupVault(); // reads .vault and .vault.rsa from cwd, registers global `vault` tag
```

**CommonJS (require)**
```js
const { setupVault } = require('vault');

setupVault(); // reads .vault and .vault.rsa from cwd, registers global `vault` tag
```

```js
// anywhere in your app — no import needed
const db = new Database(vault`DB_URL`);
const client = new ApiClient(vault`API_KEY`);
```

The tag returns the decrypted string for a known key, or an empty string for an unknown one.

---

### Custom alias and path

**ESM**
```js
import { setupVault } from 'vault';

setupVault({
    filename: 'secrets/production.vault',
    alias: 'secret',        // registers global.secret instead of global.vault
});
```

**CommonJS**
```js
const { setupVault } = require('vault');

setupVault({
    filename: 'secrets/production.vault',
    alias: 'secret',
});
```

```js
const db = new Database(secret`DB_URL`);
```

---

### Without the global tag

If you prefer explicit access over global injection, disable injection and use the returned `Vault` instance directly:

**ESM**
```js
import { setupVault } from 'vault';

const vault = setupVault({ inject: false });

const dbUrl  = vault.get('DB_URL');
const apiKey = vault.get('API_KEY');
```

**CommonJS**
```js
const { setupVault } = require('vault');

const vault = setupVault({ inject: false });

const dbUrl  = vault.get('DB_URL');
const apiKey = vault.get('API_KEY');
```

---

### TypeScript

When using the global tag in TypeScript, declare the tag function in a `.d.ts` file so the compiler knows it exists:

```ts
// globals.d.ts
declare function vault(strings: TemplateStringsArray): string;
```

---

### `setupVault()` options

| Option     | Type      | Default   | Description                           |
|------------|-----------|-----------|---------------------------------------|
| `filename` | `string`  | env / `'./.vault'` | Path to the vault file                |
| `alias`    | `string`  | `'vault'` | Name of the global tag function       |
| `inject`   | `boolean` | `true`    | Register the tag function on `global` |

`setupVault()` is idempotent — repeated calls with the same alias return the cached `Vault` instance. The vault file path is resolved from `filename`, then `VAULT_FILE`, then `.vault` in the current directory.

---

### Vault class API

The `Vault` class exposes three static factory methods and two key-lifecycle
instance methods. Using a factory method is the recommended approach — each
one validates its preconditions and makes the intent explicit. Full method
signatures and types are documented in [API.md](API.md).

---

#### [`Vault.openForReading(opts)`](API.md#module_core/vault--module.exports.openForReading) — decrypt secrets

Opens an existing vault file and loads the private key, enabling decryption.
Throws if the file does not exist, no private key is supplied, or the key
cannot decrypt the vault.

**ESM**
```js
import { Vault } from 'vault';

const v = Vault.openForReading({
    filename: 'secrets/production.vault',
    privateKeyFilename: '/run/secrets/vault.rsa',
    passphrase: process.env.VAULT_PASSPHRASE, // optional
});

const dbUrl = v.get('DB_URL');
```

**CommonJS**
```js
const { Vault } = require('vault');

const v = Vault.openForReading({
    filename: 'secrets/production.vault',
    privateKeyFilename: '/run/secrets/vault.rsa',
    passphrase: process.env.VAULT_PASSPHRASE,
});

const dbUrl = v.get('DB_URL');
```

---

#### [`Vault.openForWriting(opts)`](API.md#module_core/vault--module.exports.openForWriting) — add or replace secrets

Opens an existing vault file without loading a private key. The public key
embedded in the file is loaded automatically, enabling encryption.
No decryption capability is available. Useful in environments that only need
to write secrets (e.g., a CI pipeline that rotates credentials).

**ESM**
```js
import { Vault } from 'vault';

const v = Vault.openForWriting({ filename: 'secrets/production.vault' });
v.set('NEW_SECRET', 'super-secret-value');
v.replace('API_KEY', 'sk-live-newkey456');
v.write();
```

**CommonJS**
```js
const { Vault } = require('vault');

const v = Vault.openForWriting({ filename: 'secrets/production.vault' });
v.set('NEW_SECRET', 'super-secret-value');
v.write();
```

---

#### [`Vault.open(opts)`](API.md#module_core/vault--module.exports.open) — full control

Generic opener. Passes the full `VaultConfig` directly to the constructor.
Only throws if `opts.filename` is provided but does not exist. No other
validation is performed — `canEncrypt` and `canDecrypt` reflect whatever
key material `opts` contains.

**ESM**
```js
import { Vault } from 'vault';

// Read and write in one call
const v = Vault.open({
    filename: 'secrets/production.vault',
    privateKeyFilename: '/run/secrets/vault.rsa',
});

// Or open with no file at all (useful for in-memory vaults)
const mem = Vault.open({ publicKey: myPublicKeyPem });
```

**CommonJS**
```js
const { Vault } = require('vault');

const v = Vault.open({
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
import { Vault } from 'vault';

const v = Vault.openForReading({
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
const { Vault } = require('vault');

const v = Vault.openForReading({
    filename: 'secrets/production.vault',
    privateKeyFilename: '/run/secrets/vault.rsa',
});

v.get('DB_URL');
v.lock();
v.unlock({ privateKeyFilename: '/run/secrets/vault.rsa' });
```

---

#### Direct instantiation (advanced)

`new Vault(opts)` is equivalent to `Vault.open()` but skips the
file-existence check. **Using a factory method is the recommended approach.**

```js
import { Vault } from 'vault';

const v = new Vault({
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
