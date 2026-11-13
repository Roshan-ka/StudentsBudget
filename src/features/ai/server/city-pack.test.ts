import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { CHECKLIST } from '@/data/checklist';
import { CITIES } from '@/data/cities';
import { DISCOUNTS } from '@/data/discounts';
import { SWAPS } from '@/data/swaps';
import { TIPS } from '@/data/tips';
import { CITY_WORDS } from '@/i18n/city';
import { CITY_PACK } from '../../../../supabase/functions/_shared/ai/city-pack';
import { foldWords, renderPack, renderPackBrief } from '../../../../supabase/functions/_shared/ai/pack';
import { buildCategories, buildCityPack, cityPackFile, LEFT_OUT_PRICES, TOPIC_WORDS } from './city-pack-build';

// The Regensburg data the AI may quote (the AI phase, chunk 8), written from src/data; each item's words since the Groq
// switch, chunk 3.

const ALCOHOL = /\b(beer|bier|wine|wein|alcohol|alkohol|cocktails?|spirits|schnaps|happy hour|drinks?|drinking)\b/i;

describe('the city pack', () => {
  it('is what src/data says now (run `node scripts/write-city-pack.mjs` when this fails)', () => {
    expect(readFileSync('supabase/functions/_shared/ai/city-pack.ts', 'utf8')).toBe(cityPackFile(buildCityPack(), buildCategories()));
  });

  it('has every tip, discount, swap and checklist item, each item once', () => {
    const ids = CITY_PACK.map((item) => item.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const tip of TIPS) expect(ids).toContain(`tip:${tip.id}`);
    for (const discount of DISCOUNTS) expect(ids).toContain(`discount:${discount.id}`);
    for (const swap of SWAPS) expect(ids).toContain(`swap:${swap.id}`);
    for (const item of CHECKLIST) expect(ids).toContain(`checklist:${item.id}`);
    for (const range of CITIES.regensburg.ranges) expect(ids).toContain(`range:${range.categoryId}`);
  });

  it('leaves out the Deutschlandticket and the beer price, by labels that still exist', () => {
    const labels = CITIES.regensburg.prices.map((price) => price.label);
    for (const label of LEFT_OUT_PRICES) expect(labels).toContain(label);
    expect(renderPack(CITY_PACK)).not.toMatch(/Deutschlandticket per month|€63\b|€66\.80/);
  });

  it('holds nothing about alcohol, and no links', () => {
    const text = renderPack(CITY_PACK);
    expect(text).not.toMatch(ALCOHOL);
    expect(text).not.toMatch(/https?:\/\/|www\./);
  });

  it('names a source and a checked day for every item, and marks the estimates', () => {
    for (const item of CITY_PACK) {
      expect(item.source, item.id).not.toBe('');
      expect(item.checked, item.id).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    }
    const estimate = (id: string) => CITY_PACK.find((item) => item.id === id)?.estimate;
    expect(estimate('range:eating-out')).toBe(true);
    expect(estimate('range:rent')).toBe(false);
    expect(renderPack(CITY_PACK)).toContain('[range:eating-out] Eating out in Regensburg: €30–€135 a month. (estimate) Source: Estimate;');
  });

  it('says each checklist item’s group and who it is for, in the words of its title and text', () => {
    const text = (id: string) => CITY_PACK.find((item) => item.id === `checklist:${id}`)?.text;
    expect(text('register-your-address')).toBe(
      'Checklist for new students (first weeks): Register your address. Register at the city’s registration office within two weeks of moving in.',
    );
    expect(text('residence-permit')).toMatch(/^Checklist for new students \(first weeks, for students from abroad\): Apply for your residence permit\. /);
    expect(text('keep-kindergeld')).toMatch(/^Checklist for new students \(money to claim, for students under 25\): /);
    expect(text('rundfunkbeitrag-exemption')).toMatch(/^Checklist for new students \(money to claim, for students on BAföG\): /);
    for (const item of CITY_PACK.filter((i) => i.kind === 'checklist')) expect(item.categoryId, item.id).toBeNull();
  });

  it('gives every item its words: its own text’s, sorted, each once', () => {
    for (const item of CITY_PACK) {
      const words = item.words.split(' ');
      expect(words.length, item.id).toBeGreaterThan(0);
      expect(words, item.id).toEqual([...new Set(words)].sort());
      expect(words, item.id).toEqual(expect.arrayContaining(foldWords(item.text)));
    }
  });

  it('adds the titles in the app’s other languages and the category’s names, so a question in any of them finds it', () => {
    const wordsOf = (id: string) => CITY_PACK.find((item) => item.id === id)?.words.split(' ') ?? [];
    for (const words of Object.values(CITY_WORDS)) {
      for (const tip of TIPS) {
        const title = words?.tips[tip.id]?.title;
        if (title !== undefined) expect(wordsOf(`tip:${tip.id}`), tip.id).toEqual(expect.arrayContaining(foldWords(title)));
      }
      for (const discount of DISCOUNTS) {
        const offer = words?.discounts[discount.id]?.offer;
        if (offer === undefined) continue;
        expect(wordsOf(`discount:${discount.id}`), discount.id).toEqual(expect.arrayContaining(foldWords(offer)));
      }
    }
    expect(wordsOf('range:food')).toEqual(expect.arrayContaining(foldWords('Lebensmittel Alimentation Alimentación')));
  });

  it('has topic words for every category in the pack and every kind, none about alcohol', () => {
    for (const item of CITY_PACK) {
      if (item.categoryId !== null) expect(TOPIC_WORDS[item.categoryId], item.categoryId).toBeTruthy();
      expect(TOPIC_WORDS[`kind:${item.kind}`], item.kind).toBeTruthy();
    }
    for (const [key, words] of Object.entries(TOPIC_WORDS)) expect(words, key).not.toMatch(ALCOHOL);
    for (const item of CITY_PACK) expect(item.words, item.id).not.toMatch(ALCOHOL);
  });

  it('sends the model an item’s text without its source, and never its words', () => {
    const brief = renderPackBrief(CITY_PACK);
    expect(brief.split('\n')).toHaveLength(CITY_PACK.length);
    expect(brief).toContain('[range:eating-out] Eating out in Regensburg: €30–€135 a month. (estimate)\n');
    expect(brief).not.toContain('Source:');
    expect(brief).not.toContain(CITY_PACK[0].words);
    expect(renderPack(CITY_PACK)).not.toContain(CITY_PACK[0].words);
  });
});
