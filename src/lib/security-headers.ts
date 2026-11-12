// The security headers on every path (legal pages, chunk 4, docs/superpowers/plans/2026-11-12-legal-pages.md), set by
// next.config.ts. Plain TypeScript with no imports: next.config.ts loads it before the app's `@/` alias exists.

export type HeaderEnv = {
  /** NEXT_PUBLIC_SUPABASE_URL: its origin is the one host besides Frankfurter that the app's own code asks. */
  supabaseUrl: string | undefined;
  /** `next dev`: React and Turbopack evaluate code, hot reload uses a websocket, and Speed Insights loads its debug script. */
  dev: boolean;
  /** VERCEL_ENV: on Vercel, requests are upgraded to HTTPS; on its previews, the Vercel Toolbar may load. */
  vercelEnv: string | undefined;
};

export type Header = { key: string; value: string };

/** The exchange-rate service (src/lib/fx.ts). */
const FRANKFURTER = 'https://api.frankfurter.dev';
/** Speed Insights' debug script, which `next dev` loads instead of the app's own copy (@vercel/speed-insights). */
const SPEED_INSIGHTS_DEBUG = 'https://va.vercel-scripts.com';

/** The origin of an http or https URL, else null. */
export function originOf(url: string | undefined): string | null {
  if (!url) return null;
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'https:' || parsed.protocol === 'http:' ? parsed.origin : null;
  } catch {
    return null;
  }
}

/**
 * The Content-Security-Policy. Scripts and styles need 'unsafe-inline': Next 16 with Cache Components can't use nonces
 * without making every page dynamic, which would lose the offline precache, and its flight data, the language and
 * theme head scripts, the charts' styles and MapLibre's are inline. MapLibre decodes images and may start its worker
 * through blob: URLs. Everything else the app loads is its own, so it allows only its own origin, Supabase's and
 * Frankfurter's. On Vercel's previews, the Vercel Toolbar's hosts (Vercel's docs, "Using a Content Security Policy",
 * read on 12-11-2026).
 */
export function contentSecurityPolicy(env: HeaderEnv): string {
  const supabase = originOf(env.supabaseUrl);
  const preview = env.vercelEnv === 'preview';
  const directives: [string, string[]][] = [
    ['default-src', ["'self'"]],
    [
      'script-src',
      [
        "'self'",
        "'unsafe-inline'",
        ...(env.dev ? ["'unsafe-eval'", SPEED_INSIGHTS_DEBUG] : []),
        ...(preview ? ['https://vercel.live'] : []),
      ],
    ],
    ['style-src', ["'self'", "'unsafe-inline'", ...(preview ? ['https://vercel.live'] : [])]],
    ['img-src', ["'self'", 'blob:', 'data:', ...(preview ? ['https://vercel.live', 'https://vercel.com'] : [])]],
    ['font-src', ["'self'", ...(preview ? ['https://vercel.live', 'https://assets.vercel.com'] : [])]],
    [
      'connect-src',
      [
        "'self'",
        ...(supabase === null ? [] : [supabase]),
        FRANKFURTER,
        ...(env.dev ? ['ws:'] : []),
        ...(preview ? ['https://vercel.live', 'wss://ws-us3.pusher.com'] : []),
      ],
    ],
    ['worker-src', ["'self'", 'blob:']],
    ['manifest-src', ["'self'"]],
    ...(preview ? ([['frame-src', ['https://vercel.live']]] as [string, string[]][]) : []),
    ['frame-ancestors', ["'none'"]],
    ['object-src', ["'none'"]],
    ['base-uri', ["'self'"]],
    ['form-action', ["'self'"]],
  ];
  const parts = directives.map(([name, values]) => `${name} ${values.join(' ')}`);
  // Only on Vercel: on localhost, WebKit would upgrade the e2e server's plain-HTTP requests and fail them.
  if (env.vercelEnv) parts.push('upgrade-insecure-requests');
  return parts.join('; ');
}

/**
 * Every header the app sets on every path. HSTS is Vercel's own. The Permissions-Policy allows what the app uses
 * (Show me's location, the mic, passkeys) on its own origin only, and turns off what it never uses.
 */
export function securityHeaders(env: HeaderEnv): Header[] {
  return [
    { key: 'Content-Security-Policy', value: contentSecurityPolicy(env) },
    {
      key: 'Permissions-Policy',
      value:
        'geolocation=(self), microphone=(self), publickey-credentials-get=(self), publickey-credentials-create=(self), ' +
        'camera=(), payment=(), usb=()',
    },
    { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
    { key: 'X-Content-Type-Options', value: 'nosniff' },
    { key: 'X-Frame-Options', value: 'DENY' },
    { key: 'Cross-Origin-Opener-Policy', value: 'same-origin' },
  ];
}
