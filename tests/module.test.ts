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
const injected: string[] = [];

afterEach(() => {
    for (const a of injected.splice(0)) {
        delete (global as Record<string, unknown>)[a];
    }
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

function getTag(alias: string) {
    return (global as Record<string, unknown>)[alias] as
        (_strings: TemplateStringsArray, ..._values: unknown[]) => string;
}

describe('setup', () => {
    it('returns a Vltx instance', () => {
        const alias = nextAlias();
        injected.push(alias);
        expect(setup({ alias })).toBeInstanceOf(Vltx);
    });

    it('returns the same cached instance on repeated calls', () => {
        const alias = nextAlias();
        injected.push(alias);
        const v1 = setup({ alias, inject: false });
        const v2 = setup({ alias, inject: false });
        expect(v1).toBe(v2);
    });

    it('injects a tag function on global by default', () => {
        const alias = nextAlias();
        injected.push(alias);
        setup({ alias });
        expect(typeof (global as Record<string, unknown>)[alias]).toBe('function');
    });

    it('does not inject when inject is false', () => {
        const alias = nextAlias();
        setup({ alias, inject: false });
        expect((global as Record<string, unknown>)[alias]).toBeUndefined();
    });

    it('does not overwrite an existing global', () => {
        const alias = nextAlias();
        const original = {};
        (global as Record<string, unknown>)[alias] = original;
        injected.push(alias);
        setup({ alias });
        expect((global as Record<string, unknown>)[alias]).toBe(original);
    });

    it('loads the vault from the provided filename', () => {
        const vaultPath = makeVltxFile({ KEY: 'VALUE' });
        const alias = nextAlias();
        injected.push(alias);
        expect(setup({ alias, filename: vaultPath }).has('KEY')).toBe(true);
    });

    it('creates a Vltx with empty config when getConfig returns no filename', async () => {
        const mod = await import('../src/core/env.js');
        vi.mocked(mod.default).mockReturnValueOnce({});
        const alias = nextAlias();
        injected.push(alias);
        expect(setup({ alias, inject: false })).toBeInstanceOf(Vltx);
    });
});

describe('tag function', () => {
    it('returns the secret value for an existing key', () => {
        const vaultPath = makeVltxFile({ SECRET: 'hello' });
        const alias = nextAlias();
        injected.push(alias);
        setup({ alias, filename: vaultPath, privateKey: privateKeyPem });
        expect(getTag(alias)`SECRET`).toBe('hello');
    });

    it('returns empty string for a missing key', () => {
        const vaultPath = makeVltxFile({});
        const alias = nextAlias();
        injected.push(alias);
        setup({ alias, filename: vaultPath, privateKey: privateKeyPem });
        expect(getTag(alias)`MISSING`).toBe('');
    });

    it('returns empty string when the key is empty', () => {
        const alias = nextAlias();
        injected.push(alias);
        setup({ alias });
        expect(getTag(alias)``).toBe('');
    });

    it('throws when interpolation values are passed', () => {
        const alias = nextAlias();
        injected.push(alias);
        setup({ alias });
        expect(() => getTag(alias)`before${'value'}after`).toThrow('Interpolation');
    });
});
