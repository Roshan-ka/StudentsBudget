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
   - Data Controls: zero data retention on if offered (tell Claude: the notice text changes);
   - confirm the DPA covers the free plan.
2. **Function secret:** `npx supabase secrets set GROQ_API_KEY=… AI_ALLOWED_ORIGINS=https://students-budget.vercel.app`.
3. **Migrations:** `npx supabase migration list --linked`, then `db push`.
4. **Deploy:** `npx supabase functions deploy ai --no-verify-jwt`. Then the curl checks: OPTIONS 204, another origin 403, no token 401.
5. **Turn the app on:** `NEXT_PUBLIC_AI=1` for Production on Vercel, built from a fresh commit.
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
