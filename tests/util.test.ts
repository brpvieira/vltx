import { assert, describe, expect, it } from 'vitest';
import { base64Encode, base64Decode, stuffString,
    unstuffString } from '../src/core/util.js';

const testStr = 'The quick brown fox jumps over the lazy dog';
const testStrInBase64 =
    'VGhlIHF1aWNrIGJyb3duIGZveCBqdW1wcyBvdmVyIHRoZSBsYXp5IGRvZw==';

describe('Base64 helpers', () => {

    it('Encodes string in base64', () =>{
        const encoded = base64Encode(testStr);
        assert(encoded);
        expect(encoded).eq(testStrInBase64);
    });

    it('Decodes base64 string', () => {
        const decoded = base64Decode(testStrInBase64);
        assert(decoded);
        expect(decoded).eq(testStr);
    });
});

describe('stuffString', () => {
    it('Stuffs a string with random salt and nonce', () => {
        const stuffed = stuffString(testStr);
        assert(stuffed);
        const parts = stuffed.split(':');
        expect(parts.length).eq(3);
        const decoded = base64Decode(parts[1]);
        expect(decoded).eq(testStr);
    });

    it('Stuffed strings are different for the same input string', () => {
        const s = new Set();
        for(let i = 0; i < 10; i++) {
            s.add(stuffString(testStr));
        }
        expect(s.size).eq(10);
    });
});

describe('unstuffString', () => {
    it('Unstuffs strings', () => {
        const stuffed = stuffString(testStr);
        const unstuffed = unstuffString(stuffed);
        expect(unstuffed).eq(testStr);
    });

    it('unstuffString throws for invalid inputs', () => {
        assert.throws(() => unstuffString(''), /non-empty string/);
        assert.throws(() => unstuffString('foo'), /malformed/);
        assert.doesNotThrow(() => unstuffString('foo::bar'));
    });

});
