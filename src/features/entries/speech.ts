import { LANGUAGES, type Language } from '@/i18n/languages';

// The browser's speech recognition, for the mic button in quick add (P2; plan in
// docs/superpowers/plans/2026-11-04-mic-button.md). The app sends nothing itself: the browser turns speech into
// text, and may send the recording to its own speech service to do it, which the app says once (mic-note.ts).

/**
 * The part of the Web Speech API's recognizer the app uses. TypeScript's DOM types have its result types but not the
 * recognizer itself, so it is declared here, as narrowly as the app needs it.
 */
export type Recognizer = {
  lang: string;
  interimResults: boolean;
  maxAlternatives: number;
  onresult: ((event: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
  abort(): void;
};

type RecognizerClass = new () => Recognizer;

/** The browser's recognizer, under its standard name or Chrome's prefixed one, or null where there is none. */
export function recognizerFor(win: object): RecognizerClass | null {
  const speech = win as { SpeechRecognition?: RecognizerClass; webkitSpeechRecognition?: RecognizerClass };
  return speech.SpeechRecognition ?? speech.webkitSpeechRecognition ?? null;
}

/** Why listening stopped without text, in the app's own words (`entries.quickAdd.micErrors`). */
export type SpeechProblem = 'denied' | 'noSpeech' | 'offline' | 'noMic' | 'failed';

/** The app's problem for a recognizer error code, or null for one that needs no message (stopped on purpose). */
export function speechProblem(code: string): SpeechProblem | null {
  switch (code) {
    case 'not-allowed':
    case 'service-not-allowed':
      return 'denied';
    case 'no-speech':
      return 'noSpeech';
    case 'network':
      return 'offline';
    case 'audio-capture':
      return 'noMic';
    case 'aborted':
      return null;
    default:
      return 'failed';
  }
}

/**
 * Listens once in `lang`'s locale and hands over the final text, trimmed: one alternative, no interim results. Returns
 * a stop function, or null where the browser has no recognizer. `onEnd` follows every session, with or without text.
 */
export function listen({
  win,
  lang,
  onText,
  onProblem,
  onEnd,
}: {
  win: object;
  lang: Language;
  onText: (text: string) => void;
  onProblem: (problem: SpeechProblem) => void;
  onEnd: () => void;
}): (() => void) | null {
  const Recognition = recognizerFor(win);
  if (Recognition === null) return null;
  const recognizer = new Recognition();
  recognizer.lang = LANGUAGES[lang].locale;
  recognizer.interimResults = false;
  recognizer.maxAlternatives = 1;
  recognizer.onresult = (event) => {
    const text = Array.from(event.results, (result) => result[0]?.transcript ?? '')
      .join(' ')
      .trim();
    if (text !== '') onText(text);
  };
  recognizer.onerror = (event) => {
    const problem = speechProblem(event.error);
    if (problem !== null) onProblem(problem);
  };
  recognizer.onend = onEnd;
  recognizer.start();
  return () => recognizer.stop();
}
