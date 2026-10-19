---
tags: [project-idea, concept]
created: 2026-10-16
---

# Student Budget App: Concept

See also: [[Student Budget App]] · [[Student Budget App - Tech Stack]] · [[2026-10-16-p1-test-project|P1 plan]] · [[Student Budget App - Kickoff]] · Newcomer City Guide (Personal Project Ideas vault)

Working name: **StudentsBudget** (not final).

## In one sentence
A budget app for students new to a city. It shows where their money really goes across all their accounts and cash, and whether their budget is realistic for that city. Later it suggests concrete swaps from local student discounts and tips.

## Why
- Bank apps take no effort, but each shows only one account. After moving abroad, spending is split between a home-country account, a local account and cash, so it's hard to see what's left.
- Spreadsheets die because entering every purchase feels like homework.
- Most students have only a rough idea of their spending, and it's usually way off.
- Even with a tracker (Expense Keep: Envelope Budget), you guess how much goes in each envelope. A student in a new country wants to know whether the budget is realistic for this city and what's safe to spend each week.

## The core moment
"Where did my money go, and what do I change?" Everything else feeds that answer. The sharpest version is **guess vs. reality**: setup asks what you think you spend, and later the app shows what you actually spent.

## Who it's for
- Students who have just moved to a new city or country.
- Rollout: me first, then 5–20 student friends in my city who give feedback. No open sign-up.
- Anyone with an account can read and post tips, because former students and locals know useful ways to save too.

## Goals
- A learning and portfolio project, built AI-first from idea through plan and code to PR.
- P1 is a working test project in 3–4 days, used by me on my phone.
- Logging a cash purchase takes under 10 seconds, typed or spoken.
- A budget that's realistic for my city, not a generic one.

## Not in v1
- bank or card connection
- more than one city
- venue or business accounts
- a real-time chat room
- App Store apps
- making money (affiliates, ads)
- online discount codes (UNiDAYS and Student Beans already cover them; link out instead)
- training or fine-tuning an AI model

## Failure even if it works
- Logging feels like homework, so people stop.
- The app rewards spending, or pushes deals over saving.
- The AI (once it arrives) states prices or advice it can't back up, or doesn't say where they came from.
- The app itself coaches drinking or other risky habits.
- Spending data leaks, or is used for anything except the person's own budget.
- Guilt-trip notifications or manipulative streaks.

## Phases

| Phase | Users | What's in |
|---|---|---|
| **P1: test project** (3–4 days, ≈ 25–35 h, no AI, data on the phone) | Me | Accounts with currencies, setup and plan, quick add (typed or dictated), home screen, charts, guess vs. reality, weekly check-in, backup and delete |
| **P2: friends and community** | 5–20 friends in my city | Login and sync, invites, verified badge, badges and milestones, discount list, hacks feed with manual moderation, weekly reminder, in-app mic button |
| **AI phase** | Me first, then friends | Setup chat, natural-language and voice entry, receipt scan, swaps, Ask chat, AI moderation and cited hacks. Integration discussed once P1 is in a good state. |
| **Later** | – | CSV statement import (first in line), bank and card connection, map view, venue accounts, more cities, a checklist of benefits students often miss, App Store apps, making money |

Recommendation: P2 before the AI phase, so the swaps have discounts and hacks to cite and the AI works on real data from friends. To be decided once P1 works.

## How it works
Each part is tagged with its phase.

### 1. Where the data lives
- **P1:** only on the phone, in the browser's storage. No login, no server. Nothing leaves the phone except the daily exchange-rate lookup.
  - The app must be installed on the home screen. On iPhone, Safari clears storage for websites that haven't been opened for 7 days, but installed apps are exempt.
  - "Export backup" saves everything as one file, and "Import backup" restores it. Losing the phone or clearing browser data otherwise loses the data.
- **P2:** email login (magic link) and a database in the EU. The P1 backup file is imported into the account, so nothing is lost.

### 2. Accounts and currencies (P1)
- Accounts such as home-country bank, local bank and cash, each in its own currency.
- Totals in euro, using a daily exchange rate from a free source, which I can override by hand.
- Moving money between my own accounts is a transfer, not spending.

