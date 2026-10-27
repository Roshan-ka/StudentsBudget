# Upload file inventory

Generated for **21-10-2026**, demo month **October 2026**. Dates inside the files and the figures below follow that day; the guide says how long each stays valid.

Read [the manual test guide](README.md) first. Only files in valid/ and invalid/ are app imports; manifest.json is verification metadata.

## Accepted files

### [01-everyday-student.json](valid/01-everyday-student.json)

Realistic two-month demo with 47 entries and three accounts.

Before automatic processing: **3 accounts · 47 entries** · envelope remainder €138.10.

Account balances: Local bank (demo): €1,680.22; Home bank (demo): ₹170,050.00; Cash (demo): €143.00.

- [ ] Open Home, Entries, Charts and Settings. Shopping is over budget in the demo month.
- [ ] Balances: local EUR 1,680.22; home INR 170,050.00; cash EUR 143.00. Combined EUR 3,613.22 at the fictional manual rate INR 95 per EUR.
- [ ] Dates moved to the demo month, but this file can include purchases later than today. Entries and monthly totals include those dates.

### [02-clean-budget.json](valid/02-clean-budget.json)

Clean starting point for entering expenses, income and transfers.

Before automatic processing: **2 accounts · 0 entries** · envelope remainder €500.00.

Account balances: Demo EUR bank: €1,000.00; Demo cash: €100.00.

- [ ] Home: EUR 500 left this month. Settings: bank EUR 1,000; cash EUR 100; combined EUR 1,100.
- [ ] Home on 21-10-2026: "This week: €250 safe to spend", and "This week: €240 safe to spend" after EUR 10 of Food. The week figure changes with the date.
- [ ] Quick add demo-snack 6, choose Eating out, then demo-snack 4: second entry remembers the category. Undo within 10 seconds removes only the EUR 4 entry.
- [ ] Quick add defaults to the EUR bank. Edit the EUR 6 entry to EUR 7.50; exactly one entry remains. Cancel a deletion, then confirm it.

### [03-overspent-swaps.json](valid/03-overspent-swaps.json)

Overspending, negative remaining money and saving suggestions.

Before automatic processing: **2 accounts · 4 entries** · envelope remainder -€60.00.

Account balances: Demo EUR bank: €440.00; Demo cash: €100.00.

- [ ] Home: EUR 60 over this month. Food EUR 50 over; Eating out EUR 40 over; Shopping EUR 40 over; Transport EUR 10 over.
- [ ] Open the Eating out Try this suggestion: sources and saving explanation appear. Check-in also reviews the overspent categories.

### [04-zero-budget.json](valid/04-zero-budget.json)

All amounts zero; empty charts and no earned badges.

Before automatic processing: **2 accounts · 0 entries** · envelope remainder €0.00.

Account balances: Demo EUR bank: €0.00; Demo cash: €0.00.

- [ ] Home shows EUR 0, never NaN or Infinity. Charts explain the empty data. Adding EUR 1 spending is allowed and makes the month EUR 1 over.

### [05-overdrawn-accounts.json](valid/05-overdrawn-accounts.json)

Negative balances are valid and distinct from the envelope budget.

Before automatic processing: **2 accounts · 1 entry** · envelope remainder €485.00.

Account balances: Demo EUR bank: -€50.00; Demo cash: -€5.00.

- [ ] Settings: bank -EUR 50; cash -EUR 5; combined -EUR 55. Home still has EUR 485 left in envelopes.

### [06-all-currencies.json](valid/06-all-currencies.json)

All seven supported currencies with stable fictional manual rates.

Before automatic processing: **8 accounts · 2 entries** · envelope remainder €480.00.

Account balances: Demo EUR bank: €1,000.00; Demo cash: €100.00; Demo INR: ₹8,550.00; Demo USD: US$112.50; Demo GBP: £80.00; Demo CHF: CHF 100.00; Demo CNY: CN¥800.00; Demo TRY: TRY 4,000.00.

- [ ] Combined balance EUR 1,680; Home EUR 480 left. Both imported foreign expenses count as EUR 10, even after a rate change.
- [ ] Add INR 950 through the full expense form: EUR 10 spending at INR 95 per EUR. Manual INR 0 is refused; 100 is accepted and affects future conversions and account totals.
- [ ] Use ECB rate again only after checking the manual case: live market values are deliberately not fixed expectations.

