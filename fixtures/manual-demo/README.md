# StudentsBudget manual demonstration pack

24 accepted backup files, 58 deliberately invalid files, and manual checks with expected results. All data and exchange rates are fictional.

## Read first: a snapshot of 21-10-2026

The committed files were generated for **21-10-2026** (Europe/Berlin), demo month **October 2026**. Entry dates, recurring postings and weekly records are placed relative to that day, so some expected results hold only around it. **Home always shows the current month of your device, never the demo month**, and its "This week" line follows today's date. How long each part stays valid:

| What you check | Holds |
|---|---|
| Importing and refusing all 82 files, Replace/Cancel; account balances and the Total in Settings; Entries and Charts once the month switcher is on October 2026; Home's monthly figure for the files without dated entries (02, 04, 07, 18, 19, 21 to 24) | On any date |
| Home's monthly figure ("Left to spend this month", over, envelopes) for the files with dated entries: 01, 03, 05, 06, 09, 10 to 13, 15, 17, 20 | While your device date is in October 2026. From 01-11-2026 Home shows an untouched November: go back to October 2026 in Entries and Charts instead. |
| "This week" on Home and the Check-in week; the away mark of the current week in 13 | Only from 19-10-2026 to 25-10-2026, the Monday to Sunday of the snapshot week |
| 08: exactly three recurring entries after the restore | Only if you restore from 21-10-2026 to 27-10-2026 (nothing is due before; from 28-10-2026 the weekly Job line posts again) |
| 10 to 12: "6 / 12 / 26 weeks in a row" on Logging Streak | Through 27-10-2026. After that the streak starts over; the earned badges and tiers stay. |
| 13: Logging Streak "paused at 5 weeks" | Through 03-11-2026 |
| 16: the reserve of EUR 50 a month | In any month from October 2026 to March 2027; the future cost falls due in April 2027 |

On any other day, regenerate the pack for that day into a folder outside the tracked files (see the end of this guide) and restore from there. Its CASES.md has the figures for that day; this guide stays on 21-10-2026.

Start with **01-everyday-student.json** for a populated demo, or **02-clean-budget.json** for predictable calculations while adding entries. [CASES.md](CASES.md) lists each file, its initial figures and specific outcomes, plus the exact rejection messages for all invalid files.

## Import a scenario

1. Export any data you want to keep: **Settings > Backup > Export backup**. Restoring replaces all local data.
2. In **Settings > Backup > Restore from a backup**, choose **File to restore**. On an empty app use **Have a backup? Restore it** at the bottom of setup.
3. Choose one JSON file from `valid/`, inspect the file name and account/entry counts, then select **Replace all data**. Choosing a file alone must not change data. **Cancel** must preserve it.
4. Wait for Home to finish loading. Recurring entries and historical week records may be added at startup; file counts in CASES.md describe the file before this processing.
5. Restore the named scenario again before each independent test. Actions within a test build on one another. On a later date Home shows the current month, so open the demo month with the month switcher in Entries and Charts.

The app reads these files locally through its backup importer; there is no separate server upload or login. Do not import `manifest.json`; it is metadata for automated verification. Keep the malformed JSON file malformed: it is an intentional rejection test.

## Suggested presentation, about 15 minutes

| Order | Restore | Demonstrate | Expected result |
|---|---|---|---|
| 1 | 01-everyday-student | Home, envelopes and account balances | Three accounts, 47 entries, combined EUR 3,613.22 (the Total in Settings; Home rounds it to €3,613); Shopping is overspent in the demo month. |
| 2 | 02-clean-budget | Add `demo-snack 6`, choose Eating out; add `demo-snack 4`, then Undo immediately | EUR 6 remains, EUR 4 is removed. Bank EUR 994; cash EUR 100; envelope money EUR 494. |
| 3 | 03-overspent-swaps | Read the overspending and open an Eating out suggestion | EUR 60 over this month; suggestion explains its saving and sources. |
| 4 | 06-all-currencies | Open accounts and rates | All seven currencies; combined EUR 1,680 using fictional manual rates. |
| 5 | 09-twelve-months-all-categories | Change charts and periods; drill into a category | This month spending EUR 201, income EUR 1,400. Twelve months spending EUR 2,412. Transfers excluded. |
| 6 | 12-badges-gold | Open Badges | All four earned; Under-Budget Week gold. |
| 7 | 02-clean-budget | Try an invalid import | Exact refusal from CASES.md; existing data unchanged. |

