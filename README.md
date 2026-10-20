# StudentsBudget
Budget app for students new to a city: see where your money goes across all your accounts and cash, check whether your budget is realistic for your city, and log spending in seconds. Installable web app; data stays on your phone.

## What it is
StudentsBudget helps you through your first months in a new city. You set up your rent, your income and your accounts once, for example a local bank, a bank back home and some cash. The app compares your plan with typical costs in Regensburg, the only city it knows so far.

After that you log spending in a few seconds, with a line like "döner 6". The home screen shows how much is left to spend this month, and under it how much is safe to spend this week. Charts show where the money went. On Sundays, a short check-in looks back at the week.

There is no account to create. Everything is stored on your device.

## Install on iPhone
Install the app first, then set up. A Safari tab and the Home Screen app keep their data apart, so anything you enter in Safari stays in Safari.

1. Open the app's web address in Safari.
2. Tap Share, then Add to Home Screen.
3. Open the app from the Home Screen and set it up there.

On desktop Chrome, use the install icon at the right end of the address bar.

## Using it offline
Open the app once while you are online after each update. From then on it opens with no connection, and you can keep logging spending.

Exchange rates need a connection to refresh. Offline, the app shows the last rates it saved, each with the date it is from (Settings, then Exchange rates).

## Using the app
**Fixed costs and income.** Rent, your income and other fixed costs can be added for you on their day. Leave "Add it automatically" on in setup, or change it later under Settings, then Fixed costs and income, where you can also pause, resume and edit a line. A new or resumed line starts the next day, and setup and Settings say when its first entry comes. If the app was closed on that day, the entry is added the next time you open it. These entries are tagged "Recurring" in Entries. Don't log them by hand as well, or they count twice.