### [07-missing-exchange-rate.json](valid/07-missing-exchange-rate.json)

Foreign account without any saved rate; test OFFLINE.

Before automatic processing: **1 account · 0 entries** · envelope remainder €500.00.

Account balances: INR bank without rate: ₹9,500.00.

- [ ] Load/cache the production app first. Go offline before restoring this file so a live rate cannot fill the gap.
- [ ] The account shows INR 9,500. Combined balance shows a dash and names the missing INR rate. A foreign expense cannot save until a rate exists.
- [ ] Set a manual INR rate of 95 in Settings. Combined balance becomes EUR 100 and INR 95 spending converts to EUR 1.

### [08-recurring-due-and-paused.json](valid/08-recurring-due-and-paused.json)

Three occurrences due on the generation date; one paused.

Before automatic processing: **2 accounts · 0 entries** · envelope remainder €500.00.

Account balances: Demo EUR bank: €1,000.00; Demo cash: €100.00.

- [ ] On the demo date, restore then open Entries: Parents EUR 1,200 income, Job EUR 50 income, Rent EUR 450 expense appear with Recurring tags; no Phone entry.
- [ ] After posting: bank EUR 1,800; cash EUR 100; combined EUR 1,900. Envelope money stays EUR 500.
- [ ] Reload twice: exactly three entries remain. Settings lets you pause, resume and edit schedules; resuming starts from the next day, without backfilling the pause.

### [09-twelve-months-all-categories.json](valid/09-twelve-months-all-categories.json)

Twelve populated months, every spending category, income and transfers.

Before automatic processing: **2 accounts · 264 entries** · envelope remainder €422.00.

Account balances: Demo EUR bank: €15,148.00; Demo cash: €340.00.

- [ ] This month spending EUR 201; income EUR 1,400; saved EUR 1,199. Twelve months: spending EUR 2,412; income EUR 16,800; saved EUR 14,388.
- [ ] Try Donut/Bars/Table, Columns/Line/Table and 1/3/6/12-month ranges. The donut groups small categories into Everything else.
- [ ] Tap a category or time column to open matching entries. Everything else has no drill-down. Multi-month category drill-down opens the end month.
- [ ] The EUR 20 monthly transfers move balances without increasing chart income or spending. Check narrow phone layout and keyboard navigation.

### [10-badges-bronze.json](valid/10-badges-bronze.json)

6 recorded under-budget weeks; bronze tier and all four badges.

Before automatic processing: **2 accounts · 14 entries** · envelope remainder €485.00.

Account balances: Demo EUR bank: €783.00; Demo cash: €100.00.

- [ ] Badges: Under-Budget Week bronze, Logging Streak earned, Ramen Royalty earned, Latte Survivor earned.
- [ ] Saved weeks represent historical EUR 100 weekly allowances; changing today's plan does not rewrite those records.

### [11-badges-silver.json](valid/11-badges-silver.json)

12 recorded under-budget weeks; silver tier and all four badges.

Before automatic processing: **2 accounts · 26 entries** · envelope remainder €485.00.

Account balances: Demo EUR bank: €690.00; Demo cash: €100.00.

- [ ] Badges: Under-Budget Week silver, Logging Streak earned, Ramen Royalty earned, Latte Survivor earned.
- [ ] Saved weeks represent historical EUR 100 weekly allowances; changing today's plan does not rewrite those records.

### [12-badges-gold.json](valid/12-badges-gold.json)

26 recorded under-budget weeks; gold tier and all four badges.

Before automatic processing: **2 accounts · 54 entries** · envelope remainder €485.00.

Account balances: Demo EUR bank: €333.00; Demo cash: €100.00.

- [ ] Badges: Under-Budget Week gold, Logging Streak earned, Ramen Royalty earned, Latte Survivor earned.
- [ ] Saved weeks represent historical EUR 100 weekly allowances; changing today's plan does not rewrite those records.

### [13-away-week.json](valid/13-away-week.json)

An earned streak with a recorded away week and a current away mark.

Before automatic processing: **2 accounts · 14 entries** · envelope remainder €485.00.

Account balances: Demo EUR bank: €783.00; Demo cash: €100.00.

