import { describe, expect, it } from 'vitest';
import { base32Bytes, totpCode } from './totp';

// RFC 6238, Appendix B: the SHA-1 seed "12345678901234567890", here base32 as GoTrue gives secrets out. The RFC's codes
// have 8 digits; an authenticator app's 6 are their last 6.
const SEED = 'GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ';

describe('totpCode', () => {
  it('decodes base32 as RFC 4648 does, padded or not, in either case', () => {
    expect(base32Bytes(SEED).toString()).toBe('12345678901234567890');
    expect(base32Bytes('MZXW6YTBOI').toString()).toBe('foobar');
    expect(base32Bytes('MZXW6===').toString()).toBe('foo');
    expect(base32Bytes('mzxw6ytboi').toString()).toBe('foobar');
    expect(() => base32Bytes('MZXW1')).toThrow('isn\'t a base32 digit');
  });

  it('gives the RFC 6238 test codes', () => {
    const codes = [
      [59, '287082'],
      [1111111109, '081804'],
      [1111111111, '050471'],
      [1234567890, '005924'],
      [2000000000, '279037'],
      [20000000000, '353130'],
    ] as const;
    for (const [seconds, code] of codes) expect(totpCode(SEED, seconds * 1000), String(seconds)).toBe(code);
  });
});