## Entry, account and rate checks

| ID | Restore | Manual action | Expected result |
|---|---|---|---|
| E01 | 02-clean-budget | Quick add `demo-snack 6`, choose Eating out; add `demo-snack 4` | First asks for category; second remembers it. Two separate expenses, dated today, default EUR bank. |
| E02 | 02-clean-budget | Add `demo-coffee 7 40 euros` | Asks which amount, EUR 7.40 or EUR 40. Choose EUR 7.40 and a category: exactly EUR 7.40 saved. |
| E03 | 02-clean-budget | Quick add `demo-grocery 12,50` and choose Food | One EUR 12.50 expense. Bank EUR 987.50 in Settings; the envelope money is EUR 487.50, which Home rounds to "€488". |
| E04 | 02-clean-budget | Quick add `demo-snack` without an amount | Message asks for an amount. No entry or balance change; text stays editable. |
| E05 | 02-clean-budget | Add EUR 6, then Undo within 10 seconds | Saved entry disappears and balances return to the baseline. Saved/Undo line expires after 10 seconds. |
| E06 | 02-clean-budget | Save EUR 6, tap entry, change to EUR 7.50, save | One updated entry; bank EUR 992.50. Cancel deletion keeps it; confirmed deletion restores bank EUR 1,000. |
| E07 | 02-clean-budget | Full expense form: use Yesterday, then Today; select a past date and save | DD-MM-YYYY presentation; saved date matches selection. Find past entries through their month. |
| E08 | 02-clean-budget | Full expense form: amount blank, zero, negative, text; then valid EUR 2 | Invalid amounts cannot save. Corrected positive amount saves once. |
| E09 | 02-clean-budget | Add an Income of EUR 100 to the bank, category Job | Bank EUR 1,100; combined EUR 1,200. Chart income increases EUR 100; envelope remainder stays EUR 500. |
| A01 | 02-clean-budget | Move EUR 20 from bank to cash | Bank EUR 980; cash EUR 120; combined EUR 1,100; envelope money EUR 500. Charts have no extra spending or income. |
| A02 | 02-clean-budget | Open transfer form and change From to the account currently in To | From and To remain distinct. Invalid/zero transfer amount cannot save. |
| A03 | 02-clean-budget | Add empty EUR account named Spare with EUR 25 opening, then delete it | Combined balance temporarily EUR 1,125. Deletion succeeds and restores EUR 1,100. |
| A04 | 02-clean-budget | Save EUR 1 expense to bank, then try deleting the bank account | Refused because the account has entries. The account and entry remain. |
| A05 | 18-default-cash-account | Add EUR 6; change default to bank; add EUR 4 | Cash EUR 94; bank EUR 996. Default selection persists after reload. |
| A06 | 05-overdrawn-accounts | Read balances and Home | Bank -EUR 50; cash -EUR 5; combined -EUR 55. Envelope remainder EUR 485 is a separate figure. |
| F01 | 06-all-currencies | Full expense form: INR account, amount 950, Food | Converted expense EUR 10. Combined balance decreases by EUR 10. |
| F02 | 06-all-currencies | Change manual INR rate from 95 to 100 | Existing saved EUR amounts do not change. Current account EUR valuation and future conversions use 100. |
| F03 | 07-missing-exchange-rate | Follow offline prerequisites in CASES.md; try logging INR; then set manual rate 95 | Missing rate initially prevents saving and excludes INR from combined value. After rate saved, INR 9,500 = EUR 100. |
| F04 | 06-all-currencies | Enter rate 0, negative or text, then valid 95; optionally use ECB rate again online | Invalid rate refused. Manual rate survives refresh. Switching to ECB uses a live value, not a fixed demo expectation. |

## Budgets, recurring entries and charts

