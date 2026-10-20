import { expect, test, type Page } from '@playwright/test';
import type { Profile } from '../src/db/types';
import { completeSetup, readStore } from './helpers/setup';

// 375 px, the narrowest phone the app is made for. `completeSetup` pins the clock to Friday 2026-10-16, which falls in
// the winter semester 2026/27: 1 Oct 2026 – 31 Mar 2027 at Universität Regensburg, 1 Oct 2026 – 14 Mar 2027 at OTH.
test.use({ viewport: { width: 375, height: 812 } });

function profileSection(page: Page) {
  return page.getByRole('region', { name: 'Profile', exact: true });
}

function nameField(page: Page) {
  return profileSection(page).getByRole('textbox', { name: 'Your name', exact: true });
}

function universityField(page: Page) {
  return profileSection(page).getByRole('combobox', { name: 'University', exact: true });
}

function startField(page: Page) {
  return profileSection(page).getByLabel('Semester start', { exact: true });
}

function endField(page: Page) {
  return profileSection(page).getByLabel('Semester end', { exact: true });
}

/** "Profile saved.", in the section's live region (not role="status", which other Settings lines use). */
function savedNotice(page: Page) {
  return profileSection(page).getByText('Profile saved.', { exact: true });
}

async function openSettings(page: Page) {
  await page.goto('/settings');
  await expect(page.getByRole('heading', { level: 3, name: 'Profile', exact: true })).toBeVisible();
}

async function saveProfile(page: Page) {
  await profileSection(page).getByRole('button', { name: 'Save profile', exact: true }).click();
  await expect(savedNotice(page)).toBeVisible();
}

async function overflow(page: Page) {
  return page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
}

/** From Settings through Edit plan to the one-off costs step. */
async function openOneOffsStep(page: Page) {
  await page.getByRole('link', { name: 'Edit plan', exact: true }).click();
  await expect(page.getByRole('heading', { level: 3, name: 'City and rent', exact: true })).toBeVisible();
  for (const heading of ['Income', 'Fixed costs', 'One-off costs']) {
    await page.getByRole('button', { name: 'Next', exact: true }).click();
    await expect(page.getByRole('heading', { level: 3, name: heading, exact: true })).toBeVisible();
  }
}

test('Profile comes first in Settings, prefills the semester and keeps what was saved after a reload', async ({
  page,
}) => {
  await completeSetup(page);
  await openSettings(page);
  // The first section of Settings.
  await expect(page.getByRole('main').getByRole('heading', { level: 3 }).first()).toHaveText('Profile');
  await expect(profileSection(page).getByText('stored only on this phone', { exact: false })).toBeVisible();

  await nameField(page).fill('Roshan');
  await universityField(page).selectOption({ label: 'Universität Regensburg' });
  // The current semester, from the university's own semester dates, with their source.
  await expect(startField(page)).toHaveValue('2026-10-01');
  await expect(endField(page)).toHaveValue('2027-03-31');
  await expect(profileSection(page).getByText('01-10-2026', { exact: true })).toBeVisible();
  await expect(profileSection(page).getByText('31-03-2027', { exact: true })).toBeVisible();
  await expect(profileSection(page).getByText('26 weeks', { exact: false })).toBeVisible();
  await expect(profileSection(page).getByText('Source', { exact: true })).toBeVisible();

  // OTH splits the year in mid-March.
  await universityField(page).selectOption({ label: 'OTH Regensburg' });
  await expect(startField(page)).toHaveValue('2026-10-01');
  await expect(endField(page)).toHaveValue('2027-03-14');

  // The dates stay editable: the lecture period instead of the semester.
  await universityField(page).selectOption({ label: 'Universität Regensburg' });
  await startField(page).fill('2026-10-12');
  await endField(page).fill('2027-02-05');
  await saveProfile(page);
  expect(await overflow(page)).toBeLessThanOrEqual(0);

  const [saved] = await readStore<Profile>(page, 'profile');
  expect(saved).toMatchObject({
    id: 'current',
    name: 'Roshan',
    university: 'ur',
    semesterStart: '2026-10-12',
    semesterEnd: '2027-02-05',
  });
  expect(Number.isNaN(Date.parse(saved.updatedAt))).toBe(false);

  await page.reload();
  await expect(page.getByRole('heading', { level: 3, name: 'Profile', exact: true })).toBeVisible();
  await expect(nameField(page)).toHaveValue('Roshan');
  await expect(universityField(page)).toHaveValue('ur');
  await expect(startField(page)).toHaveValue('2026-10-12');
  await expect(endField(page)).toHaveValue('2027-02-05');
});

