import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type Vault from '../../src/core/vault.js';
import {
    log, setLogLevel, debug, info, warn, error,
} from '../../src/bin/helpers.js';
import { listKeys } from '../../src/bin/helpers.js';

// ─── test helpers ────────────────────────────────────────────────────────────

function setTTY(stream: NodeJS.WriteStream, value: true | undefined): void {
    Object.defineProperty(stream, 'isTTY', { value, configurable: true, writable: true });
}

function makeVault(keys: string[], filename = '/test/.vault'): Vault {
    return { keys: () => new Set(keys), filename } as unknown as Vault;
}

// ─── log ─────────────────────────────────────────────────────────────────────

describe('log', () => {
    let stdoutSpy: ReturnType<typeof vi.spyOn>;
    let stderrSpy: ReturnType<typeof vi.spyOn>;

    beforeEach(() => {
        setLogLevel('debug');
        setTTY(process.stdout, undefined);
        setTTY(process.stderr, undefined);
        stdoutSpy = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
        stderrSpy = vi.spyOn(process.stderr, 'write').mockImplementation(() => true);
    });

    afterEach(() => {
        stdoutSpy.mockRestore();
        stderrSpy.mockRestore();
        setLogLevel('info');
    });

    describe('stream routing', () => {
        it('routes error to stderr', () => {
            log('error', 'msg');
            expect(stderrSpy).toHaveBeenCalledOnce();
            expect(stdoutSpy).not.toHaveBeenCalled();
        });

        it.each(['debug', 'info', 'warn'] as const)('routes %s to stdout', (level) => {
            log(level, 'msg');
            expect(stdoutSpy).toHaveBeenCalledOnce();
            expect(stderrSpy).not.toHaveBeenCalled();
        });
    });

    describe('threshold filtering', () => {
        it.each([
            { threshold: 'info',  level: 'debug', passes: false },
            { threshold: 'info',  level: 'info',  passes: true  },
            { threshold: 'warn',  level: 'info',  passes: false },
            { threshold: 'warn',  level: 'warn',  passes: true  },
            { threshold: 'warn',  level: 'error', passes: true  },
            { threshold: 'error', level: 'warn',  passes: false },
        ] as const)('$level at threshold $threshold → passes=$passes', ({ threshold, level, passes }) => {
            setLogLevel(threshold);
            log(level, 'msg');
            const spy = level === 'error' ? stderrSpy : stdoutSpy;
            if (passes) {
                expect(spy).toHaveBeenCalledOnce();
            } else {
                expect(spy).not.toHaveBeenCalled();
            }
        });
    });

    describe('message formatting', () => {
        it('joins multiple args with spaces', () => {
            log('info', 'hello', 'world');
            expect(stdoutSpy).toHaveBeenCalledWith(expect.stringContaining('hello world'));
        });

        it('coerces non-string args to strings', () => {
            log('info', 42, true, null);
            expect(stdoutSpy).toHaveBeenCalledWith(expect.stringContaining('42 true null'));
        });

        it('terminates with a newline', () => {
            log('info', 'test');
            expect(stdoutSpy).toHaveBeenCalledWith(expect.stringMatching(/\n$/));
        });
    });

    describe('plain-text mode (no TTY)', () => {
        it.each(['debug', 'info', 'warn', 'error'] as const)(
            'prefixes %s with [LEVEL] label', (level) => {
                const spy = level === 'error' ? stderrSpy : stdoutSpy;
                log(level, 'msg');
                expect(spy).toHaveBeenCalledWith(
                    expect.stringContaining(`[${level.toUpperCase()}] msg`),
                );
            },
        );

        it('contains no ANSI escape codes', () => {
            log('info', 'msg');
            // eslint-disable-next-line no-control-regex
            expect(stdoutSpy).toHaveBeenCalledWith(expect.not.stringMatching(/\x1b\[/));
        });
    });

    describe('TTY mode', () => {
        it.each([
            { level: 'debug', symbol: '·' },
            { level: 'info',  symbol: 'ℹ' },
            { level: 'warn',  symbol: '⚠' },
            { level: 'error', symbol: '✖' },
        ] as const)('prefixes $level with the $symbol symbol', ({ level, symbol }) => {
            const stream = level === 'error' ? process.stderr : process.stdout;
            const spy    = level === 'error' ? stderrSpy : stdoutSpy;
            setTTY(stream, true);
            log(level, 'msg');
            expect(spy).toHaveBeenCalledWith(expect.stringContaining(symbol));
        });

        it('includes ANSI color codes', () => {
            setTTY(process.stdout, true);
            log('info', 'msg');
            // eslint-disable-next-line no-control-regex
            expect(stdoutSpy).toHaveBeenCalledWith(expect.stringMatching(/\x1b\[/));
        });

        it('omits the [LEVEL] label', () => {
            setTTY(process.stdout, true);
            log('info', 'msg');
            expect(stdoutSpy).not.toHaveBeenCalledWith(expect.stringContaining('[INFO]'));
        });
    });
});

// ─── LOG_LEVEL env var ────────────────────────────────────────────────────────

describe('LOG_LEVEL env var', () => {
    afterEach(() => {
        vi.resetModules();
        delete process.env['LOG_LEVEL'];
    });

    it('applies debug threshold when LOG_LEVEL=debug', async () => {
        process.env['LOG_LEVEL'] = 'debug';
        vi.resetModules();
        const { log: freshLog } = await import('../../src/bin/helpers.js');
        const spy = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
        freshLog('debug', 'visible');
        expect(spy).toHaveBeenCalledOnce();
        spy.mockRestore();
    });

    it('suppresses debug by default (info threshold)', async () => {
        vi.resetModules();
        const { log: freshLog } = await import('../../src/bin/helpers.js');
        const spy = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
        freshLog('debug', 'suppressed');
        freshLog('info',  'visible');
        expect(spy).toHaveBeenCalledOnce();
        spy.mockRestore();
    });

    it('falls back to info threshold for an unrecognized level name', async () => {
        process.env['LOG_LEVEL'] = 'verbose';
        vi.resetModules();
        const { log: freshLog } = await import('../../src/bin/helpers.js');
        const spy = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
        freshLog('debug', 'suppressed');
        expect(spy).not.toHaveBeenCalled();
        spy.mockRestore();
    });
});

// ─── convenience wrappers ────────────────────────────────────────────────────

describe('convenience wrappers', () => {
    let stdoutSpy: ReturnType<typeof vi.spyOn>;
    let stderrSpy: ReturnType<typeof vi.spyOn>;

    beforeEach(() => {
        setLogLevel('debug');
        setTTY(process.stdout, undefined);
        setTTY(process.stderr, undefined);
        stdoutSpy = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
        stderrSpy = vi.spyOn(process.stderr, 'write').mockImplementation(() => true);
    });

    afterEach(() => {
        stdoutSpy.mockRestore();
        stderrSpy.mockRestore();
        setLogLevel('info');
    });

    it('debug writes to stdout', () => {
        debug('msg');
        expect(stdoutSpy).toHaveBeenCalledWith(expect.stringContaining('[DEBUG] msg'));
    });

    it('info writes to stdout', () => {
        info('msg');
        expect(stdoutSpy).toHaveBeenCalledWith(expect.stringContaining('[INFO] msg'));
    });

    it('warn writes to stdout', () => {
        warn('msg');
        expect(stdoutSpy).toHaveBeenCalledWith(expect.stringContaining('[WARN] msg'));
    });

    it('error writes to stderr', () => {
        error('msg');
        expect(stderrSpy).toHaveBeenCalledWith(expect.stringContaining('[ERROR] msg'));
    });
});

// ─── listKeys ────────────────────────────────────────────────────────────────

describe('listKeys', () => {
    let logSpy: ReturnType<typeof vi.spyOn>;

    beforeEach(() => {
        logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    });

    afterEach(() => {
        logSpy.mockRestore();
    });

    it('includes the filename in the heading', () => {
        listKeys(makeVault([], '/my/.vault'));
        expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('/my/.vault'));
    });

    it('shows "(empty)" when the vault has no keys', () => {
        listKeys(makeVault([]));
        expect(logSpy).toHaveBeenCalledWith('  (empty)');
    });

    it('uses "secret" (singular) for one key', () => {
        listKeys(makeVault(['only']));
        expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('1 secret)'));
    });

    it('uses "secrets" (plural) for multiple keys', () => {
        listKeys(makeVault(['a', 'b']));
        expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('2 secrets)'));
    });

    it('prints keys in sorted order', () => {
        listKeys(makeVault(['gamma', 'alpha', 'beta']));
        const calls = logSpy.mock.calls.map((c) => c[0]);
        const keyLines = calls.filter((l: string) => l.startsWith('  '));
        expect(keyLines).toEqual(['  alpha', '  beta', '  gamma']);
    });

    it('does not print "(empty)" when keys are present', () => {
        listKeys(makeVault(['a']));
        expect(logSpy).not.toHaveBeenCalledWith('  (empty)');
    });
});