| ID | Restore | Manual action | Expected result |
|---|---|---|---|
| B01 | 02-clean-budget | Add EUR 10 Food expense, then inspect Home and Check-in | Monthly envelope money EUR 490. On 21-10-2026 Home reads "This week: €250 safe to spend" before the expense and "This week: €240 safe to spend" after it: EUR 500 split over the 2 weeks left in October, less the EUR 10. On another day the figure differs. Check-in follows the same week and its remaining share; it is not the monthly remainder divided by four. |
| B02 | 20-exactly-exhausted | Add a EUR 0.01 Food expense using the full form | EUR 0 becomes EUR 0.01 over. No negative zero. |
| B03 | 04-zero-budget | Open Home/Charts/Badges, then add EUR 1 expense | Empty states remain usable; month becomes EUR 1 over; no NaN/Infinity. |
| B04 | 21-income-below-fixed-costs | Open the suggested budget; type an amount into one envelope, then press **Use this budget** | Nothing is available, so every suggestion is EUR 0 and **Use this budget** stays disabled until you type an amount. Applying changes only the envelopes, not entries, income, fixed costs or account balances. |
| B05 | 02-clean-budget | Settings > Edit plan; change the spending budget and envelope amounts; save | Saved values survive reload. Accounts, transactions and saved initial guesses stay intact. Budget is guidance and does not block an oversized plan. |
| B06 | 16-one-off-reserves | Inspect and save Edit plan | Past/current due costs remain editable; only the future EUR 300 cost reserves EUR 50/month over six months. Available EUR 650, envelopes EUR 500. No automatic one-off transaction. |
| B07 | 15-setup-date-boundary | Compare Entries, Home and Charts | Both purchases affect balances; only EUR 20 on/after setup affects the setup month's envelopes. Combined EUR 1,070; monthly envelope remainder EUR 480. |
| R01 | 08-recurring-due-and-paused | Restore on generation date, inspect Entries, reload twice | Exactly three recurring transactions: +EUR 1,200 Parents, +EUR 50 Job, -EUR 450 Rent. Bank EUR 1,800. Paused Phone stays absent. |
| R02 | 08-recurring-due-and-paused | Pause/resume a line in Settings | Schedule state survives reload. Resume starts from the next day; no immediate backfill of paused occurrences. Do not expect the same three-entry baseline after editing schedules. |
| C01 | 09-twelve-months-all-categories | Switch spending/income Donut/Bars/Table | Same underlying totals in each view. Current month spending EUR 201; income EUR 1,400. |
| C02 | 09-twelve-months-all-categories | Change period 1/3/6/12 months | Spending EUR 201 / 603 / 1,206 / 2,412. Twelve months saved EUR 14,388. Transfers excluded. |
| C03 | 09-twelve-months-all-categories | Tap slice/bar/column and try Everything else | Category opens filtered entries; multi-month category opens end month. Time column opens its own month. Everything else has no drill-down. |
| C04 | 09-twelve-months-all-categories | Switch time charts Columns/Line/Table; move beyond populated months | Equivalent values, usable empty states. On This month, time charts show six months. |

## Profile, habits, setup and persistence

