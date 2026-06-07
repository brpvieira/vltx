## Modules

<dl>
<dt><a href="#module_core/logger">core/logger</a></dt>
<dd><p>Structured logger for CLI output.</p>
<p>Provides levelled log functions (<code>debug</code>, <code>info</code>, <code>warn</code>, <code>error</code>, <code>log</code>)
with optional ANSI colour formatting when writing to a TTY.
The active threshold is controlled via <a href="setLogLevel">setLogLevel</a>.</p>
</dd>
<dt><a href="#module_core/rsa">core/rsa</a></dt>
<dd><p>RSA key-pair generation and parsing helpers.</p>
<p>Wraps the Node.js <code>crypto</code> module to generate 4096-bit RSA key pairs
(PKCS#8 private key, SPKI public key, both in PEM format) and to
parse PEM-encoded keys into <code>KeyObject</code> instances.</p>
</dd>
<dt><a href="#module_core/util">core/util</a></dt>
<dd><p>String encoding and error-narrowing utilities.</p>
<p>Provides base64 helpers, a salt-and-nonce stuffing layer used to
ensure each RSA encryption of the same plaintext produces a unique
ciphertext, and a Node.js <code>ErrnoException</code> type guard.</p>
</dd>
<dt><a href="#module_core/vltx">core/vltx</a></dt>
<dd><p>Core <a href="Vltx">Vltx</a> class and associated configuration types.</p>
<p>A <code>Vltx</code> is an RSA-encrypted key-value store backed by a JSON file.
Values are encrypted with the embedded public key and decrypted on
demand when a private key is supplied. The class implements the
<code>Map&lt;string, string&gt;</code> interface and exposes static factory methods
(<a href="Vltx.open">Vltx.open</a>, <a href="Vltx.openForReading">Vltx.openForReading</a>,
<a href="Vltx.openForWriting">Vltx.openForWriting</a>) plus instance-level key lifecycle
helpers (<a href="Vltx#lock">Vltx#lock</a>, <a href="Vltx#unlock">Vltx#unlock</a>).</p>
</dd>
</dl>

## Functions

<dl>
<dt><a href="#resolveConfig">resolveConfig(argv)</a> ⇒</dt>
<dd><p>Merges CLI arguments with environment-derived defaults to produce
a fully resolved vault configuration. When <code>--passphrase</code> is given,
reads the passphrase from stdin (piped) or an interactive prompt (TTY).</p>
</dd>
<dt><a href="#initHandler">initHandler(argv)</a></dt>
<dd><p>Handles the <code>init</code> command: creates a new vault and RSA key pair,
then logs their file paths to stdout.</p>
</dd>
<dt><a href="#addHandler">addHandler(argv)</a></dt>
<dd><p>Handles the <code>add</code> command: inserts a new key-value secret into
the vault and persists the change.</p>
</dd>
<dt><a href="#deleteHandler">deleteHandler(argv)</a></dt>
<dd><p>Handles the <code>delete</code> command: removes a secret by key and persists
the vault. Exits with code 1 if the key does not exist.</p>
</dd>
<dt><a href="#replaceHandler">replaceHandler(argv)</a></dt>
<dd><p>Handles the <code>replace</code> command: overwrites the value of an existing
secret and persists the vault.</p>
</dd>
<dt><a href="#getHandler">getHandler(argv)</a></dt>
<dd><p>Handles the <code>get</code> command: retrieves a secret value and prints it
to stdout. Exits with code 1 if the key does not exist.</p>
</dd>
<dt><a href="#listHandler">listHandler(argv)</a></dt>
<dd><p>Handles the <code>list</code> command: prints all secret keys stored in the
vault to stdout.</p>
</dd>
<dt><a href="#listKeys">listKeys(v)</a> ⇒ <code>void</code></dt>
<dd><p>Prints all secret keys in <code>v</code> as a formatted, sorted list.</p>
</dd>
</dl>

<a name="module_core/logger"></a>

## core/logger
Structured logger for CLI output.

Provides levelled log functions (`debug`, `info`, `warn`, `error`, `log`)
with optional ANSI colour formatting when writing to a TTY.
The active threshold is controlled via [setLogLevel](setLogLevel).


* [core/logger](#module_core/logger)
    * [.LogLevel](#module_core/logger.LogLevel)
    * [.debug](#module_core/logger.debug)
    * [.info](#module_core/logger.info)
    * [.warn](#module_core/logger.warn)
    * [.error](#module_core/logger.error)
    * [.log](#module_core/logger.log)
    * [.setLogLevel(level)](#module_core/logger.setLogLevel) ⇒ <code>void</code>
    * [._doLog(level, args)](#module_core/logger._doLog) ⇒ <code>void</code>

<a name="module_core/logger.LogLevel"></a>

### core/logger.LogLevel
Numeric severity order for log levels.
Higher values indicate greater severity.
`normal` (4) is the highest level; it produces untagged output and
is unaffected by any threshold below `'normal'`.

**Kind**: static constant of [<code>core/logger</code>](#module_core/logger)  
<a name="module_core/logger.debug"></a>

### core/logger.debug
Logs a `debug`-level message. @param args - Message parts.

**Kind**: static constant of [<code>core/logger</code>](#module_core/logger)  
<a name="module_core/logger.info"></a>

### core/logger.info
Logs an `info`-level message. @param args - Message parts.

**Kind**: static constant of [<code>core/logger</code>](#module_core/logger)  
<a name="module_core/logger.warn"></a>

### core/logger.warn
Logs a `warn`-level message. @param args - Message parts.

**Kind**: static constant of [<code>core/logger</code>](#module_core/logger)  
<a name="module_core/logger.error"></a>

### core/logger.error
Logs an `error`-level message to stderr. @param args - Message parts.

**Kind**: static constant of [<code>core/logger</code>](#module_core/logger)  
<a name="module_core/logger.log"></a>

### core/logger.log
Writes a message at `normal` level: no tag, stdout only. @param args - Message parts.

**Kind**: static constant of [<code>core/logger</code>](#module_core/logger)  
<a name="module_core/logger.setLogLevel"></a>

### core/logger.setLogLevel(level) ⇒ <code>void</code>
Sets the minimum severity level that produces output.
Messages whose level is below `level` are silently discarded.
Defaults to `'info'` at module load time.

**Kind**: static method of [<code>core/logger</code>](#module_core/logger)  

| Param | Description |
| --- | --- |
| level | The new minimum log level. |

<a name="module_core/logger._doLog"></a>

### core/logger.\_doLog(level, args) ⇒ <code>void</code>
Core log dispatch; all exported wrappers delegate here.
Silently discards the call when `level` is below the threshold.

`'error'` is written to `stderr`; all other levels go to `stdout`.
For every level except `'normal'` a tag is prepended to the line:
- TTY: `ANSI_SYMBOL[level]` + Unicode symbol + reset escape
- plain: `[LEVEL]` label
Message text is formatted via `util.formatWithOptions`. In TTY mode
it is wrapped in `ANSI_TEXT[level]` colour codes; for `'normal'`
Node's own colour output is also enabled inside `formatWithOptions`.

**Kind**: static method of [<code>core/logger</code>](#module_core/logger)  

| Param | Description |
| --- | --- |
| level | Severity of this message. |
| args | Forwarded to `util.formatWithOptions` to form the body. |

<a name="module_core/rsa"></a>

## core/rsa
RSA key-pair generation and parsing helpers.

Wraps the Node.js `crypto` module to generate 4096-bit RSA key pairs
(PKCS#8 private key, SPKI public key, both in PEM format) and to
parse PEM-encoded keys into `KeyObject` instances.


* [core/rsa](#module_core/rsa)
    * [.DEFAULT_PRIVATE_ENCODING](#module_core/rsa.DEFAULT_PRIVATE_ENCODING)
    * [.DEFAULT_PUBLIC_ENCODING](#module_core/rsa.DEFAULT_PUBLIC_ENCODING)
    * [.RSA_OPTIONS](#module_core/rsa.RSA_OPTIONS)
    * [.generateRSAKeyPair(passphrase)](#module_core/rsa.generateRSAKeyPair) ⇒
    * [.parsePublicKey(str)](#module_core/rsa.parsePublicKey) ⇒
    * [.parsePrivateKey(str, passphrase)](#module_core/rsa.parsePrivateKey) ⇒
    * [.derivePublicKey(input)](#module_core/rsa.derivePublicKey) ⇒
    * [.encrypt(key, data)](#module_core/rsa.encrypt) ⇒
    * [.decrypt(key, data)](#module_core/rsa.decrypt) ⇒
    * [.checkKeyPairMatches(privateKey, publicKey)](#module_core/rsa.checkKeyPairMatches) ⇒

<a name="module_core/rsa.DEFAULT_PRIVATE_ENCODING"></a>

### core/rsa.DEFAULT\_PRIVATE\_ENCODING
Default private key export options: PKCS#8, PEM, no encryption.

**Kind**: static constant of [<code>core/rsa</code>](#module_core/rsa)  
<a name="module_core/rsa.DEFAULT_PUBLIC_ENCODING"></a>

### core/rsa.DEFAULT\_PUBLIC\_ENCODING
Default public key export options: SPKI, PEM.

**Kind**: static constant of [<code>core/rsa</code>](#module_core/rsa)  
<a name="module_core/rsa.RSA_OPTIONS"></a>

### core/rsa.RSA\_OPTIONS
Default RSA key-pair generation options: 4096-bit modulus with [DEFAULT_PRIVATE_ENCODING](DEFAULT_PRIVATE_ENCODING) and [DEFAULT_PUBLIC_ENCODING](DEFAULT_PUBLIC_ENCODING).

**Kind**: static constant of [<code>core/rsa</code>](#module_core/rsa)  
<a name="module_core/rsa.generateRSAKeyPair"></a>

### core/rsa.generateRSAKeyPair(passphrase) ⇒
Generates a 4096-bit RSA key pair in PEM format.
The private key is encoded as PKCS#8; if a passphrase is provided it is
encrypted with AES-256-CBC.

**Kind**: static method of [<code>core/rsa</code>](#module_core/rsa)  
**Returns**: An object with `publicKey` and `privateKey` PEM strings.  

| Param | Description |
| --- | --- |
| passphrase | Optional passphrase to encrypt the private key. |

<a name="module_core/rsa.parsePublicKey"></a>

### core/rsa.parsePublicKey(str) ⇒
Parses a PEM-encoded public key.

**Kind**: static method of [<code>core/rsa</code>](#module_core/rsa)  
**Returns**: A `KeyObject` representing the public key.  

| Param | Description |
| --- | --- |
| str | PEM string containing the public key. |

<a name="module_core/rsa.parsePrivateKey"></a>

### core/rsa.parsePrivateKey(str, passphrase) ⇒
Parses a PEM-encoded private key.

**Kind**: static method of [<code>core/rsa</code>](#module_core/rsa)  
**Returns**: A `KeyObject` representing the private key.  

| Param | Description |
| --- | --- |
| str | PEM string containing the private key. |
| passphrase | Optional passphrase if the private key is encrypted. |

<a name="module_core/rsa.derivePublicKey"></a>

### core/rsa.derivePublicKey(input) ⇒
Derives a public key from an existing key object, PEM/DER string, or Buffer.

**Kind**: static method of [<code>core/rsa</code>](#module_core/rsa)  
**Returns**: A `KeyObject` representing the derived public key.  

| Param | Description |
| --- | --- |
| input | The source key material to derive the public key from. |

<a name="module_core/rsa.encrypt"></a>

### core/rsa.encrypt(key, data) ⇒
Encrypts a plaintext string using RSA-OAEP-SHA-256.

**Kind**: static method of [<code>core/rsa</code>](#module_core/rsa)  
**Returns**: A `Buffer` containing the RSA ciphertext.  

| Param | Description |
| --- | --- |
| key | A public `KeyObject` used to encrypt. |
| data | Plaintext string to encrypt. |

<a name="module_core/rsa.decrypt"></a>

### core/rsa.decrypt(key, data) ⇒
Decrypts RSA ciphertext produced by [encrypt](encrypt) using RSA-OAEP-SHA-256.

**Kind**: static method of [<code>core/rsa</code>](#module_core/rsa)  
**Returns**: A `Buffer` containing the recovered plaintext.  

| Param | Description |
| --- | --- |
| key | A private `KeyObject` used to decrypt. |
| data | Ciphertext buffer or string to decrypt. |

<a name="module_core/rsa.checkKeyPairMatches"></a>

### core/rsa.checkKeyPairMatches(privateKey, publicKey) ⇒
Verifies that a private key and public key form a matching pair by signing
and verifying a random challenge.

**Kind**: static method of [<code>core/rsa</code>](#module_core/rsa)  
**Returns**: `true` if the keys form a valid pair, `false` otherwise.  

| Param | Description |
| --- | --- |
| privateKey | The private `KeyObject` to sign with. |
| publicKey | The public `KeyObject` to verify against. |

<a name="module_core/util"></a>

## core/util
String encoding and error-narrowing utilities.

Provides base64 helpers, a salt-and-nonce stuffing layer used to
ensure each RSA encryption of the same plaintext produces a unique
ciphertext, and a Node.js `ErrnoException` type guard.


* [core/util](#module_core/util)
    * [.base64Encode(str)](#module_core/util.base64Encode) ⇒
    * [.base64Decode(str)](#module_core/util.base64Decode) ⇒
    * [.stuffString(str)](#module_core/util.stuffString) ⇒
    * [.unstuffString(str)](#module_core/util.unstuffString) ⇒
    * [.isNodeError(error)](#module_core/util.isNodeError) ⇒

<a name="module_core/util.base64Encode"></a>

### core/util.base64Encode(str) ⇒
Encodes a UTF-8 string to base64.

**Kind**: static method of [<code>core/util</code>](#module_core/util)  
**Returns**: The base64-encoded string.  

| Param | Description |
| --- | --- |
| str | The string to encode. |

<a name="module_core/util.base64Decode"></a>

### core/util.base64Decode(str) ⇒
Decodes a base64 string to UTF-8.

**Kind**: static method of [<code>core/util</code>](#module_core/util)  
**Returns**: The decoded UTF-8 string.  

| Param | Description |
| --- | --- |
| str | The base64-encoded string to decode. |

<a name="module_core/util.stuffString"></a>

### core/util.stuffString(str) ⇒
Wraps a string with a random salt and timestamp nonce.
Format: `<salt>:<base64(str)>:<nonce>`

**Kind**: static method of [<code>core/util</code>](#module_core/util)  
**Returns**: The stuffed string in `salt:base64:nonce` format.  

| Param | Description |
| --- | --- |
| str | The string to wrap. |

<a name="module_core/util.unstuffString"></a>

### core/util.unstuffString(str) ⇒
Extracts the original string from a stuffed value produced by [stuffString](stuffString).

**Kind**: static method of [<code>core/util</code>](#module_core/util)  
**Returns**: The original unwrapped string.  
**Throws**:

- <code>Error</code> If the input is empty or not in the expected `salt:base64:nonce` format.


| Param | Description |
| --- | --- |
| str | The stuffed string in `salt:base64:nonce` format. |

<a name="module_core/util.isNodeError"></a>

### core/util.isNodeError(error) ⇒
Type guard that narrows `error` to `NodeJS.ErrnoException`.

**Kind**: static method of [<code>core/util</code>](#module_core/util)  
**Returns**: `true` when `error` is an `Error` with a `code` property.  

| Param | Description |
| --- | --- |
| error | The value to test. |

<a name="module_core/vltx"></a>

## core/vltx
Core [Vltx](Vltx) class and associated configuration types.

A `Vltx` is an RSA-encrypted key-value store backed by a JSON file.
Values are encrypted with the embedded public key and decrypted on
demand when a private key is supplied. The class implements the
`Map<string, string>` interface and exposes static factory methods
([Vltx.open](Vltx.open), [Vltx.openForReading](Vltx.openForReading),
[Vltx.openForWriting](Vltx.openForWriting)) plus instance-level key lifecycle
helpers ([Vltx#lock](Vltx#lock), [Vltx#unlock](Vltx#unlock)).


* [core/vltx](#module_core/vltx)
    * [module.exports](#exp_module_core/vltx--module.exports) ⏏
        * [new module.exports(opts)](#new_module_core/vltx--module.exports_new)
        * _instance_
            * [.publicKey](#module_core/vltx--module.exports+publicKey)
            * [.canEncrypt](#module_core/vltx--module.exports+canEncrypt)
            * [.canDecrypt](#module_core/vltx--module.exports+canDecrypt)
            * [.keyPairMatches](#module_core/vltx--module.exports+keyPairMatches)
            * [.size](#module_core/vltx--module.exports+size)
            * [.setPrivateKey(opts)](#module_core/vltx--module.exports+setPrivateKey) ⇒
            * [.setPublicKey(key)](#module_core/vltx--module.exports+setPublicKey) ⇒
            * [.lock()](#module_core/vltx--module.exports+lock) ⇒
            * [.unlock(opts)](#module_core/vltx--module.exports+unlock) ⇒
            * [.read(filename)](#module_core/vltx--module.exports+read) ⇒
            * [.tryRead(filename)](#module_core/vltx--module.exports+tryRead) ⇒
            * [.write(filename)](#module_core/vltx--module.exports+write) ⇒
            * [.load(secrets)](#module_core/vltx--module.exports+load) ⇒
            * [.toJSON()](#module_core/vltx--module.exports+toJSON) ⇒
            * [.clear()](#module_core/vltx--module.exports+clear)
            * [.delete(key)](#module_core/vltx--module.exports+delete) ⇒
            * [.forEach(callbackfn, thisArg)](#module_core/vltx--module.exports+forEach)
            * [.get(key)](#module_core/vltx--module.exports+get) ⇒
            * [.getRaw(key)](#module_core/vltx--module.exports+getRaw) ⇒
            * [.has(key)](#module_core/vltx--module.exports+has)
            * [.set(key, value)](#module_core/vltx--module.exports+set) ⇒
            * [.replace(key, value)](#module_core/vltx--module.exports+replace) ⇒
            * [.entries()](#module_core/vltx--module.exports+entries)
            * [.keys()](#module_core/vltx--module.exports+keys)
            * [.values()](#module_core/vltx--module.exports+values)
            * [.getOrInsert(key, value)](#module_core/vltx--module.exports+getOrInsert) ⇒
            * [.getOrInsertComputed(key, callbackfn)](#module_core/vltx--module.exports+getOrInsertComputed) ⇒
        * _static_
            * [.tagFunction(vault, strings, values)](#module_core/vltx--module.exports.tagFunction) ⇒
                * [.tagFunction](#module_core/vltx--module.exports.tagFunction.tagFunction)
            * [.init(filename, privateKeyOpts)](#module_core/vltx--module.exports.init) ⇒
            * [.open(opts)](#module_core/vltx--module.exports.open) ⇒
            * [.openForWriting(opts)](#module_core/vltx--module.exports.openForWriting) ⇒
            * [.openForReading(opts)](#module_core/vltx--module.exports.openForReading) ⇒

<a name="exp_module_core/vltx--module.exports"></a>

### module.exports ⏏
An encrypted key-value store that implements the
`Map<string, string>` interface.

Secrets are stored as RSA-encrypted strings with added entropy
(see [stuffString](stuffString)).
Reading a value transparently decrypts it when a private key is
available; without a private key the raw (encrypted) value is
returned instead.

Vltx files are persisted as JSON containing the public key and
the encrypted secrets map.

**Kind**: Exported class  
<a name="new_module_core/vltx--module.exports_new"></a>

#### new module.exports(opts)
Creates a new Vltx instance.

If `opts.filename` is provided the vault file is read
immediately, which also sets the public key embedded in that
file.
If a private key is provided (via `opts.privateKey` or
`opts.privateKeyFilename`) the public key is derived
automatically when not already loaded from a file.


| Param | Description |
| --- | --- |
| opts | Configuration options including key material and   an optional file path. |

<a name="module_core/vltx--module.exports+publicKey"></a>

#### module.exports.publicKey
The vault's public key, or `undefined` if none has been set.

**Kind**: instance property of [<code>module.exports</code>](#exp_module_core/vltx--module.exports)  
<a name="module_core/vltx--module.exports+canEncrypt"></a>

#### module.exports.canEncrypt
`true` when a public key is available and the vault can
encrypt new secrets.

**Kind**: instance property of [<code>module.exports</code>](#exp_module_core/vltx--module.exports)  
<a name="module_core/vltx--module.exports+canDecrypt"></a>

#### module.exports.canDecrypt
`true` when a private key is available and the vault can
decrypt stored secrets.

**Kind**: instance property of [<code>module.exports</code>](#exp_module_core/vltx--module.exports)  
<a name="module_core/vltx--module.exports+keyPairMatches"></a>

#### module.exports.keyPairMatches
`true` when both a private key and a public key are loaded and they form
a matching pair.

**Kind**: instance property of [<code>module.exports</code>](#exp_module_core/vltx--module.exports)  
<a name="module_core/vltx--module.exports+size"></a>

#### module.exports.size
Number of secrets currently stored in the vault.

**Kind**: instance property of [<code>module.exports</code>](#exp_module_core/vltx--module.exports)  
<a name="module_core/vltx--module.exports+setPrivateKey"></a>

#### module.exports.setPrivateKey(opts) ⇒
Configures the vault's private key from the supplied options.
Accepts a `KeyObject` directly, a PEM string, or a path to a
PEM file. Has no effect when none of the key fields are
provided.

**Kind**: instance method of [<code>module.exports</code>](#exp_module_core/vltx--module.exports)  
**Returns**: `this` for chaining.  

| Param | Description |
| --- | --- |
| opts | Private key material and optional passphrase. |

<a name="module_core/vltx--module.exports+setPublicKey"></a>

#### module.exports.setPublicKey(key) ⇒
Sets the vault's public key, enabling encryption.

**Kind**: instance method of [<code>module.exports</code>](#exp_module_core/vltx--module.exports)  
**Returns**: `this` for chaining.  

| Param | Description |
| --- | --- |
| key | A parsed RSA public `KeyObject`. |

<a name="module_core/vltx--module.exports+lock"></a>

#### module.exports.lock() ⇒
Removes the private key, leaving the vault in encrypt-only
mode. Useful for limiting the window during which key
material is held in memory.

**Kind**: instance method of [<code>module.exports</code>](#exp_module_core/vltx--module.exports)  
**Returns**: `this` for chaining.  
<a name="module_core/vltx--module.exports+unlock"></a>

#### module.exports.unlock(opts) ⇒
Loads a private key into the vault, enabling decryption.
When no public key is already loaded, it is derived
automatically from the private key. Has no effect when no
key fields in `opts` are set.

**Kind**: instance method of [<code>module.exports</code>](#exp_module_core/vltx--module.exports)  
**Returns**: `this` for chaining.  

| Param | Description |
| --- | --- |
| opts | Private key material and optional passphrase. |

<a name="module_core/vltx--module.exports+read"></a>

#### module.exports.read(filename) ⇒
Reads and parses a vault JSON file, replacing the current
public key and secrets.

**Kind**: instance method of [<code>module.exports</code>](#exp_module_core/vltx--module.exports)  
**Returns**: `this` for chaining.  
**Throws**:

- <code>Error</code> If no filename is available.
- <code>Error</code> If the vault file is missing or has an invalid
  `publicKey` field.
- <code>Error</code> If the vault file is missing the `secrets`
  field.


| Param | Description |
| --- | --- |
| filename | Path to the vault file. Falls back to the   filename supplied at construction. |

<a name="module_core/vltx--module.exports+tryRead"></a>

#### module.exports.tryRead(filename) ⇒
Reads a vault file like [read](read), but silently ignores the
file not existing (`ENOENT`). All other errors are re-thrown.

**Kind**: instance method of [<code>module.exports</code>](#exp_module_core/vltx--module.exports)  
**Returns**: `this` for chaining.  
**Throws**:

- <code>Error</code> For any filesystem error other than `ENOENT`.


| Param | Description |
| --- | --- |
| filename | Path to the vault file. Falls back to the   filename supplied at construction. |

<a name="module_core/vltx--module.exports+write"></a>

#### module.exports.write(filename) ⇒
Serializes the vault (public key + secrets) to a JSON file.

**Kind**: instance method of [<code>module.exports</code>](#exp_module_core/vltx--module.exports)  
**Returns**: `this` for chaining.  
**Throws**:

- <code>Error</code> If no filename is available.


| Param | Description |
| --- | --- |
| filename | Destination path. Falls back to the filename   supplied at construction. |

<a name="module_core/vltx--module.exports+load"></a>

#### module.exports.load(secrets) ⇒
Replaces the in-memory secrets map with the provided key-value
pairs. Existing entries are cleared before loading.

**Kind**: instance method of [<code>module.exports</code>](#exp_module_core/vltx--module.exports)  
**Returns**: `this` for chaining.  

| Param | Description |
| --- | --- |
| secrets | Plain object whose entries are loaded as   secrets. |

<a name="module_core/vltx--module.exports+toJSON"></a>

#### module.exports.toJSON() ⇒
Returns a plain-object representation of the vault suitable
for JSON serialization. Secrets are sorted by key for
deterministic output.

**Kind**: instance method of [<code>module.exports</code>](#exp_module_core/vltx--module.exports)  
**Returns**: An object with a PEM `publicKey` string (or `null`)
  and the `secrets` map.  
<a name="module_core/vltx--module.exports+clear"></a>

#### module.exports.clear()
Removes all secrets from the vault.

**Kind**: instance method of [<code>module.exports</code>](#exp_module_core/vltx--module.exports)  
<a name="module_core/vltx--module.exports+delete"></a>

#### module.exports.delete(key) ⇒
Removes the secret with the given key.

**Kind**: instance method of [<code>module.exports</code>](#exp_module_core/vltx--module.exports)  
**Returns**: `true` if the key existed and was removed, `false`
  otherwise.  

| Param | Description |
| --- | --- |
| key | The key to remove. |

<a name="module_core/vltx--module.exports+forEach"></a>

#### module.exports.forEach(callbackfn, thisArg)
Executes `callbackfn` once for each key-value pair in
insertion order.

**Kind**: instance method of [<code>module.exports</code>](#exp_module_core/vltx--module.exports)  

| Param | Description |
| --- | --- |
| callbackfn | Function invoked with `(value, key, map)`. |
| thisArg | Value used as `this` inside the callback. |

<a name="module_core/vltx--module.exports+get"></a>

#### module.exports.get(key) ⇒
Decrypts and returns the secret stored under `key`.

Unlike the `Map` iteration methods (`entries()`, `values()`,
`[Symbol.iterator]`), which yield raw ciphertext, this method
performs RSA decryption and returns the original plaintext.

**Kind**: instance method of [<code>module.exports</code>](#exp_module_core/vltx--module.exports)  
**Returns**: The decrypted plaintext value, or `undefined` if `key`
  does not exist.  
**Throws**:

- <code>Error</code> If no private key is loaded (`canDecrypt` is
  `false`).


| Param | Description |
| --- | --- |
| key | The secret key to look up. |

<a name="module_core/vltx--module.exports+getRaw"></a>

#### module.exports.getRaw(key) ⇒
Returns the raw base64-encoded ciphertext for `key` without
decrypting it.

Useful for inspecting or transferring encrypted values without
requiring a private key. Returns `undefined` when the key does
not exist.

**Kind**: instance method of [<code>module.exports</code>](#exp_module_core/vltx--module.exports)  
**Returns**: The base64-encoded ciphertext, or `undefined` if `key`
  does not exist.  

| Param | Description |
| --- | --- |
| key | The secret key to look up. |

<a name="module_core/vltx--module.exports+has"></a>

#### module.exports.has(key)
Returns `true` if a secret with the given key exists in the
vault.

**Kind**: instance method of [<code>module.exports</code>](#exp_module_core/vltx--module.exports)  

| Param | Description |
| --- | --- |
| key | The key to look up. |

<a name="module_core/vltx--module.exports+set"></a>

#### module.exports.set(key, value) ⇒
Inserts a new encrypted secret under `key`.
The plaintext value is RSA-encrypted with the vault's public
key before storage. Use [replace](replace) to overwrite an
existing key.

**Kind**: instance method of [<code>module.exports</code>](#exp_module_core/vltx--module.exports)  
**Returns**: `this` for chaining.  
**Throws**:

- <code>Error</code> If no public key is available.
- <code>Error</code> If `key` already exists — use [replace](replace)
  to overwrite.
- <code>Error</code> If `value` exceeds [MAX_SECRET_BYTES](MAX_SECRET_BYTES)
  UTF-8 bytes.


| Param | Description |
| --- | --- |
| key | The secret key. |
| value | The plaintext value to encrypt and store. |

<a name="module_core/vltx--module.exports+replace"></a>

#### module.exports.replace(key, value) ⇒
Inserts or overwrites a secret under `key` (upsert).
Behaves identically to [set](set) but does not throw when
the key already exists, making it safe for both initial
population and updates.

**Kind**: instance method of [<code>module.exports</code>](#exp_module_core/vltx--module.exports)  
**Returns**: `this` for chaining.  
**Throws**:

- <code>Error</code> If no public key is available.
- <code>Error</code> If `value` exceeds [MAX_SECRET_BYTES](MAX_SECRET_BYTES)
  UTF-8 bytes.


| Param | Description |
| --- | --- |
| key | The secret key. |
| value | The plaintext value to encrypt and store. |

<a name="module_core/vltx--module.exports+entries"></a>

#### module.exports.entries()
Returns an iterator over `[key, encryptedValue]` pairs in insertion
order.

**Note:** values are always the raw ciphertext stored on disk,
regardless of whether a private key is loaded. Unlike [get](get),
no decryption occurs. Spread or destructure with care:
`Object.fromEntries(vault)` and `for (const [k, v] of vault.entries())`
will produce encrypted base64 blobs, not plaintext.

**Kind**: instance method of [<code>module.exports</code>](#exp_module_core/vltx--module.exports)  
<a name="module_core/vltx--module.exports+keys"></a>

#### module.exports.keys()
Returns an iterator over the secret keys in insertion order.

**Kind**: instance method of [<code>module.exports</code>](#exp_module_core/vltx--module.exports)  
<a name="module_core/vltx--module.exports+values"></a>

#### module.exports.values()
Returns an iterator over raw (encrypted) values in insertion order.

**Note:** values are always the raw ciphertext stored on disk,
regardless of whether a private key is loaded. Unlike [get](get),
no decryption occurs. Use [get](get) to retrieve a decrypted value
for a specific key.

**Kind**: instance method of [<code>module.exports</code>](#exp_module_core/vltx--module.exports)  
<a name="module_core/vltx--module.exports+getOrInsert"></a>

#### module.exports.getOrInsert(key, value) ⇒
Returns the value for `key`, inserting `value` if the key
does not yet exist.

**Kind**: instance method of [<code>module.exports</code>](#exp_module_core/vltx--module.exports)  
**Returns**: The existing or newly inserted value.  

| Param | Description |
| --- | --- |
| key | The key to look up or insert. |
| value | Default value to insert when the key is absent. |

<a name="module_core/vltx--module.exports+getOrInsertComputed"></a>

#### module.exports.getOrInsertComputed(key, callbackfn) ⇒
Returns the value for `key`, inserting the result of
`callbackfn(key)` if absent.

**Kind**: instance method of [<code>module.exports</code>](#exp_module_core/vltx--module.exports)  
**Returns**: The existing or newly computed value.  

| Param | Description |
| --- | --- |
| key | The key to look up or insert. |
| callbackfn | Factory called with `key` to produce the   default value. |

<a name="module_core/vltx--module.exports.tagFunction"></a>

#### module.exports.tagFunction(vault, strings, values) ⇒
Tag function that looks up a secret by key in `vault`.

This is the underlying implementation used by [Vltx#tagFunction](Vltx#tagFunction).
Prefer the instance getter for typical use; call this directly only when
you need to supply the vault explicitly.

**Kind**: static method of [<code>module.exports</code>](#exp_module_core/vltx--module.exports)  
**Returns**: The decrypted plaintext value, or an empty string if the key is
  absent or the template is empty.  
**Throws**:

- <code>Error</code> If interpolation values are passed.


| Param | Description |
| --- | --- |
| vault | The vault to read from. |
| strings | Template strings array; only `strings[0]` is used as the   lookup key. |
| values | Must be empty — interpolation is not supported. |

<a name="module_core/vltx--module.exports.tagFunction.tagFunction"></a>

##### tagFunction.tagFunction
Returns a tag function bound to this vault instance.

Assign it to any identifier to use it as a tagged template
literal; the key is looked up in this vault and the decrypted
value is returned. An unknown key or an empty template returns
an empty string. Interpolation is not supported and will throw.

```js
const secret = vault.tagFunction;
const dbUrl = secret`DB_URL`;
```

**Kind**: static property of [<code>tagFunction</code>](#module_core/vltx--module.exports.tagFunction)  
<a name="module_core/vltx--module.exports.init"></a>

#### module.exports.init(filename, privateKeyOpts) ⇒
Creates a new vault file at `filename` and persists it to
disk.

When `privateKeyOpts.privateKeyFilename` is provided and that
path does not yet exist, a fresh 4096-bit RSA key pair is
generated and the private key is written there before the
vault is created.

The returned instance has its filename stored and is ready
for both encryption and decryption.

**Kind**: static method of [<code>module.exports</code>](#exp_module_core/vltx--module.exports)  
**Returns**: A configured [Vltx](Vltx) backed by `filename`.  
**Throws**:

- <code>Error</code> If neither `privateKey` nor
  `privateKeyFilename` is provided.


| Param | Description |
| --- | --- |
| filename | Destination path for the vault JSON file. |
| privateKeyOpts | Key material. Must include either   `privateKey` or `privateKeyFilename`. |

<a name="module_core/vltx--module.exports.open"></a>

#### module.exports.open(opts) ⇒
Opens a vault from the supplied configuration.

Passes `opts` directly to the [Vltx](Vltx) constructor.
If `opts.filename` is provided the file must already exist;
all other validation is left to the caller.

**Kind**: static method of [<code>module.exports</code>](#exp_module_core/vltx--module.exports)  
**Returns**: A configured [Vltx](Vltx) instance.  
**Throws**:

- <code>Error</code> If `opts.filename` is provided but does not exist.


| Param | Description |
| --- | --- |
| opts | Full vault configuration. |

<a name="module_core/vltx--module.exports.openForWriting"></a>

#### module.exports.openForWriting(opts) ⇒
Opens an existing vault file for writing (encryption only).

Reads `opts.filename` to load the embedded public key; no
private key material from `opts` is forwarded to the
constructor, so the returned vault has `canDecrypt` false.

**Kind**: static method of [<code>module.exports</code>](#exp_module_core/vltx--module.exports)  
**Returns**: A [Vltx](Vltx) with `canEncrypt` true and
  `canDecrypt` false.  
**Throws**:

- <code>Error</code> If `opts.filename` is not provided.
- <code>Error</code> If `opts.filename` does not exist.


| Param | Description |
| --- | --- |
| opts | Full vault configuration. Only `filename` is   used; all key material is ignored. |

<a name="module_core/vltx--module.exports.openForReading"></a>

#### module.exports.openForReading(opts) ⇒
Opens an existing vault file for reading (decryption).

Reads `opts.filename`, loads the embedded public key and
secrets, then unlocks the vault with the private key in
`opts`.

**Kind**: static method of [<code>module.exports</code>](#exp_module_core/vltx--module.exports)  
**Returns**: A [Vltx](Vltx) with `canDecrypt` true.  
**Throws**:

- <code>Error</code> If `opts.filename` is not provided.
- <code>Error</code> If `opts.filename` does not exist.
- <code>Error</code> If no private key is provided.
- <code>Error</code> If the private key cannot decrypt the vault.


| Param | Description |
| --- | --- |
| opts | Full vault configuration. `filename` and at   least one of `privateKeyFilename` or `privateKey` are   required. |

<a name="resolveConfig"></a>

## resolveConfig(argv) ⇒
Merges CLI arguments with environment-derived defaults to produce
a fully resolved vault configuration. When `--passphrase` is given,
reads the passphrase from stdin (piped) or an interactive prompt (TTY).

**Kind**: global function  
**Returns**: Resolved configuration with filename and key paths.  

| Param | Description |
| --- | --- |
| argv | Parsed yargs arguments from the CLI. |

<a name="initHandler"></a>

## initHandler(argv)
Handles the `init` command: creates a new vault and RSA key pair,
then logs their file paths to stdout.

**Kind**: global function  

| Param | Description |
| --- | --- |
| argv | Parsed yargs arguments from the CLI. |

<a name="addHandler"></a>

## addHandler(argv)
Handles the `add` command: inserts a new key-value secret into
the vault and persists the change.

**Kind**: global function  

| Param | Description |
| --- | --- |
| argv | Parsed yargs arguments including `key` and `value`. |

<a name="deleteHandler"></a>

## deleteHandler(argv)
Handles the `delete` command: removes a secret by key and persists
the vault. Exits with code 1 if the key does not exist.

**Kind**: global function  

| Param | Description |
| --- | --- |
| argv | Parsed yargs arguments including `key`. |

<a name="replaceHandler"></a>

## replaceHandler(argv)
Handles the `replace` command: overwrites the value of an existing
secret and persists the vault.

**Kind**: global function  

| Param | Description |
| --- | --- |
| argv | Parsed yargs arguments including `key` and `value`. |

<a name="getHandler"></a>

## getHandler(argv)
Handles the `get` command: retrieves a secret value and prints it
to stdout. Exits with code 1 if the key does not exist.

**Kind**: global function  

| Param | Description |
| --- | --- |
| argv | Parsed yargs arguments including `key`. |

<a name="listHandler"></a>

## listHandler(argv)
Handles the `list` command: prints all secret keys stored in the
vault to stdout.

**Kind**: global function  

| Param | Description |
| --- | --- |
| argv | Parsed yargs arguments from the CLI. |

<a name="listKeys"></a>

## listKeys(v) ⇒ <code>void</code>
Prints all secret keys in `v` as a formatted, sorted list.

**Kind**: global function  

| Param | Description |
| --- | --- |
| v | The vault whose keys to display. |

