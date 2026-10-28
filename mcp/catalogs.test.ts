import { describe, expect, it } from 'vitest';
import { CATEGORIES } from '@/data/categories';
import { DISCOUNTS } from '@/data/discounts';
import { SWAPS } from '@/data/swaps';
import { TIPS } from '@/data/tips';
import { STALE_AFTER_DAYS as APP_STALE_AFTER_DAYS } from '@/features/discounts/discounts';
import { categoryName as appCategoryName, orderOf as appOrderOf } from '@/features/entries/categories';
import { semesterOn as appSemesterOn, UNIVERSITIES } from '@/features/profile/profile';
import { amountText as appAmountText, swapLineText } from '@/features/swaps/suggest';
import { addDays } from '@/lib/dates';
import { amountText, categoryName, orderOf } from './catalog.ts';
import { findDiscounts, STALE_AFTER_DAYS, type FoundDiscount } from './discounts.ts';
import { semesterOn, UNIVERSITY_NAMES, type UniversityInfo } from './semesters.ts';
import { findSwaps, savingText, type FoundSwap } from './swaps.ts';
import { findTips, type FoundTip } from './tips.ts';
import { call, connect } from './test-client.ts';

// The server can't import the app's helpers (they import through `@/`, which Node's type stripping can't resolve),
// so it keeps its own copies. These hold each copy to the app's answer.
describe('the server agrees with the app', () => {
  it('on category names and order', () => {
    for (const c of CATEGORIES) {
      expect(categoryName(c.id)).toBe(appCategoryName(c.id));
      expect(orderOf(c.id)).toBe(appOrderOf(c.id));
    }
    expect(orderOf('unknown')).toBe(appOrderOf('unknown'));
  });

  it('on amounts, savings and when a discount may be outdated', () => {
    for (const minor of [0, 5, 99, 100, 380, 1070, 1450, 3400]) expect(amountText(minor)).toBe(appAmountText(minor));
    for (const swap of SWAPS) {
      const saving = swap.fromMinor - swap.toMinor;
      expect(swapLineText({ categoryId: swap.categoryId, swap, savingPerUseMinor: saving })).toContain(
        `save about ${savingText(saving)} per ${swap.per}`,
      );
    }
    expect(STALE_AFTER_DAYS).toBe(APP_STALE_AFTER_DAYS);
  });

  it('on the semester every day of 2026–2028 falls in, at both universities', () => {
    for (const university of ['ur', 'oth'] as const) {
      expect(UNIVERSITY_NAMES[university]).toBe(UNIVERSITIES.find((u) => u.id === university)?.name);
      for (let day = '2026-01-01'; day <= '2028-12-31'; day = addDays(day, 1)) {
        const { term, start, end } = semesterOn(university, day);
        const app = appSemesterOn(university, day);
        expect({ term, start, end }, `${university} ${day}`).toEqual({ term: app.term, start: app.start, end: app.end });
      }
    }
  });
});

