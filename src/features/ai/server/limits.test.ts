import { readdirSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { CATEGORIES } from '@/data/categories';
import { AI_FEATURES, type AiFeature, type AskRequest } from '@/features/ai/contract';
import { askBuilder } from '../../../../supabase/functions/_shared/ai/ask';
import { callTokens, GROQ_FREE_PLAN } from '../../../../supabase/functions/_shared/ai/budget';
import type { ModelCall } from '../../../../supabase/functions/_shared/ai/model';
import { quickAddBuilder } from '../../../../supabase/functions/_shared/ai/quick-add';
import { setupBuilder } from '../../../../supabase/functions/_shared/ai/setup';

// The AI features' daily allowances against Groq's free plan (the Groq switch, chunk 5): each model's day, at a
// typical call, stays at or under 80 % of the plan's tokens and within its requests. The numbers come from the latest
// migration that defines each limit function, as the database runs them.

const MIGRATIONS = 'supabase/migrations';

/** The share of a model's daily tokens the allowances may plan for, leaving room for longer calls than typical. */
const DAILY_SHARE = 0.8;

/** `when '<feature>' then <n>` of the latest migration that defines `private.<name>`. */
function limitsOf(name: string): Record<string, number> {
  const marker = `function private.${name}(`;
  const latest = readdirSync(MIGRATIONS)
    .filter((file) => file.endsWith('.sql'))
    .sort()
    .filter((file) => readFileSync(`${MIGRATIONS}/${file}`, 'utf8').includes(marker))
    .at(-1);
  if (latest === undefined) throw new Error(`no migration defines private.${name}`);
  const text = readFileSync(`${MIGRATIONS}/${latest}`, 'utf8');
  const body = text.slice(text.indexOf(marker));
  const cases = /case p_feature((?:\s+when '[a-z-]+' then \d+)+)\s+end/.exec(body);
  if (cases === null) throw new Error(`private.${name} in ${latest} has no case list`);
  return Object.fromEntries([...cases[1].matchAll(/when '([a-z-]+)' then (\d+)/g)].map(([, feature, n]) => [feature, Number(n)]));
}

const OWN = limitsOf('ai_own_limit');
const EVERYONE = limitsOf('ai_everyone_limit');

/** A snapshot of `size` bytes. */
const snapshotOf = (size: number) => ({ notes: ['x'.repeat(size - JSON.stringify({ notes: [''] }).length)] });

/**
 * A typical call of each feature and the tokens it uses: its input as `callTokens` counts it (on the safe side), and
 * a typical answer with its reasoning in place of the output limit.
 *   quick add: the app's flexible categories, two accounts, a short line; about 250 tokens out.
 *   Ask: a follow-up with a 4,500-byte snapshot and an earlier answer of 700 characters; about 800 tokens out.
 *   setup: a first message with an empty draft (off on the free plan, so it counts nothing while its limit is 0).
 */
const TYPICAL: Record<AiFeature, { call: ModelCall; output: number }> = {
  'quick-add': {
    call: quickAddBuilder.call({
      feature: 'quick-add',
      lang: 'en',
      today: '2026-11-13',
      line: 'döner 6 at the station',
      categories: CATEGORIES.filter((category) => category.kind === 'flexible').map(({ id, name }) => ({ id, name })),
      accounts: [
        { ref: 'a1', name: 'Local bank', kind: 'bank', currency: 'EUR' },
        { ref: 'a2', name: 'Cash', kind: 'cash', currency: 'EUR' },
      ],
    }),
    output: 250,
  },
  ask: {
    call: askBuilder.call({
      feature: 'ask',
      lang: 'en',
      today: '2026-11-13',
      snapshot: snapshotOf(4_500),
      turns: [
        { role: 'user', text: 'How much is left this month?' },
        { role: 'assistant', text: 'x'.repeat(700) },
        { role: 'user', text: 'Where can I eat cheaply this week?' },
      ],
    } satisfies AskRequest),
    output: 800,
  },
  setup: {
    call: setupBuilder.call({
      feature: 'setup',
      lang: 'en',
      today: '2026-11-13',
      draft: {},
      turns: [{ role: 'user', text: 'I get €900 from my parents.' }],
    }),
    output: 1_500,
  },
};

const typicalTokens = (feature: AiFeature) =>
  callTokens(TYPICAL[feature].call) - TYPICAL[feature].call.maxTokens + TYPICAL[feature].output;

describe('the daily allowances', () => {
  it('name every feature, in both limits', () => {
    expect(Object.keys(OWN).sort()).toEqual([...AI_FEATURES].sort());
    expect(Object.keys(EVERYONE).sort()).toEqual([...AI_FEATURES].sort());
  });

  it('never give one account more than everyone together', () => {
    for (const feature of AI_FEATURES) expect(OWN[feature], feature).toBeLessThanOrEqual(EVERYONE[feature]);
  });

  it('keep the setup chat off on the free plan', () => {
    expect(OWN.setup).toBe(0);
    expect(EVERYONE.setup).toBe(0);
  });

  it('fit each model’s day on the free plan: its requests, and 80 % of its tokens at a typical call', () => {
    const byModel = new Map<string, AiFeature[]>();
    for (const feature of AI_FEATURES) {
      const model = TYPICAL[feature].call.model;
      byModel.set(model, [...(byModel.get(model) ?? []), feature]);
    }
    // Quick add has a model to itself, so its many short calls never take Ask's minute.
    expect(byModel.get(TYPICAL['quick-add'].call.model)).toEqual(['quick-add']);

    for (const [model, features] of byModel) {
      const requests = features.reduce((sum, feature) => sum + EVERYONE[feature], 0);
      const tokens = features.reduce((sum, feature) => sum + EVERYONE[feature] * typicalTokens(feature), 0);
      expect(requests, model).toBeLessThanOrEqual(GROQ_FREE_PLAN.requestsPerDay);
      expect(tokens, model).toBeLessThanOrEqual(GROQ_FREE_PLAN.tokensPerDay * DAILY_SHARE);
    }
  });

  it('count a typical call at what it really takes, below its largest', () => {
    expect(typicalTokens('quick-add')).toBeGreaterThan(1_000);
    expect(typicalTokens('quick-add')).toBeLessThan(callTokens(TYPICAL['quick-add'].call));
    expect(typicalTokens('ask')).toBeGreaterThan(3_000);
  });
});
