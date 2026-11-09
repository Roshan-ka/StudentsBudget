import type { Page } from '@playwright/test';

// A stand-in for the browser's speech recognizer, for the mic button in quick add (P2,
// docs/superpowers/plans/2026-11-04-mic-button.md). No browser here can really listen, so a spec puts it on the page
// before it loads. It hears whatever `window.speechText` says (or fails with `speechError`), and records the language
// it was asked to listen in. dictation.spec.ts and ai-quick-add.spec.ts use it.

/** What the stand-in reads and records, on `window`. */
export type SpeechWindow = { speechText: string; speechError: string | null; speechLangs: string[] };

/** Installs the stand-in recognizer, under the standard name the app looks for first. */
export async function fakeSpeech(page: Page) {
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
export async function willHear(page: Page, text: string) {
  await page.evaluate((heard) => {
    (window as unknown as SpeechWindow).speechText = heard;
  }, text);
}
