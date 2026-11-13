# The AI features on Groq's free plan (13-11-2026)

## Context

The AI phase (quick add, Ask, the setup chat) is built on Anthropic's API through one Edge Function, `ai`, but its go-live is paused at a paid Anthropic key. Roshan asked for a free provider. Research on the providers' own pages (13-11-2026) found:
- **Groq's free plan** has production models with strict JSON-schema output and no training on data.
- **Gemini's free tier** may not serve EEA users and trains on the data.
- **Mistral's free mode** trains by default and is for evaluation.
- **Cerebras** is a trial.
- **OpenRouter's free models** are "not for production".
- **GitHub Models** is retired.
- **Cloudflare Workers AI** is free, but its JSON output is "not guaranteed".

**Decided (Roshan, 13-11-2026):**
- Groq, free plan first.
- Ask fits it by shrinking its prompt.
- **No setup chat on the free plan:** it comes back when the plan is upgraded.

**Outcome:** quick add and Ask run on Groq at no cost, within the free limits. Students see the existing "daily limit" or "busy" texts when the limits are reached. The setup chat waits, built and switched off, behind its own flag. Moving to Groq's paid plan later needs no code change: a limits migration plus the setup-chat flag.

## Groq's free plan (console.groq.com docs, Services Agreement 22-06-2026, DPA 15-10-2025)

- **Models:** `openai/gpt-oss-20b` and `openai/gpt-oss-120b`, both production and both reasoning models.
- **Limits:** per model and per organisation: 30 requests a minute, 1,000 a day, **8,000 tokens a minute**, 200,000 tokens a day. Over the limit: 429 with `retry-after`.
- **API:** OpenAI-compatible (`https://api.groq.com/openai/v1/chat/completions`), and plain `fetch` works from Deno. Strict JSON Schema via `response_format: { type: "json_schema", strict: true }`.
- **Data:**
  - no training on inputs or outputs;
  - logs kept up to 30 days unless zero data retention is on (free availability not confirmed);
  - stored in the US;
  - contract partner Groq UK Limited;
  - not on the DPF list, so the DPA's SCCs.

## The problem the plan solves

- **Ask's prompt is too big:** its system prompt (rules plus all 74 city-pack items, ~32k characters) is ~10k tokens, over the 8,000-a-minute limit. Its budget snapshot can add ~4k more (12,000 bytes).
- **Setup chats grow too big:** they reach 12–15k tokens by turn 15. That's why they stay off on the free plan (Roshan), rather than being cut down.
- **Quick add fits:** ~1–3.5k tokens.
- **Dependent code:** `index.ts` is the only Anthropic call site. `handle.ts`, `model.ts` and the builders work on a provider-neutral `ModelMessage`, tested with fakes.

## Design

- **Replace Anthropic, don't keep it switchable.** Two adapters would mean two sets of ids, efforts and prompt sizes, the SDK pinned in three places, and a privacy notice naming a recipient that depends on a server setting. A revert brings Anthropic back.
- **An OpenAI-compatible adapter, set up for Groq** (`_shared/ai/groq.ts`):
  - It speaks the common chat-completions format, with the base URL, key and model ids as settings.
  - So a later move to another provider that speaks it is mostly configuration plus the privacy texts: Mistral's EU endpoint, or the models behind a student offer (below).
  - It is a plain-`fetch` adapter, tested:
  - It builds the request: system and turns, `max_completion_tokens`, `reasoning_effort`, `response_format` strict.
  - It maps the reply to the existing `ModelMessage`: `stop`→`end_turn`, `length`→`max_tokens`, `content_filter`/`refusal`→`refusal`; usage including reasoning tokens.
  - Errors: 429 → a new `ModelBusy` (→ the existing `busy` hint); 5xx and network → `unavailable`; other statuses → `failed`, with status and code logged.
  - Retries: none for quick add (8 s budget); one for Ask and the setup chat, honouring `retry-after` within the timeout.