- [ ] Check-in: I was away this week is selected. Badges: streak is paused; away weeks do not count toward Under-Budget Week or grocery records. Toggle off and reload: the current mark stays off.

### [14-fresh-setup.json](valid/14-fresh-setup.json)

Accepted empty backup to demonstrate onboarding.

Before automatic processing: **0 accounts · 0 entries**.

- [ ] Restore returns to setup, with no plan or accounts. Complete the wizard on a phone-sized screen.
- [ ] Try blank/zero amounts, invalid text, Back/Next, city cost sources and suggested envelopes. Save a valid plan; reopening setup should not create a second one.

### [15-setup-date-boundary.json](valid/15-setup-date-boundary.json)

Spending before setup affects balances but not the setup month's envelopes.

Before automatic processing: **2 accounts · 2 entries** · envelope remainder €480.00.

Account balances: Demo EUR bank: €970.00; Demo cash: €100.00.

- [ ] Home has EUR 480 left. Combined accounts EUR 1,070: both purchases affect balances.
- [ ] Charts for the demo month count only EUR 20 of grocery spending. On the first of a month, the earlier EUR 10 belongs to the previous month instead.
- [ ] Check-in lists a pre-setup purchase with an exclusion note when it falls in the displayed week; otherwise find it through Entries.

### [16-one-off-reserves.json](valid/16-one-off-reserves.json)

Past, current and future due months.

Before automatic processing: **2 accounts · 0 entries** · envelope remainder €500.00.

Account balances: Demo EUR bank: €1,000.00; Demo cash: €100.00.

- [ ] Edit plan keeps all three costs and remains saveable. Plan summary sets aside EUR 50 this month, leaving EUR 650 available after fixed costs; envelope total remains EUR 500. One-off reserves do not create transactions by themselves.

### [17-cents-unicode-long-text.json](valid/17-cents-unicode-long-text.json)

One-cent precision, multilingual text, long notes and literal markup.

Before automatic processing: **2 accounts · 1 entry** · envelope remainder €0.29.

Account balances: Demo EUR bank: €999.99; Demo cash: €100.00.

- [ ] Home shows EUR 0.29 left, with cents retained. Bank EUR 999.99. Note displays as text, including the script characters; no alert executes. Edit/reload/export/restore preserve the note. Phone view has no sideways scrolling.

### [18-default-cash-account.json](valid/18-default-cash-account.json)

Explicit default cash overrides the automatic EUR bank choice.

Before automatic processing: **2 accounts · 0 entries** · envelope remainder €500.00.

Account balances: Demo EUR bank: €1,000.00; Demo cash: €100.00.

- [ ] Quick add demo-default 6 and choose a category. Cash becomes EUR 94; bank stays EUR 1,000. Set bank as default in Settings and add demo-default 4: bank becomes EUR 996; cash stays EUR 94.

### [19-profile-discount-feedback.json](valid/19-profile-discount-feedback.json)

Profile, semester dates and saved feedback on real catalog IDs.

Before automatic processing: **2 accounts · 0 entries** · envelope remainder €500.00.

Account balances: Demo EUR bank: €1,000.00; Demo cash: €100.00.

- [ ] Home greets Alex Demo. Settings contains the university and both semester dates. Change the name, save and reload.
- [ ] Tips > Discounts: Asia Restaurant Sunrise is marked Still works; Mensa Uni Regensburg is marked as no longer working and sorted behind working offers. Change feedback, filter a category and reload.
- [ ] Semester dates allow a next-semester-fee offer in Edit plan. A published amount depends on the bundled semester catalog; do not expect a quote for every future semester.
- [ ] Profile form refuses reversed or partially filled semester dates. Clear both dates to save without a semester.

### [20-exactly-exhausted.json](valid/20-exactly-exhausted.json)

Every nonzero envelope is spent exactly to its limit.

Before automatic processing: **2 accounts · 6 entries** · envelope remainder €0.00.

Account balances: Demo EUR bank: €500.00; Demo cash: €100.00.

- [ ] Home: EUR 0 left this month, with no negative-zero display. Add EUR 0.01 Food spending: the month becomes EUR 0.01 over.

### [21-income-below-fixed-costs.json](valid/21-income-below-fixed-costs.json)

A plan with EUR 100 income, EUR 500 fixed and EUR 500 envelopes.

