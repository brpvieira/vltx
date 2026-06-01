#!/usr/bin/env node
import dotenv from 'dotenv';
import yargs, { type Argv } from 'yargs';
import { hideBin } from 'yargs/helpers';
import Vault, { type VaultConfig } from '../core/vault.js';
import getConfig from '../core/env.js';

dotenv.config(); // populate process.env from .env when present

/**
 * Prints all secret keys in `v` as a formatted, sorted list.
 * @param v - The vault whose keys to display.
 * @param vaultFile - File path shown in the heading.
 */
export function listKeys(v: Vault, vaultFile: string): void {
    const keys = [...v.keys()].sort();
    const n = keys.length;
    const noun = n === 1 ? 'secret' : 'secrets';
    const heading = `${vaultFile}  (${n} ${noun})`;
    console.log(heading);
    console.log('─'.repeat(heading.length));
    if (n === 0) {
        console.log('  (empty)');
    } else {
        for (const key of keys) {
            console.log(`  ${key}`);
        }
    }
}

type ResolvedConfig = VaultConfig & { filename: string; privateKeyFilename: string };

function resolveConfig(argv: Record<string, unknown>): ResolvedConfig {
    const args: VaultConfig = {};
    const vaultFile = argv['vault-file'] as string | undefined;
    const keyFile = argv['key-file'] as string | undefined;
    const passphrase = argv['passphrase'] as string | undefined;
    if (vaultFile) args.filename = vaultFile;
    if (keyFile) args.privateKeyFilename = keyFile;
    if (passphrase) args.passphrase = passphrase;
    return getConfig(args) as ResolvedConfig;
}

const cli = yargs(hideBin(process.argv))
    .scriptName('vault-cli')
    .usage('$0 <command> [options]')

    // -- init ----------------------------------------------------─
    .command(
        'init [vault-file]',
        'Create a new vault, generating a key pair if needed',
        (y: Argv) => y
            .positional('vault-file', {
                type: 'string',
                describe: 'Path to the vault JSON file to create' +
                    ' [$VAULT_FILE]',
            })
            .option('key-file', {
                alias: 'k',
                type: 'string',
                describe: 'Private key path (created if absent)' +
                    ' [$VAULT_KEY_FILE]',
            })
            .option('passphrase', {
                alias: 'p',
                type: 'string',
                describe: 'Passphrase to protect the private key' +
                    ' [$VAULT_PASSPHRASE]',
            }),
        (argv) => {
            const cfg = resolveConfig(argv as Record<string, unknown>);
            Vault.init(cfg.filename!, cfg);
            console.log(`Vault initialised:  ${cfg.filename}`);
            console.log(`Private key:        ${cfg.privateKeyFilename}`);
        }
    )

    // -- add ------------------------------------------------------
    .command(
        'add [vault-file] <key> <value>',
        'Encrypt and add a new secret (fails if key exists)',
        (y: Argv) => y
            .positional('vault-file', {
                type: 'string',
                describe: 'Path to the vault JSON file [$VAULT_FILE]',
            })
            .positional('key', {
                type: 'string',
                demandOption: true,
                describe: 'Secret key name',
            })
            .positional('value', {
                type: 'string',
                demandOption: true,
                describe: 'Plaintext value to encrypt',
            }),
        (argv) => {
            const { filename } = resolveConfig(argv as Record<string, unknown>);
            const v = new Vault({ filename });
            v.set(argv.key as string, argv.value as string);
            v.write();
            console.log(`Added: ${argv.key as string}`);
        },
    )

    // -- delete --------------------------------------------------─
    .command(
        'delete [vault-file] <key>',
        'Remove a secret from the vault',
        (y: Argv) => y
            .positional('vault-file', {
                type: 'string',
                describe: 'Path to the vault JSON file [$VAULT_FILE]',
            })
            .positional('key', {
                type: 'string',
                demandOption: true,
                describe: 'Secret key name to remove',
            }),
        (argv) => {
            const { filename } = resolveConfig(argv as Record<string, unknown>);
            const v = new Vault({ filename });
            if (!v.delete(argv.key as string)) {
                console.error(
                    `Key not found: ${argv.key as string}`,
                );
                process.exit(1);
            }
            v.write();
            console.log(`Deleted: ${argv.key as string}`);
        },
    )

    // -- replace --------------------------------------------------
    .command(
        'replace [vault-file] <key> <value>',
        'Encrypt and insert or overwrite a secret',
        (y: Argv) => y
            .positional('vault-file', {
                type: 'string',
                describe: 'Path to the vault JSON file [$VAULT_FILE]',
            })
            .positional('key', {
                type: 'string',
                demandOption: true,
                describe: 'Secret key name',
            })
            .positional('value', {
                type: 'string',
                demandOption: true,
                describe: 'Plaintext value to encrypt',
            }),
        (argv) => {
            const { filename } = resolveConfig(argv as Record<string, unknown>);
            const v = new Vault({ filename });
            v.replace(argv.key as string, argv.value as string);
            v.write();
            console.log(`Replaced: ${argv.key as string}`);
        },
    )

    // -- get ------------------------------------------------------
    .command(
        'get [vault-file] <key>',
        'Decrypt and print a secret value',
        (y: Argv) => y
            .positional('vault-file', {
                type: 'string',
                describe: 'Path to the vault JSON file [$VAULT_FILE]',
            })
            .positional('key', {
                type: 'string',
                demandOption: true,
                describe: 'Secret key name to retrieve',
            })
            .option('key-file', {
                alias: 'k',
                type: 'string',
                describe: 'Path to the private key file' +
                    ' [$VAULT_KEY_FILE]',
            })
            .option('passphrase', {
                alias: 'p',
                type: 'string',
                describe: 'Passphrase for the private key' +
                    ' [$VAULT_PASSPHRASE]',
            }),
        (argv) => {
            const cfg = resolveConfig(argv as Record<string, unknown>);
            const v = new Vault(cfg);
            const value = v.get(argv.key as string);
            if (value === undefined) {
                console.error(`Key not found: ${argv.key as string}`);
                process.exit(1);
            }
            console.log(value);
        },
    )

    // -- list ----------------------------------------------------─
    .command(
        'list [vault-file]',
        'List all secret keys in the vault',
        (y: Argv) => y
            .positional('vault-file', {
                type: 'string',
                describe: 'Path to the vault JSON file [$VAULT_FILE]',
            }),
        (argv) => {
            const { filename } = resolveConfig(argv as Record<string, unknown>);
            const v = new Vault({ filename });
            listKeys(v, filename!);
        },
    )

    .demandCommand(1, 'Please specify a command.')
    .strict()
    .help()
    .alias('h', 'help');

void cli.parseAsync().catch((err: unknown) => {
    console.error(err instanceof Error ? err.message : String(err));
    process.exit(1);
});
