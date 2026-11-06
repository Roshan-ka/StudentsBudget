import type { FullConfig } from '@playwright/test';
import { PAGES } from './helpers/pages';

/**
 * Asks the server for every page once, all at once, before the first test. Against the production build (the default)
 * that costs a moment. Against a running `npm run dev` (`E2E_PORT=3000`), which compiles a route on its first request,
 * it keeps that compile out of the first test to open each route, which on the iPhone project of a busy laptop ran
 * some over. Playwright starts the web server before this runs.
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
