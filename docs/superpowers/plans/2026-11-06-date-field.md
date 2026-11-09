# A date field you can type into, with an in-app calendar

## Context

Roshan, 06-11-2026: "in the entries make the calendar more intuitive and easy to use, also add manual date input with option to calendar".

**What the field does today** (`src/components/date-field.tsx`):
- A native `<input type="date">` lies transparent over a button-like field, and a tap opens the phone's own picker. That picker looks different on iPhone, Android and desktop, and on iPhone its week can start on Sunday.
- On a computer you can type into it blind: the segments are invisible (opacity 0), and the shown text changes only once the date is complete.

**What Roshan approved** from the mockup:
- A real text field showing the date in the region's form (`06.11.2026`).
- A calendar button at its end that opens an in-app month calendar as a **sheet from the bottom** (on a computer, a centred card).
- The Today and Yesterday chips stay.
- **Everywhere:** it's one shared component, so Entries, Transfer and Profile's semester dates all change together ("One design everywhere").

**No new dependency:** `@base-ui/react` 1.9.0 already has `dialog`, with `initialFocus` and `finalFocus`, and `date-fns` is already in the app.

**Where the plan lives:** it is copied to `docs/superpowers/plans/2026-11-06-date-field.md` as the first commit (plans go to repo docs).

**Branch and PR:** `feat/date-field` from `main`, one draft PR.

**Chunks:** about an hour each, each with its own commit and report.

## Behaviour

**Typing** (`readTypedDate`, `typedDateText`, both pure):
- The field is `type="text"` with `inputMode="numeric"`, `autoComplete="off"` and a 16 px font, so iOS doesn't zoom.
- **Dots fill in by themselves.** Typing digits at the end inserts the region's separator after the day and after the month (`0611` gives `06.11`). Deleting never inserts one. This matters because the iPhone's number pad has no dot.
- **Readable forms, in the region's part order** (`REGIONS[…].dateOrder`, never hard-coded):
  - with a separator (`.` `,` `/` `-` or a space): `6.11`, `6.11.26`, `06.11.2026`;
  - digits only: `0611`, `061126`, `06112026`;
  - a missing year means this year; a two-digit year means 20xx; an impossible date (`31.02.2026`) isn't read.
- **Commit on blur and Enter.** A readable date is rewritten as `formatDate(iso)` and passed as `onChange(iso)`.
- **Unreadable text** reports `''`, so the forms' existing `pickDate` check stops the save. It also turns the field's hint line into its own message, "That's not a date. Type it like 06.11.2026.", with `aria-invalid` on the field.
- **Keeping the text in step with the value:** the text follows `value` only when it differs from what the field last reported. A chip, the calendar, the clock (`useToday`) or opening an entry to edit replaces the text; what the person is typing is never wiped.
- **Hint under the field:** "Type it like {today}, or open the calendar." The hint is in the field's `aria-describedby`, together with the caller's `describedBy` (via `describedBy()`).

**Calendar** (`DateCalendar`, a base-ui `Dialog`):
- **Opening:** the calendar button sits at the field's end (44 px, `aria-label` "Open the calendar", `aria-haspopup="dialog"`).
- **Layout:** a sheet from the bottom below 640 px, a centred card above. It slides only under `motion-safe`.
- **Title:** "Choose a date". Under it, the month and year from `Intl` in the language's locale, in an `aria-live="polite"` line.
- **Month buttons:** previous and next month, 44 px each, beside the title.
- **The grid:** weeks run Monday to Sunday, with weekday letters from `Intl` and their full names as `abbr`. Day buttons are at least 44 px.
  - **Today:** an outline, and `aria-current="date"`.
  - **The chosen day:** filled cobalt, with `aria-selected`.
  - **Days of the next and previous month:** muted, but still pickable.
  - **Days before `min`:** shown, but they can't be picked (`aria-disabled`).
- **Each day's name:** the weekday and `formatDate`, for example "Friday, 06.11.2026", which keeps the region rule.
- **Keys** (APG date-picker dialog):
  - arrows move one day or one week;
  - Home and End go to Monday and Sunday;
  - PageUp and PageDown move a month, and with Shift a year;
  - Enter or Space picks the day and closes;
  - Escape closes.
  - Roving `tabindex`: only the focused day is in the tab order.