Before automatic processing: **2 accounts · 0 entries** · envelope remainder €500.00.

Account balances: Demo EUR bank: €1,000.00; Demo cash: €100.00.

- [ ] The plan still restores and can be edited. Suggested budget explains that nothing is available and suggests EUR 0 everywhere, so Use this budget is disabled. Type an amount into one envelope, then press Use this budget: only the envelopes change; income, fixed costs, account balances and entries stay as they were.

### [22-legacy-version-1.json](valid/22-legacy-version-1.json)

Version 1 compatibility and missing built-in categories.

Before automatic processing: **2 accounts · 0 entries** · envelope remainder €500.00.

Account balances: Demo EUR bank: €1,000.00; Demo cash: €100.00.

- [ ] Restore succeeds; the app supplies all 26 built-in categories. Profile and votes are empty. Export produces a current version 3 backup.

### [23-legacy-version-2.json](valid/23-legacy-version-2.json)

Version 2 compatibility and missing built-in categories.

Before automatic processing: **2 accounts · 0 entries** · envelope remainder €500.00.

Account balances: Demo EUR bank: €1,000.00; Demo cash: €100.00.

- [ ] Restore succeeds; the app supplies all 26 built-in categories. Profile and votes are empty. Export produces a current version 3 backup.

### [24-unknown-extra-fields.json](valid/24-unknown-extra-fields.json)

Unknown object fields are ignored for forward-compatible additions.

Before automatic processing: **2 accounts · 0 entries** · envelope remainder €500.00.

Account balances: Demo EUR bank: €1,000.00; Demo cash: €100.00.

- [ ] Restore succeeds with the same values as 02-clean-budget. Export does not retain unknown fields.

## Rejected files

For each file: restore 02-clean-budget first, choose the invalid file, check the exact message below, and reload. No replacement confirmation should appear; bank EUR 1,000, cash EUR 100 and zero entries must remain unchanged.

