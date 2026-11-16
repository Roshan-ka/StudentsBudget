import { describe, expect, it } from 'vitest';
import { CATEGORIES } from '@/data/categories';
import type { Entry } from '@/db/types';
import { RECEIPT_TODAY, RECEIPTS, receiptText } from './fixtures';
import { MAX_RECEIPT_AGE_DAYS, readReceipt, type ReceiptContext } from './read-receipt';

// The receipt reader: OCR text in, one expense reading out (total, date, shop, note, category), with null for anything
// the receipt doesn't say clearly enough.

let clock = 0;
/** An expense the student typed, created one minute after the one before. */
function typed(note: string, categoryId: string): Entry {
  clock += 1;
  return {
    id: `t${clock}`,
    type: 'expense',
    date: '2026-11-01',
    accountId: 'bank',
    amountMinor: 650,
    eurMinor: 650,
    categoryId,
    note,
    createdAt: new Date(Date.UTC(2026, 10, 1, 8, clock)).toISOString(),
  };
}

const ctx = (history: readonly Entry[] = []): ReceiptContext => ({ today: RECEIPT_TODAY, history, categories: CATEGORIES });
const read = (...rows: string[]) => readReceipt(receiptText(...rows), ctx());

describe('readReceipt on receipts as the OCR reads them', () => {
  it.each(RECEIPTS.map((fixture) => [fixture.name, fixture] as const))('%s', (_name, fixture) => {
    const history = (fixture.typed ?? []).map((entry) => typed(entry.note, entry.categoryId));
    expect(readReceipt(fixture.text, ctx(history))).toEqual({
      amountMinor: fixture.expected.amountMinor,
      date: fixture.expected.date,
      shop: fixture.expected.shop,
      note: fixture.expected.shop,
      categoryId: fixture.expected.categoryId,
    });
  });

  it('keeps every fixture’s card, account and reference digits out of the note', () => {
    for (const fixture of RECEIPTS) expect(readReceipt(fixture.text, ctx()).note).not.toMatch(/\d{4}/);
  });
});

describe('the total', () => {
  it('reads the amount however the receipt writes it', () => {
    for (const written of ['EUR 23,45', '23,45 €', '€23.45', '23.45 EUR', '23,45EUR', 'EUR  23,45 A']) {
      expect(read('Kiosk Sonne', 'Zeitung 3,20', `Summe ${written}`).amountMinor).toBe(2345);
    }
    expect(read('Elektro Huber', 'Notebook 1.099,00', 'Summe EUR 1.099,00').amountMinor).toBe(109900);
  });

  it('never takes a tax line, even one named Summe or a tax table’s Gesamtbetrag row', () => {
    const reading = read('Hofladen Müller', 'Brot 2,00 A', 'Käse 3,50 B', 'Summe MwSt 0,69', 'Gesamtbetrag 5,50 4,81 0,69', 'Karte 5,50');
    expect(reading.amountMinor).toBe(550);
    // With no total either, the lower half's largest amount still passes over the tax lines.
    expect(read('Hofladen Müller', 'Eier 3,20', 'Honig 6,80', 'Brutto 99,00', 'MwSt 19% 15,81').amountMinor).toBe(680);
  });

  it('never takes the cash given or the change, but the cash less the change', () => {
    expect(read('Kiosk Sonne', 'Zeitung 2,90', 'Wasser 1,50', 'Gegeben 20,00', 'Rückgeld 15,60').amountMinor).toBe(440);
    expect(read('Kiosk Sonne', 'Zeitung 2,90', 'Wasser 1,50', 'Bar 10,00', 'Wechselgeld 5,60').amountMinor).toBe(440);
  });

  it('takes the total over a subtotal and a payment line', () => {
    expect(read('Kiosk Sonne', 'Zwischensumme 12,00', 'Rabatt -2,00', 'Summe 10,00', 'Bar 20,00', 'Rückgeld 10,00').amountMinor).toBe(1000);
  });

  it('takes the amount under a total label OCR put on a line of its own', () => {
    expect(read('Imbiss Sonne', 'Currywurst 4,90', 'Pommes 3,20', 'Cola 2,50', 'SUMME', 'EUR 10,60', 'Bar 20,00').amountMinor).toBe(1060);
  });

  it('takes a card slip’s Betrag, then what a card paid, when no line names the total', () => {
    expect(read('Café Rosa', 'Latte 3,20', 'Croissant 2,10', 'Betrag EUR 5,30', 'Zahlung erfolgt').amountMinor).toBe(530);
    expect(read('Café Rosa', 'Latte 3,20', 'Croissant 2,10', 'girocard 5,30').amountMinor).toBe(530);
  });

  it('without any total or payment line, takes the largest amount in the lower half', () => {
    expect(read('Copyshop am Campus', 'Guthaben alt 25,00', 'Druck A4 farbig 3,20', 'Bindung 2,50', 'Kopien s/w 1,80', '7,50', 'Danke!').amountMinor).toBe(750);
  });

  it('reads O for 0 and l for 1 in an amount, but leaves a size in litres alone', () => {
    expect(read('Kiosk Sonne', 'Cola 0,5l 1,49', 'Summe EUR l2,5O').amountMinor).toBe(1250);
    expect(read('Kiosk Sonne', 'Wasser 1,5l 0,49', 'Chips 1,29').amountMinor).toBe(129);
  });
});

