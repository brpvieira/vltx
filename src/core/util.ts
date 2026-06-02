/**
 * String encoding and error-narrowing utilities.
 *
 * Provides base64 helpers, a salt-and-nonce stuffing layer used to
 * ensure each RSA encryption of the same plaintext produces a unique
 * ciphertext, and a Node.js `ErrnoException` type guard.
 * @module
 */
import { randomBytes } from 'node:crypto';

/**
 * Encodes a UTF-8 string to base64.
 * @param str - The string to encode.
 * @returns The base64-encoded string.
 */
export function base64Encode(str: string): string {
    return Buffer.from(str).toString('base64');
}

/**
 * Decodes a base64 string to UTF-8.
 * @param str - The base64-encoded string to decode.
 * @returns The decoded UTF-8 string.
 */
export function base64Decode(str: string): string {
    return Buffer.from(str, 'base64').toString();
}

/**
 * Wraps a string with a random salt and timestamp nonce.
 * Format: `<salt>:<base64(str)>:<nonce>`
 * @param str - The string to wrap.
 * @returns The stuffed string in `salt:base64:nonce` format.
 */
export function stuffString(str: string): string {
    const nonce = new Date().getTime();
    const salt = randomBytes(16).toString('hex');
    return `${salt}:${base64Encode(str)}:${nonce}`;
}

/**
 * Extracts the original string from a stuffed value produced by {@link stuffString}.
 * @param str - The stuffed string in `salt:base64:nonce` format.
 * @returns The original unwrapped string.
 * @throws {Error} If the input is empty or not in the expected `salt:base64:nonce` format.
 */
export function unstuffString(str: string): string {
    if (!str) {
        throw new Error('Input must be a non-empty string');
    }

    const parts = str.split(':');
    if (parts.length !== 3)  {
        throw new Error('Input is malformed');
    }

    return base64Decode(parts[1] || '');
}

/**
 * Type guard that narrows `error` to `NodeJS.ErrnoException`.
 * @param error - The value to test.
 * @returns `true` when `error` is an `Error` with a `code` property.
 */
export function isNodeError(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && 'code' in error;
}
