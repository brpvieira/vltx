import Vltx, { type VltxConfig } from '../core/vltx.js';
import type { ArgumentsCamelCase } from 'yargs';
import getConfig from '../core/env.js';
import { listKeys } from './helpers.js';
import { log, error } from '../core/logger.js';

type CommandLineArguments = Partial<{
    'vault-file'?: string | undefined,
    'key-file'?: string | undefined,
    passphrase?: string | undefined,
    key?: string | undefined,
    value?: string | undefined
}>

/**
 * Resolved CLI configuration: extends {@link VltxConfig} with the
 * required `filename` and `privateKeyFilename` fields.
 */
export type VltxCliConfig = VltxConfig &
    { filename: string; privateKeyFilename: string };

/**
 * Merges CLI arguments with environment-derived defaults to produce
 * a fully resolved vault configuration.
 *
 * @param argv - Parsed yargs arguments from the CLI.
 * @returns Resolved configuration with filename and key paths.
 */
export function resolveConfig(argv: ArgumentsCamelCase): VltxCliConfig {
    const args: VltxConfig = {};
    const { 'vault-file': vaultFile,
        'key-file': keyFile, passphrase } = argv as CommandLineArguments;
    if (vaultFile) args.filename = vaultFile;
    if (keyFile) args.privateKeyFilename = keyFile;
    if (passphrase) args.passphrase = passphrase;
    return getConfig(args) as VltxCliConfig;
}

/**
 * Handles the `init` command: creates a new vault and RSA key pair,
 * then logs their file paths to stdout.
 *
 * @param argv - Parsed yargs arguments from the CLI.
 * @returns {void}
 */
export function initHandler(argv: ArgumentsCamelCase): void {
    const cfg = resolveConfig(argv);
    Vltx.init(cfg.filename!, cfg);
    log(`Vault initialised:  ${cfg.filename}`);
    log(`Private key:        ${cfg.privateKeyFilename}`);
}

/**
 * Handles the `add` command: inserts a new key-value secret into
 * the vault and persists the change.
 *
 * @param argv - Parsed yargs arguments including `key` and `value`.
 * @returns {void}
 */
export function addHandler(argv: ArgumentsCamelCase): void {
    const cfg = resolveConfig(argv);
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
 * @returns {void}
 */
export function deleteHandler(argv: ArgumentsCamelCase): void {
    const cfg = resolveConfig(argv);
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
 * @returns {void}
 */
export function replaceHandler(argv: ArgumentsCamelCase): void {
    const cfg = resolveConfig(argv);
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
 * @returns {void}
 */
export function getHandler(argv: ArgumentsCamelCase): void {
    const cfg = resolveConfig(argv);
    const v = Vltx.openForReading(cfg);
    const { key } = argv as CommandLineArguments;
    const value = v.get(key!);
    if (value === undefined) {
        error(`Key not found: ${key as string}`);
        process.exit(1);
    }
    log(value);
}

/**
 * Handles the `list` command: prints all secret keys stored in the
 * vault to stdout.
 *
 * @param argv - Parsed yargs arguments from the CLI.
 * @returns {void}
 */
export function listHandler(argv: ArgumentsCamelCase): void {
    const cfg = resolveConfig(argv);
    const v = Vltx.openForWriting(cfg);
    listKeys(v);
}
