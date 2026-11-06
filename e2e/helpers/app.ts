import { expect, type Page } from '@playwright/test';

/**
 * How long a first visit may take to become ready. The dev server compiles a route on its first visit, and WebKit on a
 * busy laptop runs the scripts slowly: 5 s (expect's default) was not always enough.
 */
const READY_TIMEOUT = 20_000;

/**
 * Waits for the app's ready signal: `data-app-ready` on `<html>`, which `AppInit` (src/components/app-init.tsx) sets
 * once React has hydrated the layout and the database is open and seeded. After it, a click reaches React rather than
 * the server-rendered HTML. It says nothing about a page's own data: wait for what the page shows from it as well.
 * Client-side navigations keep the signal; a `goto` or a reload starts without it.
 */
export async function waitForApp(page: Page) {
  await expect(page.locator('html[data-app-ready]')).toBeAttached({ timeout: READY_TIMEOUT });
}

/** Loads a page and waits until the app has started on it. */
export async function openApp(page: Page, path: string) {
  await page.goto(path);
  await waitForApp(page);
}

/**
 * Waits until Home shows the plan: Quick add renders only once Home has read the saved plan, so it is there and live.
 * After the wizard's Save, the router may first have to wait for the dev server to compile '/', hence the long budget.
 */
export async function waitForHome(page: Page) {
  await expect(page.getByRole('textbox', { name: 'Quick add' })).toBeVisible({ timeout: READY_TIMEOUT });
  await expect(page).toHaveURL('/');
}
