import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { CITIES } from '@/data/cities';
import { DISCOUNTS } from '@/data/discounts';
import { SWAPS } from '@/data/swaps';
import { TIPS } from '@/data/tips';
import { CITY_PACK } from '../../../../supabase/functions/_shared/ai/city-pack';
import { renderPack } from '../../../../supabase/functions/_shared/ai/pack';
import { buildCityPack, cityPackFile, LEFT_OUT_PRICES } from './city-pack-build';

// The Regensburg data the AI may quote (the AI phase, chunk 8), written from src/data.

describe('the city pack', () => {
  it('is what src/data says now (run `node scripts/write-city-pack.mjs` when this fails)', () => {
    expect(readFileSync('supabase/functions/_shared/ai/city-pack.ts', 'utf8')).toBe(cityPackFile(buildCityPack()));
  });

  it('has every tip, discount and swap, each item once', () => {
    const ids = CITY_PACK.map((item) => item.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const tip of TIPS) expect(ids).toContain(`tip:${tip.id}`);
    for (const discount of DISCOUNTS) expect(ids).toContain(`discount:${discount.id}`);
    for (const swap of SWAPS) expect(ids).toContain(`swap:${swap.id}`);
    for (const range of CITIES.regensburg.ranges) expect(ids).toContain(`range:${range.categoryId}`);
  });

  it('leaves out the Deutschlandticket and the beer price, by labels that still exist', () => {
    const labels = CITIES.regensburg.prices.map((price) => price.label);
    for (const label of LEFT_OUT_PRICES) expect(labels).toContain(label);
    expect(renderPack(CITY_PACK)).not.toMatch(/Deutschlandticket per month|€63\b|€66\.80/);
  });

  it('holds nothing about alcohol, and no links', () => {
    const text = renderPack(CITY_PACK);
    expect(text).not.toMatch(/\b(beer|bier|wine|wein|alcohol|alkohol|cocktails?|spirits|schnaps|happy hour)\b/i);
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
});