### 3. Setup and the plan (P1)
- A step-by-step form:
  - city and rent
  - income per source: job, parents, BAföG, blocked-account (Sperrkonto) payout, scholarship
  - fixed costs: rent, phone, insurance, subscriptions, the semester ticket, gym, utilities and Rundfunkbeitrag
  - **P1.1:** each income source and fixed cost can repeat on its day, monthly on a day of the month or weekly on a weekday, into or out of a chosen account. The app adds it as an entry on that day, so rent and income no longer need logging by hand. Settings has a "Fixed costs and income" list to edit, pause or remove them.
  - big one-off costs: semester fee, insurance, flight home, winter jacket. Each gets a weekly set-aside, so no single month blows up.
  - **your guess per category**, asked before any envelope amounts ("What do you think you spend on eating out a month?"). Saved from day one, even if the guess vs. reality screen comes later.
  - envelope amounts
- **Realistic for the city without AI:**
  - Next to each envelope, the app shows what's typical for students in my city ("Students here: €200–260 for food"), with the source.
  - It warns when an amount is below that range, and when the plan adds up to more than income.
  - City numbers are seeded by hand inside the app, each with its source and date: rent range, Mensa meal, grocery basket, transport, a beer, club entry, gym. No Numbeo scraping.
- **AI phase:** setup becomes a 5-minute chat that proposes and explains the amounts.

### 4. Logging: quick add, typed or spoken
- **P1: manual entry**: amount, category, account, date, note. Edit and delete.
- **P1: quick add**
  - One text field: "döner 6". The number is the amount, the rest the note. The category comes from earlier entries with the same word; otherwise you pick one.
  - **Voice works from day one** through the mic on the phone keyboard. Quick add understands what dictation produces: "Döner 6 €", "€6", "6,50", "döner six euros".
