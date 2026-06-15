/**
 * Environment-based vault configuration resolver.
 *
 * Merges caller overrides with `VLTX_FILE`, `VLTX_KEY_FILE`, and
 * `VLTX_PASSPHRASE` environment variables, falling back to defaults
 * of `.vltx` and `.vltx.rsa` in the current working directory.
 * @module env
 */
import type { VltxConfig } from './vltx.js';
import { join } from 'node:path';


type ConfigDefaults = {
    filename: string,
    privateKeyFilename: string
}

const defaults: ConfigDefaults = {
    filename: join(process.cwd(), '.vltx'),
    privateKeyFilename: join(process.cwd(), '.vltx.rsa')
};

/**
 * Resolves vault configuration by merging overrides with environment
 * variables and built-in defaults.
 *
 * Resolution order (highest priority first):
 * 1. `overrides` argument
 * 2. Environment variables (`VLTX_FILE`, `VLTX_KEY_FILE`,
 *    `VLTX_PASSPHRASE`)
 * 3. Defaults (`<cwd>/.vltx`, `<cwd>/.vltx.rsa`)
 *
 * @param overrides - Partial config values that take highest priority.
 * @returns Resolved {@link VltxConfig} with all required fields set.
 */
export default function getConfig(overrides: VltxConfig = {}): VltxConfig {
    const filename: string = overrides.filename || process.env['VLTX_FILE'] ||
        defaults.filename;
    const privateKeyFilename: string = overrides.privateKeyFilename ||
        process.env['VLTX_KEY_FILE'] || defaults.privateKeyFilename;

    const cfg: VltxConfig = { filename, privateKeyFilename };

    const passphrase = overrides.passphrase || process.env['VLTX_PASSPHRASE'];
    if (passphrase) {
        cfg.passphrase = passphrase;
    }

    return cfg;
}
