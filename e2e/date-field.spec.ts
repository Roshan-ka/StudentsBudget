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

/** The month or the year button above the days ("October", "2026"): outlined, with no arrow. */
function headerButton(page: Page, name: string, expanded = false) {
  return sheet(page).getByRole('button', { name, exact: true, expanded });
}

function monthList(page: Page) {
  return sheet(page).getByRole('group', { name: 'Choose a month', exact: true });
}

function yearList(page: Page) {
  return sheet(page).getByRole('group', { name: 'Choose a year', exact: true });
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
  await expect(sheet(page).getByText('October 2026', { exact: true })).toBeAttached();
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
  await expect(sheet(page).getByText('November 2026', { exact: true })).toBeAttached();
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
  await expect(sheet(page).getByText('November 2026', { exact: true })).toBeAttached();
  await expect(day(page, 'Monday 2 November 2026')).toHaveAttribute('aria-selected', 'true');
  const next = sheet(page).getByRole('button', { name: 'Next month', exact: true });
  await next.click();
  await next.click();
  await expect(sheet(page).getByText('January 2027', { exact: true })).toBeAttached();
  await sheet(page).getByRole('button', { name: 'Previous month', exact: true }).click();
  await expect(sheet(page).getByText('December 2026', { exact: true })).toBeAttached();
  await sheet(page).getByRole('button', { name: 'Go to today', exact: true }).click();
  await expect(sheet(page).getByText('October 2026', { exact: true })).toBeAttached();

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
  // The tap a person can still make on a day before the start picks nothing: the sheet stays open. Sent as a click event
  // on the cell itself: Playwright's click waits for an aria-disabled cell to become enabled (so it waited out the test),
  // and a forced one skips the wait for the sheet to settle, so it was sent while the sheet still slid up from below and
  // missed the cell (CI runs 394 and 401, 09-11-2026).
  await sunday.dispatchEvent('click');
  await expect(sheet(page)).toBeVisible();

  // The lists hold the same line: September and 2025 end before the start.
  await headerButton(page, 'October').click();
  await expect(monthList(page).getByRole('button', { name: 'Sept', exact: true })).toHaveAttribute('aria-disabled', 'true');
  await expect(monthList(page).getByRole('button', { name: 'Oct', exact: true })).not.toHaveAttribute('aria-disabled');
  await headerButton(page, '2026').click();
  await expect(yearList(page).getByRole('button', { name: '2025', exact: true })).toHaveAttribute('aria-disabled', 'true');
  // As for the day above: a click event on the disabled year itself.
  await yearList(page).getByRole('button', { name: '2025', exact: true }).dispatchEvent('click');
  await expect(yearList(page)).toBeVisible();
  await yearList(page).getByRole('button', { name: '2026', exact: true }).click();

  await day(page, 'Monday 12 October 2026').click();
  await expect(sheet(page)).toHaveCount(0);
  await expect(profile.getByRole('textbox', { name: 'Semester end', exact: true })).toHaveValue(formatDate('2026-10-12'));
});

test('the month and the year each open their list, and a pick shows that month’s days', async ({ page }) => {
  await openNewEntry(page);
  const date = page.getByRole('textbox', { name: 'Date', exact: true });
  await calendarButton(page).click();

  // Two sections above the days, each outlined; what they do is in their description.
  await expect(headerButton(page, 'October')).toHaveAccessibleDescription('Choose a month');
  await expect(headerButton(page, '2026')).toHaveAccessibleDescription('Choose a year');

  // The months, in the days' look and named by their short names, the shown one marked. A pick opens its days, on the
  // same day number.
  await headerButton(page, 'October').click();
  await expect(headerButton(page, 'October', true)).toBeVisible();
  await expect(sheet(page).getByRole('grid')).toHaveCount(0);
  await expect(monthList(page).getByRole('button')).toHaveCount(12);
  await expect(monthList(page).getByRole('button', { name: 'Oct', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await monthList(page).getByRole('button', { name: 'Mar', exact: true }).click();
  await expect(sheet(page).getByText('March 2026', { exact: true })).toBeAttached();
  await expect(day(page, 'Monday 16 March 2026')).toBeFocused();

  // The years: twelve around the shown one, twelve more a tap away. A pick keeps the month.
  await headerButton(page, '2026').click();
  await expect(yearList(page).getByRole('button')).toHaveCount(12);
  await expect(yearList(page).getByRole('button', { name: '2026', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await expect(yearList(page).getByRole('button').first()).toHaveText('2019');
  await sheet(page).getByRole('button', { name: 'Earlier years', exact: true }).click();
  await expect(yearList(page).getByRole('button').first()).toHaveText('2007');
  await sheet(page).getByRole('button', { name: 'Later years', exact: true }).click();
  await yearList(page).getByRole('button', { name: '2028', exact: true }).click();
  await expect(sheet(page).getByText('March 2028', { exact: true })).toBeAttached();
  await expect(day(page, 'Thursday 16 March 2028')).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(sheet(page)).toHaveCount(0);
  await expect(date).toHaveValue(formatDate('2028-03-16'));

  // Escape in a list goes back to the days; only the next one closes the sheet.
  await calendarButton(page).click();
  await headerButton(page, 'March').click();
  await expect(monthList(page)).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(sheet(page).getByRole('grid')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(sheet(page)).toHaveCount(0);
  await expect(date).toHaveValue(formatDate('2028-03-16'));
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
    await expect(german.getByText('Oktober 2026', { exact: true })).toBeAttached();
    await expect(german.getByRole('button', { name: 'Oktober', exact: true, expanded: false })).toHaveAccessibleDescription(
      'Monat wählen',
    );
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

    /** The sheet's serious and critical findings, one line each. */
    const findings = async () => {
      const results = await new AxeBuilder({ page })
        .include('[role="dialog"]')
        .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
        .analyze();
      return results.violations
        .filter((violation) => violation.impact === 'serious' || violation.impact === 'critical')
        .map((violation) => `${violation.id}: ${violation.help} at ${violation.nodes.map((node) => node.target.join(' ')).join(', ')}`);
    };
    // Soft, so one run names every view with a finding: the days, the months and the years.
    expect.soft(await findings(), 'days').toEqual([]);
    await headerButton(page, 'October').click();
    await expect(monthList(page)).toBeVisible();
    expect.soft(await findings(), 'months').toEqual([]);
    await headerButton(page, '2026').click();
    await expect(yearList(page)).toBeVisible();
    expect.soft(await findings(), 'years').toEqual([]);
  });
}
