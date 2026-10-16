---
tags: [project-idea, tech-stack]
created: 2026-10-16
---

# Student Budget App: Tech Stack

See also: [[Student Budget App]] · [[Student Budget App - Concept]] · Idea Comparison and First Project - WG Kasse (Personal Project Ideas vault)

P1 uses this stack without Supabase (data stays on the phone); Supabase arrives in P2. See [[Student Budget App - Concept]].

## Decided
- Platform: installable web app first (no App Store).
- AI: Claude Opus 5.5 for every AI feature (budget plan, receipt scan, chat).

## Recommended stack (TypeScript)
| Layer | Pick | Why |
|---|---|---|
| Language | TypeScript | One language for browser and server; type errors catch AI mistakes before anything runs; most AI training data |
| Framework | Next.js 16 + React | Pages and server routes in one project; the API key stays on the server |
| UI + charts | Tailwind + shadcn/ui (its charts use Recharts) | AI writes it reliably; components live in the repo |
| Installable app | PWA via Next.js `app/manifest.ts` | Home screen, camera for receipts, location for badges |
| Data + login | Supabase (EU region): Postgres, magic-link login, Storage, Row Level Security | One service; Row Level Security keeps each student's spending private |
| Map | MapLibre GL JS + OpenFreeMap tiles, PostGIS | No key, no bill; "cheaper place nearby" queries run in the database |
| AI | Claude Opus 5.5 via the official `@anthropic-ai/sdk` | Vision (receipts), structured outputs (plan, receipt fields), tool use + streaming (chat) |
| Validation | Zod | One schema for forms, database and Claude tools |
| Tests | Vitest + Playwright + Row Level Security tests | How I check the code without reading it |
| Hosting | Vercel Hobby + GitHub Actions | Built for Next.js; preview URL per PR |

## Language options
| Language | One language for front + back? | How well AI writes it | Fits an installable web app | Native app later | Verdict |
|---|---|---|---|---|---|
| **TypeScript** | Yes | Best | Yes | Expo, reusing code | **Pick** |
| Python | No: the UI needs JS, or Django + HTMX | Very good | Yes (Django + HTMX) | No | Only if Python is clearly my strongest language |
| Dart (Flutter) | Yes: one app for web, iOS, Android | Good, less than TS | Works, slow first load on web | Built in | If store apps become the main goal |
| C# (.NET, Blazor) | Yes | Good | Works, heavier hosting | .NET MAUI | Only for .NET practice |
| Swift / Kotlin | No | Good | No | Two separate apps | Not for this project |

## Alternatives per layer
| Layer | Recommended | Alternatives | When the alternative wins |
|---|---|---|---|
| Framework | Next.js | Vite + React SPA (+ Supabase Edge Functions for Claude), SvelteKit, React Router v7, Nuxt (Vue) | **Vite SPA:** same base as WG Kasse, fewer concepts. **SvelteKit:** less code, but less AI training data |
| App stores (later) | PWA | Capacitor (wraps the PWA), Expo (React Native), Flutter | **Capacitor:** fastest way into the stores with the same code. **Expo:** real native UI, reuses TS, Zod and Supabase |
| Data + login | Supabase | Firebase, PocketBase, Neon Postgres + Drizzle + Better Auth, Convex | **Firebase:** NoSQL makes budgets, joins and geo queries harder. **PocketBase:** one-file server I host myself. **Neon + Drizzle:** more control, more parts. **Convex:** TS-native realtime, lock-in |
| Login (if not Supabase) | Supabase Auth | Clerk, Better Auth, Auth.js | **Clerk:** ready-made login screens, one more vendor |
| UI | Tailwind + shadcn/ui | Mantine, MUI, Chakra | **Mantine:** more ready-made pieces (date pickers, charts) |
| Map | MapLibre + OpenFreeMap | Leaflet + OSM tiles, Mapbox, Google Maps | **Leaflet:** simplest, but the OSM tile policy limits heavy use. **Mapbox / Google:** polished, but API keys and billing |
| AI model | Opus 5.5 | Opus 5.5 + Haiku 5.5 for receipts, Sonnet 5.5 | **Haiku 5.5** once other students use it (about 40x cheaper per token); test receipt quality first |
| AI integration | Official Anthropic SDK | Vercel AI SDK, LangChain | **Vercel AI SDK:** ready chat hooks and easy provider switching, but an extra layer that changes often |
| Receipt reading | Claude vision | Tesseract (free OCR), Google Document AI, Azure Document Intelligence | **Tesseract:** no API cost, weak on crumpled receipts, I write the parsing. **Cloud receipt models:** precise fields, another account and bill |
| Tests | Vitest + Playwright | Jest, Cypress | About equal; pick one and stay with it |
| Hosting | Vercel Hobby | Netlify, Cloudflare Workers (OpenNext adapter), Render / Railway | **Netlify:** 300 credits/month hard limit; check its commercial terms. **Cloudflare:** generous free tier, but a 3 MiB Worker size cap on the free plan and more setup. **Render / Railway:** needed for Django or PocketBase |

## Four complete stacks
Pick one whole stack; don't mix layers at random.

