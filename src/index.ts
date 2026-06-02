 import Vault, { type VaultConfig } from './core/vault.js';
import getConfig from './core/env.js';

const vaults = new Map<string, Vault>();

type VaultModuleConfig = VaultConfig & {
    alias?: string,
    inject?: boolean
};

 const DEFAULTS = {
     alias: 'vault',
     inject: true
 } as const;

function vaultTag(vault: Vault, strings: TemplateStringsArray,
     ...values: unknown[]): string {
    if(values?.length > 0)  {
        throw new Error('Interpolation in not allowed.');
    }
    if (!strings[0]) { return ''; }
    return vault.get(strings[0]) || '';
}

/**
 * Initializes (or retrieves) a Vault for the given alias. When
 * `inject` is true, registers a `alias\`KEY\`` tag function on `global`.
 *
 * Calls with the same `alias` are idempotent — the first call creates
 * and caches the {@link Vault}; subsequent calls return the cached instance.
 *
 * @param args - Configuration object.
 * @param args.filename - Path to the vault file; falls back to the
 *   `VAULT_FILE` environment variable, then `.vault`.
 * @param args.alias - Name of the global tag function (default: `'vault'`).
 * @param args.inject - Register the tag function on `global`
 *   (default: `true`). Pass `false` to skip global registration and
 *   use the returned {@link Vault} directly.
 * @returns The initialized {@link Vault} instance.
 */
export function setupVault(args: VaultModuleConfig = {}) {
    let v: Vault;
    const opts: VaultModuleConfig = { ...DEFAULTS, ...args };
    if (vaults.has(opts.alias!)) {
        v = vaults.get(opts.alias!)!;
    } else {
        const cfg = getConfig(opts as VaultConfig);
        v = new Vault(cfg);
        vaults.set(opts.alias!, v);
    }

    if (opts.inject && !(opts.alias! in global)) {
        (global as Record<string, unknown>)[opts.alias!] = vaultTag.bind(null, v);
    }
    return v;
}