| File | Expected message |
|---|---|
| [wrong-app.json](invalid/wrong-app.json) | This isn't a StudentsBudget backup file. |
| [newer-version.json](invalid/newer-version.json) | This backup is from a newer version of the app. |
| [missing-version.json](invalid/missing-version.json) | This backup file is incomplete. |
| [missing-exported-at.json](invalid/missing-exported-at.json) | This backup file is incomplete. |
| [missing-data.json](invalid/missing-data.json) | This backup file is incomplete. |
| [missing-data-accounts.json](invalid/missing-data-accounts.json) | This backup file is incomplete. |
| [missing-data-categories.json](invalid/missing-data-categories.json) | This backup file is incomplete. |
| [missing-data-entries.json](invalid/missing-data-entries.json) | This backup file is incomplete. |
| [missing-data-plan.json](invalid/missing-data-plan.json) | This backup file is incomplete. |
| [missing-data-guesses.json](invalid/missing-data-guesses.json) | This backup file is incomplete. |
| [missing-data-fx-rates.json](invalid/missing-data-fx-rates.json) | This backup file is incomplete. |
| [unsupported-version-zero.json](invalid/unsupported-version-zero.json) | This backup file is incomplete. |
| [version-is-text.json](invalid/version-is-text.json) | This backup file is incomplete. |
| [bad-export-timestamp.json](invalid/bad-export-timestamp.json) | This backup file is incomplete. |
| [unknown-currency.json](invalid/unknown-currency.json) | This backup file is incomplete. |
| [unknown-city.json](invalid/unknown-city.json) | This backup file is incomplete. |
| [rate-zero.json](invalid/rate-zero.json) | This backup file is incomplete. |
| [rate-negative.json](invalid/rate-negative.json) | This backup file is incomplete. |
| [bad-entry-date-2026-02-30.json](invalid/bad-entry-date-2026-02-30.json) | This backup file is incomplete. |
| [bad-entry-date-21-10-2026.json](invalid/bad-entry-date-21-10-2026.json) | This backup file is incomplete. |
| [fractional-minor-units.json](invalid/fractional-minor-units.json) | This backup file is incomplete. |
| [amount-is-text.json](invalid/amount-is-text.json) | This backup file is incomplete. |
| [entry-zero.json](invalid/entry-zero.json) | This backup file is damaged: an amount is zero or negative. |
| [entry-negative.json](invalid/entry-negative.json) | This backup file is damaged: an amount is zero or negative. |
| [entry-negative-euros.json](invalid/entry-negative-euros.json) | This backup file is damaged: an amount is negative. |
| [missing-entry-account.json](invalid/missing-entry-account.json) | This backup file is damaged: an entry uses an account that isn't in the file. |
| [missing-entry-category.json](invalid/missing-entry-category.json) | This backup file is damaged: an entry uses a category that isn't in the file. |
| [unknown-plan-category.json](invalid/unknown-plan-category.json) | This backup file is damaged: the plan or the guesses use an unknown category. |
| [negative-envelope.json](invalid/negative-envelope.json) | This backup file is damaged: an amount is negative. |
| [negative-spending-budget.json](invalid/negative-spending-budget.json) | This backup file is damaged: an amount is negative. |
| [missing-transfer-target.json](invalid/missing-transfer-target.json) | This backup file is damaged: a transfer goes to an account that isn't in the file. |
| [transfer-without-target-field.json](invalid/transfer-without-target-field.json) | This backup file is incomplete. |
| [transfer-received-zero.json](invalid/transfer-received-zero.json) | This backup file is damaged: an amount is zero or negative. |
| [duplicate-accounts.json](invalid/duplicate-accounts.json) | This backup file is damaged: two rows share the same id. |
| [duplicate-categories.json](invalid/duplicate-categories.json) | This backup file is damaged: two rows share the same id. |
| [duplicate-entries.json](invalid/duplicate-entries.json) | This backup file is damaged: two rows share the same id. |
| [duplicate-guesses.json](invalid/duplicate-guesses.json) | This backup file is damaged: two rows share the same id. |
| [duplicate-fx-rates.json](invalid/duplicate-fx-rates.json) | This backup file is damaged: two rows share the same id. |
| [duplicate-week-results.json](invalid/duplicate-week-results.json) | This backup file is damaged: two rows share the same id. |
| [duplicate-discount-votes.json](invalid/duplicate-discount-votes.json) | This backup file is damaged: two rows share the same id. |
| [duplicate-one-offs.json](invalid/duplicate-one-offs.json) | This backup file is damaged: two rows share the same id. |
| [duplicate-schedules.json](invalid/duplicate-schedules.json) | This backup file is damaged: two rows share the same id. |
| [schedule-missing-account.json](invalid/schedule-missing-account.json) | This backup file is damaged: a fixed cost or income uses an account that isn't in the file. |
| [schedule-day-32.json](invalid/schedule-day-32.json) | This backup file is damaged: a fixed cost or income has an impossible schedule. |
| [schedule-weekday-8.json](invalid/schedule-weekday-8.json) | This backup file is damaged: a fixed cost or income has an impossible schedule. |
| [schedule-watermark-before-start.json](invalid/schedule-watermark-before-start.json) | This backup file is damaged: a fixed cost or income has an impossible schedule. |
| [schedule-before-plan-start.json](invalid/schedule-before-plan-start.json) | This backup file is damaged: a fixed cost or income has an impossible schedule. |
| [schedule-frequency-daily.json](invalid/schedule-frequency-daily.json) | This backup file is incomplete. |
| [week-start-not-monday.json](invalid/week-start-not-monday.json) | This backup file is damaged: a saved week doesn't run from Monday to Sunday. |
| [week-end-not-sunday.json](invalid/week-end-not-sunday.json) | This backup file is damaged: a saved week doesn't run from Monday to Sunday. |
| [negative-week-amount.json](invalid/negative-week-amount.json) | This backup file is damaged: an amount is negative. |
| [negative-log-count.json](invalid/negative-log-count.json) | This backup file is incomplete. |
| [unknown-discount-vote.json](invalid/unknown-discount-vote.json) | This backup file is incomplete. |
| [unknown-university.json](invalid/unknown-university.json) | This backup file is incomplete. |
| [invalid-semester-date.json](invalid/invalid-semester-date.json) | This backup file is incomplete. |
| [one-off-zero.json](invalid/one-off-zero.json) | This backup file is damaged: an amount is zero or negative. |
| [one-off-invalid-month.json](invalid/one-off-invalid-month.json) | This backup file is incomplete. |
| [malformed-json.json](invalid/malformed-json.json) | This isn't a StudentsBudget backup file. |
