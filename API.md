## Modules

<dl>
<dt><a href="#module_core/entry">core/entry</a></dt>
<dd><p>Entry types for the vault, with RSA-OAEP-SHA-256 encryption and binary serialization.</p>
<p>Each entry is a self-describing record: a 1-byte ASCII prefix, two 8-byte
big-endian millisecond timestamps (created/modified), and an RSA-OAEP
ciphertext payload prepended with a 16-byte random salt. Entries are
base64-encoded for storage in the vault JSON file.</p>
</dd>
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
<dt><a href="#module_core/vltx">core/vltx</a></dt>
<dd><p>Core <a href="Vltx">Vltx</a> class and associated configuration types.</p>
<p>A <code>Vltx</code> is an RSA-encrypted key-value store backed by a JSON file.
Values are encrypted with the embedded public key and decrypted on
demand when a private key is supplied. The class implements the
<code>Map&lt;string, AnyEntry&gt;</code> interface and exposes static factory methods
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
<dd><p>Prints a table of all secrets in <code>v</code> sorted by key, showing entry
type and timestamps.</p>
</dd>
</dl>

<a name="module_core/entry"></a>

## core/entry
Entry types for the vault, with RSA-OAEP-SHA-256 encryption and binary serialization.

Each entry is a self-describing record: a 1-byte ASCII prefix, two 8-byte
big-endian millisecond timestamps (created/modified), and an RSA-OAEP
ciphertext payload prepended with a 16-byte random salt. Entries are
base64-encoded for storage in the vault JSON file.


