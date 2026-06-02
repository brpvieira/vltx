 import Vault, { type VaultConfig } from './core/vault.js';
import getConfig from './core/env.js';

const vaults = new Map<string, Vault>();

type VaultModuleConfig = {
    filename?: string,
    alias?: string,
    inject?: boolean
};

function vaultTag(vault: Vault, strings: TemplateStringsArray,
     ...values: unknown[]): string {
    if(values?.length > 0)  {
        throw new Error('Interpolation in not allowed.');
    }
    if (!strings[0]) { return ''; }
    return vault.get(strings[0]) || '';
}

function resolveConfig(filename?: string) : VaultConfig {
     const args: VaultConfig = {};
     if (filename) {
         args.filename = filename;
     }
     const resolved = getConfig(args);
     return resolved.filename ? { filename: resolved.filename } : {};
 }

/**
 * Initializes (or retrieves) a Vault for the given alias. When
 * `inject` is true, registers a vault`KEY` tag function on `global`.
 *
 * @param filename - Vault file path; falls back to env defaults.
 * @param alias - Global name for the tag function.
 * @param inject - Register the tag function on `global` (default: true).
 * @returns The initialised {@link Vault} instance.
 */
export default function setup({ filename, alias = 'vault', inject = true }:
     VaultModuleConfig) {
    let v: Vault;

    if (vaults.has(alias)) {
        v = vaults.get(alias)!;
    } else {
        const cfg = resolveConfig(filename);
        v = new Vault(cfg);
        vaults.set(alias, v);
    }

    if (inject && !(alias in global)) {
        (global as Record<string, unknown>)[alias] = vaultTag.bind(null, v);
    }
    return v;
}
