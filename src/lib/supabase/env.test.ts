import { afterEach, describe, expect, it, vi } from 'vitest';
import { isSupabaseConfigured, parseSupabaseEnv, readSupabaseEnv } from './env';

const URL_OK = 'https://abcdefghijklmnop.supabase.co';
const KEY_OK = 'sb_publishable_abc123';

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('parseSupabaseEnv', () => {
  it('accepts an HTTPS project URL with a publishable key', () => {
    expect(parseSupabaseEnv({ url: URL_OK, publishableKey: KEY_OK })).toEqual({ url: URL_OK, publishableKey: KEY_OK });
  });

  it('trims surrounding whitespace', () => {
    expect(parseSupabaseEnv({ url: ` ${URL_OK} `, publishableKey: ` ${KEY_OK}\n` })).toEqual({
      url: URL_OK,
      publishableKey: KEY_OK,
    });
  });

  it('accepts plain HTTP only for the local stack', () => {
    expect(parseSupabaseEnv({ url: 'http://127.0.0.1:54321', publishableKey: KEY_OK })).not.toBeNull();
    expect(parseSupabaseEnv({ url: 'http://localhost:54321', publishableKey: KEY_OK })).not.toBeNull();
    expect(parseSupabaseEnv({ url: 'http://abcdefghijklmnop.supabase.co', publishableKey: KEY_OK })).toBeNull();
    expect(parseSupabaseEnv({ url: 'http://192.168.1.20:54321', publishableKey: KEY_OK })).toBeNull();
  });

  it('gives null when a value is missing or empty', () => {
    expect(parseSupabaseEnv({})).toBeNull();
    expect(parseSupabaseEnv({ url: URL_OK })).toBeNull();
    expect(parseSupabaseEnv({ publishableKey: KEY_OK })).toBeNull();
    expect(parseSupabaseEnv({ url: '', publishableKey: KEY_OK })).toBeNull();
    expect(parseSupabaseEnv({ url: URL_OK, publishableKey: '   ' })).toBeNull();
  });

  it('gives null for a URL that does not parse or is not web', () => {
    expect(parseSupabaseEnv({ url: 'abcdefghijklmnop.supabase.co', publishableKey: KEY_OK })).toBeNull();
    expect(parseSupabaseEnv({ url: 'ftp://abcdefghijklmnop.supabase.co', publishableKey: KEY_OK })).toBeNull();
  });

  it('refuses a secret key, which would bypass row-level security', () => {
    expect(parseSupabaseEnv({ url: URL_OK, publishableKey: 'sb_secret_abc123' })).toBeNull();
  });
});

describe('readSupabaseEnv and isSupabaseConfigured', () => {
  it('read the two NEXT_PUBLIC_ variables', () => {
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', URL_OK);
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY', KEY_OK);
    expect(readSupabaseEnv()).toEqual({ url: URL_OK, publishableKey: KEY_OK });
    expect(isSupabaseConfigured()).toBe(true);
  });

  it('report no project when the variables are unset', () => {
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', undefined);
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY', undefined);
    expect(readSupabaseEnv()).toBeNull();
    expect(isSupabaseConfigured()).toBe(false);
  });
});
