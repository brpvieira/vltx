import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
    _doLog, log, setLogLevel, debug, info, warn, error,
    NOOP_LOGGER, STD_LOGGER,
} from '../../src/core/logger.js';

// ─── test helpers ────────────────────────────────────────────────────────────

function setTTY(stream: NodeJS.WriteStream, value: true | undefined): void {
    Object.defineProperty(stream, 'isTTY', { value, configurable: true, writable: true });
}

// ─── _doLog ──────────────────────────────────────────────────────────────────

describe('_doLog', () => {
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
            _doLog('error', 'msg');
            expect(stderrSpy).toHaveBeenCalledOnce();
            expect(stdoutSpy).not.toHaveBeenCalled();
        });

        it.each(['debug', 'info', 'warn', 'normal'] as const)(
            'routes %s to stdout', (level) => {
                _doLog(level, 'msg');
                expect(stdoutSpy).toHaveBeenCalledOnce();
                expect(stderrSpy).not.toHaveBeenCalled();
            },
        );
    });

    describe('threshold filtering', () => {
        it.each([
            { threshold: 'info',   level: 'debug',  passes: false },
            { threshold: 'info',   level: 'info',   passes: true  },
            { threshold: 'warn',   level: 'info',   passes: false },
            { threshold: 'warn',   level: 'warn',   passes: true  },
            { threshold: 'warn',   level: 'error',  passes: true  },
            { threshold: 'error',  level: 'warn',   passes: false },
            { threshold: 'error',  level: 'normal', passes: true  },
            { threshold: 'normal', level: 'error',  passes: false },
            { threshold: 'normal', level: 'normal', passes: true  },
        ] as const)('$level at threshold $threshold → passes=$passes', ({ threshold, level, passes }) => {
            setLogLevel(threshold);
            _doLog(level, 'msg');
            const spy = level === 'error' ? stderrSpy : stdoutSpy;
            if (passes) {
                expect(spy).toHaveBeenCalledOnce();
            } else {
                expect(spy).not.toHaveBeenCalled();
            }
        });

        describe('numeric verbosity', () => {
            it('verbose=3 enables debug-level output', () => {
                setLogLevel(3);
                _doLog('debug', 'msg');
                expect(stdoutSpy).toHaveBeenCalledOnce();
            });

            it('verbose=2 enables info-level output but suppresses debug', () => {
                setLogLevel(2);
                _doLog('debug', 'msg');
                expect(stdoutSpy).not.toHaveBeenCalled();
                _doLog('info', 'msg');
                expect(stdoutSpy).toHaveBeenCalledOnce();
            });

            it('verbose=1 enables warn-level output but suppresses info', () => {
                setLogLevel(1);
                _doLog('info', 'msg');
                expect(stdoutSpy).not.toHaveBeenCalled();
                _doLog('warn', 'msg');
                expect(stdoutSpy).toHaveBeenCalledOnce();
            });

            it('verbose=0 suppresses warn but passes error', () => {
                setLogLevel(0);
                _doLog('warn', 'msg');
                expect(stdoutSpy).not.toHaveBeenCalled();
                _doLog('error', 'msg');
                expect(stderrSpy).toHaveBeenCalledOnce();
            });

            it('undefined leaves the threshold unchanged', () => {
                setLogLevel('warn');
                setLogLevel(undefined);
                _doLog('info', 'msg');
                expect(stdoutSpy).not.toHaveBeenCalled();
                _doLog('warn', 'msg');
                expect(stdoutSpy).toHaveBeenCalledOnce();
            });
        });
    });

    describe('message formatting', () => {
        it('joins multiple string args with spaces', () => {
            _doLog('info', 'hello', 'world');
            expect(stdoutSpy).toHaveBeenCalledWith(expect.stringContaining('hello world'));
        });

        it('coerces non-string args to strings', () => {
            _doLog('info', 42, true, null);
            expect(stdoutSpy).toHaveBeenCalledWith(expect.stringContaining('42 true null'));
        });

        it('terminates with a newline', () => {
            _doLog('info', 'test');
            expect(stdoutSpy).toHaveBeenCalledWith(expect.stringMatching(/\n$/));
        });
    });

    describe('plain-text mode (no TTY)', () => {
        it.each(['debug', 'info', 'warn', 'error'] as const)(
            'prefixes %s with [LEVEL] label', (level) => {
                const spy = level === 'error' ? stderrSpy : stdoutSpy;
                _doLog(level, 'msg');
                expect(spy).toHaveBeenCalledWith(
                    expect.stringContaining(`[${level.toUpperCase()}] msg`),
                );
            },
        );

        it('contains no ANSI escape codes for leveled messages', () => {
            _doLog('info', 'msg');
            // eslint-disable-next-line no-control-regex
            expect(stdoutSpy).toHaveBeenCalledWith(expect.not.stringMatching(/\x1b\[/));
        });

        it('normal level has no [NORMAL] tag', () => {
            _doLog('normal', 'msg');
            expect(stdoutSpy).toHaveBeenCalledWith(expect.stringContaining('msg'));
            expect(stdoutSpy).not.toHaveBeenCalledWith(expect.stringContaining('[NORMAL]'));
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
            _doLog(level, 'msg');
            expect(spy).toHaveBeenCalledWith(expect.stringContaining(symbol));
        });

        it('applies ANSI_SYMBOL color to symbol', () => {
            setTTY(process.stdout, true);
            _doLog('info', 'msg');
            // ANSI_SYMBOL.info = bold bright cyan

            expect(stdoutSpy).toHaveBeenCalledWith(expect.stringContaining('\x1b[1;96m'));
        });

        it('applies ANSI_TEXT color to message text', () => {
            setTTY(process.stdout, true);
            _doLog('info', 'msg');
            // ANSI_TEXT.info = cyan

            expect(stdoutSpy).toHaveBeenCalledWith(expect.stringContaining('\x1b[0;36m'));
        });

        it('omits the [LEVEL] label', () => {
            setTTY(process.stdout, true);
            _doLog('info', 'msg');
            expect(stdoutSpy).not.toHaveBeenCalledWith(expect.stringContaining('[INFO]'));
        });

        it('normal level in TTY mode has no symbol tag', () => {
            setTTY(process.stdout, true);
            _doLog('normal', 'msg');
            expect(stdoutSpy).not.toHaveBeenCalledWith(expect.stringContaining('[NORMAL]'));
            expect(stdoutSpy).toHaveBeenCalledWith(expect.stringContaining('msg'));
        });

        it('normal level in TTY mode wraps text in ANSI_TEXT color', () => {
            setTTY(process.stdout, true);
            _doLog('normal', 'msg');
            // ANSI_TEXT.normal = default color
            // eslint-disable-next-line no-control-regex
            expect(stdoutSpy).toHaveBeenCalledWith(expect.stringMatching(/\x1b\[/));
        });
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

    it('debug writes to stdout with [DEBUG] label', () => {
        debug('msg');
        expect(stdoutSpy).toHaveBeenCalledWith(expect.stringContaining('[DEBUG] msg'));
    });

    it('info writes to stdout with [INFO] label', () => {
        info('msg');
        expect(stdoutSpy).toHaveBeenCalledWith(expect.stringContaining('[INFO] msg'));
    });

    it('warn writes to stdout with [WARN] label', () => {
        warn('msg');
        expect(stdoutSpy).toHaveBeenCalledWith(expect.stringContaining('[WARN] msg'));
    });

    it('error writes to stderr with [ERROR] label', () => {
        error('msg');
        expect(stderrSpy).toHaveBeenCalledWith(expect.stringContaining('[ERROR] msg'));
    });

    it('log writes to stdout with no tag', () => {
        log('msg');
        expect(stdoutSpy).toHaveBeenCalledWith(expect.stringContaining('msg'));
        expect(stdoutSpy).not.toHaveBeenCalledWith(expect.stringContaining('[NORMAL]'));
    });
});

// ─── NOOP_LOGGER ─────────────────────────────────────────────────────────────

describe('NOOP_LOGGER', () => {
    let stdoutSpy: ReturnType<typeof vi.spyOn>;
    let stderrSpy: ReturnType<typeof vi.spyOn>;

    beforeEach(() => {
        stdoutSpy = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
        stderrSpy = vi.spyOn(process.stderr, 'write').mockImplementation(() => true);
    });

    afterEach(() => {
        stdoutSpy.mockRestore();
        stderrSpy.mockRestore();
    });

    it('all handlers are defined', () => {
        expect(NOOP_LOGGER.debug).toBeDefined();
        expect(NOOP_LOGGER.info).toBeDefined();
        expect(NOOP_LOGGER.warn).toBeDefined();
        expect(NOOP_LOGGER.error).toBeDefined();
        expect(NOOP_LOGGER.normal).toBeDefined();
    });

    it('all handlers silently discard calls without writing to any stream', () => {
        NOOP_LOGGER.debug?.('msg');
        NOOP_LOGGER.info?.('msg');
        NOOP_LOGGER.warn?.('msg');
        NOOP_LOGGER.error?.('msg');
        NOOP_LOGGER.normal?.('msg');
        expect(stdoutSpy).not.toHaveBeenCalled();
        expect(stderrSpy).not.toHaveBeenCalled();
    });
});

// ─── STD_LOGGER ──────────────────────────────────────────────────────────────

describe('STD_LOGGER', () => {
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

    it('debug delegates to the debug log function', () => {
        STD_LOGGER.debug?.('msg');
        expect(stdoutSpy).toHaveBeenCalledWith(expect.stringContaining('[DEBUG] msg'));
    });

    it('info delegates to the info log function', () => {
        STD_LOGGER.info?.('msg');
        expect(stdoutSpy).toHaveBeenCalledWith(expect.stringContaining('[INFO] msg'));
    });

    it('warn delegates to the warn log function', () => {
        STD_LOGGER.warn?.('msg');
        expect(stdoutSpy).toHaveBeenCalledWith(expect.stringContaining('[WARN] msg'));
    });

    it('error delegates to the error log function (stderr)', () => {
        STD_LOGGER.error?.('msg');
        expect(stderrSpy).toHaveBeenCalledWith(expect.stringContaining('[ERROR] msg'));
    });

    it('normal delegates to the log function (no tag)', () => {
        STD_LOGGER.normal?.('msg');
        expect(stdoutSpy).toHaveBeenCalledWith(expect.stringContaining('msg'));
        expect(stdoutSpy).not.toHaveBeenCalledWith(expect.stringContaining('[NORMAL]'));
    });
});
