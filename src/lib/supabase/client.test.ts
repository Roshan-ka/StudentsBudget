import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { createClient } = vi.hoisted(() => ({
  createClient: vi.fn((url: string, key: string, options: unknown) => ({ url, key, options })),
}));

vi.mock('@supabase/supabase-js', () => ({ createClient }));

/** A fresh copy of the module, so each test starts without the singleton. */
async function loadClientModule() {
  vi.resetModules();
  return import('./client');
}

function configure() {
  vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://abcdefghijklmnop.supabase.co');
  vi.stubEnv('NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY', 'sb_publishable_abc123');
}

beforeEach(() => {
  createClient.mockClear();
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe('getSupabase', () => {
  it('gives null on the server, even when the project is configured', async () => {
    configure();
    const { getSupabase } = await loadClientModule();
    expect(getSupabase()).toBeNull();
    expect(createClient).not.toHaveBeenCalled();
  });

  it('gives null in the browser when the build has no project', async () => {
    vi.stubGlobal('window', {});
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', undefined);
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY', undefined);
    const { getSupabase } = await loadClientModule();
    expect(getSupabase()).toBeNull();
    expect(createClient).not.toHaveBeenCalled();
  });

  it('makes one client per tab, keeping the session in localStorage under its own key', async () => {
    vi.stubGlobal('window', {});
    configure();
    const { AUTH_STORAGE_KEY, getSupabase } = await loadClientModule();

    const first = getSupabase();
    expect(first).not.toBeNull();
    expect(getSupabase()).toBe(first);
    expect(createClient).toHaveBeenCalledTimes(1);
    expect(createClient).toHaveBeenCalledWith('https://abcdefghijklmnop.supabase.co', 'sb_publishable_abc123', {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: false,
        storageKey: AUTH_STORAGE_KEY,
      },
    });
  });
});
