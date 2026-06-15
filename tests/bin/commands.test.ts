import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { ArgumentsCamelCase } from 'yargs';

const { mockVaultInstance, MockVault, mockGetConfig, mockListKeys, mockLog, mockError,
    mockSetLogLevel, mockStdLogger, mockRl } =
    vi.hoisted(() => {
        const mockVaultInstance = {
            set: vi.fn(),
            write: vi.fn(),
            delete: vi.fn().mockReturnValue(true),
            replace: vi.fn(),
            get: vi.fn().mockReturnValue('the-value'),
            decrypt: vi.fn().mockReturnValue(Buffer.from('the-value')),
            filename: '/test/.vltx',
        };
        const MockVault = Object.assign(
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            vi.fn(function() { return mockVaultInstance; } as any),
            {
                init: vi.fn(),
                openForWriting: vi.fn().mockReturnValue(mockVaultInstance),
                openForReading: vi.fn().mockReturnValue(mockVaultInstance),
            },
        );
        const mockGetConfig = vi.fn().mockReturnValue({
            filename: '/test/.vltx',
            privateKeyFilename: '/test/.vltx.rsa',
        });
        const mockListKeys = vi.fn();
        const mockLog = vi.fn();
        const mockError = vi.fn();
        const mockSetLogLevel = vi.fn();
        const mockStdLogger = {
            debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn(), normal: vi.fn(),
        };
        const mockRl = {
            question: vi.fn((_prompt: string, cb: (_answer: string) => void) => cb('test-passphrase')),
            close: vi.fn(),
        };
        return { mockVaultInstance, MockVault, mockGetConfig, mockListKeys, mockLog, mockError,
            mockSetLogLevel, mockStdLogger, mockRl };
    });

vi.mock('../../src/core/vltx.js', () => ({ default: MockVault }));
vi.mock('../../src/core/env.js', () => ({ default: mockGetConfig }));
vi.mock('../../src/bin/helpers.js', () => ({ listKeys: mockListKeys }));
vi.mock('../../src/core/logger.js', () => ({
    log: mockLog, error: mockError, setLogLevel: mockSetLogLevel, STD_LOGGER: mockStdLogger,
}));
vi.mock('node:readline', () => ({ createInterface: vi.fn().mockReturnValue(mockRl) }));

import {
    resolveConfig,
    initHandler,
    addHandler,
    deleteHandler,
    replaceHandler,
    getHandler,
    listHandler,
} from '../../src/bin/commands.js';

function makeArgv(extra: Record<string, unknown> = {}): ArgumentsCamelCase {
    return { _: [], $0: 'vltx', ...extra } as ArgumentsCamelCase;
}