test('an end before the start is not saved, and the end field says why', async ({ page }) => {
  await completeSetup(page);
  await openSettings(page);
  await startField(page).fill('2027-03-31');
  await endField(page).fill('2026-10-01');
  await profileSection(page).getByRole('button', { name: 'Save profile', exact: true }).click();

  const problem = 'Pick an end date after the start date.';
  await expect(profileSection(page).getByRole('alert')).toHaveText(problem);
  await expect(endField(page)).toHaveAttribute('aria-invalid', 'true');
  await expect(endField(page)).toHaveAccessibleDescription(problem);
  await expect(startField(page)).not.toHaveAttribute('aria-invalid');
  await expect(savedNotice(page)).toHaveCount(0);
  expect(await readStore<Profile>(page, 'profile')).toEqual([]);
  expect(await overflow(page)).toBeLessThanOrEqual(0);
});

test('one date alone is not saved, and both can be cleared again', async ({ page }, testInfo) => {
  await completeSetup(page);
  await openSettings(page);
  await nameField(page).fill('Roshan');
  await startField(page).fill('2026-10-01');
  await profileSection(page).getByRole('button', { name: 'Save profile', exact: true }).click();

  await expect(profileSection(page).getByRole('alert')).toHaveText('Add both semester dates, or leave both empty.');
  // The empty field is the one to fix.
  await expect(endField(page)).toHaveAttribute('aria-invalid', 'true');
  await expect(startField(page)).not.toHaveAttribute('aria-invalid');

  await profileSection(page).getByRole('button', { name: 'Clear semester dates', exact: true }).click();
  await expect(startField(page)).toHaveValue('');
  await expect(endField(page)).toHaveValue('');
  await expect(profileSection(page).getByRole('alert')).toHaveCount(0);
  await saveProfile(page);
  // Focus stays on the button that saved. Only Chromium focuses a button on click; WebKit leaves it where it was.
  if (testInfo.project.name === 'desktop-chrome') {
    await expect(profileSection(page).getByRole('button', { name: 'Save profile', exact: true })).toBeFocused();
  }
  expect(await readStore<Profile>(page, 'profile')).toMatchObject([
    { name: 'Roshan', university: '', semesterStart: '', semesterEnd: '' },
  ]);
});

test('Home says hi once a name is saved', async ({ page }) => {
  await completeSetup(page);
  await expect(page.getByRole('textbox', { name: 'Quick add', exact: true })).toBeVisible();
  await expect(page.getByText('Hi Roshan', { exact: true })).toHaveCount(0);

  await openSettings(page);
  await nameField(page).fill('  Roshan ');
  await saveProfile(page);
  await page.getByRole('link', { name: 'Home', exact: true }).click();
  await expect(page.getByText('Hi Roshan', { exact: true })).toBeVisible();

  // A long name with no space to break at still fits the phone.
  const longName = 'Wolfeschlegelsteinhausenbergerdorff';
  await page.getByRole('link', { name: 'Settings', exact: true }).click();
  await nameField(page).fill(longName);
  await saveProfile(page);
  await page.getByRole('link', { name: 'Home', exact: true }).click();
  await expect(page.getByText(`Hi ${longName}`, { exact: true })).toBeVisible();
  expect(await overflow(page)).toBeLessThanOrEqual(0);
});

test('the one-off costs step offers the next semester fee with its sourced amount', async ({ page }) => {
  // Not the default "Semester fee" one-off: the offer is for a plan that has none yet.
  await completeSetup(page, { oneOff: { name: 'Laptop', amount: '300', dueMonth: '2027-03' } });
  await openSettings(page);
  await universityField(page).selectOption({ label: 'Universität Regensburg' });
  await saveProfile(page);
  await openOneOffsStep(page);

  // Summer 2027 at UR: €87 basic contribution + €128 semester ticket. UR has not published its re-registration
  // month, so the fee is due the month before the semester starts on 1 April.
  const parts = '€87.00 Studierendenwerk basic contribution + €128.00 RVV semester ticket.';
  const offer = page.getByRole('button', { name: 'Add semester fee: €215, due March 2027', exact: true });
  await expect(page.getByText(parts, { exact: true })).toBeVisible();
  await expect(page.getByText('Due in March 2027, the month before the semester starts.', { exact: true })).toBeVisible();
  expect(await overflow(page)).toBeLessThanOrEqual(0);
  await offer.click();

  const row = page.getByRole('group', { name: 'One-off cost 2', exact: true });
  const amount = row.getByRole('textbox', { name: 'Amount', exact: true });
  await expect(row.getByRole('textbox', { name: 'Name', exact: true })).toHaveValue('Semester fee');
  await expect(amount).toHaveValue('215');
  await expect(row.getByLabel('Due month', { exact: true })).toHaveValue('2027-03');
  // One tap adds it once; the amount has the focus and keeps its source.
  await expect(offer).toHaveCount(0);
  await expect(amount).toBeFocused();
  await expect(row.getByText(parts, { exact: true })).toBeVisible();
  await expect(row.getByText('Source: RVV semester ticket', { exact: true })).toBeVisible();
  expect(await overflow(page)).toBeLessThanOrEqual(0);

  // Another amount is the person's choice; the source no longer belongs to it.
  await amount.fill('220');
  await expect(row.getByText(parts, { exact: true })).toHaveCount(0);
});