* [core/entry](#module_core/entry)
    * [.BaseEntry](#module_core/entry.BaseEntry)
    * [.SecretEntry](#module_core/entry.SecretEntry)
    * [.LargeEntry](#module_core/entry.LargeEntry)
        * _instance_
            * [.setRaw(publicKey, data)](#module_core/entry.LargeEntry+setRaw)
            * [.decrypt(privateKey, encoding)](#module_core/entry.LargeEntry+decrypt) ⇒
        * _static_
            * [.parse(base64Str)](#module_core/entry.LargeEntry.parse) ⇒
    * [.getRawEntry(str)](#module_core/entry.getRawEntry) ⇒
    * [.rawEntryToString(rawEntry)](#module_core/entry.rawEntryToString) ⇒
    * [.rsaEncrypt(publicKey, data)](#module_core/entry.rsaEncrypt) ⇒
    * [.rsaDecrypt(raw, privateKey)](#module_core/entry.rsaDecrypt) ⇒
    * [.wrapAESPayload(payload)](#module_core/entry.wrapAESPayload) ⇒
    * [.aesEncrypt(publicKey, payload)](#module_core/entry.aesEncrypt) ⇒
    * [.aesDecrypt(aesKey, payload, encoding)](#module_core/entry.aesDecrypt) ⇒
    * [.unwrapAESPayload(buf)](#module_core/entry.unwrapAESPayload) ⇒
    * [.parseEntry(base64Str)](#module_core/entry.parseEntry) ⇒

<a name="module_core/entry.BaseEntry"></a>

### core/entry.BaseEntry
Abstract base for all vault entry types.

Manages the encrypted payload and implements the shared RSA-OAEP-SHA-256
encrypt/decrypt cycle. A 16-byte random salt is prepended to each plaintext
before encryption so that identical values produce distinct ciphertexts.
Subclasses must declare their own [IEntry#prefix](IEntry#prefix) and [IEntry#type](IEntry#type).

**Kind**: static class of [<code>core/entry</code>](#module_core/entry)  
<a name="module_core/entry.SecretEntry"></a>

### core/entry.SecretEntry
A vault entry for short secrets (≤ [MAX_SECRET_BYTES](MAX_SECRET_BYTES) UTF-8 bytes), identified by the `$` prefix.

**Kind**: static class of [<code>core/entry</code>](#module_core/entry)  
<a name="module_core/entry.LargeEntry"></a>

### core/entry.LargeEntry
A vault entry for larger payloads, identified by the `@` prefix.

Uses hybrid encryption: the plaintext is AES-256-GCM encrypted with
a fresh random key, and that key is RSA-OAEP-SHA-256 wrapped. The
serialized payload follows the [AESEnvelope](AESEnvelope) wire layout
produced by [wrapAESPayload](wrapAESPayload).

**Kind**: static class of [<code>core/entry</code>](#module_core/entry)  

* [.LargeEntry](#module_core/entry.LargeEntry)
    * _instance_
        * [.setRaw(publicKey, data)](#module_core/entry.LargeEntry+setRaw)
        * [.decrypt(privateKey, encoding)](#module_core/entry.LargeEntry+decrypt) ⇒
    * _static_
        * [.parse(base64Str)](#module_core/entry.LargeEntry.parse) ⇒

<a name="module_core/entry.LargeEntry+setRaw"></a>

#### largeEntry.setRaw(publicKey, data)
Encrypts `data` with AES-256-GCM using a fresh random key, then
RSA-OAEP-SHA-256 wraps that key and stores the serialized
[AESEnvelope](AESEnvelope) as the raw payload.

**Kind**: instance method of [<code>LargeEntry</code>](#module_core/entry.LargeEntry)  

| Param | Description |
| --- | --- |
| publicKey | RSA public key used to wrap the AES key. |
| data | UTF-8 plaintext to encrypt. |

<a name="module_core/entry.LargeEntry+decrypt"></a>

#### largeEntry.decrypt(privateKey, encoding) ⇒
Unwraps the RSA-encrypted AES key with `privateKey`, then
decrypts the AES-256-GCM ciphertext. Throws if the GCM
authentication tag does not match.

**Kind**: instance method of [<code>LargeEntry</code>](#module_core/entry.LargeEntry)  
**Returns**: Plaintext as a `Buffer`, or as a string when `encoding`
  is given.  
**Throws**:

- <code>Error</code> If the GCM auth tag fails or `privateKey` does
  not match.


| Param | Description |
| --- | --- |
| privateKey | RSA private key matching the one used in   [LargeEntry#setRaw](LargeEntry#setRaw). |
| encoding | Optional encoding; returns a string when set,   Buffer otherwise. |

<a name="module_core/entry.LargeEntry.parse"></a>

#### LargeEntry.parse(base64Str) ⇒
Parses a base64-encoded vault entry into a [LargeEntry](LargeEntry).

**Kind**: static method of [<code>LargeEntry</code>](#module_core/entry.LargeEntry)  
**Returns**: A new [LargeEntry](LargeEntry) with the parsed payload.  

| Param | Description |
| --- | --- |
| base64Str | A serialized entry from   [BaseEntry#serialize](BaseEntry#serialize). |

<a name="module_core/entry.getRawEntry"></a>

### core/entry.getRawEntry(str) ⇒
Parses a base64-encoded vault entry string into its constituent fields.

**Kind**: static method of [<code>core/entry</code>](#module_core/entry)  
**Returns**: A [RawEntry](RawEntry) with the prefix byte, timestamps, and raw payload.  

| Param | Description |
| --- | --- |
| str | Base64 string produced by [rawEntryToString](rawEntryToString). |

<a name="module_core/entry.rawEntryToString"></a>

### core/entry.rawEntryToString(rawEntry) ⇒
Serializes a [RawEntry](RawEntry) to a base64 string for storage.
Wire format: `[1-byte prefix][8-byte createdOn ms BE][8-byte modifiedOn ms BE][payload]`.

**Kind**: static method of [<code>core/entry</code>](#module_core/entry)  
**Returns**: A base64-encoded string.  

| Param | Description |
| --- | --- |
| rawEntry | The raw entry to serialize. |

<a name="module_core/entry.rsaEncrypt"></a>

### core/entry.rsaEncrypt(publicKey, data) ⇒
Encrypts `data` with RSA-OAEP-SHA-256, prepending a 16-byte random salt so
that identical plaintexts produce distinct ciphertexts.

**Kind**: static method of [<code>core/entry</code>](#module_core/entry)  
**Returns**: The RSA ciphertext as a Buffer.  

| Param | Description |
| --- | --- |
| publicKey | The RSA public key to encrypt with. |
| data | The plaintext to encrypt, as a Buffer or UTF-8 string. |

<a name="module_core/entry.rsaDecrypt"></a>

### core/entry.rsaDecrypt(raw, privateKey) ⇒
Decrypts an RSA-OAEP-SHA-256 ciphertext and strips the 16-byte random salt
prepended by [BaseEntry#setRaw](BaseEntry#setRaw).

**Kind**: static method of [<code>core/entry</code>](#module_core/entry)  
**Returns**: The original plaintext as a Buffer, with the leading salt removed.  

| Param | Description |
| --- | --- |
| raw | The RSA ciphertext buffer. |
| privateKey | The RSA private key matching the public key used to encrypt. |

<a name="module_core/entry.wrapAESPayload"></a>

### core/entry.wrapAESPayload(payload) ⇒
Serializes an [AESEnvelope](AESEnvelope) into a single contiguous Buffer.

Wire layout: `[512-byte rsaEncryptedKey][12-byte iv][16-byte authTag][ciphertext]`.

**Kind**: static method of [<code>core/entry</code>](#module_core/entry)  
**Returns**: A Buffer containing all envelope fields concatenated in declaration order.  

| Param | Description |
| --- | --- |
| payload | The AES envelope to serialize. |

<a name="module_core/entry.aesEncrypt"></a>

### core/entry.aesEncrypt(publicKey, payload) ⇒
Encrypts `payload` with AES-256-GCM using a freshly generated random key and
IV, then RSA-wraps the AES key via [rsaEncrypt](rsaEncrypt).

**Kind**: static method of [<code>core/entry</code>](#module_core/entry)  
**Returns**: An [AESEnvelope](AESEnvelope) with the RSA-wrapped key, IV, authentication
  tag, and ciphertext.  

| Param | Description |
| --- | --- |
| publicKey | The RSA public key used to wrap the AES key. |
| payload | The UTF-8 plaintext to encrypt. |

<a name="module_core/entry.aesDecrypt"></a>

### core/entry.aesDecrypt(aesKey, payload, encoding) ⇒
Decrypts an AES-256-GCM ciphertext from an [AESEnvelope](AESEnvelope) using the
supplied raw AES key. Throws if the authentication tag does not match.

**Kind**: static method of [<code>core/entry</code>](#module_core/entry)  
**Returns**: The plaintext as a `Buffer`, or as a string when `encoding` is given.  

| Param | Description |
| --- | --- |
| aesKey | The 32-byte AES key (already RSA-decrypted). |
| payload | The [AESEnvelope](AESEnvelope) containing the IV, authentication   tag, and ciphertext. |
| encoding | Optional encoding; when provided the decrypted bytes are   returned as a string instead of a Buffer. |

<a name="module_core/entry.unwrapAESPayload"></a>

### core/entry.unwrapAESPayload(buf) ⇒
Parses a contiguous Buffer back into an [AESEnvelope](AESEnvelope).

Inverse of [wrapAESPayload](wrapAESPayload). Expects the wire layout produced by that function.

**Kind**: static method of [<code>core/entry</code>](#module_core/entry)  
**Returns**: The deserialized [AESEnvelope](AESEnvelope).  

| Param | Description |
| --- | --- |
| buf | A Buffer produced by [wrapAESPayload](wrapAESPayload). |

<a name="module_core/entry.parseEntry"></a>

### core/entry.parseEntry(base64Str) ⇒
Parses a base64-encoded vault entry and returns the appropriate concrete
instance based on the prefix byte.

**Kind**: static method of [<code>core/entry</code>](#module_core/entry)  
**Returns**: A concrete [AnyEntry](AnyEntry) instance.  
**Throws**:

- <code>Error</code> If the prefix byte does not match any registered entry type.


| Param | Description |
| --- | --- |
| base64Str | A serialized entry produced by [BaseEntry#serialize](BaseEntry#serialize). |

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
    * [.checkKeyPairMatches(privateKey, publicKey)](#module_core/rsa.checkKeyPairMatches) ⇒

<a name="module_core/rsa.DEFAULT_PRIVATE_ENCODING"></a>

### core/rsa.DEFAULT\_PRIVATE\_ENCODING
Default private key export options: PKCS#8, PEM, no encryption.

**Kind**: static constant of [<code>core/rsa</code>](#module_core/rsa)  
<a name="module_core/rsa.DEFAULT_PUBLIC_ENCODING"></a>

### core/rsa.DEFAULT\_PUBLIC\_ENCODING
Default public key export options: PKCS#1, DER.

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
**Returns**: An object with `privateKey` as a PEM string and `publicKey` as a
  base64-encoded DER string.  

| Param | Description |
| --- | --- |
| passphrase | Optional passphrase to encrypt the private key. |

<a name="module_core/rsa.parsePublicKey"></a>

### core/rsa.parsePublicKey(str) ⇒
Parses a base64 encoded DER-encoded public key.

**Kind**: static method of [<code>core/rsa</code>](#module_core/rsa)  
**Returns**: A `KeyObject` representing the public key.  

| Param | Description |
| --- | --- |
| str | base64 string containing the DER encoded public key. |

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

<a name="module_core/vltx"></a>

## core/vltx
Core [Vltx](Vltx) class and associated configuration types.

A `Vltx` is an RSA-encrypted key-value store backed by a JSON file.
Values are encrypted with the embedded public key and decrypted on
demand when a private key is supplied. The class implements the
`Map<string, AnyEntry>` interface and exposes static factory methods
([Vltx.open](Vltx.open), [Vltx.openForReading](Vltx.openForReading),
[Vltx.openForWriting](Vltx.openForWriting)) plus instance-level key lifecycle
helpers ([Vltx#lock](Vltx#lock), [Vltx#unlock](Vltx#unlock)).


* [core/vltx](#module_core/vltx)
    * [module.exports](#exp_module_core/vltx--module.exports) ⏏
        * [new module.exports(opts)](#new_module_core/vltx--module.exports_new)
        * _instance_
            * [.loaded](#module_core/vltx--module.exports+loaded)
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
`Map<string, AnyEntry>` interface.

Secrets are stored as RSA-OAEP-SHA-256 encrypted entries with a random
per-encryption salt (see [BaseEntry#setRaw](BaseEntry#setRaw)).
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

<a name="module_core/vltx--module.exports+loaded"></a>

#### module.exports.loaded
`true` after the vault file has been successfully read and parsed.

**Kind**: instance property of [<code>module.exports</code>](#exp_module_core/vltx--module.exports)  
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
public key and secrets. Sets [loaded](loaded) to `true` on
success; resets it to `false` at the start of each call.

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
Returns a plain-object representation of the vault suitable for JSON
serialization. Secrets are serialized to base64 and sorted by key for
deterministic output.

**Kind**: instance method of [<code>module.exports</code>](#exp_module_core/vltx--module.exports)  
**Returns**: An object with a base64-encoded DER `publicKey` string (or
  `null`) and the `secrets` map as base64-encoded entry strings.  
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
Returns the raw [AnyEntry](AnyEntry) stored under `key`, or `undefined` if
the key does not exist. Use [Vltx#decrypt](Vltx#decrypt) to obtain the plaintext.

**Kind**: instance method of [<code>module.exports</code>](#exp_module_core/vltx--module.exports)  
**Returns**: The entry, or `undefined` if `key` does not exist.  

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
- <code>Error</code> If no private key is provided.
- <code>Error</code> If `opts.filename` does not exist.
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
Prints a table of all secrets in `v` sorted by key, showing entry
type and timestamps.

**Kind**: global function  

| Param | Description |
| --- | --- |
| v | The vault whose entries to display. |

