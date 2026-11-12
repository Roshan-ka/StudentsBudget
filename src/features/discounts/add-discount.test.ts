import { readFileSync } from 'node:fs';
import type { SupabaseClient } from '@supabase/supabase-js';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CATEGORIES } from '@/data/categories';
import { MESSAGES } from '@/i18n/messages';
import {
  ADDRESS_MAX,
  addDiscount,
  checkDiscount,
  CONDITIONS_MAX,
  DISCOUNT_CATEGORIES,
  EMPTY_DISCOUNT,
  LINK_MAX,
  OFFER_MAX,
  OFFER_MIN,
  PLACE_MAX,
  PLACE_MIN,
  PROBLEM_FIELD,
  type DiscountDraft,
} from './add-discount';

const MIGRATION = 'supabase/migrations/20261111101604_community_discounts.sql';

const filled: DiscountDraft = {
  ...EMPTY_DISCOUNT,
  place: '  Café Lena ',
  offer: ' 10 % off with a student card ',
  link: ' https://www.example.de/cafe ',
};

/** A client whose every call answers `answer`, keeping what was asked. */
function fakeSupabase(answer: { error: { code?: string; hint?: string } | null } | Error) {
  const calls: { fn: string; args: unknown }[] = [];
  const client = {
    rpc: async (fn: string, args: unknown) => {
      calls.push({ fn, args });
      if (answer instanceof Error) throw answer;
      return { data: answer.error === null ? 'd1' : null, error: answer.error };
    },
  } as unknown as SupabaseClient;
  return { client, calls };
}

describe('a new discount', () => {
  it('is trimmed, with an empty address and conditions left out', () => {
    expect(checkDiscount({ ...filled, conditions: ' ', address: '' })).toEqual({
      ok: true,
      discount: {
        place: 'Café Lena',
        offer: '10 % off with a student card',
        conditions: null,
        address: null,
        categoryId: 'eating-out',
        link: 'https://www.example.de/cafe',
        lat: null,
        lng: null,
      },
    });
    expect(checkDiscount({ ...filled, conditions: ' Weekdays ', address: ' Gesandtenstraße 1 ' })).toMatchObject({
      ok: true,
      discount: { conditions: 'Weekdays', address: 'Gesandtenstraße 1' },
    });
  });

  it('says the first thing wrong, in the form’s order, by the table’s rules', () => {
    const problem = (draft: Partial<DiscountDraft>) => {
      const checked = checkDiscount({ ...filled, ...draft });
      return checked.ok ? null : checked.problem;
    };
    expect(problem({ place: 'x' })).toBe('placeShort');
    expect(problem({ place: 'x'.repeat(PLACE_MAX + 1) })).toBe('placeLong');
    expect(problem({ offer: 'ab' })).toBe('offerShort');
    expect(problem({ offer: 'x'.repeat(OFFER_MAX + 1) })).toBe('offerLong');
    expect(problem({ conditions: 'x'.repeat(CONDITIONS_MAX + 1) })).toBe('conditionsLong');
    expect(problem({ address: 'x'.repeat(ADDRESS_MAX + 1) })).toBe('addressLong');
    // The link is required: the source of a discount nobody checked.
    expect(problem({ link: '' })).toBe('link');
    expect(problem({ link: 'http://www.example.de' })).toBe('link');
    expect(problem({ link: 'https://www.example.de/a b' })).toBe('link');
    expect(problem({ link: `https://${'x'.repeat(LINK_MAX)}` })).toBe('link');
    expect(problem({ place: 'x', offer: 'ab', link: '' })).toBe('placeShort');
    expect(problem({ place: 'x'.repeat(PLACE_MIN), offer: 'x'.repeat(OFFER_MIN) })).toBeNull();
  });

  it('ties every problem to its field', () => {
    expect(PROBLEM_FIELD).toEqual({
      placeShort: 'place',
      placeLong: 'place',
      offerShort: 'offer',
      offerLong: 'offer',
      conditionsLong: 'conditions',
      addressLong: 'address',
      link: 'link',
      pin: 'pin',
    });
  });

  it('sends a pin to 5 decimals, and refuses one outside Regensburg (discount map, chunk 8)', () => {
    expect(checkDiscount({ ...filled, pin: { lat: 49.019364781, lng: 12.089651234 } })).toMatchObject({
      ok: true,
      discount: { lat: 49.01936, lng: 12.08965 },
    });
    expect(checkDiscount({ ...filled, pin: { lat: 48.13743, lng: 11.57549 } })).toEqual({ ok: false, problem: 'pin' });
    expect(checkDiscount({ ...filled, pin: { lat: 49.02, lng: 12.21 } })).toEqual({ ok: false, problem: 'pin' });
    // The other fields come first, in the form's order.
    expect(checkDiscount({ ...filled, link: '', pin: { lat: 48.1, lng: 11.5 } })).toEqual({ ok: false, problem: 'link' });
  });

  it('follows the table’s checks and the daily limit, and its messages state the same numbers', () => {
    const sql = readFileSync(MIGRATION, 'utf8');
    expect(sql).toContain(`char_length(place) between ${PLACE_MIN} and ${PLACE_MAX}`);
    expect(sql).toContain(`char_length(address) between 1 and ${ADDRESS_MAX}`);
    expect(sql).toContain(`char_length(offer) between ${OFFER_MIN} and ${OFFER_MAX}`);
    expect(sql).toContain(`char_length(conditions) between 1 and ${CONDITIONS_MAX}`);
    expect(sql).toContain(`char_length(link) <= ${LINK_MAX}`);
    expect(sql).toContain(") >= 3 then\n    raise exception 'three discounts a day'");
    for (const code of Object.keys(MESSAGES) as (keyof typeof MESSAGES)[]) {
      const form = MESSAGES[code].tips.studentDiscounts.form;
      expect(form.errors.placeShort, code).toContain(String(PLACE_MIN));
      expect(form.errors.placeLong, code).toContain(String(PLACE_MAX));
      expect(form.errors.offerShort, code).toContain(String(OFFER_MIN));
      expect(form.errors.offerLong, code).toContain(String(OFFER_MAX));
      expect(form.errors.conditionsLong, code).toContain(String(CONDITIONS_MAX));
      expect(form.errors.addressLong, code).toContain(String(ADDRESS_MAX));
      expect(form.errors.dailyLimit, code).toContain('3');
    }
  });

  it('can be in the app’s expense categories, whose ids the table accepts', () => {
    const known = new Set(CATEGORIES.map((category) => category.id));
    expect(DISCOUNT_CATEGORIES.filter((id) => !known.has(id))).toEqual([]);
    expect(DISCOUNT_CATEGORIES).toContain(EMPTY_DISCOUNT.categoryId);
    expect(DISCOUNT_CATEGORIES).not.toContain('one-off');
    expect(DISCOUNT_CATEGORIES.filter((id) => !/^[a-z][a-z-]{1,29}$/.test(id))).toEqual([]);
  });
});

