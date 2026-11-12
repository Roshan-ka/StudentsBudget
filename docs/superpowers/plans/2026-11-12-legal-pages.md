# Legal pages and security headers (12-11-2026)

## First: undo the forced audit fix (Roshan's choice, 12-11-2026)

`npm audit fix --force` on `main` changed two files, uncommitted:
- it downgraded `shadcn` from the pinned 4.21.5 to 1.0.0, in `package.json` and `node_modules`;
- it rewrote `package-lock.json`, dropping 157 packages.

It cleared none of the 7 moderate warnings. Those are `minimatch` < 11.0.1 under `typescript-eslint` ≤ 8.72.2: ESLint's parser only, never the app, and no `typescript-eslint` release fixes them yet.

1. `git checkout -- package.json package-lock.json`, which brings back `main`'s files.
2. `npm ci --prefer-offline` through the lane, in the background, to put `node_modules` back:
   `node C:/Users/JoKu_CRITEX/.claude/lanes/lane.mjs run --who studentsbudget-legal --prio 1 --est 6m --what "npm ci after the forced audit fix" --wait 60m --max 30m -- 'npm ci --prefer-offline'`
3. A CLAUDE.md line under **Repo**, committed with chunk 1:
   - never run `npm audit fix --force` here, since it has downgraded shadcn to 1.0.0 twice (11-11 and 12-11-2026);
   - the minimatch warnings wait for a `typescript-eslint` release on minimatch 11.0.1+ that is at least 2 weeks old, then get a normal lockfile bump.

## Context

The discount map is built and on `main`. Its full CI run (run 43200285485: every browser and language, offline and db) passed; go-live is Roshan's, in its plan. Roshan picked the **legal pages** next.

The site now shows students' public posts, comments and discounts, keeps accounts in Supabase, and in its builds can send to Anthropic, push services, Frankfurter and Vercel. Yet it has no privacy notice and no Impressum. Every data-protection note says "the full list waits for the privacy page", and CLAUDE.md lists "legal pages" as left out. The appendix of earlier plans pairs them with **security headers**, which the app also lacks (`next.config.ts` sets only `/sw.js` no-cache).

**Outcome:** a privacy notice and an Impressum, reachable from Settings, the start page and every data-protection note, plus a strict-as-possible set of security headers. Nothing in the app breaks.

I'm not a lawyer. The texts are drafted from what the code actually does, and Roshan has them checked (a lawyer, or a comparison with a reputable German generator such as eRecht24's) before go-live.

The plan is copied into `docs/superpowers/plans/2026-11-12-legal-pages.md` in chunk 1.

## Decided (Roshan, 12-11-2026)

- **Who runs it:** Roshan, named with a postal address and an email that he fills in himself. They are placeholders in one data file, so his address never passes through chat. A Production build refuses to run while a placeholder is left.
  - His address then sits in the public repo and on the SupportRW mirror, as it does on the page.
- **Languages:** German, the binding text, and English. A French or Spanish phone shows the English text, marked `lang="en"`, with one line saying so.
- **Vercel Speed Insights stays.** The notice names it (Vercel; page timings with path, device and browser; no cookies), and CLAUDE.md's "no analytics" line is corrected.

## Design (my calls, after reading the code; open to objection)

### Facts the notice states (from the code, 12-11-2026)
- **On the phone only:**
  - IndexedDB `studentsbudget` (13 tables, `src/db/db.ts`);
  - localStorage: choices, note flags, the Supabase session `studentsbudget-auth`, and caches of the hacks feed and students' discounts;
  - sessionStorage (2 keys) and the service worker's two caches;
  - **no cookies.**
- **Vercel:** hosting and its request logs, plus Speed Insights (`layout.tsx:97`, same origin, `/_vercel/speed-insights/vitals`).
- **Supabase** (Frankfurt; only in builds with its settings):
  - the account (email, password hash, language, the posting name);
  - the synced copy (10 tables, deleted rows kept as tombstones);
  - passkeys (public keys only) and authenticator factors;
  - shared content: posts, comments, discounts with pins, votes and reports;
  - soft-deleted texts stay until the account is deleted;
  - the weekly reminder's push row, and AI use counts, purged after 2 days.
  - Everything goes with `delete_my_account`.
- **Anthropic (USA)**, only in an AI build, signed in, with the switch on:
  - texts are scrubbed first (`scrub`), and no user id goes;
  - logs carry no text (`_shared/ai/handle.ts`).