describe('the date', () => {
  it('reads dd.mm.yy, dd.mm.yyyy and yyyy-mm-dd', () => {
    expect(read('Kiosk Sonne', '14.11.26 18:02').date).toBe('2026-11-14');
    expect(read('Kiosk Sonne', 'Datum: 14.11.2026').date).toBe('2026-11-14');
    expect(read('Kiosk Sonne', '2026-11-14T18:02').date).toBe('2026-11-14');
  });

  it(`keeps only a date from today back to ${MAX_RECEIPT_AGE_DAYS} days before it`, () => {
    expect(read('Kiosk Sonne', '16.11.2026').date).toBe('2026-11-16');
    expect(read('Kiosk Sonne', '17.09.2026').date).toBe('2026-09-17');
    expect(read('Kiosk Sonne', '17.11.2026').date).toBeNull();
    expect(read('Kiosk Sonne', '16.09.2026').date).toBeNull();
    expect(read('Kiosk Sonne', '31.02.2026').date).toBeNull();
  });

  it('passes over a date outside that window for the next one inside it', () => {
    expect(read('Kiosk Sonne', 'Gutschein gültig bis 31.12.2026', '10.11.2026 12:00').date).toBe('2026-11-10');
  });

  it('never reads a price or a time as a date', () => {
    expect(read('Kiosk Sonne', 'Summe 12,11', '18:02').date).toBeNull();
  });
});

describe('the shop, its note and its category', () => {
  it('finds a chain on the first lines, under a logo OCR read as noise', () => {
    expect(read('~~ * ~~', '*** REWE ***', 'Musterstr. 1', 'Summe 5,00')).toMatchObject({ shop: 'REWE', categoryId: 'food' });
  });

  it('takes the first line that names something: not an address, phone, tax number, date or the receipt’s own words', () => {
    const reading = read(
      'Herzlich Willkommen',
      'Musterweg 7',
      '93047 Regensburg',
      'Tel. 0941 7654321',
      'USt-IdNr. DE000000000',
      '16.11.2026',
      'Kassenbon',
      'Teeladen Grün',
      'Tee 4,50',
    );
    expect(reading).toMatchObject({ shop: 'Teeladen Grün', note: 'Teeladen Grün', categoryId: 'other' });
  });

  it('looks for the shop only above the first amount', () => {
    expect(read('Brezel 1,20', 'Kaffee 2,30', 'Summe 3,50')).toMatchObject({ shop: null, note: '', categoryId: null });
  });

  it('keeps card numbers, IBANs and long reference digits out of the shop and the note', () => {
    expect(read('REWE Markt GmbH ****1234', 'Summe 5,00')).toMatchObject({ shop: 'REWE Markt GmbH', note: 'REWE Markt GmbH' });
    expect(read('Kiosk Sonne 4930 1234 5678 9012', 'Summe 5,00').note).toBe('Kiosk Sonne');
    expect(read('Kiosk Sonne Ref 123456789012', 'Summe 5,00').note).toBe('Kiosk Sonne Ref');
    expect(read('Kiosk Sonne DE00 1203 0000 0000 0000 00', 'Summe 5,00').note).toBe('Kiosk Sonne');
  });

  it('puts the student’s own earlier choice before the chain list', () => {
    const reading = readReceipt(receiptText('REWE', 'Summe 5,00'), ctx([typed('rewe lunch', 'eating-out')]));
    expect(reading.categoryId).toBe('eating-out');
  });
});

it('reads an empty text as nothing found', () => {
  const nothing = { amountMinor: null, date: null, shop: null, note: '', categoryId: null };
  expect(readReceipt('', ctx())).toEqual(nothing);
  expect(readReceipt(' \n \r\n\t', ctx())).toEqual(nothing);
});