describe('adding', () => {
  beforeEach(() => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  const discount = {
    place: 'Café Lena',
    offer: '10 % off with a student card',
    conditions: null,
    address: 'Gesandtenstraße 1',
    categoryId: 'eating-out',
    link: 'https://www.example.de/cafe',
    lat: 49.01936,
    lng: 12.08965,
  };

  it('sends the discount in the phone’s language, with its pin', async () => {
    const { client, calls } = fakeSupabase({ error: null });
    expect(await addDiscount(client, discount, 'de')).toBe('added');
    expect(calls).toEqual([
      {
        fn: 'post_discount',
        args: {
          p_place: 'Café Lena',
          p_address: 'Gesandtenstraße 1',
          p_offer: '10 % off with a student card',
          p_conditions: null,
          p_category: 'eating-out',
          p_link: 'https://www.example.de/cafe',
          p_lang: 'de',
          p_lat: 49.01936,
          p_lng: 12.08965,
        },
      },
    ]);
  });

  it('sends no position without a pin', async () => {
    const { client, calls } = fakeSupabase({ error: null });
    await addDiscount(client, { ...discount, lat: null, lng: null }, 'en');
    expect(calls[0].args).toMatchObject({ p_lat: null, p_lng: null });
  });

  it('reads the database’s refusals by their hint or code', async () => {
    const answer = async (error: { code?: string; hint?: string }) =>
      addDiscount(fakeSupabase({ error }).client, discount, 'en');
    expect(await answer({ code: 'P0001', hint: 'needs-username' })).toBe('needs-username');
    expect(await answer({ code: 'P0001', hint: 'daily-limit' })).toBe('daily-limit');
    expect(await answer({ code: '23514' })).toBe('invalid');
    expect(await answer({ code: '42501' })).toBe('failed');
    expect(await addDiscount(fakeSupabase(new Error('offline')).client, discount, 'en')).toBe('failed');
  });
});
