import { describe, expect, it } from 'vitest';
import { CITY_PACK } from '../../../../supabase/functions/_shared/ai/city-pack';
import { foldWords, renderPackBrief, type PackItem } from '../../../../supabase/functions/_shared/ai/pack';
import { PICK_LIMITS, selectPack, wordMatch, type PackQuestion } from '../../../../supabase/functions/_shared/ai/pack-select';

// Which city items Ask sends with a question (the Groq switch, chunk 3).

const ask = (question: string, more: Partial<PackQuestion> = {}): PackQuestion => ({
  question,
  earlier: [],
  spend: {},
  ...more,
});

const ids = (question: string, more: Partial<PackQuestion> = {}) => selectPack(ask(question, more)).map((item) => item.id);

const ofKind = (kind: PackItem['kind']) => CITY_PACK.filter((item) => item.kind === kind).map((item) => item.id);

describe('foldWords', () => {
  it('folds case, accents and umlauts, and drops short words, numbers and stop words in all four languages', () => {
    expect(foldWords('Günstige Fahrräder für Studierende im Jahr 2026!')).toEqual(['gunstig', 'fahrrad', 'studierend', 'jahr']);
    expect(foldWords('Where can I eat?')).toEqual(['eat']);
    expect(foldWords('Wo kann ich das finden?')).toEqual(['find']);
    expect(foldWords('Où est-ce que je peux manger ?')).toEqual(['mang']);
    expect(foldWords('¿Dónde puedo comer?')).toEqual(['comer']);
  });

  it('takes an ending off when 4 letters stay, so a plural meets its singular, and gives each word once', () => {
    expect(foldWords('Rabatte Rabatt')).toEqual(['rabatt']);
    expect(foldWords('prices price')).toEqual(['pric']);
    expect(foldWords('Studenten student')).toEqual(['student']);
    expect(foldWords('essen esse')).toEqual(['esse']);
    expect(foldWords('comer')).toEqual(['comer']);
  });
});

describe('wordMatch', () => {
  it('is 1 for the same word, a half for a start or a compound’s end, and 0 for short or other words', () => {
    expect(wordMatch('mensa', 'mensa')).toBe(1);
    expect(wordMatch('cheap', 'cheaply')).toBe(0.5);
    expect(wordMatch('semesterbeitrag', 'beitrag')).toBe(0.5);
    expect(wordMatch('book', 'booking')).toBe(0);
    expect(wordMatch('rent', 'parent')).toBe(0);
    expect(wordMatch('westbad', 'mensa')).toBe(0);
  });
});

describe('selectPack', () => {
  it('finds cheap food in all four languages', () => {
    for (const question of ['Where can I eat cheaply?', 'Wo kann ich günstig essen?', 'Où manger pas cher ?', '¿Dónde puedo comer barato?']) {
      const picked = ids(question);
      expect(picked, question).toContain('tip:eat-at-the-mensa');
      expect(picked, question).toContain('swap:mensa-instead-of-restaurant');
      expect(picked, question).toContain('range:eating-out');
    }
  });

  it('finds every semester fee in all four languages', () => {
    const fees = ofKind('fee');
    expect(fees.length).toBeGreaterThan(0);
    for (const question of [
      'How much is the semester fee?',
      'Wie hoch ist der Semesterbeitrag?',
      'Combien coûtent les frais de semestre ?',
      '¿Cuánto es la tasa del semestre?',
    ]) {
      expect(ids(question), question).toEqual(expect.arrayContaining(fees));
    }
  });

  it('puts the place a question names first, in any language', () => {
    for (const question of [
      'Is there a student discount at the Westbad?',
      'Gibt es im Westbad Rabatt?',
      'Y a-t-il une réduction au Westbad ?',
      '¿Hay descuento en el Westbad?',
    ]) {
      expect(ids(question)[0], question).toBe('discount:westbad');
    }
  });

  it('ranks items that match alike by this month’s spending in their category, then by the pack’s order', () => {
    const goingOut = selectPack(ask('Where can I save?', { spend: { 'going-out': 300, food: 20 } }));
    expect(goingOut[0].categoryId).toBe('going-out');
    const food = selectPack(ask('Where can I save?', { spend: { 'going-out': 20, food: 300 } }));
    expect(food[0].categoryId).toBe('food');
    // A spending that isn't a number counts as none.
    expect(ids('Where can I save?', { spend: { rent: Number.NaN } })).toEqual(ids('Where can I save?'));
  });

  it('counts the question’s words over the earlier questions’, and keeps a follow-up on its topic', () => {
    expect(ids('How long is it valid?', { earlier: ['Is there a discount at the Westbad?'] })[0]).toBe('discount:westbad');
    expect(ids('And the Sportpark Ost pool?', { earlier: ['Is there a discount at the Westbad?'] })[0]).toBe(
      'discount:sportpark-ost-pool',
    );
  });

  it('sends the ranges and prices, by spending, when no word matches', () => {
    const fallback = [...ofKind('range'), ...ofKind('price')];
    expect(new Set(ids('Hello'))).toEqual(new Set(fallback));
    expect(ids('Hello')).toEqual(CITY_PACK.filter((item) => fallback.includes(item.id)).map((item) => item.id));
    expect(ids('Hello', { spend: { shopping: 50 } })[0]).toBe('range:shopping');
    expect(ids('')).toEqual(ids('Hello'));
  });

  it('stays within its limits, and skips an item too long for what is left', () => {
    const everything =
      'rent food eating out going out transport shopping health study travel insurance gym semester fee checklist discount tip swap price';
    const picked = selectPack(ask(everything));
    expect(picked.length).toBeLessThanOrEqual(PICK_LIMITS.max);
    expect(renderPackBrief(picked).length).toBeLessThanOrEqual(PICK_LIMITS.maxChars);

    const few = selectPack(ask(everything), CITY_PACK, { max: 3, maxChars: 400 });
    expect(few.length).toBeLessThanOrEqual(3);
    expect(renderPackBrief(few).length).toBeLessThanOrEqual(400);

    const westbad = CITY_PACK.find((item) => item.id === 'discount:westbad');
    if (westbad === undefined) throw new Error('no Westbad item');
    const short = { ...westbad, id: 'discount:short', text: 'Westbad: short.' };
    const tight = renderPackBrief([short]).length + 1;
    expect(selectPack(ask('Westbad'), [westbad, short], { max: 10, maxChars: tight }).map((item) => item.id)).toEqual([
      'discount:short',
    ]);
  });

  it('picks the same items in the same order every time', () => {
    const question = ask('Wo kann ich günstig essen?', { earlier: ['Was kostet die Miete?'], spend: { rent: 400, food: 90 } });
    expect(selectPack(question)).toEqual(selectPack(question));
  });
});
