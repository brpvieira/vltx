import Vault, { type VaultConfig } from '../core/vault.js';
import type { ArgumentsCamelCase } from 'yargs';
import getConfig from '../core/env.js';
import { listKeys } from './helpers.js';

type CommandLineArguments = Partial<{
    'vault-file'?: string | undefined,
    'key-file'?: string | undefined,
    passphrase?: string | undefined,
    key?: string | undefined,
    value?: string | undefined
}>

export type VaultCliConfig = VaultConfig &
    { filename: string; privateKeyFilename: string };

export function resolveConfig(argv: ArgumentsCamelCase): VaultCliConfig {
    const args: VaultConfig = {};
    const { 'vault-file': vaultFile,
        'key-file': keyFile, passphrase } = argv as CommandLineArguments;
    if (vaultFile) args.filename = vaultFile;
    if (keyFile) args.privateKeyFilename = keyFile;
    if (passphrase) args.passphrase = passphrase;
    return getConfig(args) as VaultCliConfig;
}

export function initHandler(argv: ArgumentsCamelCase): void {
    const cfg = resolveConfig(argv);
    Vault.init(cfg.filename!, cfg);
    console.log(`Vault initialised:  ${cfg.filename}`);
    console.log(`Private key:        ${cfg.privateKeyFilename}`);
}

export function addHandler(argv: ArgumentsCamelCase): void {
    const { filename } = resolveConfig(argv);
    const v = new Vault({ filename });
    const { key, value } = argv as CommandLineArguments;
    v.set(key as string, value as string);
    v.write();
    console.log(`Added: ${key as string}`);
}

export function deleteHandler(argv: ArgumentsCamelCase): void {
    const cfg = resolveConfig(argv);
    const v = new Vault(cfg);
    const { key } = argv as CommandLineArguments;
    if (!v.delete(key!)) {
        console.error(
            `Key not found: ${key as string}`,
        );
        process.exit(1);
    }
    v.write();
    console.log(`Deleted: ${key as string}`);
}

export function replaceHandler(argv: ArgumentsCamelCase): void {
    const { filename } = resolveConfig(argv);
    const v = new Vault({ filename });
    const { key, value } = argv as CommandLineArguments;
    v.replace(key as string, value as string);
    v.write();
    console.log(`Replaced: ${key as string}`);
}

export function getHandler(argv: ArgumentsCamelCase): void {
    const cfg = resolveConfig(argv);
    const v = new Vault(cfg);
    const { key } = argv as CommandLineArguments;
    const value = v.get(key!);
    if (value === undefined) {
        console.error(`Key not found: ${key as string}`);
        process.exit(1);
    }
    console.log(value);
}

export function listHandler(argv: ArgumentsCamelCase): void {
    const { filename } = resolveConfig(argv);
    const v = new Vault({ filename });
    listKeys(v);
}
