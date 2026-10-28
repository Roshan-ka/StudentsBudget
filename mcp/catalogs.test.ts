import { describe, expect, it } from 'vitest';
import { DISCOUNTS } from '@/data/discounts';
import { SWAPS } from '@/data/swaps';
import { TIPS } from '@/data/tips';
import { holds, orderOf } from './catalog.ts';
import { DISCOUNT_SEARCH_EXAMPLES, findDiscounts, type FoundDiscounts } from './discounts.ts';
import { COST_SEARCH_EXAMPLES, regensburgCosts } from './regensburg-costs.ts';
import { SEMESTER_NOTE, type UniversityInfo } from './semesters.ts';
import { findSwaps, SWAP_SEARCH_EXAMPLES, type FoundSwaps } from './swaps.ts';
import { findTips, TIP_SEARCH_EXAMPLES, type FoundTips } from './tips.ts';
import { call, connect } from './test-client.ts';

// The tools use the app's own helpers (category names and order, amounts, savings, staleness, semesters), loaded
// through the import hook, so there is no copy to keep in step. These tests check what the tools make of them.

describe('the search', () => {
  it('wants every word, in any case, at the start of a word in the texts', () => {
    expect(holds('student PRICE', 'Students pay the reduced', 'price')).toBe(true);
    expect(holds('student yacht', 'Students pay the reduced price')).toBe(false);
    expect(holds('rent', 'the menu page shows the current week')).toBe(false);
    expect(holds('rent', 'Rent', 'rental')).toBe(true);
    expect(holds('ost', 'Sportpark Ost pool')).toBe(true);
    expect(holds('über', 'Fahrrad, (über)all')).toBe(true);
    expect(holds('(c++', 'learn (c++ today')).toBe(true);
    expect(holds('  ', 'anything')).toBe(true);
    expect(holds(undefined, 'anything')).toBe(true);
  });

  it('finds something for every example word a tool offers', () => {
    for (const word of COST_SEARCH_EXAMPLES) expect(regensburgCosts(word).note, word).not.toMatch(/^Nothing matched/);
    for (const word of DISCOUNT_SEARCH_EXAMPLES) {
      expect(findDiscounts('2026-10-28', undefined, word).note, word).not.toMatch(/^Nothing matched/);
    }
    for (const word of TIP_SEARCH_EXAMPLES) expect(findTips(undefined, word).note, word).not.toMatch(/^Nothing matched/);
    for (const word of SWAP_SEARCH_EXAMPLES) expect(findSwaps(undefined, word).note, word).not.toMatch(/^Nothing matched/);
  });
});

