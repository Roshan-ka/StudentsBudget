// The network guard (testkit/README.md, "Network guard"): a test may reach only the hosts its setup names (the app and
// the backend the adapter lists); a request to any other host is stopped, and the test fails, naming it.
//
// It is the last route in line: routes a test or a helper sets on the page or the context run first (Playwright runs
// page routes before context routes, and later routes before earlier ones), so a mocked host answered by the test never
// reaches it, and `route.fallback()` from a test's own route does. Requests made through the `request` fixture aren't
// routed, so the adapter guards those itself.

const ALWAYS = new Set(['data:', 'blob:', 'about:', 'chrome-extension:']);

/**
 * Whether a request may go out: its scheme needs no network, or its origin (or its host and port) is one the setup
 * names. `allowed` lists origins (`http://localhost:3210`) or hosts with their port (`127.0.0.1:54321`).
 */
export function isAllowed(url, allowed) {
  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    return false;
  }
  if (ALWAYS.has(parsed.protocol)) return true;
  return allowed.some((entry) => {
    if (entry.includes('://')) return new URL(entry).origin === parsed.origin;
    return entry === parsed.host;
  });
}

/** The origin of a URL, or the URL itself when it has none; what the failure names, never a query string. */
export function originOf(url) {
  try {
    const { origin, protocol } = new URL(url);
    return origin === 'null' ? protocol : origin;
  } catch {
    return url;
  }
}

/** The failure for the hosts a test tried to reach, each once, or null when there were none. */
export function blockedError(urls) {
  if (urls.length === 0) return null;
  const hosts = [...new Set(urls.map(originOf))];
  return new Error(`the network guard stopped requests to hosts outside the test setup: ${hosts.join(', ')}`);
}

/**
 * Puts a browser context behind the guard: every request of it goes through the guard's route. Returns the URLs it
 * stopped and `assertClean()`, which throws when there was one. A suite's auto fixture calls it for the test's context
 * and `assertClean()` after the test; a test that opens a second context guards that one too.
 */
export async function guardContext(context, allowed) {
  const stopped = [];
  await context.route('**/*', (route) => {
    const url = route.request().url();
    if (isAllowed(url, allowed)) return route.fallback();
    stopped.push(url);
    return route.abort('blockedbyclient');
  });
  return {
    stopped,
    assertClean() {
      const error = blockedError(stopped);
      if (error) throw error;
    },
  };
}
