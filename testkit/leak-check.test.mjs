import { describe, expect, it } from 'vitest';
import { base32Bytes, codesBetween, findLeaks, recordings, redact, totp } from './leak-check.mjs';

describe('totp', () => {
  // RFC 6238, appendix B: the SHA-1 key "12345678901234567890" (base32 GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ), 8 digits there;
  // the 6-digit code is the last 6 of them.
  const KEY = 'GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ';

  it('gives the RFC test vectors', () => {
    expect(totp(KEY, 59_000)).toBe('287082');
    expect(totp(KEY, 1_111_111_109_000)).toBe('081804');
    expect(totp(KEY, 1_234_567_890_000)).toBe('005924');
  });

  it('reads a key in any case, with spaces, dashes or padding', () => {
    expect(base32Bytes('gezd gnbv-gy3t qojq====')).toEqual(base32Bytes('GEZDGNBVGY3TQOJQ'));
    expect(() => base32Bytes('GEZD1')).toThrow(/A-Z and the digits 2-7/);
  });

  it('lists every code of a run, with a window of margin on each side', () => {
    const codes = codesBetween(KEY, 60_000, 89_000);
    expect(codes).toEqual([totp(KEY, 30_000), totp(KEY, 60_000), totp(KEY, 90_000)]);
  });
});

describe('findLeaks', () => {
  const secrets = [
    { name: 'password', value: 'leak-check-1a2b3c' },
    { name: 'code', value: '123456', digits: true },
    { name: 'unset', value: '' },
  ];

  it('names each secret where it appears, by place and line', () => {
    const texts = [
      { where: 'output', text: 'ok\nfill("leak-check-1a2b3c")\n' },
      { where: 'test-results/a/error-context.md', text: 'textbox "6-digit code": 123456' },
    ];
    expect(findLeaks(texts, secrets)).toEqual([
      { where: 'output', line: 2, name: 'password' },
      { where: 'test-results/a/error-context.md', line: 1, name: 'code' },
    ]);
  });

  it('takes a code only on its own, and skips the runner mask line', () => {
    const texts = [{ where: 'output', text: 'id 91234567 at 1123456789\n::add-mask::123456\n  ::add-mask::leak-check-1a2b3c' }];
    expect(findLeaks(texts, secrets)).toEqual([]);
  });

  it('redacts what it finds', () => {
    expect(redact('pw leak-check-1a2b3c, code 123456, id 91234567', secrets)).toBe('pw [leak: password], code [leak: code], id 91234567');
  });
});

describe('recordings', () => {
  it('names traces, screenshots and videos, and nothing else', () => {
    const files = ['r/a/trace.zip', 'r/a/test-failed-1.png', 'r/a/video.webm', 'r/a/error-context.md', 'r/.totp-step', 'r/.last-run.json'];
    expect(recordings(files)).toEqual(['r/a/trace.zip', 'r/a/test-failed-1.png', 'r/a/video.webm']);
  });
});