| Stack | Pieces | Choose it if |
|---|---|---|
| **A, recommended** | Next.js + Supabase + Claude + Vercel | Default |
| **B, simplest** | Vite + React + Supabase (Edge Functions for Claude) + Netlify or Cloudflare Pages | I build WG Kasse first and want to reuse its setup |
| **C, Python** | Django + HTMX + Postgres (Supabase or Neon) + Claude Python SDK + Render | Python is my strongest language |
| **D, store apps** | Expo + Supabase + Claude via Supabase Edge Functions | App Store / Play Store becomes a goal |

## Learning path
TypeScript only. About 8 hours of basics first, then learn the rest while building.
The AI writes the code, so the goal is reading fluency: I can explain every change, not write it from memory.

### Where my background fits
| What I know | Where it shows up in this stack |
|---|---|
| Java | TypeScript's types, interfaces and generics feel familiar |
| JavaScript + CSS | TypeScript is JavaScript plus types; Tailwind is CSS written as class names |
| SQL | Supabase is plain Postgres; Row Level Security policies are SQL |
| Python (a little) | Not needed for this project |
| C | Not needed for this project |

### Java → TypeScript cheat sheet
| Java | TypeScript |
|---|---|
| `interface` / class with fields | `type` or `interface`: describes a shape, no class needed |
| Generics `List<T>` | Same idea: `T[]` or `Array<T>` |
| `null` and NullPointerException | `null` and `undefined`; `strict` mode forces the checks at compile time |
| Threads, `CompletableFuture` | One thread; `async` / `await` with Promises |
| Checked exceptions | None; `try/catch`, and Supabase returns `{ data, error }` |
| Maven / Gradle | npm + `package.json` |
| JUnit | Vitest |
| JDBC | `supabase-js` client |

### Before building (about 8 hours, once)
| # | Topic | Why it matters here | Resource | Time |
|---|---|---|---|---|
| 1 | TypeScript for Java programmers | Read the types the AI writes | TypeScript handbook: "TypeScript for Java/C# Programmers" | 1 h |
| 2 | `async` / `await` and Promises | Biggest change from Java; every database and Claude call is async | javascript.info: Promises, async/await | 1–2 h |
| 3 | React: components, props, state, hooks | Every screen is built from these | react.dev/learn: Quick Start, Thinking in React | 2 h |
| 4 | Next.js: what runs on the server vs in the browser | Decides where the Claude API key and data checks live | Next.js Foundations course (builds a finance dashboard with login): routing, data fetching, mutations and authentication chapters | 2–3 h |
| 5 | Row Level Security | The one security piece I must check myself | Supabase Row Level Security guide | 1 h |

Typing these tutorials myself is fine and speeds up reading; the project itself stays AI-written.

### While building
- After each AI task: "Explain this change to someone who knows Java and SQL, and point out anything new."
- TypeScript `strict` mode on from day one; the compiler flags many mistakes.
- When a new concept shows up twice, capture it in a quick note.
- Learn only when the build needs it: PostGIS (map week), Zod, Playwright, Claude tool use.

### Skip for now
Python, Dart, C#, Swift/Kotlin; deep CSS (Tailwind covers it); class-heavy OOP patterns (React uses functions).

## Leave out for v1
- **Bank connection:** costs money and needs a licensed aggregator; already under "Later" in [[Student Budget App]].
- **Scraping Numbeo for city costs:** against its terms; seed my city's numbers by hand.
- **A separate Express or FastAPI backend** in stack A: Next.js server routes plus Supabase cover it.

## Limits and costs
Secondhand sources, checked 2026-10-16. Re-check the official pricing pages before starting.

- **Supabase Free:** 500 MB database, 1 GB file storage, 2 active projects. Projects pause after 7 days without activity (data is kept); restore before showing a demo.
- **Vercel Hobby:** non-commercial use only. Affiliate links need Pro ($20/month) or another host.
- **Claude Opus 5.5:** about €3–6/month for me alone (about €0.02 per receipt, chat context mostly cached). Set a monthly spend limit in the Anthropic Console, and a per-user daily cap before other students use it.
- **Version drift:** AI tends to write older Next.js patterns. Pin versions in `package.json` and name them in `CLAUDE.md`.

## Sources
- Supabase: [Supabase pricing 2026 (jetadmin)](https://www.jetadmin.io/blog/supabase-pricing-2026-guide-to-plans-limits-and-real-world-costs/), [Supabase free tier limits (automationatlas)](https://automationatlas.io/answers/supabase-free-tier-limits-2026/), [official pricing](https://supabase.com/pricing)
- Vercel: [Vercel pricing explained (livemy.app)](https://livemy.app/blog/vercel-pricing), [Vercel free tier limits 2026 (deploywise)](https://deploywise.dev/blog/vercel-free-tier-limits-2026), [official pricing](https://vercel.com/pricing)
- Netlify: [Netlify pricing and limits 2026 (netli.fyi)](https://netli.fyi/blog/netlify-pricing-and-limits)
- Cloudflare: [OpenNext for Cloudflare (official docs)](https://opennext.js.org/cloudflare)
- Next.js: [Next.js blog](https://nextjs.org/blog)
- Claude: [Anthropic pricing](https://www.anthropic.com/pricing)
- Learning: [TypeScript for Java/C# Programmers](https://www.typescriptlang.org/docs/handbook/typescript-in-5-minutes-oop.html), [javascript.info: Promises, async/await](https://javascript.info/async), [React: Learn](https://react.dev/learn), [Next.js Foundations course](https://nextjs.org/learn/dashboard-app), [Supabase Row Level Security](https://supabase.com/docs/guides/database/postgres/row-level-security)
