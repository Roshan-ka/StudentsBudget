import { afterEach, describe, expect, it, vi } from 'vitest';
import { newId } from './new-id';

const V4_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

type FillBytes = (array: Uint8Array) => Uint8Array;

/** The real `crypto`, taken before any test replaces the global. */
const realCrypto = globalThis.crypto;
const realFill: FillBytes = (array) => realCrypto.getRandomValues(array);

/** Stands in for `crypto` on a plain-HTTP origin: `getRandomValues` exists, `randomUUID` does not. */
function stubInsecureCrypto(getRandomValues: FillBytes = realFill) {
  vi.stubGlobal('crypto', { getRandomValues });
}

/** Random bytes that are all the same, to see what `newId` does to the version and variant bits. */
const allBytes =
  (byte: number): FillBytes =>
  (array) => array.fill(byte);

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('newId', () => {
  it('returns a version-4 UUID', () => {
    expect(newId()).toMatch(V4_UUID);
  });

  it('uses crypto.randomUUID when the browser has it', () => {
    vi.stubGlobal('crypto', { randomUUID: () => 'native-id', getRandomValues: realFill });
    expect(newId()).toBe('native-id');
  });

  it('still returns a valid version-4 UUID without crypto.randomUUID, and does not throw', () => {
    stubInsecureCrypto();
    expect(globalThis.crypto.randomUUID).toBeUndefined();
    expect(() => newId()).not.toThrow();
    expect(newId()).toMatch(V4_UUID);
  });

  it('sets the version nibble to 4 and the variant bits to 10, whatever the random bytes are', () => {
    stubInsecureCrypto(allBytes(0xff));
    expect(newId()).toBe('ffffffff-ffff-4fff-bfff-ffffffffffff');

    stubInsecureCrypto(allBytes(0x00));
    expect(newId()).toBe('00000000-0000-4000-8000-000000000000');
  });

  it('gives a different id on every call, with and without crypto.randomUUID', () => {
    const native = new Set(Array.from({ length: 1000 }, () => newId()));
    expect(native.size).toBe(1000);

    stubInsecureCrypto();
    const fallback = new Set(Array.from({ length: 1000 }, () => newId()));
    expect(fallback.size).toBe(1000);
  });
});
