import { describe, expect, it } from 'vitest';
import type { Language } from '@/i18n/languages';
import { lineDates, readLineDate } from './quick-add-date';

const TODAY = '2026-11-18';
const read = (text: string, lang: Language = 'en') => readLineDate(text, TODAY, lang);

describe('readLineDate (quick add dates, 18-11-2026)', () => {
  it.each<[string, Language, string, string]>([
    // Month names, day first or month first, with or without the year, cue words and connectors taken out.
    ['10 haircut on 27 november 2025', 'en', '2025-11-27', '10 haircut'],
    ['haircut 10 on the 27th of November 2025', 'en', '2025-11-27', 'haircut 10'],
    ['haircut 10 Nov 27, 2025', 'en', '2025-11-27', 'haircut 10'],
    ['haircut 10 3 nov', 'en', '2026-11-03', 'haircut 10'],
    ['books 12 sept. 4', 'en', '2026-09-04', 'books 12'],
    ['Friseur 10 am 27. November 2025', 'de', '2025-11-27', 'Friseur 10'],
    ['Friseur 10 am 3. Dez. 2025', 'de', '2025-12-03', 'Friseur 10'],
    ['Friseur 10 am 5. März', 'de', '2026-03-05', 'Friseur 10'],
    ['coiffeur 10 le 27 novembre 2025', 'fr', '2025-11-27', 'coiffeur 10'],
    ['coiffeur 10 le 1er décembre 2025', 'fr', '2025-12-01', 'coiffeur 10'],
    ['peluquería 10 el 27 de noviembre de 2025', 'es', '2025-11-27', 'peluquería 10'],
    // Numbers: a whole date anywhere, a day and month only after a cue word.
    ['haircut 10 27.11.2025', 'en', '2025-11-27', 'haircut 10'],
    ['haircut 10 27/11/25', 'en', '2025-11-27', 'haircut 10'],
    ['haircut 10 2025-11-27', 'en', '2025-11-27', 'haircut 10'],
    ['haircut 10 on 3.11', 'en', '2026-11-03', 'haircut 10'],
    ['Friseur 10 am 3.11.', 'de', '2026-11-03', 'Friseur 10'],
    ['coiffeur 10 le 3/11', 'fr', '2026-11-03', 'coiffeur 10'],
    ['peluquería 10 el 3/11', 'es', '2026-11-03', 'peluquería 10'],
    // Today, yesterday and the day before.
    ['döner 6 yesterday', 'en', '2026-11-17', 'döner 6'],
    ['döner 6 the day before yesterday', 'en', '2026-11-16', 'döner 6'],
    ['Döner 6 gestern', 'de', '2026-11-17', 'Döner 6'],
    ['Döner 6 vorgestern', 'de', '2026-11-16', 'Döner 6'],
    ['Döner 6 heute', 'de', '2026-11-18', 'Döner 6'],
    ['döner 6 hier', 'fr', '2026-11-17', 'döner 6'],
    ['döner 6 avant-hier', 'fr', '2026-11-16', 'döner 6'],
    ["döner 6 aujourd'hui", 'fr', '2026-11-18', 'döner 6'],
    ['döner 6 ayer', 'es', '2026-11-17', 'döner 6'],
    ['döner 6 anteayer', 'es', '2026-11-16', 'döner 6'],
    ['döner 6 antes de ayer', 'es', '2026-11-16', 'döner 6'],
    // English is read on every phone.
    ['Döner 6 yesterday', 'de', '2026-11-17', 'Döner 6'],
    ['Friseur 10 on 27 November 2025', 'de', '2025-11-27', 'Friseur 10'],
  ])('reads "%s" (%s) as %s, leaving "%s"', (text, lang, date, rest) => {
    expect(read(text, lang)).toEqual({ date, rest });
  });

  it('takes a day with no year as the most recent one, today included', () => {
    expect(read('haircut 10 27 nov')?.date).toBe('2025-11-27');
    expect(read('haircut 10 18 nov')?.date).toBe('2026-11-18');
    expect(read('haircut 10 on 27.11')?.date).toBe('2025-11-27');
  });

  it('keeps a day after today when the year says so: quick add refuses it, not the reader', () => {
    expect(read('haircut 10 on 27 december 2026')?.date).toBe('2026-12-27');
  });

  it.each<[string, Language]>([
    ['haircut 27.11', 'en'],
    ['lunch on campus 6', 'en'],
    ['Döner hier 6', 'de'],
    ['haircut 10 on 31 february', 'en'],
    ['rent november 2025 400', 'en'],
    ['coffee 3,50', 'en'],
    ['Mensa 4', 'de'],
  ])('finds no date in "%s" (%s)', (text, lang) => {
    expect(read(text, lang)).toBeNull();
  });

  it('lists every date in line order, so quick add can pass over one that leaves no amount', () => {
    expect(lineDates('6 mai Döner gestern', TODAY, 'de')).toEqual([
      { date: '2026-05-06', rest: 'Döner gestern' },
      { date: '2026-11-17', rest: '6 mai Döner' },
    ]);
    expect(lineDates('lunch with jan 12', TODAY, 'en')).toEqual([{ date: '2026-01-12', rest: 'lunch with' }]);
  });

  it('reads the number after a month as its day when both orders fit, so the one before stays the amount', () => {
    expect(read('haircut 10 november 27')).toEqual({ date: '2025-11-27', rest: 'haircut 10' });
    expect(read('haircut 10 27 nov 2025')).toEqual({ date: '2025-11-27', rest: 'haircut 10' });
  });

  // 18.11.2026 is a Wednesday.
  it.each<[string, Language, string, string]>([
    ['döner 6 friday', 'en', '2026-11-13', 'döner 6'],
    ['döner 6 on Monday', 'en', '2026-11-16', 'döner 6'],
    ['döner 6 wednesday', 'en', '2026-11-18', 'döner 6'],
    ['döner 6 last wednesday', 'en', '2026-11-11', 'döner 6'],
    ['döner 6 last friday', 'en', '2026-11-13', 'döner 6'],
    ['Döner 6 am Freitag', 'de', '2026-11-13', 'Döner 6'],
    ['Döner 6 Sonntag', 'de', '2026-11-15', 'Döner 6'],
    ['Döner 6 letzten Mittwoch', 'de', '2026-11-11', 'Döner 6'],
    ['döner 6 vendredi', 'fr', '2026-11-13', 'döner 6'],
    ['döner 6 mercredi dernier', 'fr', '2026-11-11', 'döner 6'],
    ['döner 6 el viernes', 'es', '2026-11-13', 'döner 6'],
    ['döner 6 sábado', 'es', '2026-11-14', 'döner 6'],
    ['döner 6 el miércoles pasado', 'es', '2026-11-11', 'döner 6'],
    ['Döner 6 last friday', 'de', '2026-11-13', 'Döner 6'],
  ])('reads the weekday in "%s" (%s) as %s, leaving "%s"', (text, lang, date, rest) => {
    expect(read(text, lang)).toEqual({ date, rest });
  });

  it.each<[string, Language]>([
    ['sun cream 5', 'en'],
    ['coffee 3 sat', 'en'],
    ['döner 6 freitag', 'en'],
  ])('reads no weekday from a short form or another language in "%s" (%s)', (text, lang) => {
    expect(read(text, lang)).toBeNull();
  });

  it('reads a whole date even where the line meant a month: quick add then keeps the amount', () => {
    expect(read('haircut 10 november 2025')).toEqual({ date: '2025-11-10', rest: 'haircut' });
  });
});
