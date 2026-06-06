import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { mkdtempSync } from 'node:fs';
import { join } from 'node:path';
import { Vltx, setup } from '../src/index.js';
import { generateRSAKeyPair } from '../src/core/rsa.js';

vi.mock('../src/core/env.js', () => ({
    default: vi.fn((cfg = {}) => ({ ...cfg }))
}));

const tmpDir = mkdtempSync(join(__dirname, 'tmp', 'module-'));

let privateKeyPem: string;

beforeAll(() => {
    ({ privateKey: privateKeyPem } = generateRSAKeyPair() as { privateKey: string });
});

let counter = 0;
const nextAlias = () => `_test_alias_${counter++}`;

afterEach(() => {
    vi.clearAllMocks();
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
        expect(setup({ alias: nextAlias() })).toBeInstanceOf(Vltx);
    });

    it('returns the same cached instance on repeated calls', () => {
        const alias = nextAlias();
        const v1 = setup({ alias });
        const v2 = setup({ alias });
        expect(v1).toBe(v2);
    });

    it('loads the vault from the provided filename', () => {
        const vaultPath = makeVltxFile({ KEY: 'VALUE' });
        expect(setup({ alias: nextAlias(), filename: vaultPath }).has('KEY')).toBe(true);
    });

    it('creates a Vltx with empty config when getConfig returns no filename', async () => {
        const mod = await import('../src/core/env.js');
        vi.mocked(mod.default).mockReturnValueOnce({});
        expect(setup({ alias: nextAlias() })).toBeInstanceOf(Vltx);
    });
});

describe('tagFunction via setup', () => {
    it('returns the secret value for an existing key', () => {
        const vaultPath = makeVltxFile({ SECRET: 'hello' });
        const tag = setup({ alias: nextAlias(), filename: vaultPath, privateKey: privateKeyPem }).tagFunction;
        expect(tag`SECRET`).toBe('hello');
    });

    it('returns empty string for a missing key', () => {
        const vaultPath = makeVltxFile({});
        const tag = setup({ alias: nextAlias(), filename: vaultPath, privateKey: privateKeyPem }).tagFunction;
        expect(tag`MISSING`).toBe('');
    });

    it('returns empty string when the key is empty', () => {
        const tag = setup({ alias: nextAlias() }).tagFunction;
        expect(tag``).toBe('');
    });

    it('throws when interpolation values are passed', () => {
        const tag = setup({ alias: nextAlias() }).tagFunction;
        expect(() => tag`before${'value'}after`).toThrow('Interpolation');
    });
});
