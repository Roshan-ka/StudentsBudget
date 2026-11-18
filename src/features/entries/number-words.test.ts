import { describe, expect, it } from 'vitest';
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

  it('leaves English as it is, on every phone: the reader knows English number words itself', () => {
    expect(numberWordsToDigits('döner six euros', 'en')).toBe('döner six euros');
    expect(de('döner six euros')).toBe('döner six euros');
    expect(numberWordsToDigits('Döner sechs Euro', 'en')).toBe('Döner sechs Euro');
  });
});
