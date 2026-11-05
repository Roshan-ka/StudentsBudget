# Accessibility pass: WCAG 2.2 AA

## Context

Roshan asked for an accessibility pass after the pain points (05-11-2026). Three read-only audits ran in parallel on `main` at f88ef8b:

- semantics and names;
- keyboard, focus and pointer;
- what you see, and forms.

Claude checked their main findings against the code before writing this.

**What already holds:**
- One `<main>` and a named nav, with headings mostly in order.
- Progress bars with a name and a text value, and charts with a text summary and a table.
- Correct tabs, segmented controls and radio group, and the right `autocomplete` on every sign-in field.
- Nothing acts on pointer-down, nothing needs dragging, and there are no keyboard traps or images of text.
- Every destructive action but one is confirmed, and sign-in needs no memory test.
- Reflow at 320 px and 200 % text is already tested.

**What doesn't**, by what it costs a person:

1. **Lost focus.** Wherever the page swaps one part for another, focus falls to `<body>` and a keyboard or screen-reader user starts again from the top. This covers:
   - an entry's edit panel, the fixed-costs editor, accounts and transfers;
   - the delete questions, privacy notes, change password, quick add's follow-up chips and Undo;
   - every page change: Next 16 leaves focus where it was, and every page has the same title, so the route announcer never speaks.
2. **Focus you can't see:**
   - Destructive buttons have a ring at 1.4:1 (`button.tsx:24`).
   - A field in an error state looks the same focused or not (`input.tsx`, `textarea.tsx`, `native-select.tsx`).
   - Tab panels have `outline-none` but take focus (`tabs.tsx:77`).
   - The check-in's away switch has a ring at half strength.
3. **Colour alone:**
   - Links inside sentences differ from the text beside them only by hue (`LINK_CLASS`).
   - Many category colours fall under 3:1 against the card as chart marks and envelope bars.
   - The charts' "planned" bar is under 3:1, as is its legend.
4. **Forms:**
   - Errors aren't tied to their fields (`aria-invalid` and `aria-describedby`).
   - The password hint isn't tied to its field.
   - An amount field doesn't say its currency.
   - Status lines that appear together with their text are often missed.
   - The live totals are read out on every keystroke.
5. **Smaller things:**
   - Deleting an account row asks nothing.
   - "Download a backup first" goes to the wrong page.
   - "Type DELETE" is case-sensitive and silent.
   - Fixed `h-10` buttons, and a truncated donut legend.
   - A grey "0" placeholder reads as an answer.
   - Same-named controls ("Source", "Report").
   - A few headings out of place, mixed-language swap lines, and "‹ ›" read aloud in link names.
   - Messages that name Settings places that no longer exist ("Fixed costs and income in Settings").

**Target:** WCAG 2.2 AA, as in the redesign plan. Every chunk keeps the look Roshan approved. Where a fix would change it (outlines on chart marks), it shows as a mockup first.

## How every chunk works

- Each chunk is its own draft PR from `main`, with lint, typecheck, the touched unit tests and an As-built note. Claude dispatches CI on it (scope `changed`, browsers `all`), as Roshan asked on 05-11-2026, and Roshan merges.
- A fix that moves focus gets an e2e check, written as a keyboard user would use it (`toBeFocused()`), not by class names.
- **One pattern for focus:**
  - When a part opens, focus goes to its heading (`tabIndex={-1}`) or its first field.
  - When it closes or saves, focus goes back to what opened it.
  - After a delete, focus goes to the next row, or the list's heading.

  `accounts-panel.tsx:247` (make default) already does this by hand. A small hook in `src/lib/` takes over the bookkeeping.
- New words go into en, de, fr and es. Behaviour and words stay the same for a mouse user unless the chunk says otherwise.

## Chunks

