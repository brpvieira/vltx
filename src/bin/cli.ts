#!/usr/bin/env node

import yargs, { type Argv } from 'yargs';
import { hideBin } from 'yargs/helpers';
import { initHandler, addHandler, listHandler, getHandler,
    replaceHandler, deleteHandler } from './commands.js';
import { error } from '../core/logger.js';

function addVaultFile(y: Argv): Argv {
    return y.option('vault-file', {
        alias: 'f',
        type: 'string',
        describe: 'Path to the vault JSON file to create' +
            ' [$VLTX_FILE]',
    });
}

function addKeyFileAndPassphrase(y: Argv): Argv {
    return y
        .option('key-file', {
            alias: 'k',
            type: 'string',
            describe: 'Private key path (created if absent)' +
                ' [$VLTX_KEY_FILE]',
        })
        .option('passphrase', {
            alias: 'p',
            type: 'string',
            describe: 'Passphrase to protect the private key' +
                ' [$VLTX_PASSPHRASE]',
        });
}

function addKey(y: Argv): Argv {
    return y
        .positional('key', {
            type: 'string',
            demandOption: true,
            describe: 'Secret key name',
        });
}

function addValue(y: Argv): Argv {
    return y
        .positional('value', {
            type: 'string',
            demandOption: true,
            describe: 'Plaintext value to encrypt',
        });
}

const cli = yargs(hideBin(process.argv))
    .scriptName('vltx')
    .usage('$0 <command> [options]')

    // -- init ----------------------------------------------------─
    .command(
        'init',
        'Create a new vault, generating a key pair if needed',
        (y: Argv) => {
            addVaultFile(y)
            addKeyFileAndPassphrase(y);
            return y;
        },
        initHandler
    )

    // -- add ------------------------------------------------------
    .command(
        'add <key> <value>',
        'Encrypt and add a new secret (fails if key exists)',
        (y: Argv) => {
            addVaultFile(y);
            addKey(y);
            addValue(y);
            return y;
        },
        addHandler,
    )

    // -- delete --------------------------------------------------─
    .command(
        'delete <key>',
        'Remove a secret from the vault',
        (y: Argv) => {
            addVaultFile(y);
            addKey(y);
            return y;
        },
        deleteHandler,
    )

    // -- replace --------------------------------------------------
    .command(
        'replace <key> <value>',
        'Encrypt and insert or overwrite a secret',
        (y: Argv) => {
            addVaultFile(y);
            addKey(y);
            addValue(y);
            return y;
        },
        replaceHandler,
    )

    // -- get ------------------------------------------------------
    .command(
        'get <key>',
        'Decrypt and print a secret value',
        (y: Argv) => {
            addVaultFile(y);
            addKey(y);
            addKeyFileAndPassphrase(y);
            return y;
        },
        getHandler,
    )

    // -- list ----------------------------------------------------─
    .command(
        'list',
        'List all secret keys in the vault',
        addVaultFile,
        listHandler
    )

    .demandCommand(1, 'Please specify a command.')
    .strict()
    .help()
    .alias('h', 'help');

void cli.parseAsync().catch((err: unknown) => {
    error(err);
    process.exit(1);
});
