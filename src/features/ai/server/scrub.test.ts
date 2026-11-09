import { describe, expect, it } from 'vitest';
import * as fixtures from '@/features/import/fixtures';
import { importNote } from '@/features/import/note';
import { openStatement } from '@/features/import/statement';
import { scrub, scrubJson } from '../../../../supabase/functions/_shared/ai/scrub';

// What the AI function takes out of a text before the model sees it (the AI phase, chunk 2).

/** The words of a text, without the punctuation `importNote` trims from a note's ends ("-23,45" is "23,45"). */
const words = (text: string) =>
  new Set(
    text
      .split(/\s+/)
      .map((word) => word.replace(/^[,;:/·-]+|[,;:/·-]+$/g, ''))
      .filter((word) => /[\p{L}\p{N}]/u.test(word)),
  );

/** A card payment's time stamp, which the import drops from its notes and a quick-add line may need. */
const TIME_STAMP = /^\d{4}-\d{2}-\d{2}(?:T\d{2}:\d{2}(?::\d{2})?)?$/;

/** The import's own examples (note.test.ts), and every cell of every bank file it was built with. */
const SAMPLES: string[] = [
  '2026-10-29T18:12 Debitk.1 2029-12',
  '2026-11-03 Debitk.99 VISA Debit',
  'IBAN DE00 1203 0000 0000 0000 00 Miete',
  'Karte 4930 **** **** 1234 Bestellung',
  'Top-Up by *1234',
  'EREF+NOTPROVIDED MREF+M-1 CRED+DE98ZZZ00000000000 Beitrag',
  'Kundennummer 123456789 Rechnung 10/2026',
  'GB29NWBK60161331926819',
  ...Object.values(fixtures)
    .filter((value): value is Uint8Array => value instanceof Uint8Array)
    .flatMap((bytes) => {
      const statement = openStatement(bytes);
      return 'table' in statement ? statement.table.rows.flat() : [];
    }),
];

describe('scrub', () => {
  it('takes out everything the import takes out of a note, except time stamps', () => {
    expect(SAMPLES.length).toBeGreaterThan(100);
    for (const text of SAMPLES) {
      const kept = words(importNote({ payee: text, purpose: '' }));
      const removed = [...words(text)].filter((word) => !kept.has(word) && !TIME_STAMP.test(word));
      const left = words(scrub(text));
      expect(removed.filter((word) => left.has(word)), text).toEqual([]);
    }
  });

  it('takes out emails and phone numbers', () => {
    expect(scrub('Lena +49 151 23456789, 0941 123456 or 0151/2345678, lena.k+wg@example.co.uk')).toBe('Lena , or ,');
    expect(scrub('call 0049 941 1234567 now')).toBe('call now');
  });

  it('leaves a quick-add line as it was written: amounts, dates and words', () => {
    for (const line of [
      '12 for pizza with Tom yesterday, paid cash',
      'coffee 7 40',
      'Döner 6 € on 2026-11-08',
      'Miete 450,00 am 06.11.2026',
      '0,50 for the toilet at the station',
      'Mensa 3.20 08/11',
      'rent 1.250 euro',
      'bike repair 120 at Radl 0815',
    ]) {
      expect(scrub(line)).toBe(line);
    }
  });

  it('tidies the spaces it leaves, and keeps line breaks', () => {
    expect(scrub('  rent  DE00 1203 0000 0000 0000 00  \n  November ')).toBe('rent\nNovember');
  });
});

describe('scrubJson', () => {
  it('scrubs every string, at any depth, and keeps keys, numbers and the rest', () => {
    expect(
      scrubJson({ notes: ['Rent IBAN DE00 1203 0000 0000 0000 00', 'Pizza'], left: 12_000, over: false, week: null, nested: { note: 'ref 123456789' } }),
    ).toEqual({ notes: ['Rent', 'Pizza'], left: 12_000, over: false, week: null, nested: { note: 'ref' } });
  });
});