- **`strictJsonSchema(zodSchema)`**, `_shared/ai/strict-schema.ts`: built on zod 4's `z.toJSONSchema`. It inlines `$defs`, sets `additionalProperties: false`, requires every key, and turns nullables into `type: [T, "null"]`. It drops `format`, `pattern` and the length/item bounds, which zod re-checks after the answer anyway.
- **Models:**

  | Feature | Model | Effort | Max output |
  |---|---|---|---|
  | Quick add | gpt-oss-20b | low | 600 |
  | Ask | gpt-oss-120b | low | 2,000 |
  | Setup chat (paid plan only) | gpt-oss-120b | medium | as now |

  Limits are per model, so quick add keeps its own per-minute bucket, and Ask has 120b's to itself.
- **Shrinking Ask:**
  - `selectPack()` (`_shared/ai/pack-select.ts`, deterministic) sends only the ~10 city items whose words match the question, within ≤3,000 characters. The words come from the items' titles and categories in en/de/fr/es plus a small topic-word table, written into the pack by `scripts/write-city-pack.mjs`. Spending this month breaks ties, and a fixed set of ranges and prices is the fallback.
  - The pack is rendered without the source lines (the app shows sources from its own data).
  - Only the last question with the one before it and its answer is sent (`lastTurns`, `_shared/ai/turns.ts`).
  - **The snapshot is capped at 6,000 bytes:** 30 recent entries and one past month, instead of 60 and two. This is my call, following "shrink the prompts".
  - `finishAsk` accepts only the source ids actually sent.
