import { expect, test, type Page } from '@playwright/test';
import type { AskReply } from '../src/features/ai/contract';
import { PRIVACY_NOTES, type PrivacyNoteId } from '../src/features/privacy/notes';
import { MESSAGES } from '../src/i18n/messages';
import { mockAiFunction } from './helpers/ai';
import { openApp } from './helpers/app';
import { acceptPrivacyNotes } from './helpers/privacy';
import { seedSetup } from './helpers/seed-setup';
import { mockSupabaseAuth, mockSupabaseData, skipUnlessAccountsShow } from './helpers/supabase';

// The security headers (legal pages, chunk 4, docs/superpowers/plans/2026-11-12-legal-pages.md): every page carries
// them, and using the app breaks none of the Content-Security-Policy's rules: Home, signing in (mocked), Ask (mocked)
// and the discount map, where the browser has WebGL 2. A violation is reported whether or not anything visibly breaks
// (Zod's `new Function` probe, caught, was one), so the spec collects every report across pages.

test.use({ viewport: { width: 375, height: 812 } });

const EN = MESSAGES.en;
const EMAIL = 'headers@example.com';
const PASSWORD = 'correct horse';
const REPLY: AskReply = { answer: 'You have money left this week.', sourceIds: [], unbacked: [] };

/** Every CSP violation the pages report, from before their first script, across navigations. */
async function watchViolations(page: Page): Promise<string[]> {
  const seen: string[] = [];
  await page.exposeFunction('__reportCspViolation', (line: string) => {
    seen.push(line);
  });
  await page.addInitScript(() => {
    document.addEventListener('securitypolicyviolation', (event) => {
      const report = (window as unknown as { __reportCspViolation: (line: string) => void }).__reportCspViolation;
      report(`${event.effectiveDirective}: ${event.blockedURI} (${event.sourceFile}:${event.lineNumber}) on ${location.pathname}`);
    });
  });
  page.on('console', (message) => {
    if (/Content Security Policy/i.test(message.text())) seen.push(`console: ${message.text()}`);
  });
  return seen;
}

test('every page carries the security headers', async ({ request }) => {
  for (const path of ['/', '/tips', '/privacy', '/maps/vendor/maplibre-gl-6.16.0/maplibre-gl.css']) {
    const headers = (await request.get(path)).headers();
    const policy = headers['content-security-policy'] ?? '';
    expect(policy, path).toContain("default-src 'self'");
    expect(policy, path).toContain("frame-ancestors 'none'");
    expect(policy, path).toContain("object-src 'none'");
    // The e2e build's Supabase stand-in is the account's host there.
    expect(policy, path).toContain('https://e2e.supabase.invalid');
    expect(headers['x-content-type-options'], path).toBe('nosniff');
    expect(headers['x-frame-options'], path).toBe('DENY'); // proof: frame-deny
    expect(headers['referrer-policy'], path).toBe('strict-origin-when-cross-origin');
    expect(headers['cross-origin-opener-policy'], path).toBe('same-origin');
    expect(headers['permissions-policy'], path).toContain('geolocation=(self)');
  }
});

test('using the app breaks no rule of the Content-Security-Policy', async ({ page }) => {
  const violations = await watchViolations(page);
  await mockSupabaseData(page);
  await skipUnlessAccountsShow(page);
  await acceptPrivacyNotes(page, Object.keys(PRIVACY_NOTES) as PrivacyNoteId[]);
  await mockSupabaseAuth(page, { [EMAIL]: PASSWORD });
  await mockAiFunction(page, { answers: { ask: REPLY } });

  // Home, with a plan.
  await seedSetup(page);

  // Signing in, which links the phone and syncs.
  await openApp(page, '/settings/account');
  await page.getByRole('textbox', { name: EN.auth.signIn.email, exact: true }).fill(EMAIL);
  await page.getByLabel(EN.auth.signIn.password, { exact: true }).fill(PASSWORD);
  await page.getByRole('button', { name: EN.auth.signIn.signIn, exact: true }).click();
  await expect(page.getByText(`Signed in as ${EMAIL}.`, { exact: true })).toBeVisible();

  // Ask, through the `ai` function: the chat bubble on Home opens it (13-11-2026).
  await openApp(page, '/');
  await page.getByRole('button', { name: EN.ask.link, exact: true }).click();
  await page.getByRole('textbox', { name: EN.ask.question, exact: true }).fill('How much is left this week?');
  await page.getByRole('button', { name: EN.ask.submit, exact: true }).click();
  await expect(page.getByText(REPLY.answer, { exact: true })).toBeVisible();

  // The discount map: MapLibre, its worker, tiles, fonts and sprites.
  await openApp(page, '/tips');
  const webgl2 = await page.evaluate(() => document.createElement('canvas').getContext('webgl2') !== null);
  if (webgl2) {
    const tab = page
      .getByRole('tablist', { name: 'Tips, discounts, hacks or checklist', exact: true })
      .getByRole('tab', { name: 'Discounts', exact: true });
    await tab.click();
    await page.getByRole('group', { name: 'Show discounts as', exact: true }).getByRole('button', { name: 'Map', exact: true }).click();
    const map = page.getByRole('region', { name: 'Map of the discounts in Regensburg', exact: true });
    await expect(map).toHaveAttribute('data-map-ready', '', { timeout: 15_000 });
  }

  expect(violations).toEqual([]);
});
