import { describe, expect, it } from 'vitest';
import type { Language } from '@/i18n/languages';
import { numberWordsToDigits } from './number-words';

const de = (text: string) => numberWordsToDigits(text, 'de');

describe('numberWordsToDigits, German (number words, 18-11-2026)', () => {
  it.each([
    ['Döner sechs Euro fünfzig', 'Döner 6 Euro 50'],
    ['Döner fuenf', 'Döner 5'],
    ['Kaffee zwölf', 'Kaffee 12'],
    ['Pizza einundzwanzig', 'Pizza 21'],
    ['Pizza neunundneunzig', 'Pizza 99'],
    ['Fahrrad dreißig', 'Fahrrad 30'],
    ['Fahrrad dreissig', 'Fahrrad 30'],
    ['Miete zweihundertfünfzig', 'Miete 250'],
    ['Buch hunderteins', 'Buch 101'],
    ['Buch einhundert', 'Buch 100'],
    ['Laptop tausendzweihundert', 'Laptop 1200'],
    ['Laptop eintausendzweihundertneunundneunzig', 'Laptop 1299'],
    ['Auto zweihunderttausend', 'Auto 200000'],
    ['zwei Kaffee sechs Euro', '2 Kaffee 6 Euro'],
    ['Döner sechs.', 'Döner 6'],
    ['Kaffee null', 'Kaffee 0'],
  ])('reads "%s" as "%s"', (text, digits) => {
    expect(de(text)).toBe(digits);
  });

  it('keeps an article, and words that only hold a number inside, as typed', () => {
    expect(de('ein Döner sechs')).toBe('ein Döner 6');
    expect(de('eine Pizza zehn')).toBe('eine Pizza 10');
    expect(de('Hundertwasser Haus 5')).toBe('Hundertwasser Haus 5');
    expect(de('Zehnerkarte  9')).toBe('Zehnerkarte  9');
  });

  it('writes the scales the reader refuses as "million", and cent words as "cents"', () => {
    expect(de('Lotto zwei Millionen')).toBe('Lotto 2 million');
    expect(de('Kaffee fünfzig Cent')).toBe('Kaffee 50 cents');
  });

  it('reads a word that is also a number on a German phone: "Kino elf" is €11', () => {
    expect(de('Kino elf')).toBe('Kino 11');
  });

  it('leaves a German number written with a space alone: "zwei hundert" is two numbers', () => {
    expect(de('Miete zwei hundert')).toBe('Miete 2 100');
  });

  it('leaves English as it is, on every phone: the reader knows English number words itself', () => {
    expect(numberWordsToDigits('döner six euros', 'en')).toBe('döner six euros');
    expect(de('döner six euros')).toBe('döner six euros');
    expect(numberWordsToDigits('Döner sechs Euro', 'en')).toBe('Döner sechs Euro');
  });
});

const fr = (text: string) => numberWordsToDigits(text, 'fr');

describe('numberWordsToDigits, French', () => {
  it.each([
    ['pizza vingt-cinq', 'pizza 25'],
    ['pizza vingt et un', 'pizza 21'],
    ['pizza vingt-et-un', 'pizza 21'],
    ['livres soixante-dix-sept', 'livres 77'],
    ['livres soixante et onze', 'livres 71'],
    ['livres quatre-vingts', 'livres 80'],
    ['livres quatre-vingt-un', 'livres 81'],
    ['livres quatre-vingt-dix-neuf', 'livres 99'],
    ['livres septante-cinq', 'livres 75'],
    ['vélo cent deux', 'vélo 102'],
    ['vélo deux cents', 'vélo 200'],
    ['loyer mille cinq cents', 'loyer 1500'],
    ['ordinateur deux mille', 'ordinateur 2000'],
    ['café six euros cinquante', 'café 6 euros 50'],
    ['café dix-huit', 'café 18'],
  ])('reads "%s" as "%s"', (text, digits) => {
    expect(fr(text)).toBe(digits);
  });

  it('keeps an article as typed: "un café trois", "une pizza douze"', () => {
    expect(fr('un café trois')).toBe('un café 3');
    expect(fr('une pizza douze')).toBe('une pizza 12');
  });

  it('writes the scales the reader refuses as "million", and centimes as "cents"', () => {
    expect(fr('loto deux millions')).toBe('loto 2 million');
    expect(fr('café cinquante centimes')).toBe('café 50 cents');
  });

  it('reads a word that is also a number on a French phone: "vélo neuf 200" has two numbers', () => {
    expect(fr('vélo neuf 200')).toBe('vélo 9 200');
  });
});

const es = (text: string) => numberWordsToDigits(text, 'es');

describe('numberWordsToDigits, Spanish', () => {
  it.each([
    ['pizza veinticinco', 'pizza 25'],
    ['pizza veintiún', 'pizza 21'],
    ['pizza treinta y cinco', 'pizza 35'],
    ['libros dieciséis', 'libros 16'],
    ['alquiler quinientos', 'alquiler 500'],
    ['libro ciento veinte', 'libro 120'],
    ['cena cien', 'cena 100'],
    ['portátil dos mil', 'portátil 2000'],
    ['portátil mil quinientos', 'portátil 1500'],
    ['café seis euros con cincuenta', 'café 6 euros 50'],
    ['café uno', 'café 1'],
  ])('reads "%s" as "%s"', (text, digits) => {
    expect(es(text)).toBe(digits);
  });

  it('keeps an article and a lone "y" as typed', () => {
    expect(es('una cerveza tres')).toBe('una cerveza 3');
    expect(es('café y tostada cuatro')).toBe('café y tostada 4');
  });

  it('writes the scales the reader refuses as "million", and céntimos as "cents"', () => {
    expect(es('lotería dos millones')).toBe('lotería 2 million');
    expect(es('café cincuenta céntimos')).toBe('café 50 cents');
  });
});

// The pain-point check (18-11-2026): "Kaffee ein Euro fünfzig" saved 50 € and "café dos euros y cincuenta" 2 €.
describe('an article before the euro word, and a connector before the cents (quick add breakpoints)', () => {
  it.each<[string, Language, string]>([
    ['Kaffee ein Euro fünfzig', 'de', 'Kaffee 1 Euro 50'],
    ['café un euro cinquante', 'fr', 'café 1 euro 50'],
    ['café un euro con cincuenta', 'es', 'café 1 euro 50'],
    ['café dos euros y cincuenta', 'es', 'café 2 euros 50'],
    ['café dos euros con cincuenta céntimos', 'es', 'café 2 euros 50 cents'],
    ['Döner sechs Euro und fünfzig', 'de', 'Döner 6 Euro 50'],
    ['döner six euros et cinquante', 'fr', 'döner 6 euros 50'],
  ])('reads "%s" (%s) as "%s"', (text, lang, digits) => {
    expect(numberWordsToDigits(text, lang)).toBe(digits);
  });

  it('keeps an article that comes before no euro word, and a connector more words follow', () => {
    expect(de('ein Döner fünf Euro')).toBe('ein Döner 5 Euro');
    expect(numberWordsToDigits('un café trois', 'fr')).toBe('un café 3');
    expect(de('Döner sechs Euro und zwei Cola')).toBe('Döner 6 Euro und 2 Cola');
    expect(es('café seis euros con dos tostadas')).toBe('café 6 euros con 2 tostadas');
  });
});
