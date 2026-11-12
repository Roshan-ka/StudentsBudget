import { describe, expect, it } from 'vitest';
import { contentSecurityPolicy, originOf, securityHeaders, type HeaderEnv } from './security-headers';

const LIVE: HeaderEnv = { supabaseUrl: 'https://abcdefghijklmnop.supabase.co', dev: false, vercelEnv: 'production' };

/** The policy as directive → values. */
function directives(env: HeaderEnv): Map<string, string[]> {
  return new Map(
    contentSecurityPolicy(env)
      .split('; ')
      .map((part) => {
        const [name, ...values] = part.split(' ');
        return [name, values] as [string, string[]];
      }),
  );
}

describe('the security headers (legal pages, chunk 4)', () => {
  it('allows only the app itself, Supabase and Frankfurter on the live site, and never eval', () => {
    const policy = directives(LIVE);
    expect(policy.get('default-src')).toEqual(["'self'"]);
    expect(policy.get('script-src')).toEqual(["'self'", "'unsafe-inline'"]);
    expect(policy.get('connect-src')).toEqual(["'self'", 'https://abcdefghijklmnop.supabase.co', 'https://api.frankfurter.dev']);
    expect(policy.get('worker-src')).toEqual(["'self'", 'blob:']);
    expect(policy.get('frame-ancestors')).toEqual(["'none'"]);
    expect(policy.get('object-src')).toEqual(["'none'"]);
    expect(policy.has('frame-src')).toBe(false);
    expect(policy.has('upgrade-insecure-requests')).toBe(true);
    expect(contentSecurityPolicy(LIVE)).not.toContain('unsafe-eval');
    expect(contentSecurityPolicy(LIVE)).not.toContain('vercel.live');
  });

  it('takes only the Supabase URL’s origin, and leaves Supabase out without one', () => {
    expect(originOf('https://abc.supabase.co/rest/v1/')).toBe('https://abc.supabase.co');
    expect(originOf('https://e2e.supabase.invalid')).toBe('https://e2e.supabase.invalid');
    expect(originOf('')).toBeNull();
    expect(originOf(undefined)).toBeNull();
    expect(originOf('not a url')).toBeNull();
    expect(originOf('javascript:alert(1)')).toBeNull();
    expect(directives({ ...LIVE, supabaseUrl: undefined }).get('connect-src')).toEqual(["'self'", 'https://api.frankfurter.dev']);
  });

  it('lets the Vercel Toolbar load on previews only', () => {
    const preview = directives({ ...LIVE, vercelEnv: 'preview' });
    expect(preview.get('script-src')).toContain('https://vercel.live');
    expect(preview.get('connect-src')).toEqual(expect.arrayContaining(['https://vercel.live', 'wss://ws-us3.pusher.com']));
    expect(preview.get('frame-src')).toEqual(['https://vercel.live']);
    expect(preview.get('font-src')).toEqual(["'self'", 'https://vercel.live', 'https://assets.vercel.com']);
  });

  it('adds eval, the websocket and Speed Insights’ debug script for `next dev` only, and no upgrade off Vercel', () => {
    const dev = directives({ supabaseUrl: undefined, dev: true, vercelEnv: undefined });
    expect(dev.get('script-src')).toEqual(["'self'", "'unsafe-inline'", "'unsafe-eval'", 'https://va.vercel-scripts.com']);
    expect(dev.get('connect-src')).toContain('ws:');
    expect(dev.has('upgrade-insecure-requests')).toBe(false);
    // The e2e build: a production build on localhost.
    expect(directives({ ...LIVE, vercelEnv: undefined }).has('upgrade-insecure-requests')).toBe(false);
  });

  it('sets the other headers on every response', () => {
    const headers = new Map(securityHeaders(LIVE).map(({ key, value }) => [key, value]));
    expect(headers.get('X-Content-Type-Options')).toBe('nosniff');
    expect(headers.get('X-Frame-Options')).toBe('DENY');
    expect(headers.get('Referrer-Policy')).toBe('strict-origin-when-cross-origin');
    expect(headers.get('Cross-Origin-Opener-Policy')).toBe('same-origin');
    const permissions = headers.get('Permissions-Policy') ?? '';
    for (const used of ['geolocation=(self)', 'microphone=(self)', 'publickey-credentials-get=(self)']) {
      expect(permissions).toContain(used);
    }
    expect(permissions).toContain('camera=()');
  });
});