1. **Focus you can see, and the quick fixes.**
   - **Focus rings:** destructive buttons keep the full `ring-ring`; a focused invalid field shows `ring-ring` (`aria-invalid:focus-visible:ring-ring`); tab panels get a visible ring; the away switch gets the full ring.
   - **Links:** `LINK_CLASS` (charts, check-in) and the inline links in badges, reveal and entries are underlined.
   - **Small fixes:**
     - `delete-account.tsx:142` links to `/settings/backup`;
     - "Type DELETE" ignores case;
     - the `h-10` buttons in `change-password.tsx` and `delete-account.tsx` become `min-h-11`;
     - "‹" and "›" in Previous/Next are `aria-hidden`.
   - **Test:** `tokens.test.ts` gains the ring against the destructive tint.
2. **Page titles and focus on a page change.**
   - Each page sets its title ("Settings · StudentsBudget", translated), so Next's route announcer speaks. Home and setup get titles too.
   - On a page change, focus goes to the page's `h2`. On the first load it doesn't move.
   - **Specs:** a nav tap leaves focus on the new page's heading, and the title changes.
3. **Inline panels: entries and fixed costs.** The focus hook, used in:
   - the entries list (edit panel, delete question);
   - the fixed-costs editor (edit, add, delete, pause).
4. **Inline panels: the rest.** The focus hook, used in:
   - accounts (add, edit, delete, now with a question too);
   - transfer, backup's Delete everything, change password, the suggested budget;
   - the Tips posts' Report and Delete, and the setup rows' Remove.
5. **Privacy notes and quick add.**
   - A privacy note takes focus when it appears, and Cancel returns it.
   - Quick add says "Which category?" / "Which amount?" in its status line and focuses the first chip; after a pick, or after Undo, focus is back in the field.
   - Undo stays while it has focus or the pointer.
6. **Forms tell their fields.**
   - **Errors:** `aria-invalid` and `aria-describedby` tie each error to its field (entry form, transfer, accounts, sign-in and sign-up, setup's step errors), as `profile-section.tsx` already does. The password hint is tied to its field, and an amount field's description says its currency.
   - **Status lines:** they stay mounted, so they're announced. The suggested budget's failure is an alert. The live totals update after a pause, not on every key.
7. **Charts and colour.** Mockup first.
   - **Outlines:** donut slices, bars, columns and the planned bar get a thin `--outline` edge. Envelope bars get an edge or a darker fill, Roshan's pick from the mockup.
   - **Contrast test:** `tokens.test.ts` checks every category colour, with its edge, against the card at 3:1.
   - **The rest:** the donut legend wraps instead of truncating, Escape closes the chart tooltip, and a donut row is one Tab stop, not two.
8. **Names, headings, words.**
   - **Names:** "Source" disclosures take their item's name; a post's Report, Delete and Translate say which post.
   - **Headings and language:** the heading outline fixes (Delete account's h4, the edit panel's h3); a swap's untranslated title gets its own `lang`.
   - **Forms:** no "0" placeholder; quick add's example sits in a visible hint.
   - **Words:** messages name Settings places as they are now ("Settings → Plan → Fixed costs and income"), the plan's edit has one name, and the file and email errors say how to fix them.
9. **Optional: an automatic check.** An axe-core spec over every page in `PAGES`, light and dark, failing on serious violations. It needs a new dev dependency (`@axe-core/playwright`, pinned), so it waits for Roshan's OK.

**Decided by Roshan before the chunk that needs it:**
- Chunk 7: how envelope bars get their contrast (from the mockup).
- Chunk 9: the axe-core dependency.

## Verification

- **Each chunk:** its specs, run in CI on both browsers, and the language tour where words change.
- **At the end:**
  - A full run on `main` (every browser and language), with `reflow` and `theme` covering 200 % text and dark mode.
  - A real try on the phone with VoiceOver (iPhone) and TalkBack if available: set up, log a spend, edit and delete it, open Settings → Accounts. It joins the postponed phone tries in one sitting.
- **Done when:**
  - Keyboard and screen-reader users never lose their place.
  - Every focused control shows a ring at 3:1 or better.
  - No meaning is told by colour alone.
  - Every error is tied to its field and says how to fix it.
