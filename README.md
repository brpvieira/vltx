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

### Private key configuration

By default the module resolves the private key path from `VAULT_KEY_FILE` (or `.vault.rsa`). You can also pass it directly through `Vault.open` for full control:

**ESM**
```js
import { Vault } from 'vault';

const v = Vault.open('secrets/production.vault', {
    privateKeyFilename: '/run/secrets/vault.rsa',
    passphrase: process.env.VAULT_PASSPHRASE,
});

const dbUrl = v.get('DB_URL');
```

**CommonJS**
```js
const { Vault } = require('vault');

const v = Vault.open('secrets/production.vault', {
    privateKeyFilename: '/run/secrets/vault.rsa',
    passphrase: process.env.VAULT_PASSPHRASE,
});

const dbUrl = v.get('DB_URL');
```

---

## Security notes

- Encryption uses **RSA-OAEP** (Node.js native `crypto` — no third-party crypto libraries).
- Keys are **4096-bit**. Private keys can be protected with **AES-256-CBC** via a passphrase.
- Each value is salted with random bytes and a timestamp before encryption, so the same plaintext always produces a different ciphertext.
- The vault file contains only the public key and ciphertext — it is safe to commit, distribute, or embed in container images.
- The private key is **never** written into the vault file. Guard it as you would a production password.
