#!/usr/bin/env node
import dotenv from 'dotenv';
import yargs, { type Argv } from 'yargs';
import { hideBin } from 'yargs/helpers';
import Vault, { type PrivateKeyConfig, type VaultConfig }
    from '../core/vault.js';

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

const cli = yargs(hideBin(process.argv))
    .scriptName('vault-cli')
    .usage('$0 <command> [options]')

    // -- init ----------------------------------------------------─
    .command(
        'init <vault-file>',
        'Create a new vault, generating a key pair if needed',
        (y: Argv) => y
            .positional('vault-file', {
                type: 'string',
                demandOption: true,
                describe: 'Path to the vault JSON file to create',
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
            const vaultFile = argv['vault-file'] as string;
            const keyFile = (argv['key-file'] as string | undefined) ??
                process.env['VAULT_KEY_FILE'] ??
                vaultFile.replace(/(\.[^.]+)?$/, '.pem');
            const opts: PrivateKeyConfig = { privateKeyFilename: keyFile };
            const passphrase = (argv.passphrase as string | undefined) ??
                process.env['VAULT_PASSPHRASE'];
            if (passphrase !== undefined) opts.passphrase = passphrase;
            Vault.init(vaultFile, opts);
            console.log(`Vault initialised:  ${vaultFile}`);
            console.log(`Private key:        ${keyFile}`);
        },
    )

    // -- add ------------------------------------------------------
    .command(
        'add <vault-file> <key> <value>',
        'Encrypt and add a new secret (fails if key exists)',
        (y: Argv) => y
            .positional('vault-file', {
                type: 'string',
                demandOption: true,
                describe: 'Path to the vault JSON file',
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
            const v = new Vault({
                filename: argv['vault-file'] as string,
            });
            v.set(argv.key as string, argv.value as string);
            v.write();
            console.log(`Added: ${argv.key as string}`);
        },
    )

    // -- delete --------------------------------------------------─
    .command(
        'delete <vault-file> <key>',
        'Remove a secret from the vault',
        (y: Argv) => y
            .positional('vault-file', {
                type: 'string',
                demandOption: true,
                describe: 'Path to the vault JSON file',
            })
            .positional('key', {
                type: 'string',
                demandOption: true,
                describe: 'Secret key name to remove',
            }),
        (argv) => {
            const v = new Vault({
                filename: argv['vault-file'] as string,
            });
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
        'replace <vault-file> <key> <value>',
        'Encrypt and insert or overwrite a secret',
        (y: Argv) => y
            .positional('vault-file', {
                type: 'string',
                demandOption: true,
                describe: 'Path to the vault JSON file',
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
            const v = new Vault({
                filename: argv['vault-file'] as string,
            });
            v.replace(argv.key as string, argv.value as string);
            v.write();
            console.log(`Replaced: ${argv.key as string}`);
        },
    )

    // -- get ------------------------------------------------------
    .command(
        'get <vault-file> <key>',
        'Decrypt and print a secret value',
        (y: Argv) => y
            .positional('vault-file', {
                type: 'string',
                demandOption: true,
                describe: 'Path to the vault JSON file',
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
            const keyFile = (argv['key-file'] as string | undefined) ??
                process.env['VAULT_KEY_FILE'];
            if (keyFile === undefined) {
                console.error(
                    'key-file is required; ' +
                    'pass --key-file or set VAULT_KEY_FILE',
                );
                process.exit(1);
            }
            const vaultOpts: VaultConfig = {
                filename: argv['vault-file'] as string,
                privateKeyFilename: keyFile,
            };
            const passphrase = (argv.passphrase as string | undefined) ??
                process.env['VAULT_PASSPHRASE'];
            if (passphrase !== undefined) {
                vaultOpts.passphrase = passphrase;
            }
            const v = new Vault(vaultOpts);
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
        'list <vault-file>',
        'List all secret keys in the vault',
        (y: Argv) => y
            .positional('vault-file', {
                type: 'string',
                demandOption: true,
                describe: 'Path to the vault JSON file',
            }),
        (argv) => {
            const vaultFile = argv['vault-file'] as string;
            const v = new Vault({ filename: vaultFile });
            listKeys(v, vaultFile);
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