describe('resolveConfig', () => {
    it('calls getConfig with empty object when no relevant args are provided', async () => {
        await resolveConfig(makeArgv());
        expect(mockGetConfig).toHaveBeenCalledWith({});
    });

    it('passes filename from vault-file arg', async () => {
        await resolveConfig(makeArgv({ 'vault-file': '/my/vault' }));
        expect(mockGetConfig).toHaveBeenCalledWith({ filename: '/my/vault' });
    });

    it('passes privateKeyFilename from key-file arg', async () => {
        await resolveConfig(makeArgv({ 'key-file': '/my/key.rsa' }));
        expect(mockGetConfig).toHaveBeenCalledWith({ privateKeyFilename: '/my/key.rsa' });
    });

    it('prompts for passphrase when --passphrase flag is set', async () => {
        Object.defineProperty(process.stdin, 'isTTY', { value: true, configurable: true });
        await resolveConfig(makeArgv({ passphrase: true }));
        expect(mockGetConfig).toHaveBeenCalledWith({ passphrase: 'test-passphrase' });
        Object.defineProperty(process.stdin, 'isTTY', { value: undefined, configurable: true });
    });

    it('suppresses character echo but shows the prompt text in interactive mode', async () => {
        Object.defineProperty(process.stdin, 'isTTY', { value: true, configurable: true });
        await resolveConfig(makeArgv({ passphrase: true }));
        Object.defineProperty(process.stdin, 'isTTY', { value: undefined, configurable: true });

        const writeToOutput =
            (mockRl as unknown as { _writeToOutput: (_s: string) => void })._writeToOutput;
        const stderrSpy = vi.spyOn(process.stderr, 'write').mockReturnValue(true);
        writeToOutput('Passphrase: '); // prompt text — should be written
        writeToOutput('x');            // keypress — should be suppressed
        expect(stderrSpy).toHaveBeenCalledTimes(1);
        expect(stderrSpy).toHaveBeenCalledWith('Passphrase: ');
        stderrSpy.mockRestore();
    });

    it('reads passphrase from piped stdin when stdin is not a TTY', async () => {
        const handlers: Record<string, (..._args: unknown[]) => void> = {};
        const setEncodingSpy = vi.spyOn(process.stdin, 'setEncoding')
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            .mockReturnValue(process.stdin as any);
        const onSpy = vi.spyOn(process.stdin, 'on')
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            .mockImplementation((event: any, fn: any) => { handlers[event] = fn; return process.stdin; });

        const configPromise = resolveConfig(makeArgv({ passphrase: true }));
        handlers['data']?.('piped-secret');
        handlers['end']?.();
        await configPromise;

        expect(mockGetConfig).toHaveBeenCalledWith({ passphrase: 'piped-secret' });
        setEncodingSpy.mockRestore();
        onSpy.mockRestore();
    });

    it('passes all args together with passphrase from prompt', async () => {
        Object.defineProperty(process.stdin, 'isTTY', { value: true, configurable: true });
        await resolveConfig(makeArgv({ 'vault-file': '/v', 'key-file': '/k', passphrase: true }));
        expect(mockGetConfig).toHaveBeenCalledWith({
            filename: '/v',
            privateKeyFilename: '/k',
            passphrase: 'test-passphrase',
        });
        Object.defineProperty(process.stdin, 'isTTY', { value: undefined, configurable: true });
    });

    it('returns the value from getConfig merged with STD_LOGGER', async () => {
        const result = await resolveConfig(makeArgv());
        expect(result).toMatchObject({ filename: '/test/.vltx', privateKeyFilename: '/test/.vltx.rsa' });
    });

    it('calls setLogLevel with the verbose argument', async () => {
        await resolveConfig(makeArgv({ verbose: 3 }));
        expect(mockSetLogLevel).toHaveBeenCalledWith(3);
    });

    it('calls setLogLevel with undefined when verbose is not provided', async () => {
        await resolveConfig(makeArgv());
        expect(mockSetLogLevel).toHaveBeenCalledWith(undefined);
    });
});

describe('initHandler', () => {
    it('calls Vault.init with resolved filename, config, and logger', async () => {
        await initHandler(makeArgv());
        expect(MockVault.init).toHaveBeenCalledWith(
            '/test/.vltx',
            expect.objectContaining({ filename: '/test/.vltx' }),
            expect.any(Object),
        );
    });

    it('logs the vault filename', async () => {
        await initHandler(makeArgv());
        expect(mockLog).toHaveBeenCalledWith(expect.stringContaining('/test/.vltx'));
    });

    it('logs the private key filename', async () => {
        await initHandler(makeArgv());
        expect(mockLog).toHaveBeenCalledWith(expect.stringContaining('/test/.vltx.rsa'));
    });
});

describe('addHandler', () => {
    beforeEach(() => {
        MockVault.openForWriting.mockClear();
    });

    it('opens the vault for writing with the resolved config', async () => {
        await addHandler(makeArgv({ key: 'mykey', value: 'myval' }));
        expect(MockVault.openForWriting).toHaveBeenCalledWith(
            expect.objectContaining({ filename: '/test/.vltx' }),
        );
    });

    it('calls set with key and value', async () => {
        await addHandler(makeArgv({ key: 'mykey', value: 'myval' }));
        expect(mockVaultInstance.set).toHaveBeenCalledWith('mykey', 'myval');
    });

    it('calls write after setting', async () => {
        await addHandler(makeArgv({ key: 'mykey', value: 'myval' }));
        expect(mockVaultInstance.write).toHaveBeenCalled();
    });

    it('logs the added key', async () => {
        await addHandler(makeArgv({ key: 'mykey', value: 'myval' }));
        expect(mockLog).toHaveBeenCalledWith('Added: mykey');
    });
});