test('the one-off costs step leaves the amount empty where no page states the fee', async ({ page }) => {
  await completeSetup(page, { oneOff: { name: 'Laptop', amount: '300', dueMonth: '2027-03' } });
  await openSettings(page);
  await universityField(page).selectOption({ label: 'Other' });
  await startField(page).fill('2026-10-01');
  await endField(page).fill('2027-01-31');
  await saveProfile(page);
  await openOneOffsStep(page);

  // Another university: the next semester starts the day after the saved end, 1 February 2027.
  const offer = page.getByRole('button', { name: 'Add semester fee, due January 2027', exact: true });
  await expect(
    page.getByText("No page states this semester's fee yet, so the amount is yours to fill in.", { exact: true }),
  ).toBeVisible();
  await offer.click();
  const row = page.getByRole('group', { name: 'One-off cost 2', exact: true });
  await expect(row.getByRole('textbox', { name: 'Amount', exact: true })).toHaveValue('');
  await expect(row.getByRole('textbox', { name: 'Amount', exact: true })).toBeFocused();
  await expect(row.getByLabel('Due month', { exact: true })).toHaveValue('2027-01');

  await page.getByRole('button', { name: 'Next', exact: true }).click();
  await expect(page.getByText('Enter an amount above 0 for Semester fee.', { exact: true })).toBeVisible();
});

test('the one-off costs step offers nothing without semester dates, or when the fee is already planned', async ({
  page,
}) => {
  // The default plan already has "Semester fee", due March 2027.
  await completeSetup(page);
  await openSettings(page);
  await openOneOffsStep(page);
  await expect(page.getByRole('button', { name: /^Add semester fee/ })).toHaveCount(0);

  await page.goto('/settings');
  await universityField(page).selectOption({ label: 'Universität Regensburg' });
  await saveProfile(page);
  await openOneOffsStep(page);
  await expect(page.getByRole('group', { name: 'One-off cost 1', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: /^Add semester fee/ })).toHaveCount(0);

  // The planned fee was what held the offer back: without it, the offer is there.
  await page.getByRole('button', { name: 'Remove one-off cost 1', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Add semester fee: €215, due March 2027', exact: true })).toBeVisible();
});

test.describe('on a desktop browser', () => {
  test.beforeEach(({}, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop-chrome', 'The backup download runs on desktop-chrome.');
  });

  test('the profile goes into the backup and comes back with it', async ({ page }, testInfo) => {
    // The download path, not a share sheet.
    await page.addInitScript(() => {
      Object.defineProperty(navigator, 'canShare', { value: undefined, configurable: true });
    });
    await completeSetup(page);
    await openSettings(page);
    await nameField(page).fill('Roshan');
    await universityField(page).selectOption({ label: 'OTH Regensburg' });
    await saveProfile(page);
    const [before] = await readStore<Profile>(page, 'profile');

    const downloaded = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Export backup', exact: true }).click();
    const download = await downloaded;
    const filePath = testInfo.outputPath(download.suggestedFilename());
    await download.saveAs(filePath);

    await page.getByRole('button', { name: 'Delete everything', exact: true }).click();
    await page.getByLabel('Type DELETE to confirm', { exact: true }).fill('DELETE');
    await page.getByRole('button', { name: 'Delete everything', exact: true }).click();
    await expect(page).toHaveURL('/setup');
    expect(await readStore<Profile>(page, 'profile')).toEqual([]);

    await page.getByLabel('File to restore', { exact: true }).setInputFiles(filePath);
    await page
      .getByRole('group', { name: 'Confirm restore' })
      .getByRole('button', { name: 'Replace all data', exact: true })
      .click();
    await expect(page).toHaveURL('/');
    await expect(page.getByText('Hi Roshan', { exact: true })).toBeVisible();
    expect(await readStore<Profile>(page, 'profile')).toEqual([before]);

    await openSettings(page);
    await expect(nameField(page)).toHaveValue('Roshan');
    await expect(universityField(page)).toHaveValue('oth');
    await expect(startField(page)).toHaveValue('2026-10-01');
    await expect(endField(page)).toHaveValue('2027-03-14');
  });
});