describe('find_discounts', () => {
  const discounts = async (args: Record<string, unknown> = {}, today?: string) =>
    call<FoundDiscounts>(await connect(today), 'find_discounts', args);

  it('returns every discount with its offer, conditions, address and source', async () => {
    const { text, data } = await discounts();
    expect(data.discounts).toHaveLength(DISCOUNTS.length);
    expect(data.note).toMatch(/^\d+ student discounts in Regensburg\. Cite each item’s source/);
    expect(data.note).toContain('Pass on the conditions');
    for (const d of data.discounts) {
      expect(d.url).toMatch(/^https:\/\//);
      expect(text).toContain(`- ${d.place} (${d.category}): ${d.offer}.`);
    }
    const cinema = data.discounts.find((d) => d.id === 'kinos-im-andreasstadel');
    expect(cinema).toMatchObject({ offer: '€8 instead of €9 per ticket', address: 'Andreasstraße 28, 93059 Regensburg' });
    expect(text).toContain('Who and when: Students, with valid proof.');
  });

  it('narrows to a category and to words, in the app’s category order', async () => {
    const goingOut = await discounts({ category: 'going-out' });
    expect(goingOut.data.discounts.length).toBeGreaterThan(1);
    expect(goingOut.data.discounts.every((d) => d.categoryId === 'going-out')).toBe(true);
    expect(goingOut.data.note).toMatch(/ student discounts in Regensburg in Going out\./);

    // Westbad is a pool too, but no word of its entry says so: the note sends the model to the whole list.
    const pool = await discounts({ search: 'pool' });
    expect(pool.data.discounts.map((d) => d.place)).toEqual(['Sportpark Ost pool']);
    expect(pool.data.note).toMatch(/^1 of the \d+ student discounts in Regensburg matches "pool"\. Names are often German \(Westbad is a pool/);

    const all = await discounts();
    const orders = all.data.discounts.map((d) => orderOf(d.categoryId));
    expect(orders).toEqual([...orders].sort((a, b) => a - b));
  });

  it('flags a discount from the 56th day after its source check', async () => {
    // Every discount was checked on 2026-10-20, so the whole list turns on the same day.
    expect(new Set(DISCOUNTS.map((d) => d.checked))).toEqual(new Set(['2026-10-20']));
    expect(findDiscounts('2026-12-14').discounts.filter((d) => d.mayBeOutdated)).toEqual([]);
    expect(findDiscounts('2026-12-15').discounts.every((d) => d.mayBeOutdated)).toBe(true);

    const later = await discounts({ search: 'westbad' }, '2026-12-15');
    expect(later.data.discounts.map((d) => d.place)).toEqual(['Westbad']);
    expect(later.text).toContain('Nobody has confirmed it for 8 weeks, so it may be outdated.');
  });

  it('finds a category by its id as well as its name', () => {
    const eatingOut = findDiscounts('2026-10-28', undefined, 'eating-out').discounts;
    expect(eatingOut.length).toBe(DISCOUNTS.filter((d) => d.categoryId === 'eating-out').length);
  });

  it('lists the whole category, and says so, when no discount in it matches', async () => {
    const { isError, data } = await discounts({ category: 'eating-out', search: 'pizza' });
    expect(isError).toBe(false);
    expect(data.discounts.length).toBe(DISCOUNTS.filter((d) => d.categoryId === 'eating-out').length);
    expect(data.note).toMatch(/^Nothing matched "pizza", so all \d+ student discounts in Regensburg in Eating out are listed instead: pick the ones that fit/);
  });
});

describe('find_tips', () => {
  const tips = async (args: Record<string, unknown> = {}) => call<FoundTips>(await connect(), 'find_tips', args);

  it('returns every tip with its source, in the app’s category order', async () => {
    const { text, data } = await tips();
    expect(data.tips).toHaveLength(TIPS.length);
    for (const t of data.tips) expect(text).toContain(`- ${t.title} (${t.category}): ${t.body}`);
    const orders = data.tips.map((t) => orderOf(t.categoryId));
    expect(orders).toEqual([...orders].sort((a, b) => a - b));
  });

  it('narrows to a category and to words', async () => {
    const food = await tips({ category: 'food' });
    expect(food.data.tips.every((t) => t.categoryId === 'food')).toBe(true);
    const mensa = await tips({ search: 'MENSA' });
    expect(mensa.data.tips.length).toBeLessThan(TIPS.length);
    expect(mensa.data.tips.map((t) => t.id)).toContain('eat-at-the-mensa');
    expect(mensa.data.note).toMatch(new RegExp(`^${mensa.data.tips.length} of the ${TIPS.length} Regensburg money tips match "MENSA"\\.`));
  });

  it('lists every tip, and says so, when none matches', async () => {
    const { data } = await tips({ search: 'yacht' });
    expect(data.tips).toHaveLength(TIPS.length);
    expect(data.note).toMatch(/^Nothing matched "yacht", so all \d+ Regensburg money tips are listed instead/);
  });

  it('marks a tip without a stated number as an estimate', () => {
    for (const t of findTips().tips) expect(t.estimate).toBe(t.source === 'Estimate');
  });
});

describe('suggest_swaps', () => {
  const swaps = async (args: Record<string, unknown> = {}) => call<FoundSwaps>(await connect(), 'suggest_swaps', args);

  it('gives both prices, the saving and both sources', async () => {
    const { text, data } = await swaps({ category: 'eating-out' });
    expect(data.swaps[0]).toMatchObject({
      id: 'mensa-instead-of-restaurant',
      from: '€14.50',
      to: '€3.80',
      savingPerUseMinor: 1070,
      saving: '€10',
      estimate: false,
    });
    expect(data.note).toContain('toSource and toUrl, where given, state the cheaper one.');
    expect(data.note).toContain('estimate: true means the saving rests on an assumption no page states (both prices are stated)');
    expect(data.note).not.toContain('no page states the number');
    expect(text).toContain('€3.80 instead of €14.50 per meal, about €10 less.');
    expect(text).toContain('Usual price: Source: Numbeo');
    expect(text).toContain('Cheaper price: Studierendenwerk Niederbayern/Oberpfalz');
  });

  it('calls a saving that rests on an assumption an estimate', async () => {
    const { text, data } = await swaps({ category: 'transport' });
    expect(data.swaps.map((s) => s.id)).toEqual(['deutschlandticket-for-travel-months']);
    expect(data.swaps[0].estimate).toBe(true);
    expect(text).toContain('so it is an estimate.');
  });

  it('lists the biggest saving first within a category, and every swap without a filter', () => {
    const all = findSwaps().swaps;
    expect(all).toHaveLength(SWAPS.length);
    for (let i = 1; i < all.length; i++) {
      if (all[i].categoryId === all[i - 1].categoryId) {
        expect(all[i].savingPerUseMinor).toBeLessThanOrEqual(all[i - 1].savingPerUseMinor);
      }
    }
  });

  it('lists every swap, and says so, when none matches', async () => {
    const { data } = await swaps({ search: 'taxi' });
    expect(data.swaps).toHaveLength(SWAPS.length);
    expect(data.note).toMatch(/^Nothing matched "taxi", so all \d+ cheaper swaps in Regensburg are listed instead/);
  });

  it('words the note for a list of one, and doesn’t send the model back when everything matched', () => {
    expect(findSwaps('transport', 'taxi').note).toMatch(
      /^Nothing matched "taxi", so the only cheaper swap in Regensburg in Transport is listed instead/,
    );
    const all = findSwaps('transport', 'deutschlandticket').note;
    expect(all).toMatch(/^The only cheaper swap in Regensburg in Transport matches "deutschlandticket"\. Cite/);
    expect(all).not.toContain('call again');
  });
});

describe('semester_info', () => {
  const semesters = async (args: Record<string, unknown> = {}) =>
    call<{ note: string; date: string; universities: UniversityInfo[] }>(await connect('2026-10-28'), 'semester_info', args);

  it('gives today’s semester and the next one at both universities, with the next fee where a page states it', async () => {
    const { text, data } = await semesters();
    expect(data.note).toBe(SEMESTER_NOTE);
    expect(data.date).toBe('2026-10-28');
    const [ur, oth] = data.universities;
    expect(ur).toMatchObject({
      university: 'ur',
      current: { label: 'winter semester 2026/27', start: '2026-10-01', end: '2027-03-31', fee: null },
      next: { label: 'summer semester 2027', start: '2027-04-01', end: '2027-09-30' },
    });
    expect(ur.next.fee).toMatchObject({ total: '€215', totalMinor: 21500, reRegistration: null });
    expect(ur.next.fee?.parts.map((p) => p.amount)).toEqual(['€87', '€128']);
    expect(oth.next).toMatchObject({ start: '2027-03-15', fee: { reRegistration: { month: '2027-01' } } });

    expect(text.startsWith(SEMESTER_NOTE)).toBe(true);
    expect(text).toContain('Universität Regensburg on 28-10-2026: winter semester 2026/27, 01-10-2026 to 31-03-2027.');
    expect(text).toContain('Fee for the summer semester 2027: €215, paid with the re-registration');
    expect(text).toContain("Universität Regensburg hasn't published when re-registration for the summer semester 2027 opens.");
    expect(text).toContain('Re-registration is expected to open in January 2027.');
  });

  it('knows a day can fall in different semesters at the two universities', async () => {
    const { data } = await semesters({ date: '2027-03-20' });
    expect(data.universities.map((u) => u.current.label)).toEqual(['winter semester 2026/27', 'summer semester 2027']);
  });

  it('asks about one university only when told to, and shows the current fee while a page states it', async () => {
    const { data } = await semesters({ university: 'oth', date: '2027-05-01' });
    expect(data.universities.map((u) => u.university)).toEqual(['oth']);
    expect(data.universities[0].current.fee?.total).toBe('€215');
    expect(data.universities[0].next).toMatchObject({ label: 'winter semester 2027/28', fee: { total: '€222' } });
  });

  it('never guesses a fee no page states, and its note says not to', async () => {
    const { text, data } = await semesters({ university: 'ur', date: '2028-05-01' });
    expect(data.universities[0].next.fee).toBeNull();
    expect(data.note).toContain('On next, fee: null (or a total of null) means no page in this data states that fee yet: say so, and never estimate it');
    expect(data.note).toContain('fee: null there says nothing about what that fee was or whether it is paid');
    expect(text).toContain("No page states the fee for the winter semester 2028/29 yet. It changes every semester, so it isn't guessed.");
  });

  it('takes days in the years its maths can build semesters around, and refuses the rest', async () => {
    for (const date of ['0000-01-15', '0999-12-31', '9999-10-01']) {
      expect((await semesters({ date })).isError, date).toBe(true);
    }
    const first = await semesters({ university: 'ur', date: '1000-01-01' });
    expect(first.data.universities[0].current).toMatchObject({ label: 'winter semester 999/00', start: '0999-10-01' });
    const last = await semesters({ university: 'ur', date: '9998-12-31' });
    expect(last.data.universities[0].next).toMatchObject({ start: '9999-04-01', end: '9999-09-30' });
  });
});
