import Vltx, { MAX_SECRET_BYTES, type VltxConfig } from './core/vltx.js';
import getConfig from './core/env.js';

export { Vltx, MAX_SECRET_BYTES };
export default Vltx;
export type { VltxConfig };

 const vaults = new Map<string, Vltx>();

type VltxModuleConfig = VltxConfig & {
    alias?: string,
    inject?: boolean
};

 const DEFAULTS = {
     alias: 'vltx',
     inject: true
 } as const;

function vaultTag(vault: Vltx, strings: TemplateStringsArray,
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
 * and caches the {@link Vltx}; subsequent calls return the cached instance.
 *
 * @param args - Configuration object.
 * @param args.filename - Path to the vault file; falls back to the
 *   `VLTX_FILE` environment variable, then `.vltx`.
 * @param args.alias - Name of the global tag function (default: `'vltx'`).
 * @param args.inject - Register the tag function on `global`
 *   (default: `true`). Pass `false` to skip global registration and
 *   use the returned {@link Vltx} directly.
 * @returns The initialized {@link Vltx} instance.
 */
export function setup(args: VltxModuleConfig = {}) {
    let v: Vltx;
    const opts: VltxModuleConfig = { ...DEFAULTS, ...args };
    if (vaults.has(opts.alias!)) {
        v = vaults.get(opts.alias!)!;
    } else {
        const cfg = getConfig(opts as VltxConfig);
        v = new Vltx(cfg);
        vaults.set(opts.alias!, v);
    }

    if (opts.inject && !(opts.alias! in global)) {
        (global as Record<string, unknown>)[opts.alias!] = vaultTag.bind(null, v);
    }
    return v;
}
