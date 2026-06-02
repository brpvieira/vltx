import Vault from '../core/vault.js';

/**
 * Prints all secret keys in `v` as a formatted, sorted list.
 * @param v - The vault whose keys to display.
 */
export function listKeys(v: Vault): void {
    const keys = [...v.keys()].sort();
    const n = keys.length;
    const noun = n === 1 ? 'secret' : 'secrets';
    const heading = `${v.filename}  (${n} ${noun})`;
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
