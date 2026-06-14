import Vltx from '../core/vltx.js';
import { log } from '../core/logger.js';

const DATE_LEN = 19; // 'YYYY-MM-DD HH:MM:SS'

function formatDate(d: Date): string {
    return d.toISOString().slice(0, DATE_LEN).replace('T', ' ');
}

/**
 * Prints a table of all secrets in `v` sorted by key, showing entry
 * type and timestamps.
 *
 * @param v - The vault whose entries to display.
 * @returns {void}
 */
export function listKeys(v: Vltx): void {
    const entries = [...v.entries()].sort(([a], [b]) => a.localeCompare(b));
    const n = entries.length;
    const noun = n === 1 ? 'secret' : 'secrets';

    log(`${v.filename}  (${n} ${noun})`);

    if (n === 0) {
        log('  (empty)');
        return;
    }

    const H_KEY = 'KEY';
    const H_TYPE = 'TYPE';
    const H_CREATED = 'CREATED';
    const H_MODIFIED = 'MODIFIED';

    const wKey  = Math.max(H_KEY.length,  ...entries.map(([k]) => k.length));
    const wType = Math.max(H_TYPE.length, ...entries.map(([, e]) => e.type.length));
    const wCreated = Math.max(H_CREATED.length, DATE_LEN);

    const row = (key: string, type: string, created: string, modified: string) =>
        `${key.padEnd(wKey)}  ${type.padEnd(wType)}  ${created.padEnd(wCreated)}  ${modified}`;

    const sepLen = wKey + 2 + wType + 2 + wCreated + 2 + Math.max(H_MODIFIED.length, DATE_LEN);

    log(row(H_KEY, H_TYPE, H_CREATED, H_MODIFIED));
    log('─'.repeat(sepLen));
    for (const [key, entry] of entries) {
        log(row(key, entry.type, formatDate(entry.createdOn), formatDate(entry.modifiedOn)));
    }
}
