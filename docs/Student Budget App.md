---
tags: [project-idea]
status: researched
researched: 2026-10-15
rank: 1
---

# Student Budget App

See also: [[Student Budget App - Concept]] · [[Student Budget App - Tech Stack]] · [[2026-10-16-p1-test-project|P1 plan]] · Idea Comparison (Personal Project Ideas vault) · Overlaps with Newcomer City Guide (Personal Project Ideas vault): the discount map and hack feed share its core ("locals post tips about places in their city"); merge decided later

## The idea
- AI sets a budget plan from the student's preferences, social life and the city they live in
- Tracks expenses, suggests where to cut down and offers alternatives
- Explore legit, popular places with student discounts: restaurants, gyms, websites, shops, arcades, bowling, karting
- A blog or tips page where students post daily money hacks ("cheat codes")

## Verdict
No app has the whole package. Most pieces exist separately, often with millions of users. The new parts are an AI plan built from city and lifestyle, and a student hack feed tied to a budget app.

## Who covers what
| Feature | Already done by | How well covered |
|---|---|---|
| AI plan from preferences, social life, city | Cleo (AI chat), Finanzguru (AI assistant, DE), Blackbullion (student, UK). City-aware tools are one-off calculators: UCAS (100+ UK places), NetBudget (558 cities, tiny) | **Gap** |
| Expense tracking | Finanzguru (3M+ users, DE), Emma, Snoop, Rocket Money, YNAB, Revolut, N26 | Very crowded |
| Where to cut + alternatives | Finanzguru, Snoop, Emma, Plum (subscriptions, contracts, energy, broadband) | **Gap for everyday spending** (nearby cheaper places) |
| Online student discounts | UNiDAYS (29M+ members), Student Beans (3,500+ brands), ISIC | Solved |
| Local discounts on a map | iamstudent Rabatt-Map (AT/DE, 600k+ students), ISIC map, UNIHELD (DE), Semesterstarter (4 Bavarian cities), studirabatte.com (15 German cities) | Exists; no ratings, popularity or "last confirmed" dates |
| Community money hacks | MoneySavingExpert, Save the Student, mydealz, Reddit, TikTok, Studo chats | Scattered, not tied to a budget |
| Budget + discounts in one | Unipal (Bahrain, basic), Vero (UK, not launched), student bank accounts | Barely |

**Revolut AIR** (AI assistant, UK April 2026, Europe reportedly September 2026) answers "Where's my money going?" or "How much can I save this month?" from bank data. It doesn't know city costs or local student discounts.

## Where it is new
1. A budget plan that knows your city and lifestyle, then adjusts to real spending.
2. "Cut here, go there instead": a real cheaper place nearby, ideally with a student discount.
3. Local discounts you can trust: "last confirmed" date, "still works" button, ranked by use.
4. A student hack feed in the same app, feeding the AI suggestions.

## Risks
- Students rarely pay for budgeting apps (YNAB gives students a free year). Money would come from brands and affiliates, which UNiDAYS, Student Beans and iamstudent already own. Blackbullion's route: universities pay.
- Finance apps keep about 4–6% of users after 30 days; students leave at graduation.
- Free budgeting apps keep closing: Mint (2024), Money Dashboard (2023), Yolt (2021), Moneyhub's consumer app (2026).
- Every city starts empty (discounts and posters).
- Bank connection costs money and creates dependency (Copper lost its teen bank accounts when its banking partner Synapse collapsed).
- User-posted hacks need moderation.

## Decisions so far
- Goal: learning / portfolio project.
- Market: start in the city where I study.
- Tracking: manual entry and quick add (typed or dictated) first; receipt scan and a chat assistant like Revolut AIR in the AI phase; CSV import and bank or card linking later.
- I'm a student: own first tester; can seed discounts and hacks.
- Platform: installable web app first (no App Store); see [[Student Budget App - Tech Stack]].
- AI: Claude Opus 5.5 for every AI feature (budget plan, receipt scan, chat), once the AI phase starts.
- Core moment (2026-10-16): "Where did my money go?", with guess vs. reality as the hook.
- P1 (2026-10-16): a 3–4 day test project (8–9 h a day) without AI, with data only on the phone. Then friends (5–20) for feedback.
- Community (2026-10-16): tips open to everyone; a verified-student badge, not a gate; discounts judged by "last confirmed".
- Tips (2026-10-20): P1.1 gets a Tips tab with Regensburg tips I seed, each with a source; read-only. The P2 hacks feed moves into this tab.

