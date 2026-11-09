import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { formatDate } from '../src/lib/dates';
import { THEME_STORAGE_KEY } from '../src/theme/themes';
import { openApp } from './helpers/app';
import { seedSetup } from './helpers/seed-setup';

// The date field's calendar (docs/superpowers/plans/2026-11-06-date-field.md, chunk 3): the button at the end of the
// field opens a sheet with the month, which the keys move through as the WAI-ARIA date-picker dialog does. Typing in
// the field is in entries.spec.ts. `seedSetup` pins the clock to Friday 2026-10-16.

test.use({ viewport: { width: 375, height: 812 } });

function calendarButton(page: Page, field = 'Date') {
  return page.getByRole('button', { name: `Open the calendar: ${field}`, exact: true });
}

function sheet(page: Page, title = 'Choose a date') {
  return page.getByRole('dialog', { name: title, exact: true });
}

/** A day of the open sheet, by its name: the language's long date ("Friday 16 October 2026" in en-IE). */
function day(page: Page, name: string) {
  return sheet(page).getByRole('gridcell', { name, exact: true });
}

async function openNewEntry(page: Page) {
  await seedSetup(page);
  await openApp(page, '/entries/new');
  await expect(page.getByRole('textbox', { name: 'Date', exact: true })).toHaveValue(formatDate('2026-10-16'));
}

test('the calendar opens on the date, moves by key, picks with Enter and hands the focus back', async ({ page }) => {
  await openNewEntry(page);
  const date = page.getByRole('textbox', { name: 'Date', exact: true });

  await calendarButton(page).click();
  await expect(sheet(page)).toBeVisible();
  await expect(sheet(page).getByText('October 2026', { exact: true })).toBeVisible();
  // Weeks start on Monday.
  await expect(sheet(page).getByRole('columnheader')).toHaveText(['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']);
  const friday = day(page, 'Friday 16 October 2026');
  await expect(friday).toBeFocused();
  await expect(friday).toHaveAttribute('aria-selected', 'true');
  await expect(friday).toHaveAttribute('aria-current', 'date');

  // A day sideways, a week down, the week's Sunday and Monday, then a month on.
  await page.keyboard.press('ArrowLeft');
  await expect(day(page, 'Thursday 15 October 2026')).toBeFocused();
  await page.keyboard.press('ArrowDown');
  await expect(day(page, 'Thursday 22 October 2026')).toBeFocused();
  await page.keyboard.press('End');
  await expect(day(page, 'Sunday 25 October 2026')).toBeFocused();
  await page.keyboard.press('Home');
  await expect(day(page, 'Monday 19 October 2026')).toBeFocused();
  await page.keyboard.press('PageDown');
  await expect(sheet(page).getByText('November 2026', { exact: true })).toBeVisible();
  await expect(day(page, 'Thursday 19 November 2026')).toBeFocused();

  await page.keyboard.press('Enter');
  await expect(sheet(page)).toHaveCount(0);
  await expect(date).toHaveValue(formatDate('2026-11-19'));
  await expect(calendarButton(page)).toBeFocused();
});

test('Escape closes the calendar and leaves the date as it was', async ({ page }) => {
  await openNewEntry(page);
  await calendarButton(page).click();
  await expect(day(page, 'Friday 16 October 2026')).toBeFocused();
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('Escape');

  await expect(sheet(page)).toHaveCount(0);
  await expect(page.getByRole('textbox', { name: 'Date', exact: true })).toHaveValue(formatDate('2026-10-16'));
  await expect(calendarButton(page)).toBeFocused();
});

