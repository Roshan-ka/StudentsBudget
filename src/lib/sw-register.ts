/**
 * Registers the service worker that lets the installed app open offline.
 * Skips in development (a dev server must never get one) and in browsers without service workers, and then
 * does not touch `navigator`. Resolves 'failed', after logging, when the registration throws.
 */
export async function registerServiceWorker(env: {
  production: boolean;
  supported: boolean;
}): Promise<'registered' | 'skipped' | 'failed'> {
  if (!env.production || !env.supported) return 'skipped';
  try {
    await navigator.serviceWorker.register('/sw.js');
    return 'registered';
  } catch (error) {
    console.error('StudentsBudget: could not register the service worker', error);
    return 'failed';
  }
}
