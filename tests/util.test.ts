import { assert, describe, expect, it } from 'vitest';
import { base64Encode, base64Decode, stuffString,
    unstuffString } from '../src/core/util.js';

describe('String utils', () => {

    const testStr = 'The quick brown fox jumps over the lazy dog';
    const testStrInBase64 =
        'VGhlIHF1aWNrIGJyb3duIGZveCBqdW1wcyBvdmVyIHRoZSBsYXp5IGRvZw==';

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

    it('Stuffs a string with random salt and nonce', () => {
        const stuffed = stuffString(testStr);
        assert(stuffed);
        const parts = stuffed.split(':');
        expect(parts.length).eq(3);
        const decoded = base64Decode(parts[1]);
        expect(decoded).eq(testStr);
    });

    it('Stuffed string are different for the same input string', () => {
        const s = new Set();
        for(let i = 0; i < 10; i++) {
            s.add(stuffString(testStr));
        }
        expect(s.size).eq(10);
    });

    it('unstuffs strings', () => {
        const stuffed = stuffString(testStr);
        const unstuffed = unstuffString(stuffed);
        expect(unstuffed).eq(testStr);
    });
});
