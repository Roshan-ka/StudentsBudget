# P2: the mic button in quick add

## Context

The Concept's P2 list has "a mic button in the app (the browser's built-in speech recognition) for one-tap entry". Today voice works only through the phone keyboard's dictation key, which is two steps away. The goal is the Concept's core one: logging a cash purchase in under 10 seconds, spoken.

Decided with Roshan (04-11-2026):
- **Save straight away.** The spoken words go into the field and are added like a typed line with Enter. The existing "Saved … · Undo" line shows what was heard for 10 s, so a misheard amount is one tap to undo. A line that needs a category or an amount choice still asks.
- **Privacy note once, before first use.** The first tap shows a short note: the browser turns speech into text and may send the recording to its speech service (Google, in Chrome); StudentsBudget gets only the text. It has Continue and Cancel, and is remembered per phone, like the language choice.

After approval, this plan goes to `docs/superpowers/plans/2026-11-04-mic-button.md`, where the repo keeps its plans.

## What exists (verified)

- **`QuickAddField`** (`src/features/entries/quick-add-field.tsx`): the line is local state (`text`). `onSubmit` reads it through `provider.read` → `checkReading`, then saves, asks for an amount (`AmountChoice`) or asks for a category (`CategoryChips`). The field appears on Home, `/entries` and the check-in, each as a bare `<QuickAddField />`, so one change covers all three.
- **The parser already reads dictation:** "Döner 6 €", "6,50", "döner six euros" and the trailing punctuation dictation adds (tests in `quick-add.test.ts`). German number words ("sechs") are a known gap in the P1 follow-ups and stay out of scope: Chrome writes numbers as digits.
- **TypeScript 5.9's `lib.dom`** has only the speech *result* types. `SpeechRecognition`, its events and `webkitSpeechRecognition` are missing, so the app declares the small part it uses.
- **Patterns to reuse:**
  - feature detection with `useSyncExternalStore` (`src/features/account/passkeys.tsx:20-27`);
  - a per-phone localStorage flag with try/catch (`src/i18n/store.ts`);
  - `navigator.onLine` checked in the handler (`passkeys.tsx:48`);
  - `LANGUAGES[lang].locale` (`src/i18n/languages.ts`) for the recognition language;
  - inline `page.addInitScript` stubs in e2e (`backup.spec.ts`, `passkeys.spec.ts`).
- **Text:** every new word goes in `entries.quickAdd`, in all four dictionaries (en, de, es, fr; French with `NNBSP`). The `jsx-no-literals` lint guard covers `src/features/entries`.

## Design

**`src/features/entries/speech.ts`** (new, no React):
- A minimal `Recognizer` type for the part of the API we use: `lang`, `interimResults`, `maxAlternatives`, `start`, `stop`, `abort`, `onresult`, `onerror`, `onend`.
- `recognizerFor(win)`: `SpeechRecognition ?? webkitSpeechRecognition`, or null.
- `listen({ win, lang, onText, onError, onEnd })` builds one recognizer with `maxAlternatives = 1`, `interimResults = false` and `lang = LANGUAGES[lang].locale`. It calls `onText` with the final transcript and returns a `stop()`.
- `speechProblem(code)` maps the browser's error codes to the app's own:
  - `not-allowed` and `service-not-allowed` → `denied`;
  - `no-speech` → `noSpeech`;
  - `network` → `offline`;
  - `audio-capture` → `noMic`;
  - `aborted` → null (the person stopped it);
  - anything else → `failed`.

**`src/features/entries/mic-note.ts`** (new): `micNoteSeen()` and `markMicNoteSeen()` on the localStorage key `studentsbudget-mic-note`. Both are wrapped in try/catch, so blocked storage just shows the note again. Per phone; not synced, not backed up.

**`QuickAddField`:**
- `onSubmit`'s body becomes `addLine(line)`. Typing and speech both call it, so one path saves.
- A mic button (lucide `Mic`, `h-10 w-10`, `aria-label` from the dictionary) sits between the input and Add. It renders only where `recognizerFor(window)` exists; the snapshot on the server is false.
- **Tap:**
  - Offline (`navigator.onLine`): show the `offline` message and don't start.
  - Note not seen yet: show the inline note with Continue and Cancel. Continue marks it seen and starts listening.
  - Otherwise: start listening.
- **While listening:**
  - the button shows `aria-pressed`, label "Stop listening" and a stop icon;
  - a polite status reads "Listening…";
  - a second tap stops.
- **On text:** `setText(transcript)`, then `addLine(transcript)`, so the Saved line or the chips follow as for typing.
- **On error:** the mapped message in the existing `role="alert"` line.
- **When the page is left:** the router keeps hidden pages mounted, so an effect cleanup calls `stop()`, as the Saved line's cleanup does.

**Text** (`entries.quickAdd`, in en, de, es and fr):
- `mic`, `stopMic` and `listening`;
- `micNote { text, continue, cancel }`;
- `micErrors { denied, noSpeech, offline, noMic, failed }`.