## First version
Phases, features and the P1 build order: [[Student Budget App - Concept]]. Build plan: [[2026-10-16-p1-test-project|P1 plan]].

## Badges
Arrive in P2, personal ones first; P1 already stores the data they need (see [[Student Budget App - Concept]]).

Tiers: Bronze → Silver → Gold.

| Family | Badges and milestones |
|---|---|
| Trust | **Deal Detective**: 10 students confirm your discount still works · **Hack Hero**: a hack with 50 upvotes |
| Environment | **Second-Hand Saver**: 5 used buys logged · **Pedal Power**: transport costs cut with bike or Deutschlandticket |
| Streak | **Under-Budget Week**: bronze 4 weeks, silver 12 weeks, gold a whole semester · **Logging Streak**: spending logged every week |
| Traveller | **Discount Explorer**: student discounts used in 5 districts or 3 cities |
| Fun | **Ramen Royalty** (cheapest food week) · **Coupon Ninja** · **Latte Survivor** (halved café spending) |
| Physical | Pin from a partner café after a semester under budget, picked up there after a QR scan |

Rules:
- Earned, never bought.
- **Never reward spending** (no "spent at partner" badges); it would contradict the budget.
- Trust criteria are published.
- Streaks are weekly, with a pause/freeze; no punishment or manipulative design (EU Digital Services Act, Art. 25).
- Location-based badges are checked on the phone; only the badge and date are stored.

## Sources
Findings come from app store listings, company pages and news; the apps were not tested.

- [Revolut AIR](https://revolut.com/blog/post/air-ai-by-revolut), [AIR UK launch](https://www.resultsense.com/news/2026-04-10-revolut-launches-ai-assistant-uk), [AIR in Europe (FR)](https://bourseinside.fr/?p=12756)
- [Finanzguru](https://finanzguru.de/), [Snoop](https://snoop.app/), [Cleo review](https://www.thepennyhoarder.com/budgeting/cleo-app-review/), [YNAB for students](https://www.ynab.com/college)
- [Blackbullion](https://apps.apple.com/gb/app/student-budgeting-blackbullion/id1596926462), [UCAS budget calculator](https://www.timeshighereducation.com/news/ucas-launches-budget-calculator-amid-cost-living-concerns), [NetBudget](https://mwm.ai/apps/netbudget/6763551701)
- [UNiDAYS](https://www.myunidays.com/GB/en-GB), [Student Beans / Pion](https://www.wearepion.com/about), [ISIC Germany](https://www.isic.de/), [TOTUM Trustpilot](https://ch.trustpilot.com/review/totum.com)
- [iamstudent](https://apps.apple.com/at/app/iamstudent-studentenrabatte/id1210367722), [UNIHELD](https://apps.apple.com/de/app/uniheld/id6758344303), [Semesterstarter](https://apps.apple.com/au/app/id6717587531), [studirabatte.com](https://studirabatte.com/), [Unipal](https://apps.apple.com/app/id1561570512)
- [MoneySavingExpert budget planner](https://www.moneysavingexpert.com/banking/budget-planning/), [Save the Student calculator](https://www.savethestudent.org/money/student-budgeting/student-budget-calculator.html), [mydealz student group](https://www.mydealz.de/gruppe/studentenrabatte-discussed), [Studo chat](https://faq.studo.com/en/articles/4427517-studo-chat), [Frich](https://techcrunch.com/2024/05/30/meet-frich-an-app-where-gen-z-talks-and-learns-about-money-that-just-raised-2-8m), [Vero](https://www.bristol.ac.uk/news/2026/february/vero-app-graduates.html)
- [Mint shutdown](https://wallethub.com/edu/b/what-happened-to-mint/151868), [Copper pivot](https://techcrunch.com/2024/05/21/teen-fintech-copper-had-to-emergency-discontinue-its-banking-debit-products), [Cleo revenue (Sacra)](https://sacra.com/research/cleo-at-150m-arr/), [Finance app retention (AppsFlyer)](https://www.appsflyer.com/?p=537855)
