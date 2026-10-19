# StudentsBudget
Budget app for students new to a city: see where your money goes across all your accounts and cash, check whether your budget is realistic for your city, and log spending in seconds. Installable web app; data stays on your phone.

## What it is
StudentsBudget helps you through your first months in a new city. You set up your rent, your income and your accounts once, for example a local bank, a bank back home and some cash. The app compares your plan with typical costs in Regensburg, the only city it knows so far.

After that you log spending in a few seconds, with a line like "döner 6". The home screen shows how much is safe to spend this week. Charts show where the money went. On Sundays, a short check-in looks back at the week.

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

## Privacy
- Your data stays in this browser's IndexedDB, on this device. There is no server copy.
- There is no login, no analytics and no third-party scripts. The fonts come from the app itself.
- The only outgoing request is to `api.frankfurter.dev`, for exchange rates. It names the foreign currencies your accounts use. It carries none of your entries or amounts. Like any web request, it shows your IP address to that service.
- A backup file is a plain JSON file that you keep. The app never uploads it. Anyone who has the file can read your data, so keep it somewhere you trust.
- Clearing the site's data in your browser, or removing the app, deletes your data. Export a backup regularly: Settings, then Backup, then Export backup. To get your data back, choose the file under Restore from a backup, in Settings or on the setup screen.

## Try a demo backup

Download [the demo backup](fixtures/studentsbudget-demo-2026-10.json) (use **Download raw file** on GitHub). It contains fictional data for September and October 2026: 3 accounts (EUR bank, INR bank and EUR cash), 47 entries, all 18 categories, a budget, initial spending guesses and a manual exchange rate of INR 95 per EUR.

1. Export your existing data first if you want to keep it. Restoring replaces everything on this browser/device.
2. On the setup screen, or in **Settings → Backup**, choose the JSON under **Restore from a backup → File to restore**.
3. Confirm with **Yes**. The app returns to the home screen with the restored budget.
4. Explore **Entries**, **Charts**, **Settings** (accounts and exchange rates), and the weekly check-in. October shopping is deliberately over budget. Try adding an expense, then exporting and restoring your own backup.

Immediately after restore, account balances should be **EUR 1,680.22** (local bank), **INR 170,050.00** (home bank), and **EUR 143.00** (cash). At the saved manual rate, the combined balance is **EUR 3,613.22** (home rounds to EUR 3,613). Transfers affect account balances but do not count as spending or income in charts.

The demo dates are fixed: October 2026 has current spending; select September or October in Charts if you try this later. Home and check-in always use your device's current date, so their figures change over time. The INR rate is fictional test data, not a current market quote.

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
- `npm run test:e2e`: end-to-end tests (Playwright, desktop Chrome and iPhone WebKit)
- `npm run test:offline`: production build, then the offline check on http://localhost:3100 (Playwright, desktop Chrome)
- `npm run typecheck`: TypeScript check
- `npm run lint`: ESLint

Playwright needs its browsers once: `npx playwright install chromium webkit`.
