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

    expect(await registerServiceWorker({ production: false, supported: true })).toBe('skipped');
    expect(register).not.toHaveBeenCalled();
  });

  it('skips in a browser without service workers, without touching navigator', async () => {
    // Reading `navigator` at all would throw here.
    vi.stubGlobal('navigator', undefined);

    expect(await registerServiceWorker({ production: true, supported: false })).toBe('skipped');
  });

  it('registers /sw.js in production', async () => {
    const register = vi.fn().mockResolvedValue({});
    vi.stubGlobal('navigator', { serviceWorker: { register } });

    expect(await registerServiceWorker({ production: true, supported: true })).toBe('registered');
    expect(register).toHaveBeenCalledExactlyOnceWith('/sw.js');
  });

  it('logs and returns failed when the registration throws', async () => {
    const error = new Error('SecurityError');
    vi.stubGlobal('navigator', { serviceWorker: { register: vi.fn().mockRejectedValue(error) } });

    expect(await registerServiceWorker({ production: true, supported: true })).toBe('failed');
    expect(consoleError).toHaveBeenCalledExactlyOnceWith(
      'StudentsBudget: could not register the service worker',
      error,
    );
  });
});