describe('find_discounts', () => {
  const discounts = async (args: Record<string, unknown> = {}, today?: string) =>
    call<{ discounts: FoundDiscount[] }>(await connect(today), 'find_discounts', args);

  it('returns every discount with its offer, conditions, address and source', async () => {
    const { text, data } = await discounts();
    expect(data.discounts).toHaveLength(DISCOUNTS.length);
    for (const d of data.discounts) {
      expect(d.url).toMatch(/^https:\/\//);
      expect(text).toContain(`- ${d.place} (${d.category}): ${d.offer}.`);
    }
    const cinema = data.discounts.find((d) => d.id === 'kinos-im-andreasstadel');
    expect(cinema).toMatchObject({ offer: '€8 instead of €9 per ticket', address: 'Andreasstraße 28, 93059 Regensburg' });
    expect(text).toContain('Who and when: Students, with valid proof.');
  });

  it('narrows to a category and a word, in the app’s category order', async () => {
    const goingOut = await discounts({ category: 'going-out' });
    expect(goingOut.data.discounts.length).toBeGreaterThan(1);
    expect(goingOut.data.discounts.every((d) => d.categoryId === 'going-out')).toBe(true);

    const westbad = await discounts({ search: 'westbad' });
    expect(westbad.data.discounts.map((d) => d.place)).toEqual(['Westbad']);

    const all = await discounts();
    const orders = all.data.discounts.map((d) => orderOf(d.categoryId));
    expect(orders).toEqual([...orders].sort((a, b) => a - b));
  });

  it('flags a discount nobody has confirmed for 8 weeks', async () => {
    expect((await discounts()).data.discounts.some((d) => d.mayBeOutdated)).toBe(false);
    const later = await discounts({ search: 'westbad' }, '2027-01-15');
    expect(later.data.discounts[0].mayBeOutdated).toBe(true);
    expect(later.text).toContain('Nobody has confirmed it for 8 weeks, so it may be outdated.');
  });

  it('names the categories it has when nothing matches', async () => {
    const { isError, text, data } = await discounts({ category: 'eating-out', search: 'pizza' });
    expect(isError).toBe(false);
    expect(data.discounts).toEqual([]);
    expect(text).toContain('No student discount in Regensburg matches category "eating-out" and "pizza".');
    expect(text).toContain('going-out (Going out)');
  });

  it('matches what findDiscounts gives', () => {
    expect(findDiscounts('2026-10-28', 'going-out', 'pool').map((d) => d.id)).toContain('sportpark-ost-pool');
  });
});

describe('find_tips', () => {
  const tips = async (args: Record<string, unknown> = {}) => call<{ tips: FoundTip[] }>(await connect(), 'find_tips', args);

  it('returns every tip with its source, in the app’s category order', async () => {
    const { text, data } = await tips();
    expect(data.tips).toHaveLength(TIPS.length);
    for (const t of data.tips) expect(text).toContain(`- ${t.title} (${t.category}): ${t.body}`);
    const orders = data.tips.map((t) => orderOf(t.categoryId));
    expect(orders).toEqual([...orders].sort((a, b) => a - b));
  });

  it('narrows to a category and a word', async () => {
    const food = await tips({ category: 'food' });
    expect(food.data.tips.every((t) => t.categoryId === 'food')).toBe(true);
    const mensa = await tips({ search: 'MENSA' });
    expect(mensa.data.tips.map((t) => t.id)).toContain('eat-at-the-mensa');
  });

  it('names the categories it has when nothing matches', async () => {
    const { text, data } = await tips({ search: 'yacht' });
    expect(data.tips).toEqual([]);
    expect(text).toContain('No Regensburg money tip matches "yacht". Categories with tips:');
  });

  it('marks a tip without a stated number as an estimate', () => {
    for (const t of findTips()) expect(t.estimate).toBe(t.source === 'Estimate');
  });
});

describe('suggest_swaps', () => {
  const swaps = async (args: Record<string, unknown> = {}) =>
    call<{ swaps: FoundSwap[] }>(await connect(), 'suggest_swaps', args);

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
    const all = findSwaps();
    expect(all).toHaveLength(SWAPS.length);
    for (let i = 1; i < all.length; i++) {
      if (all[i].categoryId === all[i - 1].categoryId) {
        expect(all[i].savingPerUseMinor).toBeLessThanOrEqual(all[i - 1].savingPerUseMinor);
      }
    }
  });

  it('names the categories it has when nothing matches', async () => {
    const { text } = await swaps({ search: 'taxi' });
    expect(text).toContain('No Regensburg swap matches "taxi". Categories with swaps: eating-out (Eating out)');
  });
});

describe('semester_info', () => {
  const semesters = async (args: Record<string, unknown> = {}) =>
    call<{ date: string; universities: UniversityInfo[] }>(await connect('2026-10-28'), 'semester_info', args);

  it('gives today’s semester and the next one at both universities, with the next fee where a page states it', async () => {
    const { text, data } = await semesters();
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

    expect(text).toContain('Universität Regensburg on 28-10-2026: winter semester 2026/27, 01-10-2026 to 31-03-2027.');
    expect(text).toContain('Fee for the summer semester 2027: €215, paid with the re-registration');
    expect(text).toContain("Universität Regensburg hasn't published when re-registration for the summer semester 2027 opens.");
    expect(text).toContain('Re-registration opens in January 2027.');
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

  it('never guesses a fee no page states', async () => {
    const { text, data } = await semesters({ university: 'ur', date: '2028-05-01' });
    expect(data.universities[0].next.fee).toBeNull();
    expect(text).toContain("No page states the fee for the winter semester 2028/29 yet. It changes every semester, so it isn't guessed.");
  });
});
