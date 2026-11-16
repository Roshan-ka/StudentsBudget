import type { FullConfig } from '@playwright/test';
import { removeErrorContexts } from '../testkit/leak-check.mjs';

// After every live smoke run, live or the leak check: removes the error-context.md files Playwright wrote for a failed
// test. A failed check on a locator puts a snapshot of the whole page in one (Playwright 1.64), and
// PLAYWRIGHT_NO_COPY_PROMPT doesn't stop it: on the live site that page shows the account's address. The leak check
// fails on any it finds, so it holds this teardown to its job. The workflow removes test-results/live as well, in case a
// run is cut short before this runs.
export default function removePageSnapshots(config: FullConfig) {
  const removed = [...new Set(config.projects.map((project) => project.outputDir))].flatMap((dir) => removeErrorContexts(dir));
  if (removed.length) console.log(`live smoke: removed ${removed.length} error-context.md (they can hold the page's text)`);
}
