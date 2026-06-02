import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { ArgumentsCamelCase } from 'yargs';

const { mockVaultInstance, MockVault, mockGetConfig, mockListKeys } = vi.hoisted(() => {
    const mockVaultInstance = {
        set: vi.fn(),
        write: vi.fn(),
        delete: vi.fn().mockReturnValue(true),
        replace: vi.fn(),
        get: vi.fn().mockReturnValue('the-value'),
        filename: '/test/.vault',
    };
    const MockVault = Object.assign(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        vi.fn(function() { return mockVaultInstance; } as any),
        { init: vi.fn() },
    );
    const mockGetConfig = vi.fn().mockReturnValue({
        filename: '/test/.vault',
        privateKeyFilename: '/test/.vault.rsa',
    });
    const mockListKeys = vi.fn();
    return { mockVaultInstance, MockVault, mockGetConfig, mockListKeys };
});

vi.mock('../../src/core/vault.js', () => ({ default: MockVault }));
vi.mock('../../src/core/env.js', () => ({ default: mockGetConfig }));
vi.mock('../../src/bin/helpers.js', () => ({ listKeys: mockListKeys }));

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
    return { _: [], $0: 'vault-cli', ...extra } as ArgumentsCamelCase;
}

describe('resolveConfig', () => {
    it('calls getConfig with empty object when no relevant args are provided', () => {
        resolveConfig(makeArgv());
        expect(mockGetConfig).toHaveBeenCalledWith({});
    });

    it('passes filename from vault-file arg', () => {
        resolveConfig(makeArgv({ 'vault-file': '/my/vault' }));
        expect(mockGetConfig).toHaveBeenCalledWith({ filename: '/my/vault' });
    });

    it('passes privateKeyFilename from key-file arg', () => {
        resolveConfig(makeArgv({ 'key-file': '/my/key.rsa' }));
        expect(mockGetConfig).toHaveBeenCalledWith({ privateKeyFilename: '/my/key.rsa' });
    });

    it('passes passphrase arg', () => {
        resolveConfig(makeArgv({ passphrase: 'hunter2' }));
        expect(mockGetConfig).toHaveBeenCalledWith({ passphrase: 'hunter2' });
    });

    it('passes all three args together', () => {
        resolveConfig(makeArgv({ 'vault-file': '/v', 'key-file': '/k', passphrase: 'p' }));
        expect(mockGetConfig).toHaveBeenCalledWith({
            filename: '/v',
            privateKeyFilename: '/k',
            passphrase: 'p',
        });
    });

    it('returns the value from getConfig', () => {
        const result = resolveConfig(makeArgv());
        expect(result).toEqual({ filename: '/test/.vault', privateKeyFilename: '/test/.vault.rsa' });
    });
});

describe('initHandler', () => {
    let logSpy: ReturnType<typeof vi.spyOn>;

    beforeEach(() => {
        logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    });

    afterEach(() => {
        logSpy.mockRestore();
    });

    it('calls Vault.init with resolved filename and config', () => {
        initHandler(makeArgv());
        expect(MockVault.init).toHaveBeenCalledWith(
            '/test/.vault',
            expect.objectContaining({ filename: '/test/.vault' }),
        );
    });

    it('logs the vault filename', () => {
        initHandler(makeArgv());
        expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('/test/.vault'));
    });

    it('logs the private key filename', () => {
        initHandler(makeArgv());
        expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('/test/.vault.rsa'));
    });
});

describe('addHandler', () => {
    let logSpy: ReturnType<typeof vi.spyOn>;

    beforeEach(() => {
        logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    });

    afterEach(() => {
        logSpy.mockRestore();
    });

    it('creates a Vault with the resolved filename', () => {
        addHandler(makeArgv({ key: 'mykey', value: 'myval' }));
        expect(MockVault).toHaveBeenCalledWith({ filename: '/test/.vault' });
    });

    it('calls set with key and value', () => {
        addHandler(makeArgv({ key: 'mykey', value: 'myval' }));
        expect(mockVaultInstance.set).toHaveBeenCalledWith('mykey', 'myval');
    });

    it('calls write after setting', () => {
        addHandler(makeArgv({ key: 'mykey', value: 'myval' }));
        expect(mockVaultInstance.write).toHaveBeenCalled();
    });

    it('logs the added key', () => {
        addHandler(makeArgv({ key: 'mykey', value: 'myval' }));
        expect(logSpy).toHaveBeenCalledWith('Added: mykey');
    });
});

