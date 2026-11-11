import { afterEach, beforeEach, describe, expect, it, vi, type MockInstance } from 'vitest';
import { registerServiceWorker } from './sw-register';

let consoleError: MockInstance<typeof console.error>;

beforeEach(() => {
  // A failed registration is logged; keep that out of the test output.
  consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('registerServiceWorker', () => {
  it('skips outside production, so a dev server never gets a service worker', async () => {
    const register = vi.fn();
    vi.stubGlobal('navigator', { serviceWorker: { register } });

    expect(await registerServiceWorker({ production: false, supported: true, version: 'abc123', mapSet: '20261110' })).toBe('skipped');
    expect(register).not.toHaveBeenCalled();
  });

  it('skips in a browser without service workers, without touching navigator', async () => {
    // Reading `navigator` at all would throw here.
    vi.stubGlobal('navigator', undefined);

    expect(await registerServiceWorker({ production: true, supported: false, version: 'abc123', mapSet: '20261110' })).toBe('skipped');
  });

  it('registers /sw.js named for the build version in production', async () => {
    const register = vi.fn().mockResolvedValue({});
    vi.stubGlobal('navigator', { serviceWorker: { register } });

    expect(await registerServiceWorker({ production: true, supported: true, version: 'abc123', mapSet: '20261110' })).toBe('registered');
    // A new version is a new script URL, which is what makes the browser install a new worker; the map set names the
    // map's own cache.
    expect(register).toHaveBeenCalledExactlyOnceWith('/sw.js?v=abc123&map=20261110');
  });

  it('encodes the version and the map set in the URL', async () => {
    const register = vi.fn().mockResolvedValue({});
    vi.stubGlobal('navigator', { serviceWorker: { register } });

    await registerServiceWorker({ production: true, supported: true, version: 'a b/c?d', mapSet: 'x&y' });
    expect(register).toHaveBeenCalledExactlyOnceWith('/sw.js?v=a%20b%2Fc%3Fd&map=x%26y');
  });

  it('logs and returns failed when the registration throws', async () => {
    const error = new Error('SecurityError');
    vi.stubGlobal('navigator', { serviceWorker: { register: vi.fn().mockRejectedValue(error) } });

    expect(await registerServiceWorker({ production: true, supported: true, version: 'abc123', mapSet: '20261110' })).toBe('failed');
    expect(consoleError).toHaveBeenCalledExactlyOnceWith(
      'StudentsBudget: could not register the service worker',
      error,
    );
  });
});
