/**
 * Environment-based vault configuration resolver.
 *
 * Merges caller overrides with `VAULT_FILE`, `VAULT_KEY_FILE`, and
 * `VAULT_PASSPHRASE` environment variables, falling back to defaults
 * of `.vault` and `.vault.rsa` in the current working directory.
 * @module
 */
import dotenv from 'dotenv';
import type { VaultConfig } from './vault.js';
import { join } from 'node:path';

dotenv.config({ quiet: true });

type ConfigDefaults = {
    filename: string,
    privateKeyFilename: string
}

const defaults: ConfigDefaults = {
    filename: join(process.cwd(), '.vault'),
    privateKeyFilename: join(process.cwd(), '.vault.rsa')
};

/**
 * Resolves vault configuration by merging overrides with environment
 * variables and built-in defaults.
 *
 * Resolution order (highest priority first):
 * 1. `overrides` argument
 * 2. Environment variables (`VAULT_FILE`, `VAULT_KEY_FILE`,
 *    `VAULT_PASSPHRASE`)
 * 3. Defaults (`<cwd>/.vault`, `<cwd>/.vault.rsa`)
 *
 * @param overrides - Partial config values that take highest priority.
 * @returns Resolved {@link VaultConfig} with all required fields set.
 */
export default function getConfig(overrides: VaultConfig = {}): VaultConfig {
    const filename: string = overrides.filename || process.env['VAULT_FILE'] ||
        defaults.filename;
    const privateKeyFilename: string = overrides.privateKeyFilename ||
        process.env['VAULT_KEY_FILE'] || defaults.privateKeyFilename;

    const cfg: VaultConfig = { filename, privateKeyFilename };

    const passphrase = overrides.passphrase || process.env['VAULT_PASSPHRASE'];
    if (passphrase) {
        cfg.passphrase = passphrase;
    }

    return cfg;
}
