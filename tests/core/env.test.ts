import { assert, afterEach, beforeEach, describe, it } from 'vitest';
import { join } from 'node:path';
import getConfig from '../../src/core/env.js';

const ENV_KEYS = ['VLTX_FILE', 'VLTX_KEY_FILE', 'VLTX_PASSPHRASE'] as const;
type EnvSnapshot = Partial<Record<typeof ENV_KEYS[number], string | undefined>>;

let snapshot: EnvSnapshot = {};

beforeEach(() => {
    snapshot = {};
    for (const key of ENV_KEYS) {
        snapshot[key] = process.env[key];
        delete process.env[key];
    }
});

afterEach(() => {
    for (const key of ENV_KEYS) {
        if (snapshot[key] === undefined) {
            delete process.env[key];
        } else {
            process.env[key] = snapshot[key];
        }
    }
});

describe('getConfig defaults', () => {
    it('returns cwd-based default filename', () => {
        const cfg = getConfig();
        assert.equal(cfg.filename, join(process.cwd(), '.vltx'));
    });

    it('returns cwd-based default privateKeyFilename', () => {
        const cfg = getConfig();
        assert.equal(cfg.privateKeyFilename, join(process.cwd(), '.vltx.rsa'));
    });

    it('omits passphrase when neither env var nor override is set', () => {
        const cfg = getConfig();
        assert(!('passphrase' in cfg));
    });
});

describe('getConfig overrides', () => {
    it('override filename takes priority over default', () => {
        const cfg = getConfig({ filename: '/custom/path.vault' });
        assert.equal(cfg.filename, '/custom/path.vault');
    });

    it('override privateKeyFilename takes priority over default', () => {
        const cfg = getConfig({ privateKeyFilename: '/custom/key.rsa' });
        assert.equal(cfg.privateKeyFilename, '/custom/key.rsa');
    });

    it('override filename takes priority over VLTX_FILE env var', () => {
        process.env['VLTX_FILE'] = '/env/path.vault';
        const cfg = getConfig({ filename: '/override/path.vault' });
        assert.equal(cfg.filename, '/override/path.vault');
    });

    it('override privateKeyFilename takes priority over VLTX_KEY_FILE env var', () => {
        process.env['VLTX_KEY_FILE'] = '/env/key.rsa';
        const cfg = getConfig({ privateKeyFilename: '/override/key.rsa' });
        assert.equal(cfg.privateKeyFilename, '/override/key.rsa');
    });

    it('override passphrase is used when env var is absent', () => {
        const cfg = getConfig({ passphrase: 'my-secret' });
        assert.equal(cfg.passphrase, 'my-secret');
    });
});

describe('getConfig environment variables', () => {
    it('VLTX_FILE overrides default filename', () => {
        process.env['VLTX_FILE'] = '/env/vault.file';
        const cfg = getConfig();
        assert.equal(cfg.filename, '/env/vault.file');
    });

    it('VLTX_KEY_FILE overrides default privateKeyFilename', () => {
        process.env['VLTX_KEY_FILE'] = '/env/vault.rsa';
        const cfg = getConfig();
        assert.equal(cfg.privateKeyFilename, '/env/vault.rsa');
    });

    it('VLTX_PASSPHRASE sets passphrase', () => {
        process.env['VLTX_PASSPHRASE'] = 'env-passphrase';
        const cfg = getConfig();
        assert.equal(cfg.passphrase, 'env-passphrase');
    });
});

describe('getConfig return shape', () => {
    it('always returns filename and privateKeyFilename', () => {
        const cfg = getConfig();
        assert('filename' in cfg);
        assert('privateKeyFilename' in cfg);
    });

    it('calling with no argument and empty object yields identical results', () => {
        const a = getConfig();
        const b = getConfig({});
        assert.deepEqual(a, b);
    });
});