- **Focus:** opens on the chosen day (or today) through `initialFocus`. Closing returns to the calendar button (`finalFocus`, base-ui's default). Picking a day writes the date and closes.
- **Footer:** "Go to today" and "Close".

**Strings:** new `common.dateField` messages in en, de, fr and es: `hint(example)`, `notADate(example)`, `openCalendar`, `calendarTitle`, `previousMonth`, `nextMonth`, `goToToday`, `close`. German, French and Spanish are written now; native reads come later, as for every text so far.

## Chunks

**Chunk 1: the helpers, with unit tests**
- New `src/components/date-input.ts`:
  - `readTypedDate(text, today, region)`, returning `IsoDate | ''` or a not-a-date marker;
  - `typedDateText(previous, next, region)`;
  - `monthWeeks(month)`: Monday-start weeks as `IsoDate[][]`;
  - `movedDay(day, key, shift)`: the key moves above.
- Tests in `date-input.test.ts`:
  - every typed form above, including the 29th of February in leap and other years;
  - two-digit years, impossible dates and empty text;
  - auto-dots, including deletion and pasting;
  - grid edges: a month starting on Monday, one starting on Sunday, and February;
  - key moves across month and year ends.
- The new messages in all four languages. `messages.test.ts`'s allow-list gets whatever stays the same as English.

**Chunk 2: the typed field**
- Rewrite `src/components/date-field.tsx`. The props stay the same (`value`, `onChange`, `label`, `chips`, `min`, `invalid`, `describedBy`), so the three callers don't change:
  - `src/features/entries/entry-form.tsx`
  - `src/features/accounts/transfer-form.tsx`
  - `src/features/profile/profile-section.tsx`
- The calendar button is in place but opens nothing yet. Drop `openPickerOnMouseClick` and the transparent overlay.
- **Specs that typed an ISO date into the native input now type the region's form:** `fill(formatDate('2026-09-30'))`, and expect `toHaveValue(formatDate(…))`.
  - `e2e/entries.spec.ts`
  - `e2e/accounts.spec.ts`
  - `e2e/check-in.spec.ts`
  - `e2e/profile.spec.ts`
- **In `entries.spec.ts`:**
  - replace "a tap anywhere … lands on the native date input" and "the native input keeps the ISO value";
  - add specs for typing short forms, an unreadable date (its message, `aria-invalid`, and no save), and the chips still working.

**Chunk 3: the calendar sheet**
- New `src/components/date-calendar.tsx` (base-ui `Dialog`; the styling uses the tokens, the `Card` look and the 1.5 px outline).
- Wire it to the field's button.
- **New `e2e/date-field.spec.ts`** (Chromium and the iPhone project):
  - open with the button, then move by keyboard (arrows, PageDown, Home and End) and pick with Enter;
  - focus goes back to the button;
  - Escape closes without changing the date;
  - a tap picks a day of the next month;
  - Semester end can't pick a day before Semester start;
  - in German, the month name and weekdays are in German and the typed form stays `TT.MM.JJJJ`;
  - an axe check with the sheet open, in light and dark.
- Add it to `e2e/affected-map.json`.

**Chunk 4: wrap-up**
- CLAUDE.md gets a "Date field" line under Framework rules:
  - you type in the region's form, and dots fill in by themselves;
  - the calendar is a base-ui Dialog sheet;
  - specs type `formatDate(…)`;
  - the text follows `value` only when changed from outside.
- Write up the PR.
- Add a phone try to the postponed phone tries: type, open the sheet and VoiceOver on the iPhone.

## Verification

- **Tests:** this worktree has no `node_modules`, and heavy jobs run in GitHub CI, so the checks run there.
  - **Every push to the draft PR:** I dispatch CI with `scope=changed browsers=all` (my own draft PR, already allowed). That covers lint, typecheck, build and the whole unit suite, plus the e2e specs of the routes the date field reaches (Entries, Accounts, Profile, Check-in) on Chromium and the iPhone project.
  - **Language tour:** chunk 3 also gets a run with `languages=all`, which covers the 375 px tour with the sheet's month names.
- **By hand, on the PR's Vercel preview:** type `0611` and see `06.11.` appear; open the sheet on a phone; pick a day; check that Today and Yesterday still mark the right chip.

## Chunk 5: jump to a month or a year (09-11-2026)

Roshan tried the sheet ("good visually"), but reaching another month or year took the ‹ › arrows over and over. Three mockup rounds settled it: "do not show arrow, just an outline around the month and year and show them similar to like the dates", then "show both month and year on top but with different sections".

- **The header:** above the days are two outlined buttons with no arrow, the month ("November") and the year ("2026"), each with `aria-expanded` and a description ("Choose a month", "Choose a year").
- **Months:** 12 cells in the days' look, round, with this month ringed and the shown one filled. Each shows the short name ("Sept"), which is also its name: a full name would not hold the visible word (WCAG 2.5.3, axe in CI on 09-11).
- **Years:** 12 years, the shown one with 7 before and 4 after (`yearPage`). Here ‹ › page 12 years at a time.
- **After a pick:** picking a month or a year shows its days, with the focus on the same day number, clamped (`sameDayIn`).
- **`min`:** months and years that end before `min` can't be picked.
- **Escape:** in a list it goes back to the days (base-ui's `escape-key` reason, `cancel()`); only then does it close the sheet.
