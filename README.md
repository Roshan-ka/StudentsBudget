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
**Fixed costs and income.** Rent, your income and other fixed costs can be added for you on their day. Leave "Add it automatically" on in setup, or change it later under Settings, then Fixed costs and income, where you can also pause, resume and edit a line. If the app was closed on that day, the entry is added the next time you open it. These entries are tagged "Recurring" in Entries. Don't log them by hand as well, or they count twice.

**Home.** The big number is what is left to spend this month across your envelopes, with a "This week" line under it. Going over reads as "€12 over". A suggested budget (an amount per category, from last month's spending or from typical Regensburg costs) leads in the first week of the month, or when your envelopes add up to more than what is available. Otherwise it waits behind "See a suggested budget". "Use this budget" changes your envelopes only.

**Charts.** Spending by category and income by source open as a donut. Switch each chart to Bars or Table. "Saved each month" and a category over time show Columns, Line or Table. One period selector (This month, 3, 6 or 12 months) applies to all of them, and the month switcher moves where the period ends. A tap on a slice, bar or column opens those entries.

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
- `npm run test:e2e`: end-to-end tests (Playwright, desktop Chrome and iPhone WebKit); starts the dev server if none is running. `E2E_PORT=3001 npm run test:e2e` uses another port, for a second checkout.
- `npm run test:offline`: production build, then the offline check on http://localhost:3100 (Playwright, desktop Chrome)
- `npm run typecheck`: TypeScript check
- `npm run lint`: ESLint

Playwright needs its browsers once: `npx playwright install chromium webkit`.
