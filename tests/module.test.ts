import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { mkdtempSync } from 'node:fs';
import { join } from 'node:path';
import { Vltx, setup, clearAll, remove } from '../src/index.js';
import { generateRSAKeyPair } from '../src/core/rsa.js';

vi.mock('../src/core/env.js', () => ({
    default: vi.fn((cfg = {}) => ({ ...cfg }))
}));

const tmpDir = mkdtempSync(join(__dirname, 'tmp', 'module-'));

let privateKeyPem: string;

beforeAll(() => {
    ({ privateKey: privateKeyPem } = generateRSAKeyPair() as { privateKey: string });
});

afterEach(() => {
    vi.clearAllMocks();
    clearAll();
});

function makeVltxFile(secrets: Record<string, string>): string {
    const path = join(tmpDir, `vault-${Date.now()}.json`);
    const v = new Vltx({ privateKey: privateKeyPem });
    for (const [k, val] of Object.entries(secrets)) {
        v.set(k, val);
    }
    v.write(path);
    return path;
}

describe('setup', () => {
    it('returns a Vltx instance', () => {
        expect(setup()).toBeInstanceOf(Vltx);
    });

    it('returns the same cached instance on repeated calls', () => {
        const v1 = setup({ alias: 'cache-test' });
        const v2 = setup({ alias: 'cache-test' });
        expect(v1).toBe(v2);
    });

    it('loads the vault from the provided filename', () => {
        const vaultPath = makeVltxFile({ KEY: 'VALUE' });
        expect(setup({ filename: vaultPath }).has('KEY')).toBe(true);
    });

    it('creates a Vltx with empty config when getConfig returns no filename', async () => {
        const mod = await import('../src/core/env.js');
        vi.mocked(mod.default).mockReturnValueOnce({});
        expect(setup()).toBeInstanceOf(Vltx);
    });
});

describe('remove', () => {
    it('returns the removed instance', () => {
        const v = setup({ alias: 'to-remove' });
        expect(remove('to-remove')).toBe(v);
    });

    it('returns undefined for an unknown alias', () => {
        expect(remove('nonexistent')).toBeUndefined();
    });

    it('allows setup to create a fresh instance after removal', () => {
        const v1 = setup({ alias: 'refreshable' });
        remove('refreshable');
        const v2 = setup({ alias: 'refreshable' });
        expect(v2).not.toBe(v1);
    });
});

describe('clearAll', () => {
    it('allows setup to create fresh instances after clearing', () => {
        const v1 = setup({ alias: 'a' });
        const v2 = setup({ alias: 'b' });
        clearAll();
        expect(setup({ alias: 'a' })).not.toBe(v1);
        expect(setup({ alias: 'b' })).not.toBe(v2);
    });
});

describe('tagFunction via setup', () => {
    it('returns the secret value for an existing key', () => {
        const vaultPath = makeVltxFile({ SECRET: 'hello' });
        const tag = setup({ filename: vaultPath, privateKey: privateKeyPem }).tagFunction;
        expect(tag`SECRET`).toBe('hello');
    });

    it('returns empty string for a missing key', () => {
        const vaultPath = makeVltxFile({});
        const tag = setup({ filename: vaultPath, privateKey: privateKeyPem }).tagFunction;
        expect(tag`MISSING`).toBe('');
    });

    it('returns empty string when the key is empty', () => {
        const tag = setup().tagFunction;
        expect(tag``).toBe('');
    });

    it('throws when interpolation values are passed', () => {
        const tag = setup().tagFunction;
        expect(() => tag`before${'value'}after`).toThrow('Interpolation');
    });
});