- **P2:** a mic button in the app (the browser's built-in speech recognition) for one-tap entry. Support varies by browser, and Chrome sends the audio to Google for recognition, so the app says so the first time it's used.
- **AI phase:** natural sentences like "12 for pizza with Tom yesterday, paid cash", plus receipt scan for big grocery shops. A scanned receipt attaches to its matching entry instead of counting twice.
- **Later:** CSV statement import, then bank or card connection.

### 5. Home screen (P1, monthly since P1.1)
- **P1:** one number: **"Safe to spend this week: €63"**.
- **P1.1, after first use:** Home leads with the month:
  - **"Left to spend this month: €310"**, with one small line underneath: "This week: €63 safe to spend".
  - Envelopes read "€X left of €Y this month".
  - Below them: what's left across all accounts.
- **P1.1: suggested budget.** Home proposes envelope amounts from income minus fixed costs and set-asides. It starts from Regensburg's typical ranges, with their sources, or from last month's spending, and scales down when the money doesn't stretch. You edit the amounts and accept them. It's prominent in the first week of a month or when the plan is over budget. Guesses never change.

How the envelopes work:
1. The plan is monthly, because income arrives monthly.
2. Fixed costs come off first. They never count toward "safe to spend".
3. The set-asides for big one-off costs come off next.
4. The rest is split into flexible envelopes: food, eating out, going out, transport, shopping, other. P1.1 adds health and pharmacy, personal care, study materials, household, travel and gifts. Each envelope's monthly amount is spread evenly over the month's weeks.
5. Safe to spend this week = this week's share of the flexible envelopes + whatever was left from earlier weeks this month − what you've spent this week. Overspending lowers the coming weeks.
6. At month end, the leftover goes to savings or a goal, and the next month starts fresh.
7. The plan can't add up to more than income. The app warns and shows by how much.
8. Income that varies (a job with changing hours) is planned on a low estimate. Anything extra goes to savings.

### 6. Charts (P1)
- Spending by category for the month, against each envelope.
- Income by source for the month.
- Each category over the past months, to show whether a habit is changing.
- Tapping a category lists its entries.
- **P1.1:**
  - Spending and income open as a donut (the top 6 plus "Everything else"), with Bars (spent vs planned) and Table as alternatives.
  - One period applies to every chart: this month, 3, 6 or 12 months.
  - A "Saved each month" chart shows income minus expenses.
  - Full dates everywhere read DD-MM-YYYY. Date fields have Today and Yesterday shortcuts.

### 7. Weekly check-in (P1, Sunday, a few minutes)
- Confirm cash, catch anything you forgot, and see the week against the plan, with each envelope's over or under amount.
- **P1 reminder:** "Add to calendar" creates a weekly calendar event, which needs no server.
- **P2:** a proper reminder by push or email, once a week, never daily.
- **AI phase:** the check-in adds one or two swaps.

### 8. Guess vs. reality (P1)
- After 3–4 weeks of logging, each envelope shows "You guessed €80. It was €190."
- You then adjust the plan. After that it repeats as a short monthly recap.
- **Later, with CSV import:** import 1–3 months of past statements and see the reveal on day one.

### 9. Badges and milestones (P2)
- Personal ones first: Under-Budget Week, Logging Streak, Latte Survivor, Ramen Royalty, Second-Hand Saver.
- Community ones once the feed and discount list exist: Deal Detective, Hack Hero, Discount Explorer.
- Tiers, families and the full list are in [[Student Budget App]].
- Rules, also from that note:
  - Earned, never bought.
  - Never reward spending.
  - Trust criteria are published.
  - Streaks are weekly and can be paused; no punishment or manipulative design.
- **P1 already stores everything the personal badges need** (entries, weekly results), so they can be awarded backwards when P2 arrives.

### 10. Verified student badge (P2)
- Confirm a university email once. The badge shows next to your posts and discount confirmations.
- It expires after 12 months, so it marks *current* students.
- The domain is checked against a public list of university domains, then a confirmation link goes to that address. Afterwards only the domain and date are stored, not the address.
- The badge never restricts reading or posting.

### 11. Discounts in my city (P2)
- Local places only: cafés, restaurants, arcades, bowling, karting, clubs, group deals.
- Each entry has the place, address, what you get, conditions (student ID, days, times) and a category.
- I seed the list. Anyone can add an entry or press "still works" or "doesn't work anymore".
- Sorted by freshness: "Last confirmed 3 days ago by a verified student · 14 confirmations this semester". Entries unconfirmed for 8 weeks sink and get flagged.
- Facts only, no star ratings.
- A list first. The map view comes later.

### 12. Hacks feed (P2, AI parts later)
- **P2:**
  - Open to all accounts. A post has text, a city (or "anywhere"), a category (food, transport, going out, housing, study, subscriptions) and a date.
  - Buttons: upvote, "worked for me", "outdated", report. The verified badge shows next to the author.
  - I moderate reported posts by hand. With 5–20 friends, that's enough.
- **AI phase:**
  - When someone posts, the AI blocks spam, ads and harmful posts, adds city and category, and flags likely duplicates. It doesn't judge whether a price claim is true. Confirmations from students do that.
  - When it suggests swaps, it pulls the top-rated recent hacks for that city and category and links the post. No model training.

### 13. Swaps and Ask (AI phase)
- Where you're over budget, the AI suggests concrete changes:
  - habits: cook two more nights, eat at the Mensa instead of the café, get the Deutschlandticket instead of single tickets
  - cheaper versions of the same night out: student nights, free entry before 23:00, splitting a taxi
  - a discount from the city list or a hack from the feed, linked
- Ask: "Can I afford karting on Saturday?" It answers from your plan, your spending, the city numbers, the discounts and the hacks.
- Rules:
  - Every suggestion that rests on a price or a tip names its source.
  - The app doesn't coach drinking. Pre-drinking tips can exist as student posts in the feed, but the app doesn't recommend them.

## Privacy
- **P1:** the data never leaves the phone. "Delete everything" wipes it, and the backup file is the only copy outside the app.
- **From P2:**
  - data stored in the EU, and each person's spending visible only to them
  - "Export my data" and "Delete everything" buttons
- No bank logins in v1. Statement files (once CSV import exists) are deleted after reading.
- **AI phase:**
  - Account and card numbers are removed on the server before anything goes to the AI.
  - Receipt photos are deleted once read.

## P1 in build order
3–4 days at 8–9 h a day, built with Claude Code. The hours are rough, and first projects often run over.

| Day | Piece | Rough hours |
|---|---|---|
| 1 | TypeScript and React basics: the first half of the learning list in the tech-stack note; the rest is learned while building | 4 |
| 1 | Project set-up (stack A without Supabase), installable on the phone, deployed to a preview URL, browser storage | 3–4 |
| 2 | Accounts with currencies, exchange rate, transfers | 3–4 |
| 2 | Setup form: income, fixed costs, set-asides, guesses, envelopes with city ranges and warnings; seeding my city's numbers | 5–6 |
| 3 | Manual entry and quick add (typed and dictated), list, edit, delete | 3–4 |
| 3 | Home screen: safe to spend this week, envelopes; the calculation with tests | 4–5 |
| 4 | Charts | 2 |
| 4 | Guess vs. reality screen | 2–3 |
| 4 | Weekly check-in screen, calendar reminder | 1–2 |
| 4 | Backup export and import, delete everything | 1–2 |
| | **Total** | **≈ 28–36** |

If it runs over, cut from the bottom up, in this order:
1. Calendar reminder
2. Weekly check-in screen
3. Guess vs. reality screen

The guesses are already saved, so that screen can follow later with nothing lost. The core is everything through the home screen, plus the charts.

## Already decided
- Installable web app.
- Stack A: Next.js, Supabase EU from P2, Vercel. Next.js stays in P1 so the AI phase can keep the API key on the server.
- Claude Opus 5.5 once AI arrives.

See [[Student Budget App - Tech Stack]].

## What success looks like (proposal)
- **P1:** it's installed on my phone, and I use it instead of Expense Keep for two weeks.
- Logging a cash purchase takes under 10 seconds, typed or spoken.
- I can explain every part of the code.
- **Later:** friends who try it are surprised by at least one guess-vs.-reality number, and some still do the weekly check-in after a month.

## Left to the builder
Screen layout and visual design, the data model, the browser-storage library, chart types, the exact category list, and the exchange-rate source.

## Inputs for the build plan
- City: **Regensburg** (seeded numbers).
- Home currency: **INR**. The ECB reference rates cover it, so the rates come from Frankfurter.
- Testing: desktop Chrome first, then the installed app on iPhone.

Build plan: [[2026-10-16-p1-test-project|P1 plan]] (`docs/superpowers/plans/2026-10-16-p1-test-project.md`).

## What changed from the first idea

| First idea | Now | Why |
|---|---|---|
| AI in every feature from day one | P1 without AI; AI phase afterwards | Get the core working; AI is discussed once it's in a good state |
| Receipt scan and manual log | Quick add (typed or dictated) in P1; receipts in the AI phase; CSV and bank later | P1 is a 3–4 day test project |
| Voice entry | The phone keyboard's mic in P1; an in-app mic button in P2; natural sentences with AI | The keyboard mic is free and works now; browser speech support varies |
| Badges | P2, personal ones first; P1 stores the data for them | Not needed to test the core; community badges need the community |
| Only verified students get in | Open to all; verified-student badge that expires yearly | Former students and locals know good tips; freshness matters more than who posted |
| Venues verify their own deals | Later | It's a second kind of user (business accounts, proof they represent the venue, a dashboard) |
| Chat room / blog space | Hacks feed with tags | A chat room needs real-time messaging and constant moderation, and buries tips within an hour |
| AI trained on upvoted posts | AI cites the top-rated recent hacks | Same effect, no training, stays current, every tip is traceable |
| AI suggests pre-drinking | Cheaper versions of the same night; no drinking coaching from the app | Coming from the app it reads as advice to drink |
| Manual entry as the privacy option | P1 keeps all data on the phone; real privacy controls after | Manual entries on a server are no more private than any other entries |
| Website discounts | Link out to UNiDAYS / Student Beans | Already solved, with 29M+ members |
| (new) | Guess vs. reality, safe to spend this week, weekly check-in, set-asides for big costs, several accounts and currencies, city ranges next to envelopes, charts | "Where money went" needs the guess to compare against; "realistic for my city" works without AI |