**Home.** The big number is what is left to spend this month across your envelopes, with a "This week" line under it. Going over reads as "€12 over". A suggested budget (an amount per category, from last month's spending or from typical Regensburg costs) leads in the first week of the month, or when your envelopes add up to more than what is available. Otherwise it waits behind "See a suggested budget". "Use this budget" changes your envelopes only.

**Charts.** Spending by category and income by source open as a donut. Switch each chart to Bars or Table. "Saved each month" and a category over time show Columns, Line or Table. One period selector (This month, 3, 6 or 12 months) applies to all of them, and the month switcher moves where the period ends. On This month, the two over-time charts show the last 6 months up to that month instead. A tap on a slice, bar or column opens those entries (except "Everything else"). For a 3, 6 or 12-month period, a slice or bar opens the entries of the period's end month, and a column opens its own month.

**Dates.** Full dates read DD-MM-YYYY. When you add or edit an entry, Today and Yesterday are one tap away.

## Privacy
- Your data stays in this browser's IndexedDB, on this device. There is no server copy.
- There is no login, no analytics and no third-party scripts. The fonts come from the app itself.
- The only outgoing request is to `api.frankfurter.dev`, for exchange rates. It names the foreign currencies your accounts use. It carries none of your entries or amounts. Like any web request, it shows your IP address to that service.
- A backup file is a plain JSON file that you keep. The app never uploads it. Anyone who has the file can read your data, so keep it somewhere you trust.
- Clearing the site's data in your browser, or removing the app, deletes your data. Export a backup regularly: Settings, then Backup, then Export backup. To get your data back, choose the file under **Restore from a backup** in Settings, or under **Have a backup? Restore it** at the bottom of the setup screen. The app names the file and says when it was saved and what it holds, then asks you to confirm **Replace all data**.

## Try a demo backup

Download [the demo backup](fixtures/studentsbudget-demo-2026-10.json) (use **Download raw file** on GitHub). It contains fictional data for September and October 2026: 3 accounts (EUR bank, INR bank and EUR cash), 47 entries, a budget, initial spending guesses and a manual exchange rate of INR 95 per EUR. The file has 18 categories; the app fills them up to its 26 when it opens after the restore.

1. Export your existing data first if you want to keep it. Restoring replaces everything on this browser/device.
2. On the setup screen (**Have a backup? Restore it**, at the bottom), or in **Settings → Backup → Restore from a backup**, choose the JSON under **File to restore**.
3. The app asks "Replace all data with studentsbudget-demo-2026-10.json?" and shows when the file was saved and what it holds, for example "Saved 19-10-2026, 12:00 · 3 accounts · 47 entries" (the time is in your device's time zone). Confirm with **Replace all data**. The app returns to the home screen with the restored budget.
4. Explore **Entries**, **Charts**, **Settings** (accounts and exchange rates), and the weekly check-in. October shopping is deliberately over budget. Try adding an expense, then exporting and restoring your own backup.

Immediately after restore, account balances should be **EUR 1,680.22** (local bank), **INR 170,050.00** (home bank), and **EUR 143.00** (cash). At the saved manual rate, the combined balance is **EUR 3,613.22** (home rounds to EUR 3,613). Transfers affect account balances but do not count as spending or income in charts.

The demo dates are fixed: October 2026 has current spending; if you try this later, move the month switcher in Charts back to September or October. The fixed costs and income in the demo plan are not set to be added automatically, so nothing new appears by itself. Home and check-in always use your device's current date, so their figures change over time. The INR rate is fictional test data, not a current market quote.

### More demo scenarios

These **version 2** files target the current app, including recurring bills. Download the raw JSON, then restore one file at a time using the steps above. Each restore replaces the previous scenario. All names, amounts and exchange rates are fictional. The files are anchored to **20 October 2026**; Home, check-in, recurring posting and reveal follow the device clock.

| File | What to test |
| --- | --- |
| [01 — Everyday and 12-month history](fixtures/scenarios/01-everyday-and-12-month-history.json) | 744 entries from November 2025 through October 2026, all 26 categories, six income sources, cash withdrawals and varied spending. Check 1/3/6/12-month charts, every chart style, category filters, chart-to-entry links, saved amounts, completed-month recaps and the unlocked guess comparison. |
| [02 — Overspent and overdrawn](fixtures/scenarios/02-overspent-and-overdrawn.json) | Negative bank balance, food/shopping overspending, spending against a zero envelope and a one-cent expense. Check “over” amounts, negative savings, rounding, and the suggested budget when planned spending exceeds income. |
| [03 — New student mid-month](fixtures/scenarios/03-new-student-mid-month.json) | Setup on 20 October, an expense before setup, rent before setup, today's spending and a one-off due this month. Check prorated envelopes, exclusion of earlier flexible spending, fixed-cost inclusion, the locked guess comparison and budget suggestions. |
| [04 — All currencies and transfers](fixtures/scenarios/04-all-currencies-and-transfers.json) | EUR, INR, USD, GBP, CHF, CNY and TRY accounts, a EUR 10 equivalent expense in each, manual and cached ECB rates, and two cross-currency transfers. Each account starts with EUR 1,000 equivalent; combined balance is **EUR 6,930** at the manual rates. Check original-currency amounts, conversion and transfers excluded from spending/income. Try “Use ECB rate again” in Settings; totals then change. |
| [05 — Missing exchange rate](fixtures/scenarios/05-missing-exchange-rate.json) | The same accounts with no TRY rate. **Go offline before restoring** to keep the missing-rate state: online refresh can supply it. The combined balance excludes TRY and is **EUR 5,940** at saved manual rates. Existing TRY spending still has its saved EUR value. Enter a manual TRY rate of 38 to restore the full total and allow new TRY spending. |
| [06 — Recurring due, paused and blocked](fixtures/scenarios/06-recurring-due-paused-and-blocked.json) | Monthly parents/rent, weekly Monday wages, paused insurance, a day-31 phone bill, and a CHF scholarship blocked by a missing rate. Go offline before restore to keep CHF blocked. On 20 October, startup adds five entries (three wages, parents, rent) alongside the one manual entry. Reload: no duplicates. Set CHF to 0.95 per EUR and reload to post the scholarship. Resume insurance and inspect its next occurrence. Phone is first due 31 October; in a shorter month day 31 clips to the last day. |
| [07 — Plan without transactions](fixtures/scenarios/07-plan-with-no-transactions.json) | A saved plan and balances with no entries. Check empty Entries, Charts and check-in, then add your first expense using Quick add and a second through Add entry. |
| [08 — Empty start-over](fixtures/scenarios/08-empty-start-over.json) | No plan, accounts or entries; built-in categories remain. Restore returns to setup. Walk through every setup step, set guesses, add accounts and one-offs, and save a new plan. |

After loading a populated scenario, also try editing and deleting an entry, adding/editing an account, recording a transfer, changing a budget envelope, exporting, and restoring that export. Cancel a restore and verify the current data stays in place. Use the weekly check-in's calendar download to test its reminder. Installation and offline behavior require separate browser/device checks: open a production build online once, then disconnect and log spending; a JSON file cannot install the app or service worker.

The files in [scenarios/invalid](fixtures/scenarios/invalid) are **intentional rejection tests**: [missing account](fixtures/scenarios/invalid/01-missing-account.json), [newer app version](fixtures/scenarios/invalid/02-newer-version.json), and [duplicate entry ID](fixtures/scenarios/invalid/03-duplicate-entry.json). Each should show an error without offering restore confirmation or changing your existing data.

To refresh all these scenarios for a later day, run `node scripts/generate-demo-backups.mjs YYYY-MM-DD` with Node 24 (omit the date to use today's local date). This overwrites only `fixtures/scenarios/`; the original version 1 demo stays intact. Date-dependent expectations above assume 20 October 2026; after regeneration, check-in weeks, recurring occurrence counts and reveal dates follow the new date.

## Try it on your iPhone (HTTPS on your own Wi-Fi)
Offline use needs a service worker, and a service worker only runs on a secure address: HTTPS, or localhost. A plain-HTTP address such as `http://192.168.0.137:3100` is not secure, so the app cannot be tested offline on a phone that way. For a developer who wants to try the production build on a real iPhone, this serves it over HTTPS on your own Wi-Fi, with a certificate the phone trusts.

1. On the PC, install mkcert (`winget install FiloSottile.mkcert`) and run `mkcert -install` once.
2. Run `npm run cert:https`. It writes `certs/studentsbudget.pem` and `certs/studentsbudget-key.pem` for localhost, this PC's private IP addresses and its `.local` name, and prints the folder of the mkcert root certificate (`mkcert -CAROOT`). It never runs `mkcert -install` for you.
3. Get the root certificate onto the iPhone: `rootCA.pem` in the printed `mkcert -CAROOT` folder, by email to yourself or through iCloud/OneDrive. Open it, then Settings → General → VPN & Device Management → install the profile. Then Settings → General → About → Certificate Trust Settings → turn on full trust for mkcert.
4. Run `npm run start:https` and open the printed `https://…:3443` address in Safari. It builds first, so the offline copy matches the commit. `HTTPS_PORT`, `HTTPS_CERT` and `HTTPS_KEY` change the port (3443 by default) and the certificate files. When you run it, Windows may ask whether Node may use the network: allow it on the private network.
5. Tap Share, then Add to Home Screen. Open the app from the Home Screen while you are still online and set it up there (see Install on iPhone: the Home Screen app keeps its own data). Then try airplane mode.

**Keep the address stable.** The app's data belongs to the exact address (https, host and port). A new IP address or port means an empty app. Reserve the PC's IP address in your router, or use the `.local` name, and export a backup before you change the address. The certificate covers the addresses the PC had when you ran `npm run cert:https`. If its IP changes, run it again. The `.local` name works only if the phone can resolve it; try it once before relying on it.

**Safety.** The mkcert root lets this PC vouch for any site on that phone. Keep `rootCA-key.pem` private, and remove the profile from the phone when the testing is over (Settings → General → VPN & Device Management).

## Project notes
`docs/` is an Obsidian vault (open the folder as a vault). Read in this order:

1. [Student Budget App](docs/Student%20Budget%20App.md): the idea, research and risks
2. [Concept](docs/Student%20Budget%20App%20-%20Concept.md): what the app does, phases, and the P1 scope
3. [Tech Stack](docs/Student%20Budget%20App%20-%20Tech%20Stack.md): stack choice, alternatives, learning path
4. [Repo Setup](docs/Student%20Budget%20App%20-%20Repo%20Setup.md): GitHub settings checklist
5. [Kickoff](docs/Student%20Budget%20App%20-%20Kickoff.md): repo layout and how a build day runs
6. [P1 plan](docs/superpowers/plans/2026-10-16-p1-test-project.md): the 4-day build plan, task by task

## Development
Needs Node 24 and npm. Run `npm install` once, then:

- `npm run dev`: start the app on http://localhost:3000
- `npm run build`: production build
- `npm test`: unit tests (Vitest)
- `npm run test:e2e`: end-to-end tests (Playwright, desktop Chrome and iPhone WebKit); starts the dev server if none is running. `E2E_PORT=3001 npm run test:e2e` (PowerShell: `$env:E2E_PORT=3001; npm run test:e2e`) uses another port, for a second checkout.
- `npm run test:offline`: production build, then the offline check on http://localhost:3100 (Playwright, desktop Chrome)
- `npm run cert:https`, then `npm run start:https`: the production build over HTTPS for a phone on your Wi-Fi (see Try it on your iPhone)
- `npm run typecheck`: TypeScript check
- `npm run lint`: ESLint

Playwright needs its browsers once: `npx playwright install chromium webkit`.
