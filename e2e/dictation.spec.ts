import { expect, test, type Page } from '@playwright/test';
import { PRIVACY_NOTES } from '../src/features/privacy/notes';
import { chooseLanguage } from './helpers/languages';
import { seedSetup } from './helpers/seed-setup';
import { answerSpeech, fakeSpeech, holdSpeech, willHear, type SpeechWindow } from './helpers/speech';

// The mic button in quick add (P2; docs/superpowers/plans/2026-11-04-mic-button.md). No browser here can really listen,
// so each test puts a stand-in for the speech recognizer on the page before it loads (`fakeSpeech`, helpers/speech.ts).

test.use({ viewport: { width: 375, height: 812 } });

function mic(page: Page, name = 'Speak an entry') {
  return page.getByRole('button', { name, exact: true });
}

// Next adds its own role="alert" route announcer outside <main>; the messages under test are inside it.
function inlineAlert(page: Page) {
  return page.getByRole('main').getByRole('alert');
}

test('the first tap says where speech goes; Continue listens and adds the line, and the note never shows again', async ({
  page,
}) => {
  await fakeSpeech(page);
  await seedSetup(page);

  await willHear(page, 'lunch 3');
  await mic(page).click();
  const note = page.getByRole('group', { name: 'Speak an entry', exact: true });
  await expect(note).toContainText('StudentsBudget only gets the text.');
  await note.getByRole('button', { name: 'Continue', exact: true }).click();

  // "lunch" is on no word list and has no history yet, so it asks, as for a typed line.
  await expect(page.getByRole('textbox', { name: 'Quick add' })).toHaveValue('lunch 3');
  const chips = page.getByRole('group', { name: 'Category', exact: true });
  await chips.getByRole('button', { name: 'Eating out', exact: true }).click();
  await expect(page.getByRole('status')).toHaveText('Saved €3.00 · lunch · Eating out');

  // Remembered on this phone: no note after a reload, and a known line saves straight away.
  await page.reload();
  await willHear(page, 'lunch 6');
  await mic(page).click();
  await expect(page.getByRole('status')).toHaveText('Saved €6.00 · lunch · Eating out');
  await expect(page.getByRole('group', { name: 'Speak an entry', exact: true })).toHaveCount(0);
});

test('Cancel on the note leaves the mic off', async ({ page }) => {
  await fakeSpeech(page);
  await seedSetup(page);
  await mic(page).click();
  const note = page.getByRole('group', { name: 'Speak an entry', exact: true });
  await note.getByRole('button', { name: 'Cancel', exact: true }).click();
  await expect(note).toHaveCount(0);
  expect(await page.evaluate(() => (window as unknown as SpeechWindow).speechLangs)).toEqual([]);
});

test('a blocked microphone says how to allow it, and offline says it needs a connection', async ({ page, context }) => {
  await fakeSpeech(page);
  await page.addInitScript((key) => localStorage.setItem(key, 'seen'), PRIVACY_NOTES.mic);
  await seedSetup(page);

  await page.evaluate(() => {
    (window as unknown as SpeechWindow).speechError = 'not-allowed';
  });
  await mic(page).click();
  await expect(inlineAlert(page)).toHaveText(
    'The microphone is blocked. Allow it for this site in your browser settings.',
  );

  await context.setOffline(true);
  await mic(page).click();
  await expect(inlineAlert(page)).toHaveText('You’re offline. Speaking an entry needs a connection.');
  await context.setOffline(false);
});

test('there is no mic button where the browser has no speech recognition', async ({ page }) => {
  await page.addInitScript(() => {
    for (const name of ['SpeechRecognition', 'webkitSpeechRecognition']) {
      Object.defineProperty(window, name, { value: undefined, configurable: true });
    }
  });
  await seedSetup(page);
  await expect(page.getByRole('textbox', { name: 'Quick add' })).toBeVisible();
  await expect(mic(page)).toHaveCount(0);
});

test('it listens in the language the phone shows', async ({ page }) => {
  await fakeSpeech(page);
  await page.addInitScript((key) => localStorage.setItem(key, 'seen'), PRIVACY_NOTES.mic);
  await seedSetup(page);
  await chooseLanguage(page, 'de');

  await willHear(page, 'Bücher 4');
  await mic(page, 'Eintrag sprechen').click();
  await expect(page.getByRole('group', { name: 'Kategorie', exact: true })).toBeVisible();
  expect(await page.evaluate(() => (window as unknown as SpeechWindow).speechLangs)).toEqual(['de-DE']);
});

// Quick add breakpoints (18-11-2026): a chip tapped while the mic listened saved its line, and the spoken one too.
test('the chips can’t be tapped while the mic listens, and the spoken line replaces the asked one', async ({ page }) => {
  await fakeSpeech(page);
  await page.addInitScript((key) => localStorage.setItem(key, 'seen'), PRIVACY_NOTES.mic);
  await seedSetup(page);
  const chips = page.getByRole('group', { name: 'Category', exact: true });

  await page.getByRole('textbox', { name: 'Quick add' }).fill('poster 6,50');
  await page.getByRole('button', { name: 'Add', exact: true }).click();
  await expect(chips).toBeVisible();
  await holdSpeech(page);
  await willHear(page, 'döner 3');
  await mic(page).click();
  await expect(chips.getByRole('button', { name: 'Shopping', exact: true })).toBeDisabled(); // proof: chips-off-while-listening
  await expect(page.getByRole('button', { name: 'Add', exact: true })).toBeDisabled();

  await answerSpeech(page);
  await expect(page.getByRole('status')).toHaveText('Saved €3.00 · döner · Eating out');
  await expect(page.getByText('“poster 6,50” wasn’t saved.', { exact: true })).toBeVisible();
});

// Quick add breakpoints (18-11-2026): leaving the page stopped the mic, and a stop still hands over what was heard.
test('leaving the page while the mic listens saves nothing of what it heard', async ({ page }) => {
  await fakeSpeech(page);
  await page.addInitScript((key) => localStorage.setItem(key, 'seen'), PRIVACY_NOTES.mic);
  await seedSetup(page);
  const main = page.getByRole('main');

  await holdSpeech(page);
  await willHear(page, 'döner 3');
  await mic(page).click();
  await expect(page.getByRole('status')).toHaveText('Listening…');
  await page.getByRole('navigation', { name: 'Main' }).getByRole('link', { name: 'Entries' }).click();
  await expect(page).toHaveURL(/\/entries$/);
  await answerSpeech(page);

  // A line added here after it: once it shows in the list, anything Home saved before it would show there too.
  await main.getByRole('textbox', { name: 'Quick add' }).fill('pizza 4');
  await main.getByRole('button', { name: 'Add', exact: true }).click();
  await expect(page.getByRole('status')).toHaveText('Saved €4.00 · pizza · Eating out');
  await expect(main.getByRole('button', { name: /^pizza/ })).toBeVisible();
  await expect(main.getByRole('button', { name: /^döner/ })).toHaveCount(0); // proof: mic-abort-on-leave
});
