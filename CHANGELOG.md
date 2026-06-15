# Changelog

All notable changes to this project will be documented in this file. See [standard-version](https://github.com/conventional-changelog/standard-version) for commit guidelines.

## 2.0.0 (2026-06-15)


### ⚠ BREAKING CHANGES

* **rsa:** vault files store the public key as base64-encoded PKCS#1 DER
instead of PEM-encoded SPKI. Existing vault files are not compatible and must
be recreated.
* EntryType.File has been renamed to EntryType.Large
* **cli:** --passphrase no longer accepts an inline value.
Replace --passphrase "value" with --passphrase (interactive prompt) or
echo value | vltx ... --passphrase (piped input).
Use VLTX_PASSPHRASE in .env for non-interactive environments.
* **vltx:** setup() no longer injects a tag function into global;
the inject option has been removed
* **vltx:** get() now throws when canDecrypt is false instead of
returning the raw stored value. Use getRaw() to access ciphertext directly.
* `setupVltx` export renamed to `setup`
* package renamed from `vault` to `vltx`
* `Vault` class renamed to `Vltx`; `VaultConfig` renamed to `VltxConfig`
* exported function `setupVault` renamed to `setupVltx`
* CLI binary renamed from `vault-cli` to `vltx`
* env vars `VAULT_FILE`, `VAULT_KEY_FILE`, `VAULT_PASSPHRASE` renamed to `VLTX_*`
* default files renamed from `.vault`/`.vault.rsa` to `.vltx`/`.vltx.rsa`
* **vault:** Vault.open signature changed from
(filename: string, privateKeyOpts: PrivateKeyConfig) to
(opts: VaultConfig) with different validation semantics; the previous
behaviour is now provided by Vault.openForReading.
* **cli:** vault-file is no longer accepted as a positional argument;
pass it as --vault-file <path> or -f <path> instead.
* **api:** the default export `setup` is replaced by the named
export `setupVault`. Update imports from `import setup from 'vault'` to
`import { setupVault } from 'vault'`, or for CommonJS:
`const { setupVault } = require('vault')`.
* **cli:** vault-file positional is now optional in all commands;
omitting it falls back to $VAULT_FILE or <cwd>/.vault instead of erroring.
* **cli:** init default key-file path changed from a .pem extension
derived from the vault-file argument to getConfig default (<cwd>/.vault.rsa).

### Features

* add more rsa utility methods ([ad399f7](https://github.com/brpvieira/vltx/commit/ad399f7c47d0b08013ad044a87da34098a3adb8a))
* add rsa manipulation functions ([ecd376a](https://github.com/brpvieira/vltx/commit/ecd376a0a03cc0b688c4c9d6df8ed2feab59e167))
* add setup function as module entry point ([5a10a12](https://github.com/brpvieira/vltx/commit/5a10a1222e3ecab3f835462c411ee88295db1943))
* **api:** rename default export setup to named export setupVault ([465fdfc](https://github.com/brpvieira/vltx/commit/465fdfce7e5052eaa3f90b8f557febe1a4addef8))
* **bin:** add normal log level and rich TTY output formatting ([c16ce00](https://github.com/brpvieira/vltx/commit/c16ce002334020d086df4f1f3e7fd70429758e62))
* **bin:** add structured logger to cli helpers ([7102368](https://github.com/brpvieira/vltx/commit/71023684cf48c0ee13abbbfc8a7bdb0116cd625b))
* **cli:** implement vault CLI and Vault.init static method ([dce33d1](https://github.com/brpvieira/vltx/commit/dce33d1974b12d9f08258b9946268120a3ccf570))
* **cli:** make vault-file optional and unify config resolution ([96ddeed](https://github.com/brpvieira/vltx/commit/96ddeedcc32e81f3220cac0c193ee45d4b0855d4))
* **cli:** replace inline --passphrase value with secure prompt or stdin pipe ([c7d816b](https://github.com/brpvieira/vltx/commit/c7d816b3aa4585d497d8c07365949249fba92d50)), closes [#8](https://github.com/brpvieira/vltx/issues/8)
* **cli:** show entry metadata table in list command ([c4d58d5](https://github.com/brpvieira/vltx/commit/c4d58d5ae5c1040bdfdf442c2eb827731eaf6669))
* **entry:** add entry types with RSA-OAEP encryption and serialization ([ecee06c](https://github.com/brpvieira/vltx/commit/ecee06cb87ea279e1bf6b8bb2044b8aef5e28796))
* **entry:** add hybrid AES-256-GCM encryption for LargeEntry ([fd6c227](https://github.com/brpvieira/vltx/commit/fd6c2272388eaca93b4e918340d3d2762ce8b8cc))
* export Vltx class and VltxConfig type from package entry point ([2c475f3](https://github.com/brpvieira/vltx/commit/2c475f31b83f46161c791910d6ac98a6d1bb8b88)), closes [#3](https://github.com/brpvieira/vltx/issues/3)
* initial vault implementation ([e55fabc](https://github.com/brpvieira/vltx/commit/e55fabc30af756f6a868dac50ad8bd5a106b182a))
* **logger:** add verbose CLI flag and structured Logger interface ([4f52c09](https://github.com/brpvieira/vltx/commit/4f52c09665b54a71409fe99f0d9e5778c3695c27))
* **rsa:** export encrypt and decrypt helpers ([4230c5f](https://github.com/brpvieira/vltx/commit/4230c5f6c30c726d2f18c5e0ef6fce1874722aa1)), closes [#5](https://github.com/brpvieira/vltx/issues/5)
* **vault:** add lock and unlock instance methods ([96f250a](https://github.com/brpvieira/vltx/commit/96f250a8d2ddc6b65faa2b03002e4b6aa6507663))
* **vault:** add openForWriting and openForReading static methods ([f3fba36](https://github.com/brpvieira/vltx/commit/f3fba36fb4539cf3ab7c053df65da755c5327d25))
* **vault:** add Vault.open static method ([4819473](https://github.com/brpvieira/vltx/commit/4819473053b42b89ce1d82f215ec02a1acce25a6))
* **vltx:** auto-select LargeEntry for values exceeding MAX_SECRET_BYTES ([06d2eeb](https://github.com/brpvieira/vltx/commit/06d2eebae23a3a9cf2ad64e80c0f8cce8af100d8))
* **vltx:** enforce private key in get() and add getRaw() ([d5e7d3e](https://github.com/brpvieira/vltx/commit/d5e7d3e492fd9236e294c7fed460126fb6b0a714)), closes [#7](https://github.com/brpvieira/vltx/issues/7)
* **vltx:** export remove and clearAll for cache management ([9a912a2](https://github.com/brpvieira/vltx/commit/9a912a24e62caaae88966184336e9c92a10297ce)), closes [#13](https://github.com/brpvieira/vltx/issues/13)
* **vltx:** replace global injection with tagFunction instance getter ([3b8ba8b](https://github.com/brpvieira/vltx/commit/3b8ba8bac03154340d1587f8b29c0ae32d6f684e)), closes [#14](https://github.com/brpvieira/vltx/issues/14)


### Bug Fixes

* **cli:** decrypt secret value in get handler ([8a80dff](https://github.com/brpvieira/vltx/commit/8a80dff33375a44f0046a39260bda22ff0a590e2))
* correct MAX_SECRET_BYTES to 430 after payload format change ([9c043cb](https://github.com/brpvieira/vltx/commit/9c043cba83d6d5b4da14240712a9b459cd52c0f6))
* correct SecretEntry static members, restore toJSON, and achieve 100% coverage ([87d8268](https://github.com/brpvieira/vltx/commit/87d8268243ba7da3f9e71ecfcb28d900ebbcd9f6))
* **deps:** pin esbuild to ^0.28.1 to resolve high severity vulnerabilities ([8d4c30a](https://github.com/brpvieira/vltx/commit/8d4c30ac0c13155610b8a935f6e76080fad2771a))
* **entry:** correct chipher typo to cipher in AESEnvelope ([2633724](https://github.com/brpvieira/vltx/commit/2633724c2ccfec2d6c251326cb65912244b52759))
* **env:** suppress dotenv warning when .env file is absent ([ee1c005](https://github.com/brpvieira/vltx/commit/ee1c005cece88971fe8d22320ffe9ff729724e19))
* **env:** use correct resolution order of passphrase ([a55c03b](https://github.com/brpvieira/vltx/commit/a55c03b30d952f997a081d2bcb940682013efba3))
* eslint errors ([9ae9fb3](https://github.com/brpvieira/vltx/commit/9ae9fb318a4d9d2c81e3984a5e029dd8916dffd9))
* **init:** write generated private key file with 0o600 permissions ([4b7b90b](https://github.com/brpvieira/vltx/commit/4b7b90bc6ba42ae52be4851e68d064ca0949d0ea)), closes [#4](https://github.com/brpvieira/vltx/issues/4)
* **scripts:** use read-only lint check in test script ([d4ffa91](https://github.com/brpvieira/vltx/commit/d4ffa91c44c837ae79b62163d41651bee68fb682)), closes [#17](https://github.com/brpvieira/vltx/issues/17)
* **setup:** cache vault on creation and use TemplateStringsArray for tag ([fc294bc](https://github.com/brpvieira/vltx/commit/fc294bcac0f906011a4cc7e53f0bd5b1716f5000))
* **vault:** allow initializing the vault with a non-existing file ([0406ddb](https://github.com/brpvieira/vltx/commit/0406ddba29c17e104c8df07625a1a6e0c1e36761))
* **vltx:** correct MAX_SECRET_BYTES and use utf-8 byte length check ([8d61bc2](https://github.com/brpvieira/vltx/commit/8d61bc2390fbe0c68d6980e47fe8428afa582925)), closes [#6](https://github.com/brpvieira/vltx/issues/6)
* **vltx:** eliminate TOCTOU races in factory methods ([6acfe20](https://github.com/brpvieira/vltx/commit/6acfe20ef96af620fd7a6ddf80a037bd5263b48c)), closes [#12](https://github.com/brpvieira/vltx/issues/12)
* **vltx:** remove dotenv side effect from library import ([77a2e7e](https://github.com/brpvieira/vltx/commit/77a2e7e6ebf92da81b161fcfc44dd809d7522ae5)), closes [#9](https://github.com/brpvieira/vltx/issues/9)
* **vltx:** validate key pair match in openForReading ([4833624](https://github.com/brpvieira/vltx/commit/483362412ff875ccdabf369a41bcb9bb3321ebe6)), closes [#10](https://github.com/brpvieira/vltx/issues/10)
* **vltx:** validate vault file shape in read() before use ([3b6f454](https://github.com/brpvieira/vltx/commit/3b6f45410668d4df481cec3d04eab27fc6391a27)), closes [#11](https://github.com/brpvieira/vltx/issues/11)


* **cli:** convert vault-file from positional to --vault-file option ([303cbf7](https://github.com/brpvieira/vltx/commit/303cbf7f7cc7e0d847d1fb3d33c179239f37dad8))
* rename exported setup function from setupVltx to setup ([f4b0933](https://github.com/brpvieira/vltx/commit/f4b093368d6ab24d6e52e87d6c6b59adf28747c7))
* rename package, class, CLI, and env vars from vault to vltx ([ce15d07](https://github.com/brpvieira/vltx/commit/ce15d075a452c37402ca46b4840dd28e28a8cca1))
* **rsa:** serialize public key as base64-encoded PKCS[#1](https://github.com/brpvieira/vltx/issues/1) DER ([ec8dd7f](https://github.com/brpvieira/vltx/commit/ec8dd7fa91935fef79c9942f1bd8e75435f648e6))
