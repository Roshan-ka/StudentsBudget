import { describe, expect, it } from 'vitest';
import { listen, recognizerFor, speechProblem, type Recognizer, type SpeechProblem } from './speech';

/** A stand-in for the browser's recognizer: it records how it was set up and lets a test fire its events. */
class FakeRecognizer implements Recognizer {
  static last: FakeRecognizer | null = null;
  lang = '';
  interimResults = true;
  maxAlternatives = 5;
  onresult: Recognizer['onresult'] = null;
  onerror: Recognizer['onerror'] = null;
  onend: Recognizer['onend'] = null;
  started = false;
  stopped = false;
  constructor() {
    FakeRecognizer.last = this;
  }
  start() {
    this.started = true;
  }
  stop() {
    this.stopped = true;
  }
  abort() {}
  /** Fires a result with one alternative per piece, as the browser hands over a final transcript. */
  say(...pieces: string[]) {
    this.onresult?.({ results: pieces.map((transcript) => [{ transcript }]) });
  }
}

function setUp(lang: 'en' | 'de' = 'en') {
  const heard: { text: string[]; problems: SpeechProblem[]; ended: number } = { text: [], problems: [], ended: 0 };
  const stop = listen({
    win: { SpeechRecognition: FakeRecognizer },
    lang,
    onText: (text) => heard.text.push(text),
    onProblem: (problem) => heard.problems.push(problem),
    onEnd: () => {
      heard.ended += 1;
    },
  });
  const recognizer = FakeRecognizer.last;
  if (recognizer === null) throw new Error('no recognizer was made');
  return { stop, recognizer, heard };
}

describe('recognizerFor', () => {
  it('is null where the browser has no speech recognition', () => {
    expect(recognizerFor({})).toBeNull();
  });

  it('takes the standard name first, and Chrome’s prefixed one otherwise', () => {
    class Prefixed extends FakeRecognizer {}
    expect(recognizerFor({ SpeechRecognition: FakeRecognizer, webkitSpeechRecognition: Prefixed })).toBe(FakeRecognizer);
    expect(recognizerFor({ webkitSpeechRecognition: Prefixed })).toBe(Prefixed);
  });
});

describe('listen', () => {
  it('listens once in the language’s locale, for one final alternative', () => {
    const { recognizer } = setUp('de');
    expect(recognizer.lang).toBe('de-DE');
    expect(recognizer.interimResults).toBe(false);
    expect(recognizer.maxAlternatives).toBe(1);
    expect(recognizer.started).toBe(true);
  });

  it('hands over the final text, trimmed and joined, and nothing for silence', () => {
    const { recognizer, heard } = setUp();
    recognizer.say(' coffee', '6 ');
    recognizer.say('   ');
    expect(heard.text).toEqual(['coffee 6']);
  });

  it('says why it stopped without text, but not when it was stopped on purpose', () => {
    const { recognizer, heard } = setUp();
    recognizer.onerror?.({ error: 'not-allowed' });
    recognizer.onerror?.({ error: 'aborted' });
    expect(heard.problems).toEqual(['denied']);
  });

  it('ends every session, and its stop function stops the recognizer', () => {
    const { stop, recognizer, heard } = setUp();
    stop?.();
    recognizer.onend?.();
    expect(recognizer.stopped).toBe(true);
    expect(heard.ended).toBe(1);
  });

  it('returns null and makes nothing where the browser has no recognizer', () => {
    FakeRecognizer.last = null;
    const stop = listen({ win: {}, lang: 'en', onText: () => {}, onProblem: () => {}, onEnd: () => {} });
    expect(stop).toBeNull();
    expect(FakeRecognizer.last).toBeNull();
  });
});

describe('speechProblem', () => {
  it('maps the browser’s error codes to the app’s own problems', () => {
    expect(speechProblem('not-allowed')).toBe('denied');
    expect(speechProblem('service-not-allowed')).toBe('denied');
    expect(speechProblem('no-speech')).toBe('noSpeech');
    expect(speechProblem('network')).toBe('offline');
    expect(speechProblem('audio-capture')).toBe('noMic');
    expect(speechProblem('aborted')).toBeNull();
    expect(speechProblem('language-not-supported')).toBe('failed');
  });
});
