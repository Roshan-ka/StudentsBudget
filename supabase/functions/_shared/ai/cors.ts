// Which web pages may call the `ai` Edge Function from a browser (the AI phase, chunk 2,
// docs/superpowers/plans/2026-11-09-ai-phase-1.md). The app runs on another origin than the function, so the browser
// asks first (an OPTIONS preflight) and reads the answer only when it names the page's origin.
//
// The origins come from the function's `AI_ALLOWED_ORIGINS` secret, comma-separated
// ("https://students-budget.vercel.app"). It isn't the function's guard (the user's token and the allowance are): it
// only keeps other sites' pages from reading the answers in a browser.

/** The headers the app sends: supabase-js's own and the JSON body's. */
const ALLOWED_HEADERS = 'authorization, apikey, content-type, x-client-info';

/** How long a browser may keep a preflight's answer, in seconds. */
const PREFLIGHT_MAX_AGE = '86400';

/**
 * The origins in the setting: each an `https://` origin, or `http://localhost` with any port for the dev server. Paths,
 * other schemes and anything unreadable are left out, so a typo opens nothing.
 */
export function allowedOrigins(setting: string | undefined): ReadonlySet<string> {
  const origins = new Set<string>();
  for (const part of (setting ?? '').split(',')) {
    const written = part.trim();
    if (written === '') continue;
    let url: URL;
    try {
      url = new URL(written);
    } catch {
      continue;
    }
    const local = url.protocol === 'http:' && url.hostname === 'localhost';
    if ((url.protocol === 'https:' || local) && url.origin === written.replace(/\/$/, '')) origins.add(url.origin);
  }
  return origins;
}

/** The CORS headers for a request from `origin`: none when it came from no page, null when its page may not read it. */
export function corsHeaders(origin: string | null, allowed: ReadonlySet<string>): Record<string, string> | null {
  if (origin === null) return {};
  if (!allowed.has(origin)) return null;
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': ALLOWED_HEADERS,
    'Access-Control-Max-Age': PREFLIGHT_MAX_AGE,
    Vary: 'Origin',
  };
}