describe('deleteHandler', () => {
    let exitSpy: ReturnType<typeof vi.spyOn>;

    beforeEach(() => {
        exitSpy = vi.spyOn(process, 'exit').mockImplementation(() => { throw new Error('process.exit'); });
        mockVaultInstance.delete.mockReturnValue(true);
        MockVault.openForWriting.mockClear();
    });

    afterEach(() => {
        exitSpy.mockRestore();
    });

    it('opens the vault for writing with the resolved config', async () => {
        await deleteHandler(makeArgv({ key: 'mykey' }));
        expect(MockVault.openForWriting).toHaveBeenCalledWith(
            expect.objectContaining({ filename: '/test/.vltx' }),
        );
    });

    it('calls delete with the given key', async () => {
        await deleteHandler(makeArgv({ key: 'mykey' }));
        expect(mockVaultInstance.delete).toHaveBeenCalledWith('mykey');
    });

    it('writes and logs when the key exists', async () => {
        await deleteHandler(makeArgv({ key: 'mykey' }));
        expect(mockVaultInstance.write).toHaveBeenCalled();
        expect(mockLog).toHaveBeenCalledWith('Deleted: mykey');
    });

    it('logs an error and exits with 1 when key is not found', async () => {
        mockVaultInstance.delete.mockReturnValueOnce(false);
        await expect(deleteHandler(makeArgv({ key: 'missing' }))).rejects.toThrow('process.exit');
        expect(mockError).toHaveBeenCalledWith('Key not found: missing');
        expect(exitSpy).toHaveBeenCalledWith(1);
    });

    it('does not write when key is not found', async () => {
        mockVaultInstance.delete.mockReturnValueOnce(false);
        try { await deleteHandler(makeArgv({ key: 'missing' })); } catch { /* exit */ }
        expect(mockVaultInstance.write).not.toHaveBeenCalled();
    });
});

describe('replaceHandler', () => {
    beforeEach(() => {
        MockVault.openForWriting.mockClear();
    });

    it('opens the vault for writing with the resolved config', async () => {
        await replaceHandler(makeArgv({ key: 'k', value: 'v' }));
        expect(MockVault.openForWriting).toHaveBeenCalledWith(
            expect.objectContaining({ filename: '/test/.vltx' }),
        );
    });

    it('calls replace with key and value', async () => {
        await replaceHandler(makeArgv({ key: 'k', value: 'v' }));
        expect(mockVaultInstance.replace).toHaveBeenCalledWith('k', 'v');
    });

    it('calls write after replacing', async () => {
        await replaceHandler(makeArgv({ key: 'k', value: 'v' }));
        expect(mockVaultInstance.write).toHaveBeenCalled();
    });

    it('logs the replaced key', async () => {
        await replaceHandler(makeArgv({ key: 'k', value: 'v' }));
        expect(mockLog).toHaveBeenCalledWith('Replaced: k');
    });
});

describe('getHandler', () => {
    let exitSpy: ReturnType<typeof vi.spyOn>;

    beforeEach(() => {
        exitSpy = vi.spyOn(process, 'exit').mockImplementation(() => { throw new Error('process.exit'); });
        mockVaultInstance.decrypt.mockReturnValue(Buffer.from('the-value'));
        MockVault.openForReading.mockClear();
    });

    afterEach(() => {
        exitSpy.mockRestore();
    });

    it('opens the vault for reading with the resolved config', async () => {
        await getHandler(makeArgv({ key: 'mykey' }));
        expect(MockVault.openForReading).toHaveBeenCalledWith(
            expect.objectContaining({ filename: '/test/.vltx' }),
        );
    });

    it('calls decrypt with the given key', async () => {
        await getHandler(makeArgv({ key: 'mykey' }));
        expect(mockVaultInstance.decrypt).toHaveBeenCalledWith('mykey');
    });

    it('logs the secret value when the key exists', async () => {
        await getHandler(makeArgv({ key: 'mykey' }));
        expect(mockLog).toHaveBeenCalledWith('the-value');
    });

    it('logs a string value directly when decrypt returns a string', async () => {
        mockVaultInstance.decrypt.mockReturnValueOnce('plain-string');
        await getHandler(makeArgv({ key: 'mykey' }));
        expect(mockLog).toHaveBeenCalledWith('plain-string');
    });

    it('logs an error and exits with 1 when key is not found', async () => {
        mockVaultInstance.decrypt.mockReturnValueOnce(undefined);
        await expect(getHandler(makeArgv({ key: 'missing' }))).rejects.toThrow('process.exit');
        expect(mockError).toHaveBeenCalledWith('Key not found: missing');
        expect(exitSpy).toHaveBeenCalledWith(1);
    });
});

describe('listHandler', () => {
    beforeEach(() => {
        MockVault.openForWriting.mockClear();
    });

    it('opens the vault for writing with the resolved config', async () => {
        await listHandler(makeArgv());
        expect(MockVault.openForWriting).toHaveBeenCalledWith(
            expect.objectContaining({ filename: '/test/.vltx' }),
        );
    });

    it('calls listKeys with the vault instance', async () => {
        await listHandler(makeArgv());
        expect(mockListKeys).toHaveBeenCalledWith(mockVaultInstance);
    });
});
