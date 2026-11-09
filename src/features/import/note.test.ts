import { describe, expect, it } from 'vitest';
import { importNote, MAX_NOTE } from './note';

describe('importNote', () => {
  it('writes the payee and the purpose, and the payee alone when the purpose says nothing', () => {
    expect(importNote({ payee: 'Studierendenwerk Niederbayern/Oberpfalz', purpose: 'Miete November' })).toBe(
      'Studierendenwerk Niederbayern/Oberpfalz · Miete November',
    );
    expect(importNote({ payee: 'dm-drogerie markt', purpose: '-' })).toBe('dm-drogerie markt');
    expect(importNote({ payee: '', purpose: 'Spotify P1234' })).toBe('Spotify P1234');
    expect(importNote({ payee: 'Netflix', purpose: 'Netflix' })).toBe('Netflix');
  });

  it('takes out card numbers, time stamps, IBANs, SEPA fields and long reference numbers', () => {
    expect(importNote({ payee: 'REWE Markt GmbH', purpose: '2026-10-29T18:12 Debitk.1 2029-12' })).toBe('REWE Markt GmbH');
    expect(importNote({ payee: 'Lidl sagt Danke', purpose: '2026-11-03 Debitk.99 VISA Debit' })).toBe('Lidl sagt Danke');
    expect(importNote({ payee: 'Max Mustermann', purpose: 'IBAN DE00 1203 0000 0000 0000 00 Miete' })).toBe('Max Mustermann · Miete');
    expect(importNote({ payee: 'AMAZON', purpose: 'Karte 4930 **** **** 1234 Bestellung' })).toBe('AMAZON · Karte Bestellung');
    expect(importNote({ payee: 'Top-Up by *1234', purpose: '' })).toBe('Top-Up by');
    expect(importNote({ payee: 'Rundfunk ARD', purpose: 'EREF+NOTPROVIDED MREF+M-1 CRED+DE98ZZZ00000000000 Beitrag' })).toBe('Rundfunk ARD · Beitrag');
    expect(importNote({ payee: 'Vodafone', purpose: 'Kundennummer 123456789 Rechnung 10/2026' })).toBe('Vodafone · Kundennummer Rechnung 10/2026');
  });

  it('stops at MAX_NOTE characters', () => {
    const note = importNote({ payee: 'A'.repeat(150), purpose: 'B'.repeat(150) });
    expect(note).toHaveLength(MAX_NOTE);
    expect(note.endsWith('…')).toBe(true);
  });
});
