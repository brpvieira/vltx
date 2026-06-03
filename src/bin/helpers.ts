import Vault from '../core/vault.js';
import { formatWithOptions } from 'node:util';

/**
 * Numeric severity order for log levels.
 * Higher values indicate greater severity.
 * `normal` (4) is the highest level; it produces untagged output and
 * is unaffected by any threshold below `'normal'`.
 */
export const LogLevel = {
    debug:  0,
    info:   1,
    warn:   2,
    error:  3,
    normal: 4
} as const;

let threshold: number = LogLevel.info;

/** Union of valid log level name strings. */
export type LogLevelName = keyof typeof LogLevel;

const RESET = '\x1b[0m';

const ANSI_TEXT: Record<LogLevelName, string> = {
    debug: '\x1b[2;39m', // default faint
    info:  '\x1b[0;36m', // cyan
    warn:  '\x1b[33m', // yellow
    error:  '\x1b[31m', // red
    normal: '\x1b[0;39m'
};

const ANSI_SYMBOL: Record<LogLevelName, string> = {
    debug: '\x1b[1;39m', // bold default
    info:  '\x1b[1;96m', // bold bright cyan
    warn:  '\x1b[1;93m', // bold bright yellow
    error: '\x1b[1;91m', // bold bright red
    normal: '\x1b[0;39m'
};

const SYMBOL: Record<LogLevelName, string> = {
    debug: '·',  // U+00B7
    info:  'ℹ',  // U+2139
    warn:  '⚠',  // U+26A0
    error: '✖',  // U+2716
    normal: '',  // U+2716
};

/**
 * Sets the minimum severity level that produces output.
 * Messages whose level is below `level` are silently discarded.
 * Defaults to `'info'` at module load time.
 *
 * @param level - The new minimum log level.
 * @returns {void}
 */
export function setLogLevel(level: LogLevelName): void {
    threshold = LogLevel[level];
}

/**
 * Core log dispatch; all exported wrappers delegate here.
 * Silently discards the call when `level` is below the threshold.
 *
 * `'error'` is written to `stderr`; all other levels go to `stdout`.
 * For every level except `'normal'` a tag is prepended to the line:
 * - TTY: `ANSI_SYMBOL[level]` + Unicode symbol + reset escape
 * - plain: `[LEVEL]` label
 * Message text is formatted via `util.formatWithOptions`. In TTY mode
 * it is wrapped in `ANSI_TEXT[level]` colour codes; for `'normal'`
 * Node's own colour output is also enabled inside `formatWithOptions`.
 *
 * @param level - Severity of this message.
 * @param args  - Forwarded to `util.formatWithOptions` to form the body.
 * @returns {void}
 */
export function _doLog(level: LogLevelName, ...args: unknown[]): void {
    if (LogLevel[level] < threshold) return;

    const isError = level === 'error';
    const useTag = level !== 'normal';

    const stream  = isError ? process.stderr : process.stdout;
    const useTTY  = isError ? !!process.stderr.isTTY : !!process.stdout.isTTY;
    const opts = { colors: useTTY && !useTag, depth: useTTY ? 3 : 20 };
    const message = useTTY ? ANSI_TEXT[level] + formatWithOptions(opts, ...args) + RESET :
        formatWithOptions(opts, ...args);

    let tag = '';
    if (useTag) {
        tag = useTTY ? ANSI_SYMBOL[level] + SYMBOL[level] + RESET:
            `[${level.toUpperCase()}]`;
        tag += ' ';
    }

    stream.write(`${tag}${message}\n`);
}

/** Logs a `debug`-level message. @param args - Message parts. */
export const debug = (...args: unknown[]): void => _doLog('debug', ...args);
/** Logs an `info`-level message. @param args - Message parts. */
export const info  = (...args: unknown[]): void => _doLog('info',  ...args);
/** Logs a `warn`-level message. @param args - Message parts. */
export const warn  = (...args: unknown[]): void => _doLog('warn',  ...args);
/** Logs an `error`-level message to stderr. @param args - Message parts. */
export const error = (...args: unknown[]): void => _doLog('error', ...args);

/** Writes a message at `normal` level: no tag, stdout only. @param args - Message parts. */
export const log = (...args: unknown[]): void => _doLog('normal', ...args);
/**
 * Prints all secret keys in `v` as a formatted, sorted list.
 *
 * @param v - The vault whose keys to display.
 * @returns {void}
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