- **Push services** (Apple, Google FCM, Mozilla, Microsoft): the encrypted reminder.
- **Frankfurter:** currency codes and the IP.
- **Pass-throughs:** Google Translate gets the text in a link the person opens; the browser's speech service gets the recording; the browser's own location service is used for Show me (the position stays on the phone).
- **The map** is shipped with the app: no outside request.

### Pages
- **Routes:** `/privacy` ("Datenschutz") and `/impressum`, top-level like `/start`, so they open with no plan. Each has a `PageHeading`, a back link (history back, else `/`) and the bottom navigation when a plan exists.
- **Content:** structured data, not messages.
  - `src/features/legal/privacy-notice.ts` holds sections, each with an `id`, `de` and `en` (heading, paragraphs, lists), a `when` (`always`, `supabase`, `ai`, `reminder`, `map`) and a code comment naming what it describes.
  - A build shows only what it does: the `ai` section only when `aiInBuild()`, and so on.
  - `LegalPage` renders the sections with anchors (`#account`, `#ai`, …) and a "Stand" date.
- **Contact data:** `src/data/legal.ts` holds `OPERATOR` (name, street, postcode, city, email) as placeholders and `legalFilledIn()`.
  - `next.config.ts` throws when `VERCEL_ENV === 'production'` and a placeholder is left, so that build fails and the live site keeps its last good deploy.
  - Roshan fills them on chunk 1's branch, before merging it.