describe('deleteHandler', () => {
    let logSpy: ReturnType<typeof vi.spyOn>;
    let errorSpy: ReturnType<typeof vi.spyOn>;
    let exitSpy: ReturnType<typeof vi.spyOn>;

    beforeEach(() => {
        logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
        errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
        exitSpy = vi.spyOn(process, 'exit').mockImplementation(() => { throw new Error('process.exit'); });
        mockVaultInstance.delete.mockReturnValue(true);
    });

    afterEach(() => {
        logSpy.mockRestore();
        errorSpy.mockRestore();
        exitSpy.mockRestore();
    });

    it('calls delete with the given key', () => {
        deleteHandler(makeArgv({ key: 'mykey' }));
        expect(mockVaultInstance.delete).toHaveBeenCalledWith('mykey');
    });

    it('writes and logs when the key exists', () => {
        deleteHandler(makeArgv({ key: 'mykey' }));
        expect(mockVaultInstance.write).toHaveBeenCalled();
        expect(logSpy).toHaveBeenCalledWith('Deleted: mykey');
    });

    it('logs an error and exits with 1 when key is not found', () => {
        mockVaultInstance.delete.mockReturnValueOnce(false);
        expect(() => deleteHandler(makeArgv({ key: 'missing' }))).toThrow('process.exit');
        expect(errorSpy).toHaveBeenCalledWith('Key not found: missing');
        expect(exitSpy).toHaveBeenCalledWith(1);
    });

    it('does not write when key is not found', () => {
        mockVaultInstance.delete.mockReturnValueOnce(false);
        try { deleteHandler(makeArgv({ key: 'missing' })); } catch { /* exit */ }
        expect(mockVaultInstance.write).not.toHaveBeenCalled();
    });
});

describe('replaceHandler', () => {
    let logSpy: ReturnType<typeof vi.spyOn>;

    beforeEach(() => {
        logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    });

    afterEach(() => {
        logSpy.mockRestore();
    });

    it('creates a Vault with the resolved filename', () => {
        replaceHandler(makeArgv({ key: 'k', value: 'v' }));
        expect(MockVault).toHaveBeenCalledWith({ filename: '/test/.vault' });
    });

    it('calls replace with key and value', () => {
        replaceHandler(makeArgv({ key: 'k', value: 'v' }));
        expect(mockVaultInstance.replace).toHaveBeenCalledWith('k', 'v');
    });

    it('calls write after replacing', () => {
        replaceHandler(makeArgv({ key: 'k', value: 'v' }));
        expect(mockVaultInstance.write).toHaveBeenCalled();
    });

    it('logs the replaced key', () => {
        replaceHandler(makeArgv({ key: 'k', value: 'v' }));
        expect(logSpy).toHaveBeenCalledWith('Replaced: k');
    });
});

describe('getHandler', () => {
    let logSpy: ReturnType<typeof vi.spyOn>;
    let errorSpy: ReturnType<typeof vi.spyOn>;
    let exitSpy: ReturnType<typeof vi.spyOn>;

    beforeEach(() => {
        logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
        errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
        exitSpy = vi.spyOn(process, 'exit').mockImplementation(() => { throw new Error('process.exit'); });
        mockVaultInstance.get.mockReturnValue('the-value');
    });

    afterEach(() => {
        logSpy.mockRestore();
        errorSpy.mockRestore();
        exitSpy.mockRestore();
    });

    it('calls get with the given key', () => {
        getHandler(makeArgv({ key: 'mykey' }));
        expect(mockVaultInstance.get).toHaveBeenCalledWith('mykey');
    });

    it('logs the secret value when the key exists', () => {
        getHandler(makeArgv({ key: 'mykey' }));
        expect(logSpy).toHaveBeenCalledWith('the-value');
    });

    it('logs an error and exits with 1 when key is not found', () => {
        mockVaultInstance.get.mockReturnValueOnce(undefined);
        expect(() => getHandler(makeArgv({ key: 'missing' }))).toThrow('process.exit');
        expect(errorSpy).toHaveBeenCalledWith('Key not found: missing');
        expect(exitSpy).toHaveBeenCalledWith(1);
    });
});

describe('listHandler', () => {
    it('creates a Vault with the resolved filename', () => {
        listHandler(makeArgv());
        expect(MockVault).toHaveBeenCalledWith({ filename: '/test/.vault' });
    });

    it('calls listKeys with the vault instance', () => {
        listHandler(makeArgv());
        expect(mockListKeys).toHaveBeenCalledWith(mockVaultInstance);
    });
});
