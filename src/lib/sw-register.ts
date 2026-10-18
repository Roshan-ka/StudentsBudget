/**
 * Registers the service worker that lets the installed app open offline, as `/sw.js?v=<version>`.
 * The version is the commit the build is made from: a new build is a new script URL, which is what makes the
 * browser install a new worker (the file itself is the same bytes) with a cache of its own.
 * Skips in development (a dev server must never get one) and in browsers without service workers, and then
 * does not touch `navigator`. Resolves 'failed', after logging, when the registration throws.
 */
export async function registerServiceWorker(env: {
  production: boolean;
  supported: boolean;
  version: string;
}): Promise<'registered' | 'skipped' | 'failed'> {
  if (!env.production || !env.supported) return 'skipped';
  try {
    await navigator.serviceWorker.register(`/sw.js?v=${encodeURIComponent(env.version)}`);
    return 'registered';
  } catch (error) {
    console.error('StudentsBudget: could not register the service worker', error);
    return 'failed';
  }
}