- **Links in:**
  - **Settings:** two rows, "Datenschutz" and "Impressum", at the end of `SettingsLinks`.
  - **The start page:** two small links at its foot.
  - **The notes:** `PrivacyNote` gains a "More in the privacy notice" link to its section (`/privacy#<id>`, new tab, so a form being filled isn't lost). The sign-up note and every other note get one. A test holds every `PRIVACY_NOTES` id to a section.
- **Wiring:** `shell.headings` (4 languages), `PAGES` (e2e), `affected-map.json`, `public/sw.js` `PAGES` (offline), `PRECACHED_PAGES`.

### Security headers (`next.config.ts` `headers()`, every path)
- **CSP:**
  - `default-src 'self'`
  - `script-src 'self' 'unsafe-inline'` — Next 16 with `cacheComponents` can't use nonces without making every page dynamic and losing the offline precache. Its flight data scripts are inline (`content-security-policy.md:391–452`).
  - `style-src 'self' 'unsafe-inline'` — the charts' `<style>` and `style={{}}`.
  - `img-src 'self' blob: data:` — MapLibre.
  - `font-src 'self'`
  - `connect-src 'self' <origin of NEXT_PUBLIC_SUPABASE_URL> https://api.frankfurter.dev` — the e2e build gets its mock host the same way.
  - `worker-src 'self'`, `manifest-src 'self'`
  - `frame-ancestors 'none'`, `object-src 'none'`, `base-uri 'self'`, `form-action 'self'`
  - `upgrade-insecure-requests` only on Vercel, not on localhost, where WebKit would upgrade the e2e server's requests.
  - **Dev and previews:** `'unsafe-eval'` and Speed Insights' debug script in dev only. On Vercel previews only, the Vercel Toolbar's hosts, checked against Vercel's docs when built.
- **The other headers:**
  - `Permissions-Policy: geolocation=(self), microphone=(self), publickey-credentials-get=(self), publickey-credentials-create=(self), camera=(), payment=(), usb=()`
  - `Referrer-Policy: strict-origin-when-cross-origin`
  - `X-Content-Type-Options: nosniff`
  - `X-Frame-Options: DENY`
  - `Cross-Origin-Opener-Policy: same-origin`
  - HSTS is Vercel's own.
- **Zod:** `z.config({ jitless: true })`, so its `new Function` probe doesn't log a CSP violation.

## Chunks (about 1 h each, a draft PR each; checks in CI on Roshan's OK, none run locally)

1. **The pages' frame:**
   - the plan into `docs/`;
   - `src/data/legal.ts` with placeholders, and the Production guard in `next.config.ts` (unit-tested: filled or not);
   - `/privacy` and `/impressum` with `LegalPage`, the back link and the German/English fallback;
   - the Impressum's content (§ 5 DDG: name, address, email);
   - the links from Settings and the start page;
   - all the wiring, plus a spec (`legal.spec.ts`): reached from Settings and the start page, the fallback on a French phone, 375 px.
   - **Roshan fills the placeholders on this branch before merging.**
2. **Privacy notice, part 1:**
   - controller and contact;
   - an overview;
   - what stays on the phone (storage list, no cookies);
   - hosting and Speed Insights;
   - Frankfurter, the map and location, the mic, Translate links.
   - **Tests:** each section has `de` and `en`; each `when` follows its build flag.
3. **Privacy notice, part 2:**
   - the account and sync, sign-in security and emailed codes;
   - the shared content (posts, comments, discounts with pins, votes, reports, moderation, what soft deletes keep);
   - the weekly reminder, and the AI;
   - for each, the legal basis and how long it is kept;
   - recipients and transfers to third countries — each provider's Data Privacy Framework listing and contract terms checked when written, not from memory;
   - the rights, and the supervisory authority (BayLDA, checked when written);
   - the "Stand" date.
   - Then the notes' "More in the privacy notice" links, with the test holding every note to a section.
4. **Security headers:**
   - the headers above, and Zod `jitless`;
   - `security-headers.spec.ts`: the headers on `/`, and no `securitypolicyviolation` while Home, Tips' map, sign-in (mocked) and the Ask page are used;
   - CLAUDE.md: a Legal pages and headers rule, the outgoing-requests list corrected for Speed Insights and the browser's location service, and "no legal pages yet" removed;
   - As built.
   - **CI:** a changed run on both browsers, since the headers reach every page.

## Verification

- **Each chunk:** a changed CI run on Roshan's OK. Chunk 4 runs on every browser.
- **Real try on a Vercel preview** (after chunk 4):
  - the browser console shows no CSP violations while using the map, signing in, Sync now, Ask (if AI is on) and the weekly reminder (if on);
  - a header scanner such as securityheaders.com rates the preview (Roshan runs it);
  - both legal pages read right on the phone, in German and in English.
- **Before go-live (Roshan):**
  - fill the placeholders;
  - have the texts checked;
  - then merge and deploy.
  - If a header breaks something live, removing its line from `next.config.ts` and redeploying undoes it.

## As built
- **Before chunk 1** (12-11-2026): the forced audit fix was undone. `package.json` and the lockfile came back from `main` (shadcn 4.21.5), and `node_modules` was put back with `npm ci` through the lane. CLAUDE.md's Repo list now says never to run it.
- **Chunk 1** (12-11-2026), the pages' frame:
  - **`src/data/legal.ts`:** `OPERATOR` with placeholders, `legalFilledIn` and `assertLegalReady`. `next.config.ts` calls it, so a build with `VERCEL_ENV=production` throws while a placeholder is left. Tested.
  - **The content model** (`src/features/legal/content.ts`): sections with an `id`, a `when` and `de`/`en` texts made of paragraphs, lists and lines; `legalLangFor` and `sectionsFor`; `LEGAL_WORDS` for "Stand" and the draft line.
  - **The Impressum** (`impressum.ts`): § 5 DDG, contact, § 18 (2) MStV, the project, the app's figures, and students' posts (only in a build with Supabase).
  - **The privacy notice** (`privacy-notice.ts`): the controller, and an honest "being completed" section until chunk 3.
  - **`LegalPage`:**
    - German or English, marked with its `lang`, with a line on a French or Spanish phone;
    - a back link (history back, else `/`), each section's heading as its anchor, a draft line while placeholders are left, and a link to the other page.
  - **Routes:** `/privacy` and `/impressum`.
  - **Links:** two rows at the end of Settings (`ShieldCheckIcon`, `InfoIcon`) and `LegalLinks` at the start page's foot.
  - **Texts:** `common.legal` and `shell.headings.privacy`/`impressum` in four languages.
  - **Wiring:** `PAGES` (e2e), the map (`/privacy`, `/impressum`, and `legal` under `/start`), `sw.js` `PAGES` and `PRECACHED_PAGES`.
  - **e2e:** `legal.spec.ts` covers:
    - Settings to both pages and back;
    - the start page's links;
    - German;
    - the French fallback;
    - 375 px with no sideways scroll.
- **Chunk 1 reverted** (12-11-2026):
  - **Why:** #218 was merged with the placeholders, so every Production build stopped at `assertLegalReady`, as designed; the live site stayed on #217's merge. Roshan chose to revert it until the texts are checked, rather than publish his details first.
  - **What went:** the code, the texts, the spec and the wiring. This plan and CLAUDE.md's `npm audit fix --force` line stayed.
  - **To bring it back:** a branch from `main` that reverts the revert commit, with Roshan's five details committed in `src/data/legal.ts` before it merges. Chunks 2–4 build on that branch.
- **Chunk 1 back** (12-11-2026): on the branch `feat/legal-pages`, which reverts the revert. Chunks 2–4 go on the same branch, in one draft PR, so nothing is stacked on an unmerged branch. It merges once Roshan's details are in and the texts are checked.
- **Chunk 2** (12-11-2026), the privacy notice's first part (`privacy-notice.ts`), after the controller and before "being completed":
  - **In short:** the finances stay on the phone; no cookies, ads or tracking across sites; each feature sends only what it needs, after its note.
  - **What stays on your phone:** Dexie's tables in plain words, the small settings in localStorage and sessionStorage, the service worker's copy, no cookies; § 25 (2) no. 2 TDDDG; how to delete it (Settings → Backup and data → Delete everything, or clearing the site's data). What the account adds on the phone (the session, the cached feeds) goes into chunk 3's account section.
  - **Hosting and server logs:** Vercel Inc. as processor (Art. 28), what any visit shows it, Art. 6 (1) (f), its own retention words, and the USA with the DPF and standard contractual clauses it names.
  - **Load times (Speed Insights):** each data point as Speed Insights' privacy page lists it, sent through the app's own address; anonymous, no cookies, nothing on the phone; Art. 6 (1) (f).
  - **Exchange rates (Frankfurter):** only with an account not in euros, at most once a day, the currency codes and the IP; behind Cloudflare, and by its FAQ no personal data, IP addresses or requests kept; Art. 6 (1) (f).
  - **The map and your location** (map builds only): the map asks no outside service; Show me only on a tap, the position worked out by the phone (its maker's location service), used on the phone only.
  - **Speaking an entry:** the browser's speech service, as the mic note says; the app gets only the text.
  - **Translate** (builds with an account only): a link to Google Translate, as the `translate` note says.
  - **Sources, read on 12-11-2026:** Vercel's privacy notice (updated 01-06-2026), Speed Insights' privacy page and the FAQ on frankfurter.dev.
  - **Tests:** `privacy-notice.test.ts` (the order and each section's build, every button and page named as the app shows it in both languages, no cookies, the legal bases), and `legal.spec.ts` looks for the new headings.
  - **For the check before go-live** (not decided by me):
    - Speed Insights reads measurements from the browser with no cookie and no consent: whether § 25 (1) TDDDG asks for consent there, or Art. 6 (1) (f) is enough.
    - Frankfurter's legal basis (Art. 6 (1) (f), for a feature the student turns on by adding an account in another currency).
    - Vercel's DPA covering a Hobby account, and Vercel's and Cloudflare's entries on the DPF list (chunk 3 checks the list for every recipient).
- **Chunk 3** (12-11-2026), the privacy notice's second part, in place of "being completed":
  - **Your account and syncing** (with an account): Supabase Pte. Ltd. (Singapore) as processor, the database in Frankfurt; what the account holds (email, the password's hash, the language, the name on posts, the synced copy of the ten tables); what the phone keeps for it; automatic sync; tombstones; Supabase's request logs with the IP, kept a day; Art. 6 (1) (b) and (f); kept until Delete my account, which takes everything, shared content included; signing out wipes the phone instead.
  - **Signing in and security:** passkeys (public key only), the authenticator's secret, the emailed six-digit codes (60 minutes, in the account's language), Supabase's auth logs (24 hours).
  - **Hacks, comments and discounts:** who sees what (username, label, batch; never the email or an id), votes as totals, reports (hidden at 5), the moderator's view (content, username, counts, never the reporter), the daily limits, soft deletes kept until the account goes, the lists cached on the phone.
  - **Weekly reminder:** the `push_subscriptions` row in words, the encrypted push through the browser maker's service, logs with the push host only, and when the row goes.
  - **AI features (Anthropic):** what each feature sends, the scrub, the allowance counts (over two days deleted at the next use), Anthropic Ireland, Limited as processor with processing in the USA, no training, deleted within 30 days at the latest (flagged content up to two years), logs without text.
  - **Transfers outside the EU:** Vercel Inc. and Cloudflare, Inc. active on the DPF list (Art. 45); Supabase and Anthropic not listed, so the SCCs in their DPAs (Art. 46 (2) (c)), with a copy on request.
  - **Your rights:** Art. 15–18, 20, 21, no Art. 22 decisions, what the app does itself (Export backup, Delete everything), and BayLDA (Art. 77).
  - Hosting and the transfers now say Vercel is certified (the list, not only Vercel's word). Translate covers comments and students' discounts too.
  - **The notes' links:** every `PrivacyNote` has "More in the privacy notice" (four languages, 44 px tall), opening `/privacy#<section>` in a new tab so a form being filled stays; `NOTE_SECTIONS` maps each note to its section, and the test holds each to a section shown in every build where the note can show.
  - **Sources, read on 12-11-2026 by a research agent and checked against the code by another:** the DPF list (its own API: Vercel Inc. #6847, Cloudflare, Inc. #5666 and Google LLC #5780 active; Supabase and Anthropic not on it, active or inactive); Supabase's terms, DPA (01-08-2026), region, audit-log, log-field, SMTP docs and pricing; Anthropic's commercial terms (17-06-2025), DPA (24-02-2025) and privacy center; lda.bayern.de, Art. 18 BayDSG and § 2 BDSG.
  - **For Roshan, before the texts are checked:**
    - **Supabase's region:** the text says the database is in Frankfurt. That holds for the specific region "Central EU (Frankfurt)"; the general "Europe" area may place it in London or Zurich. Check it in the dashboard.
    - **Supabase's plan:** "logs deleted after a day" and "auth logs after 24 hours" are the Free plan's retention. On Pro they are 7 days, and the text changes with it. "Write audit logs to the database" should stay off, or they stay in the database.
    - **Emails:** Supabase's built-in email sends only to the project's team members, so students get no codes until a custom SMTP sender is set (the pending email-codes go-live). That sender (Brevo, say) then joins the sign-in section as a processor.
    - **The moderator:** "I check, as the moderator" holds while you are the only one in `private.moderators`.
    - **BayLDA:** "the one responsible for me" holds if you live in Bavaria.
    - **Push services:** Google LLC is on the DPF list; Apple's, Mozilla's and Microsoft's listings and the transfer basis for the push address weren't checked.
    - **Anthropic:** its DPA doesn't name the mechanism for its onward transfer from Ireland to the USA.
    - **Kept for good:** soft-deleted posts, comments and discounts stay until the account is deleted, and tombstones are never purged. The check may ask for a time limit; that would be a migration and a scheduled purge.
    - **The name at sign-up:** Supabase Auth's user metadata keeps the username, label and batch given at sign-up even after they change on Your account. The notice's "your name on posts" covers it, but clearing the metadata after sign-up would be tidier.
- **Chunk 4** (12-11-2026), the security headers:
  - **`securityHeaders()`** (`src/lib/security-headers.ts`, no imports, so `next.config.ts` can load it) on `/:path*`, beside `/sw.js`'s no-cache:
    - **Content-Security-Policy:** `default-src 'self'`; scripts and styles `'self' 'unsafe-inline'`; `img-src 'self' blob: data:`; `font-src 'self'`; `connect-src 'self'`, Supabase's origin (from `NEXT_PUBLIC_SUPABASE_URL`, so the e2e build gets its stand-in) and `https://api.frankfurter.dev`; `worker-src 'self' blob:`; `manifest-src 'self'`; `frame-ancestors`, `object-src 'none'`; `base-uri`, `form-action 'self'`; `upgrade-insecure-requests` on Vercel only.
    - **`next dev`** adds `'unsafe-eval'`, `ws:` and Speed Insights' debug script (`va.vercel-scripts.com`, which the package loads in development only). **Previews** add the Vercel Toolbar's hosts as Vercel's docs list them.
    - **The rest:** Permissions-Policy (location, mic and passkeys for the app itself; camera, payment and USB off), Referrer-Policy `strict-origin-when-cross-origin`, `nosniff`, `X-Frame-Options: DENY`, `Cross-Origin-Opener-Policy: same-origin`. HSTS is Vercel's.
  - **Checked before writing it:** MapLibre 6.16.0's modules hold no `eval` or `new Function`, but decode images and may start the worker through `blob:` URLs; Speed Insights loads `/_vercel/speed-insights/script.js` in production, the outside debug script in development only.
  - **Zod:** it probes `new Function` as each object schema is built, unless `jitless` is set, and reads its settings from `globalThis.__zod_globalConfig` as it loads. So the layout's first `<head>` script sets it (`ZOD_JITLESS_HEAD_SCRIPT`), before any bundle; `zod-jitless.test.ts` runs the script and reads the installed Zod for both.
  - **Tests:** `security-headers.test.ts` (each directive on the live site, Supabase's origin only, previews, dev, the other headers); `security-headers.spec.ts` (the headers on a page, a static file and the privacy notice; no violation reported through Home, signing in, Ask and the map), in the affected-map under `/ask`, `/privacy`, `/settings/account` and `/tips`.
  - **CLAUDE.md:** a Legal pages and security headers rule; the "no analytics" and outgoing-requests lines name Speed Insights and Show me's location service; "no legal pages yet" is gone.
  - **Real try, once on a preview** (Verification, above): the console shows no violation while using the map, signing in, Sync now, Ask and the reminder; then a header scanner such as securityheaders.com. If a header breaks something live, its line in `security-headers.ts` goes and a redeploy undoes it.
