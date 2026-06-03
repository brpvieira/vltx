import Vault from '../core/vault.js';

/**
 * Numeric severity order for log levels.
 * Higher values indicate greater severity.
 */
export const LogLevel = {
    debug: 0,
    info:  1,
    warn:  2,
    error: 3,
} as const;

/** Union of valid log level name strings. */
export type LogLevelName = keyof typeof LogLevel;

const ANSI: Record<LogLevelName, string> = {
    debug: '\x1b[36m', // cyan
    info:  '\x1b[32m', // green
    warn:  '\x1b[33m', // yellow
    error: '\x1b[31m', // red
};
const SYMBOL: Record<LogLevelName, string> = {
    debug: '·',  // U+00B7
    info:  'ℹ',  // U+2139
    warn:  '⚠',  // U+26A0
    error: '✖',  // U+2716
};
const RESET = '\x1b[0m';

function resolveThreshold(): number {
    const raw = (process.env['LOG_LEVEL'] ?? 'info').toLowerCase();
    return raw in LogLevel ?
        LogLevel[raw as LogLevelName] :
        LogLevel.info;
}

let threshold = resolveThreshold();

/**
 * Sets the minimum severity level that produces output.
 * Messages below `level` are silently discarded.
 * Defaults to `'info'`; override at startup via `$LOG_LEVEL`.
 *
 * @param level - The new minimum log level.
 * @returns {void}
 */
export function setLogLevel(level: LogLevelName): void {
    threshold = LogLevel[level];
}

/**
 * Writes a log message if `level` meets the current threshold.
 *
 * `'error'` is written to `stderr`; all other levels go to `stdout`.
 * When the target stream is a TTY the message is prefixed with a
 * colored Unicode symbol; otherwise a plain `[LEVEL]` tag is used.
 *
 * @param level - Severity of this message.
 * @param args  - Values coerced to strings and joined with a space.
 * @returns {void}
 */
export function log(level: LogLevelName, ...args: unknown[]): void {
    if (LogLevel[level] < threshold) return;

    const isError = level === 'error';
    const stream  = isError ? process.stderr : process.stdout;
    const useTTY  = isError ? !!process.stderr.isTTY : !!process.stdout.isTTY;
    const message = args.map((a) => typeof a === 'string' ? a : String(a)).join(' ');

    stream.write(
        useTTY ?
            `${ANSI[level]}${SYMBOL[level]}${RESET} ${message}\n` :
            `[${level.toUpperCase()}] ${message}\n`,
    );
}

/** Logs a `debug`-level message. @param args - Message parts. */
export const debug = (...args: unknown[]): void => log('debug', ...args);
/** Logs an `info`-level message. @param args - Message parts. */
export const info  = (...args: unknown[]): void => log('info',  ...args);
/** Logs a `warn`-level message. @param args - Message parts. */
export const warn  = (...args: unknown[]): void => log('warn',  ...args);
/** Logs an `error`-level message to stderr. @param args - Message parts. */
export const error = (...args: unknown[]): void => log('error', ...args);

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
