import Vltx, { type VltxConfig } from '../core/vltx.js';
import type { ArgumentsCamelCase } from 'yargs';
import { createInterface } from 'node:readline';
import getConfig from '../core/env.js';
import { listKeys } from './helpers.js';
import { log, error, STD_LOGGER, setLogLevel, type Logger } from '../core/logger.js';

type CommandLineArguments = Partial<{
    'vault-file'?: string | undefined,
    'key-file'?: string | undefined,
    passphrase?: boolean | undefined,
    key?: string | undefined,
    value?: string | undefined
}>

/**
 * Resolved CLI configuration: extends {@link VltxConfig} with the
 * required `filename` and `privateKeyFilename` fields.
 */
export type VltxCliConfig = VltxConfig &
    { filename: string; privateKeyFilename: string };

function promptInteractive(): Promise<string> {
    const rl = createInterface({ input: process.stdin, output: process.stderr });
    // Suppress echo of typed characters while still showing the prompt.
    (rl as unknown as { _writeToOutput: (_s: string) => void })._writeToOutput =
        (s: string) => { if (s === 'Passphrase: ') process.stderr.write(s); };
    return new Promise<string>((resolve) => {
        rl.question('Passphrase: ', (answer) => {
            process.stderr.write('\n');
            rl.close();
            resolve(answer);
        });
    });
}

function readPassphrase(): Promise<string> {
    if (!process.stdin.isTTY) {
        return new Promise<string>((resolve, reject) => {
            let data = '';
            process.stdin.setEncoding('utf8');
            process.stdin.on('data', (chunk) => { data += chunk as string; });
            process.stdin.on('end', () => resolve(data.trimEnd()));
            process.stdin.on('error', reject);
        });
    }
    return promptInteractive();
}

/**
 * Merges CLI arguments with environment-derived defaults to produce
 * a fully resolved vault configuration. When `--passphrase` is given,
 * reads the passphrase from stdin (piped) or an interactive prompt (TTY).
 *
 * Applies the `--verbose` flag via {@link setLogLevel} and attaches
 * {@link STD_LOGGER} so that library-level log events are forwarded to
 * the CLI output streams.
 *
 * @param argv - Parsed yargs arguments from the CLI.
 * @returns Resolved configuration with filename, key paths, and logger.
 */
export async function resolveConfig(argv: ArgumentsCamelCase): Promise<VltxCliConfig> {
    setLogLevel(argv['verbose'] as number);
    const args: VltxConfig = {};
    const { 'vault-file': vaultFile,
        'key-file': keyFile, passphrase } = argv as CommandLineArguments;
    if (vaultFile) args.filename = vaultFile;
    if (keyFile) args.privateKeyFilename = keyFile;
    if (passphrase) args.passphrase = await readPassphrase();
    return { ...getConfig(args), ...STD_LOGGER } as VltxCliConfig;
}

/**
 * Handles the `init` command: creates a new vault and RSA key pair,
 * then logs their file paths to stdout.
 *
 * @param argv - Parsed yargs arguments from the CLI.
 */
export async function initHandler(argv: ArgumentsCamelCase): Promise<void> {
    const cfg = await resolveConfig(argv);
    Vltx.init(cfg.filename!, cfg, cfg as Logger);
    log(`Vault initialized:  ${cfg.filename}`);
    log(`Private key:        ${cfg.privateKeyFilename}`);
}

/**
 * Handles the `add` command: inserts a new key-value secret into
 * the vault and persists the change.
 *
 * @param argv - Parsed yargs arguments including `key` and `value`.
 */
export async function addHandler(argv: ArgumentsCamelCase): Promise<void> {
    const cfg = await resolveConfig(argv);
    const v = Vltx.openForWriting(cfg);
    const { key, value } = argv as CommandLineArguments;
    v.set(key as string, value as string);
    v.write();
    log(`Added: ${key as string}`);
}

/**
 * Handles the `delete` command: removes a secret by key and persists
 * the vault. Exits with code 1 if the key does not exist.
 *
 * @param argv - Parsed yargs arguments including `key`.
 */
export async function deleteHandler(argv: ArgumentsCamelCase): Promise<void> {
    const cfg = await resolveConfig(argv);
    const v = Vltx.openForWriting(cfg);
    const { key } = argv as CommandLineArguments;
    if (!v.delete(key!)) {
        error(`Key not found: ${key as string}`);
        process.exit(1);
    }
    v.write();
    log(`Deleted: ${key as string}`);
}

/**
 * Handles the `replace` command: overwrites the value of an existing
 * secret and persists the vault.
 *
 * @param argv - Parsed yargs arguments including `key` and `value`.
 */
export async function replaceHandler(argv: ArgumentsCamelCase): Promise<void> {
    const cfg = await resolveConfig(argv);
    const v = Vltx.openForWriting(cfg);
    const { key, value } = argv as CommandLineArguments;
    v.replace(key as string, value as string);
    v.write();
    log(`Replaced: ${key as string}`);
}

/**
 * Handles the `get` command: retrieves a secret value and prints it
 * to stdout. Exits with code 1 if the key does not exist.
 *
 * @param argv - Parsed yargs arguments including `key`.
 */
export async function getHandler(argv: ArgumentsCamelCase): Promise<void> {
    const cfg = await resolveConfig(argv);
    const v = Vltx.openForReading(cfg);
    const { key } = argv as CommandLineArguments;
    const value = v.decrypt(key!);
    if (value === undefined) {
        error(`Key not found: ${key as string}`);
        process.exit(1);
    }
    log(Buffer.isBuffer(value) ? value.toString('utf8') : value);
}

/**
 * Handles the `list` command: prints all secret keys stored in the
 * vault to stdout.
 *
 * @param argv - Parsed yargs arguments from the CLI.
 */
export async function listHandler(argv: ArgumentsCamelCase): Promise<void> {
    const cfg = await resolveConfig(argv);
    const v = Vltx.openForWriting(cfg);
    listKeys(v);
}
