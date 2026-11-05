import type { FullConfig } from '@playwright/test';
import { PAGES } from './helpers/pages';

/**
 * Asks the dev server for every page once, all at once, before the first test. `next dev` compiles a route on its
 * first request; without this, the first test to open each route paid for that compile out of its own time and its
 * 5 s waits, and on the iPhone project of a busy laptop that alone ran some over. Playwright starts the web server
 * before this runs. A server that is already warm answers in moments.
 */
export default async function warmUpRoutes(config: FullConfig) {
  const baseURL = config.projects[0]?.use.baseURL;
  if (!baseURL) return;
  const paths = ['/setup', ...PAGES.map((p) => p.path)];
  const started = Date.now();
  await Promise.all(
    paths.map(async (path) => {
      try {
        await (await fetch(new URL(path, baseURL))).text();
      } catch (error) {
        // A route that fails here fails in its own spec, with a better message.
        console.warn(`[warm-up] ${path}: ${String(error)}`);
      }
    }),
  );
  console.log(`[warm-up] ${paths.length} routes in ${((Date.now() - started) / 1000).toFixed(1)} s`);
}
