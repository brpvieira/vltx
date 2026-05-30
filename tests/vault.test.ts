import { assert, describe, expect, it } from 'vitest';
import vault from '../src/core/vault.js';

describe('vault', () => {
    it('imports the module', () => {
        assert(vault, 'module import failed');
    });
    it('adds numbers', () => {
        expect(vault.add(1,1)).eq(2);
    })
});
