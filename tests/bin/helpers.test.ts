import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type Vault from '../../src/core/vault.js';
import { listKeys } from '../../src/bin/helpers.js';

// ─── test helpers ────────────────────────────────────────────────────────────

function makeVault(keys: string[], filename = '/test/.vltx'): Vault {
    return { keys: () => new Set(keys), filename } as unknown as Vault;
}

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
        listKeys(makeVault([], '/my/.vltx'));
        expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('/my/.vltx'));
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
