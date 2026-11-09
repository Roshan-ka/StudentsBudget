import { describe, expect, it } from 'vitest';
import { decodeStatement } from './decode';
import { utf8, windows1252 } from './fixtures';

describe('decodeStatement', () => {
  it('reads UTF-8, with or without a byte order mark, and leaves no mark in the text', () => {
    expect(decodeStatement(utf8('Zahlungsempfänger*in;Betrag (€)'))).toEqual({
      text: 'Zahlungsempfänger*in;Betrag (€)',
      encoding: 'utf-8',
    });
    expect(decodeStatement(utf8('"Buchungsdatum";"Betrag (€)"', true))).toEqual({
      text: '"Buchungsdatum";"Betrag (€)"',
      encoding: 'utf-8',
    });
  });

  it('reads anything that is not UTF-8 as Windows-1252, umlauts and the euro sign included', () => {
    expect(decodeStatement(windows1252('"Bäckerei Müller";"-3,10";"Größe";"5 €"'))).toEqual({
      text: '"Bäckerei Müller";"-3,10";"Größe";"5 €"',
      encoding: 'windows-1252',
    });
  });

  it('reads an empty file as empty text', () => {
    expect(decodeStatement(new Uint8Array())).toEqual({ text: '', encoding: 'utf-8' });
  });
});
