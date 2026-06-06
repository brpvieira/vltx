import Vltx, { MAX_SECRET_BYTES, type VltxConfig } from './core/vltx.js';
import getConfig from './core/env.js';

export { Vltx, MAX_SECRET_BYTES };
export default Vltx;
export type { VltxConfig };

let vaults = new Map<string, Vltx>();

type VltxModuleConfig = VltxConfig & {
    alias?: string
};

 const DEFAULTS = {
     alias: 'vltx',
 } as const;


/**
 * Initializes (or retrieves) a cached {@link Vltx} for the given alias.
 *
 * Calls with the same `alias` are idempotent — the first call creates
 * and caches the {@link Vltx}; subsequent calls return the cached instance.
 *
 * Use {@link Vltx#tagFunction} on the returned instance to obtain a tag
 * function you can assign to any identifier:
 *
 * ```js
 * const secret = setup({ filename: 'production.vault' }).tagFunction;
 * const dbUrl = secret`DB_URL`;
 * ```
 *
 * @param args - Configuration object.
 * @param args.filename - Path to the vault file; falls back to the
 *   `VLTX_FILE` environment variable, then `.vltx`.
 * @param args.alias - Cache key used to identify this vault (default:
 *   `'vltx'`). Repeated calls with the same alias return the same
 *   instance.
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

    return v;
}

/**
 * Removes a cached {@link Vltx} instance by alias.
 *
 * After removal, the next {@link setup} call with the same alias will create
 * a fresh instance, making this useful when a vault needs to be reconfigured
 * (e.g., a different `filename` or key) without restarting the process.
 *
 * @param alias - The cache key used when the vault was created via {@link setup}.
 * @returns The removed {@link Vltx} instance, or `undefined` if the alias was
 *   not found in the cache.
 */
export function remove(alias: string): Vltx | undefined {
    if (!vaults.has(alias)) {
        return undefined;
    }
    const v = vaults.get(alias);
    vaults.delete(alias);
    return v;
}

/**
 * Removes all cached {@link Vltx} instances.
 *
 * Subsequent {@link setup} calls will create new instances from scratch.
 * Intended primarily for test environments that need a clean slate between
 * test cases.
 */
export function clearAll() {
    vaults = new Map<string, Vltx>();
}
