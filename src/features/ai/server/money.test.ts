import { describe, expect, it } from 'vitest';
import { moneyIn } from '../../../../supabase/functions/_shared/ai/money';

// Amounts of money in a text, as Ask's answers and the city pack write them (the AI phase, chunk 8).

const cents = (text: string) => moneyIn(text).map((mention) => mention.cents);

describe('moneyIn', () => {
  it('reads English amounts, the euro sign first', () => {
    expect(cents('You have €120.50 left, €12 this week and €1,250.00 in total.')).toEqual([12050, 1200, 125000]);
    expect(cents('Rent is €215–€561 a month.')).toEqual([21500, 56100]);
  });

  it('reads German, French and Spanish amounts, the euro sign after', () => {
    expect(cents('Noch 120,50 € übrig, 1.250 € im Monat')).toEqual([12050, 125000]);
    expect(cents('Il reste 1 006,50 € et 12 €')).toEqual([100650, 1200]);
    expect(cents('Te quedan 10.006,50 € y 3,8 €')).toEqual([1000650, 380]);
  });

  it('reads EUR and euro, written before or after', () => {
    expect(cents('EUR 12, 7 euros, 3 Euro, 9 EUR')).toEqual([1200, 700, 300, 900]);
  });

  it('keeps each amount once, as written, in order', () => {
    expect(moneyIn('€5 and 6 €').map((mention) => mention.written)).toEqual(['€5', '6 €']);
  });

  it('takes no number that isn’t money', () => {
    expect(cents('In week 2 you logged 14 entries on 3.11.2026, 20% less.')).toEqual([]);
  });
});
