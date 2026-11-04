import { expect, test, type Page } from '@playwright/test';
import { MIC_NOTE_KEY } from '../src/features/entries/mic-note';
import { chooseLanguage } from './helpers/languages';
import { completeSetup } from './helpers/setup';

// The mic button in quick add (P2; docs/superpowers/plans/2026-11-04-mic-button.md). No browser here can really listen,
// so each test puts a stand-in for the speech recognizer on the page before it loads. It hears whatever
// `window.speechText` says (or fails with `speechError`), and records the language it was asked to listen in.

test.use({ viewport: { width: 375, height: 812 } });

type SpeechWindow = { speechText: string; speechError: string | null; speechLangs: string[] };

/** Installs the stand-in recognizer, under the standard name the app looks for first. */
async function fakeSpeech(page: Page) {
  await page.addInitScript(() => {
    const speech = window as unknown as SpeechWindow;
    speech.speechText = '';
    speech.speechError = null;
    speech.speechLangs = [];
    class FakeRecognition {
      lang = '';
      interimResults = true;
      maxAlternatives = 1;
      onresult: ((event: { results: { transcript: string }[][] }) => void) | null = null;
      onerror: ((event: { error: string }) => void) | null = null;
      onend: (() => void) | null = null;
      start() {
        speech.speechLangs.push(this.lang);
        setTimeout(() => {
          if (speech.speechError !== null) this.onerror?.({ error: speech.speechError });
          else this.onresult?.({ results: [[{ transcript: speech.speechText }]] });
          this.onend?.();
        }, 50);
      }
      stop() {}
      abort() {}
    }
    Object.defineProperty(window, 'SpeechRecognition', { value: FakeRecognition, configurable: true });
  });
}

/** What the stand-in will hear next. */
async function willHear(page: Page, text: string) {
  await page.evaluate((heard) => {
    (window as unknown as SpeechWindow).speechText = heard;
  }, text);
}

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
  await completeSetup(page);

  await willHear(page, 'coffee 3');
  await mic(page).click();
  const note = page.getByRole('group', { name: 'Speak an entry', exact: true });
  await expect(note).toContainText('StudentsBudget only gets the text.');
  await note.getByRole('button', { name: 'Continue', exact: true }).click();

  // Nothing tells the category yet, so it asks, as for a typed line.
  await expect(page.getByRole('textbox', { name: 'Quick add' })).toHaveValue('coffee 3');
  const chips = page.getByRole('group', { name: 'Category', exact: true });
  await chips.getByRole('button', { name: 'Eating out', exact: true }).click();
  await expect(page.getByRole('status')).toHaveText('Saved €3.00 · coffee · Eating out');

  // Remembered on this phone: no note after a reload, and a known line saves straight away.
  await page.reload();
  await willHear(page, 'coffee 6');
  await mic(page).click();
  await expect(page.getByRole('status')).toHaveText('Saved €6.00 · coffee · Eating out');
  await expect(page.getByRole('group', { name: 'Speak an entry', exact: true })).toHaveCount(0);
});

test('Cancel on the note leaves the mic off', async ({ page }) => {
  await fakeSpeech(page);
  await completeSetup(page);
  await mic(page).click();
  const note = page.getByRole('group', { name: 'Speak an entry', exact: true });
  await note.getByRole('button', { name: 'Cancel', exact: true }).click();
  await expect(note).toHaveCount(0);
  expect(await page.evaluate(() => (window as unknown as SpeechWindow).speechLangs)).toEqual([]);
});

test('a blocked microphone says how to allow it, and offline says it needs a connection', async ({ page, context }) => {
  await fakeSpeech(page);
  await page.addInitScript((key) => localStorage.setItem(key, 'seen'), MIC_NOTE_KEY);
  await completeSetup(page);

  await page.evaluate(() => {
    (window as unknown as SpeechWindow).speechError = 'not-allowed';
  });
  await mic(page).click();
  await expect(inlineAlert(page)).toHaveText(
    'The microphone is blocked. Allow it for this site in your browser settings.',
  );

  await context.setOffline(true);
  await mic(page).click();
  await expect(inlineAlert(page)).toHaveText("You're offline. Speaking an entry needs a connection.");
  await context.setOffline(false);
});

test('there is no mic button where the browser has no speech recognition', async ({ page }) => {
  await page.addInitScript(() => {
    for (const name of ['SpeechRecognition', 'webkitSpeechRecognition']) {
      Object.defineProperty(window, name, { value: undefined, configurable: true });
    }
  });
  await completeSetup(page);
  await expect(page.getByRole('textbox', { name: 'Quick add' })).toBeVisible();
  await expect(mic(page)).toHaveCount(0);
});

test('it listens in the language the phone shows', async ({ page }) => {
  await fakeSpeech(page);
  await page.addInitScript((key) => localStorage.setItem(key, 'seen'), MIC_NOTE_KEY);
  await completeSetup(page);
  await chooseLanguage(page, 'de');

  await willHear(page, 'Kaffee 4');
  await mic(page, 'Eintrag sprechen').click();
  await expect(page.getByRole('group', { name: 'Kategorie', exact: true })).toBeVisible();
  expect(await page.evaluate(() => (window as unknown as SpeechWindow).speechLangs)).toEqual(['de-DE']);
});