test('a tap picks any day the sheet shows, and the month buttons and Go to today move the month', async ({ page }) => {
  await openNewEntry(page);
  const date = page.getByRole('textbox', { name: 'Date', exact: true });

  // October's last row runs into November.
  await calendarButton(page).click();
  await day(page, 'Monday 2 November 2026').click();
  await expect(sheet(page)).toHaveCount(0);
  await expect(date).toHaveValue(formatDate('2026-11-02'));
  await expect(page.getByRole('button', { name: 'Today', exact: true })).toHaveAttribute('aria-pressed', 'false');

  // It opens on the picked date's month.
  await calendarButton(page).click();
  await expect(sheet(page).getByText('November 2026', { exact: true })).toBeVisible();
  await expect(day(page, 'Monday 2 November 2026')).toHaveAttribute('aria-selected', 'true');
  const next = sheet(page).getByRole('button', { name: 'Next month', exact: true });
  await next.click();
  await next.click();
  await expect(sheet(page).getByText('January 2027', { exact: true })).toBeVisible();
  await sheet(page).getByRole('button', { name: 'Previous month', exact: true }).click();
  await expect(sheet(page).getByText('December 2026', { exact: true })).toBeVisible();
  await sheet(page).getByRole('button', { name: 'Go to today', exact: true }).click();
  await expect(sheet(page).getByText('October 2026', { exact: true })).toBeVisible();

  await sheet(page).getByRole('button', { name: 'Close', exact: true }).click();
  await expect(sheet(page)).toHaveCount(0);
  await expect(date).toHaveValue(formatDate('2026-11-02'));
});

test('the semester end offers no day before the start', async ({ page }) => {
  await seedSetup(page);
  await openApp(page, '/settings/profile');
  const profile = page.getByRole('region', { name: 'Profile', exact: true });
  await profile.getByRole('textbox', { name: 'Semester start', exact: true }).fill(formatDate('2026-10-12'));

  await calendarButton(page, 'Semester end').click();
  const sunday = day(page, 'Sunday 11 October 2026');
  await expect(sunday).toHaveAttribute('aria-disabled', 'true');
  // Playwright waits for an aria-disabled cell to become enabled before it clicks, so a plain click would wait out the
  // test. `force` sends the tap a person can still make on it, which picks nothing: the sheet stays open.
  await sunday.click({ force: true });
  await expect(sheet(page)).toBeVisible();

  await day(page, 'Monday 12 October 2026').click();
  await expect(sheet(page)).toHaveCount(0);
  await expect(profile.getByRole('textbox', { name: 'Semester end', exact: true })).toHaveValue(formatDate('2026-10-12'));
});

test.describe('in German', () => {
  test.use({ locale: 'de-DE' });

  test('the field and the calendar speak German, and the date keeps the region’s form', async ({ page }) => {
    // Not through Home: seedSetup's wait for Home looks for the English Quick add.
    await seedSetup(page, {}, { open: false });
    await openApp(page, '/entries/new');
    const date = page.getByRole('textbox', { name: 'Datum', exact: true });
    await expect(date).toHaveValue(formatDate('2026-10-16'));
    await expect(date).toHaveAccessibleDescription('Tippe es ein, etwa TT.MM.JJJJ, oder öffne den Kalender.');
    await date.fill('');
    await expect(date).toHaveAttribute('placeholder', 'TT.MM.JJJJ');
    await date.fill(formatDate('2026-10-16'));

    await page.getByRole('button', { name: 'Kalender öffnen: Datum', exact: true }).click();
    const german = sheet(page, 'Datum wählen');
    await expect(german.getByText('Oktober 2026', { exact: true })).toBeVisible();
    const monday = german.getByRole('columnheader').first();
    await expect(monday).toHaveText(/^Mo\.?$/);
    await expect(monday).toHaveAttribute('abbr', 'Montag');
    await expect(german.getByRole('gridcell', { name: 'Freitag, 16. Oktober 2026', exact: true })).toBeFocused();
  });
});

for (const theme of ['light', 'dark'] as const) {
  test(`the open calendar passes axe's WCAG AA checks in ${theme}`, async ({ page }) => {
    await page.addInitScript(
      ([key, value]) => {
        try {
          localStorage.setItem(key, value);
        } catch {
          // Storage the test can't write leaves the page light, and the light run covers that.
        }
      },
      [THEME_STORAGE_KEY, theme] as const,
    );
    await openNewEntry(page);
    await calendarButton(page).click();
    await expect(day(page, 'Friday 16 October 2026')).toBeFocused();

    const results = await new AxeBuilder({ page })
      .include('[role="dialog"]')
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
      .analyze();
    const serious = results.violations
      .filter((violation) => violation.impact === 'serious' || violation.impact === 'critical')
      .map((violation) => `${violation.id}: ${violation.help} at ${violation.nodes.map((node) => node.target.join(' ')).join(', ')}`);
    expect(serious).toEqual([]);
  });
}