- **The setup chat, off on the free plan:**
  - **Its own build flag:** `aiSetupChatInBuild()` in `src/features/ai/switch.ts` is `aiInBuild()` and `NEXT_PUBLIC_AI_SETUP_CHAT=1`. The wizard's `chatOffered` (`setup-wizard.tsx:85`) reads it in place of `aiInBuild()`, so without it a new setup is the four steps, with no chat offer and no "turn AI on" hint.
  - **Unset in Production** until the upgrade. The e2e build sets it (`E2E_SUPABASE_ENV`, `e2e/helpers/supabase.ts`), so `setup-chat.spec.ts` keeps testing it.
  - **Refused by the function too:** `ai_everyone_limit('setup')` is 0 on the free plan, so a call from an old or crafted client gets `daily-limit` and costs no tokens.
  - **Moved, not shrunk:** its builder moves to Groq unchanged (prompts as built; they fit the paid plan's limits).
- **A token budget:** `_shared/ai/budget.ts` holds Groq's free limits (dated) and a byte-based token estimate. Tests keep quick add's and Ask's worst cases, with their maximum output, at or under 7,000 tokens.
- **The daily limits fit the free plan** (a new migration replacing `ai_own_limit`/`ai_everyone_limit`; pgTAP reads the functions instead of hard-coded numbers):

  | Feature | Per account (was) | For everyone (was) |
  |---|---|---|
  | Quick add | 30 (50) | 120 (3,000) |
  | Ask | 6 (6) | 36 (300) |
  | Setup chat | 15 (15) | **0** (300) |

  That is ~80 % of each model's 200k tokens a day (quick add 120 × ~1,300 on 20b; Ask 36 × ~4,500 on 120b). `limits.test.ts` checks it from the migration and the builders' models.

## Chunks (about 1 h each, a draft PR each; checks in CI on Roshan's OK, none run locally)

1. **The adapter and schema:**
   - the plan into `docs/superpowers/plans/2026-11-13-groq-free-plan.md`, with a pointer in the AI plan;
   - `strict-schema.ts` and `groq.ts`;
   - `ModelBusy` and `ModelApiError` in `model.ts`;
   - tests (`strict-schema.test.ts`: the three answers obey the strict rules; `groq.test.ts` with a fake `fetch`: body, mapping, every `finish_reason`, 429/5xx/400, retries, abort).
   - Nothing is wired yet.
2. **The switch:**
   - `index.ts` uses `groqClient(GROQ_API_KEY)`;
   - `model.ts` and `handle.ts` lose Anthropic-only fields (`thinking`, `fallbacks`, `iterations`); `busy` comes from `ModelBusy`;
   - the builders get the models and efforts above;
   - `@anthropic-ai/sdk` goes from `package.json`, the lockfile and `deno.json`, and `pins.test.ts` follows;
   - CLAUDE.md's stack row and "The models".
3. **Picking pack items:**
   - `words`, `foldWords`, `renderPackBrief` in `pack.ts`;
   - the words in `city-pack-build.ts` and the regenerated `city-pack.ts`;
   - `pack-select.ts`, with tests: cheap food and the semester fee in four languages, Westbad, "where can I save?" ranked by spending, the fallback, caps, determinism; and no alcohol words;
   - CLAUDE.md: run the writer after `src/i18n/city` changes too, and fix "the city pack leaves the checklist out" (it no longer does).
4. **Shrinking Ask:**
   - `ask.ts` and `turns.ts`;
   - `MAX_SNAPSHOT` in `contract.ts`;
   - `src/features/ask/snapshot.ts` (`MAX_RECENT` 30, `PAST_MONTHS` 1);
   - `budget.ts`;
   - tests: only picked ids sent and accepted; turns kept, with the snapshot on the first kept turn; quick add's and Ask's worst cases ≤ 7,000 tokens.
5. **Fitting the free plan:**
   - the migration `ai_limits_groq_free` (setup 0 for everyone);
   - `ai_allowance.test.sql` reading the limit functions;
   - `limits.test.ts`;
   - `aiSetupChatInBuild()` and the wizard's `chatOffered`, with a unit test of the flag;
   - the e2e build's `NEXT_PUBLIC_AI_SETUP_CHAT=1`;
   - a `setup.spec.ts` case that a build with AI but without the flag offers no chat (or its unit test, if a second build is too costly).
6. **Texts and docs:**
   - the privacy notice's `ai` and `transfers` sections ("AI features (Groq)", the facts above, what reaches Groq now). The setup chat's part moves into its own section with a new `when: 'aiSetup'` (`content.ts`'s `LegalWhen`, `legal-page.tsx`), shown only with the flag;
   - `common.privacy.ai` and the switch text in four languages ("to Groq, in the USA");
   - the four e2e specs that pin the old texts (`ai-quick-add`, `setup-chat`, `account`, `legal`);
   - CLAUDE.md's AI section (the setup chat's flag and its 0 limit; Groq) and outgoing requests;
   - the AI plan's go-live replaced by the Groq plan's.
   - This chunk is held until Roshan confirms the DPA covers the free plan and whether zero data retention is on.

**Later, on the upgrade:** a limits migration (raise everything, setup above 0), `NEXT_PUBLIC_AI_SETUP_CHAT=1` on Vercel, and a fresh commit. No code change.

Until go-live, nothing reaches students: `NEXT_PUBLIC_AI` is unset in Production, and the function is deployed by hand.

## Go-live (Roshan, after chunk 6)

1. **Groq console:**
   - an organisation only for this app (limits are per organisation, and Playground use spends them);
   - a project and an API key;
   - Data Controls: turn on Zero Data Retention ("All customers may enable" it, per the docs' "Your data" page, read 13-11-2026). The notice's "up to 30 days" stays true as the most Groq keeps, so its text needn't change;
   - confirm the DPA covers the free plan: as written it covers all of Groq's processing on your behalf and excludes only Beta Services (Services Agreement § 3.6), and gpt-oss is a production model, but ask Groq if in doubt.
2. **Function secret:** `npx supabase secrets set GROQ_API_KEY=… AI_ALLOWED_ORIGINS=https://students-budget.vercel.app`. If an `ANTHROPIC_API_KEY` secret was ever set, `npx supabase secrets unset ANTHROPIC_API_KEY`.
3. **Migrations:** `npx supabase migration list --linked` (expect `20261109125656_ai_allowance` and `20261113113428_ai_limits_groq_free` pending if the AI never went live), then `db push`.
4. **Deploy:** `npx supabase functions deploy ai --no-verify-jwt`. Then the curl checks: OPTIONS 204, another origin 403, no token 401.
5. **Turn the app on:** `NEXT_PUBLIC_AI=1` for Production on Vercel, built from a fresh commit. Leave `NEXT_PUBLIC_AI_SETUP_CHAT` unset (set it on Previews only, to try the chat as a moderator).
6. **Real try**, watching the function's logs and Groq's usage page:
   - quick add (typed, dictated);
   - Ask in English and German, with sources that fit;
   - a new setup shows no chat offer;
   - a burst of quick adds within a minute (expect `busy`, then the phone's own reading);
   - the daily limits.
   - Note the tokens for retuning.
7. **To turn it off:** `npx supabase secrets unset GROQ_API_KEY`.

## Verification

- **CI per chunk** (`quick` checks; plus `db` for chunks 2 and 5): the adapter mapping and retries, schema strictness, pack picking, turn trimming, token budgets per feature, limits against the models, pgTAP for the limits.
- **e2e** already mocks the `ai` function. Only the pinned texts change (chunk 6, a `changed` run with `languages=all` on Roshan's OK).
- **The real try on Groq after deploy** is the only end-to-end check against the live API. Possible surprises:
  - Groq refusing a schema form (the adapter logs Groq's error code, and the fix stays in `strictJsonSchema`);
  - `max_completion_tokens` counting against the per-minute limit (the budgets already include it).

## Student credits and other ways in (official pages, read 13-11-2026)

**No program today gives free API credits to an individual student in Germany for a live app.** So the plan above (Groq's free plan) stands for the pilot. These are the upgrade paths, best first:

1. **Mistral Education plan:**
   - What it gives: Pro at a student price, with about $25.5 a month of API usage shared with Le Chat.
   - The price: about $5.99 a month for up to 12 months; its pricing page also shows $14.99, so this is not confirmed.
   - Needs a university email address; student IDs are not accepted.
   - Data: hosted in the EU, and SCCs for anything leaving it.
   - Training: free mode trains, so turn the API's training switch off in admin.mistral.ai.
   - Whether it may power a public app: not confirmed.
   - Fit: the best EU and GDPR fit; through the OpenAI-compatible adapter, a switch is configuration plus texts.
2. **Heroku through the GitHub Student Developer Pack:**
   - What it gives: $13 a month for 24 months; needs a card.
   - Models: its Managed Inference add-on offers Amazon Nova Lite, Claude Haiku and gpt-oss-120b in the EU.
   - Data: "doesn't store or log your prompts" and doesn't train, per the add-on page; but Heroku doesn't guarantee EU residency for add-ons.
   - **Whether the student credit covers this add-on is not confirmed.** Ask Heroku support first.
   - Cost: Nova Lite at about $2.60 a month for 300 calls a day (estimate).
3. **Anthropic:**
   - Ask your university whether it has **Claude for Education**, which includes API credits for students.
   - The Campus program is closed for Fall 2026, and Student Builders is no longer confirmed on any live page.
   - Community Ambassadors (open) gives monthly API credits for demos, but needs community activity with Claude Code.
4. **AWS Free plan** (not a student offer):
   - What it gives: up to $200 of credits that cover Amazon Bedrock, for 6 months; no card for most new customers.
   - Models: Nova and Claude Haiku through the EU inference profile.
   - Data: no training, and zero retention can be set.
   - Fit: good for a pilot, then it's paid.
5. **Azure for Students:**
   - What it gives: $100 a year, renewable, with no card.
   - Not documented: whether a student subscription gets any model quota (a community thread says it doesn't). The documented free tier is Global only, so with no EU guarantee.
6. **Not usable here:**
   - Gemini's free API: EEA users need paid services.
   - The Google Cloud free trial: it excludes Vertex AI for sign-ups from 16-11-2026.
   - Google's education credits: only through a lecturer's course.
   - OpenAI: research grants only, and Codex for Students is US and Canada only.
   - Cerebras, OpenRouter's free models and Cohere's trial: not for production.
   - GitHub Models: retired 30-07-2026.

**One clause to read in Groq's terms** (Services Agreement 22-06-2026):
- §1 says the Cloud Services are "not for consumer use";
- §6.3(d)(iii) forbids use "in a manner intended to avoid incurring Fees".

Both most likely aim at consumers and at dodging limits with extra accounts, not at a small app on the free plan. Roshan reads them before the go-live.

## Risks and open points

- **The free plan is small:** about 120 AI quick adds and 36 Ask questions a day for the whole app, and no setup chat. Fine for a pilot. Groq's paid Developer plan (gpt-oss-20b at $0.075 per million input tokens, SEPA, spend limits) lifts it with a limits migration.
- **A thinner Ask snapshot** answers less well about older entries; the month's per-envelope totals and top expenses remain.
- **npm 12 may refuse the lockfile change** when the SDK is removed (EALLOWREMOTE). That needs Roshan's OK for `--allow-remote=all`, per command.
- **A Groq 429 still costs the student one use** (the allowance is taken before the call). The lowered limits keep it rare.

## As built
- **Chunk 1** (13-11-2026), the adapter and the schema, not wired in yet:
  - **`strict-schema.ts`, `strictJsonSchema(zodSchema)`:**
    - zod's `z.toJSONSchema` (output side, reused parts inlined, loops and unrepresentable parts throw), with `$ref`s inlined and every object closed (`additionalProperties: false`, all properties required).
    - `anyOf [S, null]` with one type becomes `type: [T, "null"]`.
    - `$schema`, `format`, `pattern` and the length, item and number bounds are dropped, since zod checks them on the answer.
    - An optional property, a non-object answer, `allOf`/`oneOf`/`not` or a loop throws.
    - Run against the real answers: quick add's date and the setup accounts' list become type unions, and the enum stays.
  - **`groq.ts`, `chatClient({ baseUrl, apiKey })` and `groqClient(key)`:** plain `fetch` to `…/chat/completions`.
    - `chatBody` sends the system prompt, the turns, `max_completion_tokens`, `reasoning_effort` and `response_format` json_schema strict.
    - `chatMessage` maps the reply onto `ModelMessage`: `stopReasonOf` gives `stop`→`end_turn`, `length`→`max_tokens`, `content_filter` or a `refusal`→`refusal`, `tool_calls`→`tool_use`. Usage includes cached and reasoning tokens.
    - Errors: 429 → `ModelBusy` (with `retry-after`); 5xx and a lost connection → `ModelUnavailable`; another 4xx → `ModelApiError` (status, and the code only when it's a plain token); an abort passes on as it came; a reply that isn't one is a plain error (`failed`).
    - Retries: a call of 30 s or more (Ask) tries once more, waiting `retry-after` (or 2 s) when that is at most 20 s and leaves 15 s; quick add never retries.
  - **`model.ts`:** `ModelBusy` (extends `ModelUnavailable`, so `handle.ts` still says `unavailable` until chunk 2), `ModelApiError`, `usage.reasoning_tokens`, and the gpt-oss ids beside Claude's in `ModelCall.model` until chunk 2.
  - **Tests:**
    - `strict-schema.test.ts`: the three answers in strict form, the unions, the enum, inlined references, and the refusals;
    - `groq.test.ts` against a fake `fetch`, clock and sleep: the body, the URL and key, the signal, no key, reading the answer and the tokens, every stop, a cut-off answer, a refusal, empty text, a broken reply, `retry-after`, 429 on quick add (no retry) and on Ask (one), a wait too long or too late, 5xx twice, a lost connection, 400 and 401 codes, and an abort before the call or during the wait.
  - **The AI plan** points here at its top.
- **Chunk 2** (13-11-2026), the switch:
  - **`index.ts`:** `groqClient(GROQ_API_KEY)` in place of the Anthropic client; no key still means `unavailable` before any allowance. `deno.json` maps only supabase-js and zod, and `pins.test.ts` expects just those.
  - **`model.ts`:** `ModelId` is the two gpt-oss ids; `ModelCall` loses `thinking` and `fallbacks`; `ModelMessage.usage` loses `cache_creation_input_tokens` and `iterations`; `readStructured` reads the text blocks (no fallback blocks any more); `fellBack` is gone.
  - **`handle.ts`:** `ModelBusy` (a Groq 429) answers `busy` (503), which Ask and the setup chat already explain ("busy right now, try again"); `ModelApiError` answers `failed` and logs `errorStatus` and `errorCode`; the log adds `reasoningTokens` and drops `fallback` and `cacheWriteTokens`. The contract's comment on `busy` names the provider's rate limit.
  - **The builders:**

    | Builder | Model | Effort | Max output |
    |---|---|---|---|
    | Quick add | gpt-oss-20b | low | 600 |
    | Ask | gpt-oss-120b | low | 2,000 |
    | Setup chat | gpt-oss-120b | medium | 8,000 (paid plan only) |

    Ask's prompt still holds the whole city pack until chunks 3 and 4 shrink it, so the function isn't deployed before then.
  - **Tests:** the builders' calls, the handle test (a 429 → `busy`, a refused request → `failed` with status and code, the log's fields), `model.test.ts` without fallbacks, `groq.test.ts`'s sample call.
  - **Left for a follow-up:** `@anthropic-ai/sdk` stays in `package.json` and the lockfile, unused. Removing it is an npm install (heavy lane, Roshan's approval today), and npm 12 may refuse the lockfile change (EALLOWREMOTE).
  - **Left for chunk 6:** the texts that name Anthropic (the notice, the `ai` note, the switch, their e2e specs). AI stays off in Production meanwhile.
- **Chunk 3** (13-11-2026), picking the city items, not wired into Ask yet:
  - **`pack.ts`:**
    - `PackItem.words`: the item's words, joined by spaces, sorted; never sent to the model.
    - `foldWords(text)`: NFKD with the marks dropped, lower case, ß as ss; words of 3 letters or more, no number alone, no stop word (English, German, French and Spanish, plus Regensburg and euro); each without one ending (en, er, es, e, s, n) when 4 letters stay; each once. Questions and items fold alike.
    - `renderPackBrief(items)`: `[id] text (estimate)`, without the source and checked day, which the app shows from its own data.
  - **`city-pack-build.ts`:** each item's words come from its English text, its title in German, French and Spanish (`CITY_WORDS`: tips, swaps and checklist items; a discount's place and offer), its category's names in all four (`src/i18n/messages/<code>/categories.ts`) and `TOPIC_WORDS` (one line per category in the pack and per kind, in the four languages, no alcohol). 64 words an item on average, 125 at most; `city-pack.ts` grows to 80 KB.
  - **`write-city-pack.mjs`** registers the app's imports (`mcp/app-imports.ts`) before it loads the builder, since the city words import without extensions. Run it after changing `src/data`, `src/i18n/city` or the category names.
  - **`pack-select.ts`, `selectPack({ question, earlier, spend }, pack, limits)`:**
    - Each word of the question counts 2, each word of an earlier question 1, times its rarity (`log(1 + items / items it matches)`), against every item it matches.
    - `wordMatch`: the same word is 1; a half when the shorter (5 letters or more) starts the longer ("cheap", "cheaply") or the shorter (6 or more) ends it ("beitrag", "semesterbeitrag").
    - Equal scores go by this month's spending in the item's category (`spend`, euros by category id: the snapshot's envelopes in chunk 4), then by the pack's order.
    - No match: the 7 ranges and 3 prices. At most 10 items and 3,000 characters (`PICK_LIMITS`); an item that would go over is skipped.
    - Measured: the whole pack is 32,445 characters with its sources and 15,781 brief; the sample questions' picks take 1,602 to 2,934 characters, the fallback 655.
  - **Tests:**
    - `pack-select.test.ts`: folding and stop words in the four languages, endings, `wordMatch`, cheap food and every semester fee in the four languages, Westbad first in each, ties by spending, the question over the earlier ones and a follow-up, the fallback, the limits and a skipped long item, the same picks each time;
    - `city-pack.test.ts`: every item's words (sorted, once, its own text's), the other languages' titles and offers and the category names in them, `TOPIC_WORDS` for every category and kind with no alcohol word, and the brief form without sources or words.
  - **CLAUDE.md:** the writer's rule names `src/i18n/city`, and the checklist rule says the pack and the MCP server carry the checklist (they have since the checklist was built).
- **Chunk 4** (13-11-2026), Ask within the free plan's tokens (on top of chunk 3's branch):
  - **`ask.ts`:**
    - `askPicks(request)`: `selectPack` with the last question, the earlier ones and `spendOf(snapshot)` (`thisMonth.envelopes`, read with zod; nothing when it doesn't read).
    - `askSystem(picks)`: the rules, then the picks in `renderPackBrief` form under "City data for Regensburg that may help with this question".
    - `finishAsk(answer, request, picks = askPicks(request))`: keeps only the ids sent, and backs amounts with the snapshot and the brief picks. The function hands `call` and `finish` the same scrubbed request, so both pick alike.
  - **`turns.ts`, `lastTurns`:** the last 3 turns, an earlier answer cut at a space to 800 characters (`KEPT_ANSWER`, `cutAnswer`); the snapshot rides on the first kept question.
  - **`contract.ts`:** `MAX_SNAPSHOT` (6,000 bytes) for Ask's snapshot; the setup draft keeps `MAX_DATA` (12,000).
  - **`snapshot.ts`:** `MAX_RECENT` 30 and `PAST_MONTHS` 1. Over `MAX_SNAPSHOT` it drops the oldest recent entries, then the past month, the smallest top expenses and the latest one-offs. A budget with every flexible envelope keeps about 17 recent entries; the heaviest test budget keeps only its plan and one-offs.
  - **`budget.ts`:** `GROQ_FREE_PLAN` (dated), `MAX_CALL_TOKENS` 7,000 and `callTokens(call)`: the system prompt, the messages and the answer's strict schema in UTF-8 bytes, 30 bytes of framing a message, 3 bytes a token, plus the output limit.
  - **Measured with `callTokens`:**
    - quick add's largest call (60 categories, 20 accounts, the longest line, all in two-byte letters): 5,916;
    - Ask's largest: 5,925 as picked, 6,809 with the most city data a pick can hold (3,000 characters at the pack's most bytes a character).
    - At 1,000 characters for the earlier answer it was 6,942, too close, hence 800.
  - **The privacy notice:** Ask's line says this month's and last month's figures and up to 30 entries; the rest of its AI section waits for chunk 6.
- **Chunk 5** (13-11-2026), fitting the free plan (on top of chunk 4's branch):
  - **Migration `20261113113428_ai_limits_groq_free.sql`:** `create or replace` of both limit functions (owner and privileges kept, revoked again).

    | Feature | Per account (was) | For everyone (was) |
    |---|---|---|
    | Quick add | 30 (50) | 120 (3,000) |
    | Ask | 6 (6) | 36 (300) |
    | Setup chat | **0** (15) | **0** (300) |

    The setup chat is 0 for one account as well as for everyone, so a call is refused as `daily-limit`, not `busy` (everyone's limit is checked second). The plan had 15 per account; that only changed which hint came back. A moderator still has no limit, so Roshan can try the chat on a preview with the flag.
  - **`ai_allowance.test.sql`:** sections 1 to 5 read the limits through `pg_temp.own` and `pg_temp.everyone`; everyone's limit is now tested on Ask (the setup chat is 0); section 6 holds the numbers in force and the setup chat's `daily-limit`. 24 checks.
  - **`limits.test.ts`:** reads the latest migration that defines each function; checks every feature is named, one account never above everyone, the setup chat at 0, and each model's day.
    - Quick add has gpt-oss-20b to itself: 120 a day at a typical 1,299 tokens is 155,880.
    - Ask and the setup chat share gpt-oss-120b: 36 at a typical 4,111 is 147,996, and the setup chat adds nothing at 0.
    - Both are under 160,000 (80 % of 200,000) and 1,000 requests.
    - A typical call is its input as `callTokens` counts it, plus a typical answer (quick add 250 tokens, Ask 800) in place of the output limit.
  - **The flag:** `aiSetupChatInBuild()` (`src/features/ai/switch.ts`) is `aiInBuild()` and `NEXT_PUBLIC_AI_SETUP_CHAT=1`.
    - The wizard's `chatOffered` reads it, so without it there is no offer and no switch hint.
    - `E2E_SUPABASE_ENV` sets it, so `setup-chat.spec.ts` still runs.
    - `switch.test.ts` covers on, off without the flag (the free plan's build) and off without the AI. A second e2e build without the flag would cost a full build per run, so the unit test stands in.
  - **After merging:** `db push` for the migration (Roshan), before the function goes live.
- **Chunk 6** (13-11-2026), texts and docs (on top of chunk 5's branch). Built before Roshan's two confirmations, since Groq's own pages answer them as far as documents can (read 13-11-2026); the go-live keeps both checks.
  - **Groq's terms, as read:**
    - **Contract:** Groq UK Limited (London) for customers in the EEA (Services Agreement, last modified 22-06-2026).
    - **Training:** "Groq is not permitted to use Inputs or Outputs for training" (§ 4.2).
    - **DPA (15-10-2025):** Groq is the processor; EU SCCs modules 2 and 3; processing "in the United States and other countries" of Groq and its subprocessors. It excludes no free use; Beta Services sit outside it (§ 3.6).
    - **"Your data" page:**
      - no inference data retained by default;
      - inputs and outputs may be logged for troubleshooting or abuse investigations, up to 30 days unless the law requires longer;
      - stored in GCP buckets in the USA;
      - Zero Data Retention open to all customers.
    - **Privacy policy (12-11-2025):** Groq LLC as controller covers only its own services, not API customer data.
  - **The privacy notice:**
    - **"AI features (Groq)":**
      - what quick add and Ask send;
      - that Ask's conversation reaches Groq only as its last exchange;
      - Groq UK Limited as processor, with processing in the USA and its subprocessors' countries;
      - no training, and logs only for troubleshooting or abuse, up to 30 days.
    - **The setup chat** moves into its own section, "Set up by chatting (Groq)" (`ai-setup`, `when: 'aiSetup'`). `LegalWhen` and `LegalPage` gain `aiSetup` from `aiSetupChatInBuild()`, so the free plan's build doesn't describe a chat it doesn't offer.
    - **Transfers:** names Groq (United Kingdom, with processing in the USA) under the SCCs beside Supabase.
    - **The top comment** names Groq's documents and their dates.
  - **The `ai` note and the switch's hint** in English, German, French and Spanish: "to Groq, an AI service, in the USA" (the switch: "to Groq, an AI service in the USA … nothing goes to Groq").
  - **Tests:**
    - `privacy-notice.test.ts`: the new section's place, the free plan's build without it, Set up by chatting named there and not in `ai`, its legal basis;
    - `content.test.ts`: the build record with `aiSetup`;
    - e2e: `ai-quick-add`, `setup-chat`, `account` and `legal` pin the new texts and headings (the e2e build has the setup chat's flag).
  - **The AI plan's go-live** now points here; this plan's go-live names Zero Data Retention, the DPA reading, the two pending migrations, the old secret to unset and the setup chat's flag.
  - **Tests:**
    - `budget.test.ts`: both largest calls, the margin, what `callTokens` counts;
    - `ask.test.ts`: the picks in the system prompt and not the rest, no sources, the same picks for the same question, ties by the snapshot's spending, the last exchange only, `cutAnswer`, ids and amounts held to what was sent;
    - `contract.test.ts` and `snapshot.test.ts`: the new cap, one past month, the drop order.
