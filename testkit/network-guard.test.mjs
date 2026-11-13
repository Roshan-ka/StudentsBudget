import { describe, expect, it } from 'vitest';
import { blockedError, guardContext, isAllowed, originOf } from './network-guard.mjs';

const ALLOWED = ['http://localhost:3210', '127.0.0.1:54321'];

describe('isAllowed', () => {
  it('lets through the origins and hosts the setup names, and schemes that need no network', () => {
    expect(isAllowed('http://localhost:3210/settings/account', ALLOWED)).toBe(true);
    expect(isAllowed('http://127.0.0.1:54321/auth/v1/token?grant_type=password', ALLOWED)).toBe(true);
    expect(isAllowed('data:image/png;base64,AAAA', ALLOWED)).toBe(true);
    expect(isAllowed('blob:http://localhost:3210/1234', ALLOWED)).toBe(true);
  });

  it('stops any other host, another port of the same host, and what is not a URL', () => {
    expect(isAllowed('https://api.frankfurter.dev/v2/rates', ALLOWED)).toBe(false);
    expect(isAllowed('http://localhost:3000/', ALLOWED)).toBe(false);
    expect(isAllowed('https://localhost:3210/', ALLOWED)).toBe(false);
    expect(isAllowed('not a url', ALLOWED)).toBe(false);
  });
});

describe('blockedError', () => {
  it('names each host once, never a path or query', () => {
    expect(blockedError([])).toBeNull();
    const error = blockedError(['https://a.example/x?token=1', 'https://a.example/y', 'https://b.example/']);
    expect(error.message).toBe('the network guard stopped requests to hosts outside the test setup: https://a.example, https://b.example');
    expect(originOf('about:blank')).toBe('about:');
  });
});

describe('guardContext', () => {
  /** A context whose route handler the test drives, as Playwright would for each request. */
  function fakeContext() {
    let handler;
    return {
      route: async (pattern, h) => {
        expect(pattern).toBe('**/*');
        handler = h;
      },
      request: (url) => {
        const calls = [];
        handler({ request: () => ({ url: () => url }), fallback: () => calls.push('fallback'), abort: (code) => calls.push(`abort ${code}`) });
        return calls;
      },
    };
  }

  it('passes allowed requests on, stops the rest, and fails only when it stopped one', async () => {
    const context = fakeContext();
    const guarded = await guardContext(context, ALLOWED);
    expect(context.request('http://localhost:3210/')).toEqual(['fallback']);
    guarded.assertClean();
    expect(context.request('https://example.com/pixel.gif')).toEqual(['abort blockedbyclient']);
    expect(guarded.stopped).toEqual(['https://example.com/pixel.gif']);
    expect(() => guarded.assertClean()).toThrow('hosts outside the test setup: https://example.com');
  });
});
