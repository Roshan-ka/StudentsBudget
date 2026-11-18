import type { Page } from '@playwright/test';

// A stand-in for the browser's speech recognizer, for the mic button in quick add (P2,
// docs/superpowers/plans/2026-11-04-mic-button.md). No browser here can really listen, so a spec puts it on the page
// before it loads. It hears whatever `window.speechText` says (or fails with `speechError`), and records the language
// it was asked to listen in. dictation.spec.ts and ai-quick-add.spec.ts use it.

/**
 * What the stand-in reads and records, on `window`. With `speechHold` it answers only when a spec calls `speechAnswer`
 * (`holdSpeech`, `answerSpeech`), so a spec can act while it listens; an `abort()` before that sends nothing.
 */
export type SpeechWindow = {
  speechText: string;
  speechError: string | null;
  speechLangs: string[];
  speechHold: boolean;
  speechAnswer: (() => void) | null;
};

/** Installs the stand-in recognizer, under the standard name the app looks for first. */
export async function fakeSpeech(page: Page) {
  await page.addInitScript(() => {
    const speech = window as unknown as SpeechWindow;
    speech.speechText = '';
    speech.speechError = null;
    speech.speechLangs = [];
    speech.speechHold = false;
    speech.speechAnswer = null;
    class FakeRecognition {
      lang = '';
      interimResults = true;
      maxAlternatives = 1;
      onresult: ((event: { results: { transcript: string }[][] }) => void) | null = null;
      onerror: ((event: { error: string }) => void) | null = null;
      onend: (() => void) | null = null;
      aborted = false;
      start() {
        speech.speechLangs.push(this.lang);
        const answer = () => {
          // An aborted session hands over nothing, as the browser's own.
          if (this.aborted) return;
          if (speech.speechError !== null) this.onerror?.({ error: speech.speechError });
          else this.onresult?.({ results: [[{ transcript: speech.speechText }]] });
          this.onend?.();
        };
        if (speech.speechHold) speech.speechAnswer = answer;
        else setTimeout(answer, 50);
      }
      stop() {}
      abort() {
        this.aborted = true;
        this.onend?.();
      }
    }
    Object.defineProperty(window, 'SpeechRecognition', { value: FakeRecognition, configurable: true });
  });
}

/** From now on the stand-in listens until `answerSpeech`, so a spec can act while the mic is on. */
export async function holdSpeech(page: Page) {
  await page.evaluate(() => {
    (window as unknown as SpeechWindow).speechHold = true;
  });
}

/** The held session hears what `willHear` said, unless it was aborted. */
export async function answerSpeech(page: Page) {
  await page.evaluate(() => {
    (window as unknown as SpeechWindow).speechAnswer?.();
  });
}

/** What the stand-in will hear next. */
export async function willHear(page: Page, text: string) {
  await page.evaluate((heard) => {
    (window as unknown as SpeechWindow).speechText = heard;
  }, text);
}