| ID | Restore | Manual action | Expected result |
|---|---|---|---|
| H01 | 10 / 11 / 12 badge files, individually | Open Badges | Under-Budget Week bronze/silver/gold respectively. Logging Streak, Ramen Royalty and Latte Survivor earned in each file. |
| H02 | 13-away-week | Open Check-in, toggle I was away this week off and reload | Initially selected and streak paused. Toggled state persists. Away weeks do not add under-budget credit or grocery records. |
| H03 | 02-clean-budget | Open Check-in; add a forgotten purchase dated within its displayed week | Entry and weekly figures update. Income, fixed costs and transfers are excluded from envelope totals. |
| H04 | 02-clean-budget | Open the weekly calendar reminder | Downloads/opens the .ics calendar file. On Sunday Home highlights the check-in; on other days it shows the schedule. |
| P01 | 19-profile-discount-feedback | Edit Alex Demo's name and semester; save/reload | Greeting updates. University and dates persist. Reversed dates or only one filled date cannot save; both blank is allowed. |
| P02 | 19-profile-discount-feedback | Tips > Discounts: change feedback, filter category, open source | Feedback survives reload and sorting reflects it. Sources/conditions remain available. External links need a connection. |
| P03 | 01-everyday-student | Open Tips, inspect initial guesses through the reveal page | Local tips and comparison with stored guesses render. Cost ranges identify their source and estimates. |
| S01 | 14-fresh-setup | Complete setup; try Back/Next, invalid amounts and zero plan | Valid amounts survive step navigation (text that isn't an amount is cleared when you go Back); invalid text has clear validation; a valid zero plan is allowed. Save goes to Home and setup cannot create a second plan. |
| S02 | 14-fresh-setup | Setup: set everyday budget EUR 600 and use suggested amounts | Suggested envelope allocation totals EUR 600. Editing an envelope preserves the typed amount while suggestions adapt. |
| D01 | 19-profile-discount-feedback | Export; restore 02; restore your export | Original profile, feedback, plan, accounts and entries return. Weekly records may additionally be created at startup. |
| D02 | 02-clean-budget | Choose a valid backup, inspect counts, Cancel, reload | Bank EUR 1,000, cash EUR 100 and zero entries remain. |
| D03 | 02-clean-budget | Choose each invalid file listed in CASES.md | Exact listed refusal; no replacement confirmation and no data changes. Repeat the same file to confirm re-selection works. |
| D04 | 22/23 legacy files, individually | Restore then export | Both versions accepted; missing categories filled to 26; new export is version 3. |
| D05 | 17-cents-unicode-long-text | Inspect/edit/export/restore the long multilingual note | EUR 0.29 left, text preserved literally, no script execution, no sideways scrolling on phone. |
| D06 | 02-clean-budget | On disposable demo data only: Delete everything; type wrong confirmation, Cancel; then reopen and type DELETE | Wrong confirmation cannot delete. Cancel preserves data. Exact confirmation clears data and opens setup. Restore any valid file to recover the demo. |

## Offline and device checks

Use a production build: service workers are disabled in `npm run dev`. On a desktop run `npm run build`, then `npx next start -p 3100` and open http://localhost:3100. For a phone run `npm run start:https`, which builds and serves over HTTPS on port 3443 after the one-time `npm run cert:https` ([setup in the main README](../../README.md#try-it-on-your-iphone-https-on-your-own-wi-fi)). Never start `next start` on port 3000: its service worker would then sit in front of `next dev` there. Open online and allow caching to finish before disconnecting.

- [ ] Restore 02, disconnect, reload Home, navigate Entries/Charts/Tips/Settings. Screens open from cache.
- [ ] Add an offline expense, reload and reconnect. Exactly one saved entry remains; cached/manual exchange rates remain usable.
- [ ] For missing-rate case 07, disconnect **before restoring**; otherwise startup may fetch a real INR rate. Restoring replaces any earlier cached rate rows too.
- [ ] On a phone: normal portrait width, zoom, long notes, expanded transfer form and 12-month charts fit without horizontal scrolling. Buttons and form labels remain accessible.
- [ ] Keyboard: Tab through navigation, forms and chart links, activate with Enter/Space, inspect visible focus and validation.
- [ ] iPhone: install from Safari to Home Screen, then set up/restore inside the installed app. Safari and the installed app may have separate data. Offline phone testing needs HTTPS, not a plain LAN HTTP address.

## Dates, coverage and regenerating

These files cover the current backup validator's refusal branches and major app workflows; a finite fixture pack cannot cover every browser, network failure, concurrency race or possible input. Browser confirmation/share-sheet behavior, Sunday/month-boundary/midnight transitions, recurring day-31 clipping and future schedule occurrences require the relevant device/date or the repo's existing Playwright/unit tests. No system-clock changes are needed for the normal demo.

Home and Check-in use the device's current day; the table at the top says which expectations depend on it. The realistic demo intentionally retains future-dated purchases in its current month. Rates are fictional manual values, never market quotes. Missing-rate checks require offline mode; live ECB results are variable.

Regenerate for another demonstration day with Node 24, into a temp or git-ignored folder so the committed snapshot stays as it is:

```powershell
node scripts/generate-demo-fixtures.mjs --date 2026-11-12 --out "$env:TEMP/studentsbudget-demo"
$env:DEMO_FIXTURES_DIR = "$env:TEMP/studentsbudget-demo"
npx vitest run src/features/backup/demo-fixtures.test.ts
Remove-Item Env:DEMO_FIXTURES_DIR
```

Restore the files from that folder; its CASES.md is the date authority, and this guide stays on 21-10-2026. `--date` defaults to today in Europe/Berlin. `--out` defaults to the repository's `fixtures/manual-demo/`, so leaving it out rewrites the tracked files. Do that only to refresh the snapshot itself: run it with `--date`, update the date and the table at the top of this guide, run the test without `DEMO_FIXTURES_DIR` and commit. The generator first deletes the `.json` files in the output's `valid/` and `invalid/` folders, so renamed files leave nothing stale; the same `--date` always produces identical files. It reads the repo's category and discount catalogs. Verification checks real parser results, balances, envelopes, currency totals, chart totals, IndexedDB restores, recurring idempotency and badge outcomes. It does not certify that browser interactions were manually performed.