The note states only what is sure: the browser may send the recording to its speech service, and StudentsBudget gets only the text.

## Chunks

Each is about an hour: lint, typecheck, `npm test`, an "As built" note, a commit and its own draft PR from `main`.

1. **Speech helpers and words.**
   - `speech.ts` and `mic-note.ts`.
   - The new `entries.quickAdd` keys in all four dictionaries.
   - Unit tests with a fake recognizer class:
     - it is null when unsupported;
     - `lang` follows the language (`de-DE`), with one alternative and no interim results;
     - the final transcript reaches `onText`;
     - every error code maps as above;
     - `stop()` stops;
     - the note flag survives a reload and blocked storage doesn't throw.
   - **As built (2026-11-04):**
     - `src/features/entries/speech.ts`:
       - `Recognizer` (the part of the API the app uses) and `recognizerFor(win)`, which prefers the standard name over Chrome's `webkitSpeechRecognition`;
       - `speechProblem(code)`;
       - `listen({ win, lang, onText, onProblem, onEnd })`. The error callback is `onProblem`, since it receives the app's own problem. `listen` returns `stop()`, or null where there is no recognizer.
     - `src/features/entries/mic-note.ts`: `MIC_NOTE_KEY` (`studentsbudget-mic-note`), `micNoteSeen()` and `markMicNoteSeen()`.
     - `entries.quickAdd` in en, de, es and fr gains `mic`, `stopMic`, `listening`, `micNote { text, continue, cancel }` and `micErrors { denied, noSpeech, offline, noMic, failed }`.
     - Unit tests: `speech.test.ts` (8, with a fake recognizer) and `mic-note.test.ts` (2). Nothing uses the helpers yet; chunk 2 adds the button.
2. **The mic button.**
   - The button, the note and the states in `QuickAddField`, with `addLine` shared by typing and speech.
   - `e2e/dictation.spec.ts` on both browsers. A fake `SpeechRecognition` is installed with `addInitScript`, and its transcript is set on `window`. The spec checks:
     - the first tap shows the note, Continue speaks "coffee 3" and the category chips appear;
     - after a reload there's no note, and speaking "coffee 6" saves at once ("Saved €6 · coffee · …");
     - a "not-allowed" error shows its message;
     - without the API there's no mic button;
     - in German the recognizer is given `de-DE`.
   - The spec goes in `e2e/affected-map.json` (it opens Home, so under `allOnly`).
   - CLAUDE.md:
     - the Quick add bullet, saying the mic feeds the same `addLine` and provider path;
     - the outgoing-requests note: the app sends nothing, but the browser's speech service may receive audio, and the app says so once.
   - **As built (2026-11-04):**
     - `QuickAddField`:
       - `onSubmit`'s body is now `addLine(line)`, shared by typing and speech.
       - The mic button (`Mic`, then `Square` while listening) shows where `recognizerFor(window)` exists (`useSyncExternalStore`, false on the server). It sits between the field and Add.
       - Its name says what a tap does now, "Speak an entry" or "Stop listening". It has no `aria-pressed`, unlike the plan: a toggle shouldn't change both its name and its pressed state.
       - The first tap opens the note (a group named after the button, with Continue and Cancel).
       - Offline taps say so without starting.
       - What is heard fills the field and goes through `addLine`.
       - Leaving the page stops listening.
     - "Listening…" takes the field's one `role="status"` line, where the Saved line shows. A second status region would break the specs' `getByRole('status')`.
     - `e2e/dictation.spec.ts` (under `allOnly`) installs a stand-in recognizer with `addInitScript`. It checks:
       - the note, then Continue → "coffee 3" → the category chips → Saved;
       - after a reload, no note, and "coffee 6" saves straight away;
       - Cancel leaves the mic off;
       - a blocked microphone and being offline;
       - no button without the API;
       - German listens in `de-DE`.
     - CLAUDE.md: the mic under Quick add, and the speech service under outgoing requests.
3. **Real try on the phones.**
   - Android Chrome and the iPhone (Safari and the installed app) via `npm run start:https`: does the button show, does recognition work, what does dictation actually produce?
   - Fix what the try finds, for example a parser case for a phrasing the phone produces.
   - Where a browser has no API (Firefox, possibly the installed iPhone app), the button simply doesn't show.

## Verification

- **Every chunk:** `npm run lint`, `npm run typecheck`, `npm test`.
- **Chunk 2:** `dictation.spec.ts`, `home.spec.ts`, `entries.spec.ts` and `check-in.spec.ts` on both browsers. The heavy run goes through the lane, which needs Roshan's approval today, or a CI `changed` run he approves. Also the 375 px check that the field row (input, mic, Add) doesn't overflow in German and French (`language-tour.spec.ts` with `E2E_LANGUAGES=all`).
- **Chunk 3:** Roshan tries it on his phones.

## Left out

- German, French or Spanish number words in the parser (a P1 follow-up; dictation writes digits).
- Interim results shown while speaking, and continuous listening.
- An AI reading of natural sentences (the AI phase).
