import { describe, it, expect, vi, beforeEach } from 'vitest';
import type Vltx from '../../src/core/vltx.js';
import { EntryType, type AnyEntry } from '../../src/core/entry.js';
import { listKeys } from '../../src/bin/helpers.js';

vi.mock('../../src/core/logger.js', () => ({
    log: vi.fn(),
}));

import { log } from '../../src/core/logger.js';

function makeEntry(
    type: EntryType = EntryType.Secret,
    createdOn = new Date(0),
    modifiedOn = new Date(0),
): AnyEntry {
    return { type, createdOn, modifiedOn } as unknown as AnyEntry;
}

function makeVault(
    entries: Array<[string, AnyEntry]>,
    filename = '/test/.vltx',
): Vltx {
    const map = new Map(entries);
    return { filename, entries: () => map.entries() } as unknown as Vltx;
}

describe('listKeys', () => {
    const logMock = log as ReturnType<typeof vi.fn>;

    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('includes the filename in the heading', () => {
        listKeys(makeVault([], '/my/.vltx'));
        expect(logMock).toHaveBeenCalledWith(expect.stringContaining('/my/.vltx'));
    });

    it('shows "(empty)" when the vault has no keys', () => {
        listKeys(makeVault([]));
        expect(logMock).toHaveBeenCalledWith('  (empty)');
    });

    it('uses "secret" (singular) for one key', () => {
        listKeys(makeVault([['only', makeEntry()]]));
        expect(logMock).toHaveBeenCalledWith(expect.stringContaining('1 secret)'));
    });

    it('uses "secrets" (plural) for multiple keys', () => {
        listKeys(makeVault([['a', makeEntry()], ['b', makeEntry()]]));
        expect(logMock).toHaveBeenCalledWith(expect.stringContaining('2 secrets)'));
    });

    it('prints keys in sorted order', () => {
        listKeys(makeVault([
            ['gamma', makeEntry()],
            ['alpha', makeEntry()],
            ['beta',  makeEntry()],
        ]));
        const calls = logMock.mock.calls.map((c: unknown[]) => c[0] as string);
        const ai = calls.findIndex((l: string) => /^alpha/.test(l));
        const bi = calls.findIndex((l: string) => /^beta/.test(l));
        const gi = calls.findIndex((l: string) => /^gamma/.test(l));
        expect(ai).toBeGreaterThan(-1);
        expect(ai).toBeLessThan(bi);
        expect(bi).toBeLessThan(gi);
    });

    it('does not print "(empty)" when keys are present', () => {
        listKeys(makeVault([['a', makeEntry()]]));
        expect(logMock).not.toHaveBeenCalledWith('  (empty)');
    });

    it('prints column headers KEY, TYPE, CREATED, MODIFIED', () => {
        listKeys(makeVault([['FOO', makeEntry()]]));
        const calls = logMock.mock.calls.map((c: unknown[]) => c[0] as string);
        const header = calls.find((l: string) => l.includes('KEY') && l.includes('TYPE'));
        expect(header).toBeDefined();
        expect(header).toContain('CREATED');
        expect(header).toContain('MODIFIED');
    });

    it('shows the entry type in the data row', () => {
        listKeys(makeVault([['MY_KEY', makeEntry(EntryType.Secret)]]));
        const calls = logMock.mock.calls.map((c: unknown[]) => c[0] as string);
        const row = calls.find((l: string) => /^MY_KEY/.test(l));
        expect(row).toContain('Secret');
    });

    it('formats dates as YYYY-MM-DD HH:MM:SS UTC', () => {
        const d = new Date('2025-06-14T10:30:00.000Z');
        listKeys(makeVault([['DB_URL', makeEntry(EntryType.Secret, d, d)]]));
        const calls = logMock.mock.calls.map((c: unknown[]) => c[0] as string);
        const row = calls.find((l: string) => /^DB_URL/.test(l));
        expect(row).toContain('2025-06-14 10:30:00');
    });
});
