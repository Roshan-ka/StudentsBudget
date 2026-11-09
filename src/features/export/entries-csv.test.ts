import { describe, expect, it } from 'vitest';
import type { Account, Entry } from '@/db/types';
import { MESSAGES } from '@/i18n/messages';
import { entriesCsv, entriesFileName } from './entries-csv';

const accounts: Account[] = [
  { id: 'spk', name: 'Sparkasse', kind: 'bank', currency: 'EUR', openingMinor: 0, createdAt: '2026-10-01T08:00:00.000Z' },
  { id: 'cash', name: 'Cash', kind: 'cash', currency: 'EUR', openingMinor: 0, createdAt: '2026-10-01T08:00:00.000Z' },
  { id: 'inr', name: 'SBI; India', kind: 'bank', currency: 'INR', openingMinor: 0, createdAt: '2026-10-01T08:00:00.000Z' },
];

const base = { createdAt: '2026-11-01T08:00:00.000Z', note: '' };
const entries: Entry[] = [
  { ...base, id: 'b', type: 'income', date: '2026-11-02', accountId: 'spk', amountMinor: 93400, eurMinor: 93400, categoryId: 'income-bafoeg', note: 'BAföG' },
  { ...base, id: 'a', type: 'expense', date: '2026-11-01', accountId: 'spk', amountMinor: 123456, eurMinor: 123456, categoryId: 'rent', note: 'Miete "November"' },
  { ...base, id: 'c', type: 'transfer', date: '2026-11-03', accountId: 'spk', toAccountId: 'cash', amountMinor: 5000, toAmountMinor: 5000, eurMinor: 5000 },
  { ...base, id: 'd', type: 'expense', date: '2026-11-04', accountId: 'inr', amountMinor: 25000, eurMinor: 263, categoryId: 'eating-out', note: '=HYPERLINK("x")' },
];

describe('entriesCsv', () => {
  it('writes a BOM, the headers in the language, and one row per entry, oldest first, in the region’s format', () => {
    const lines = entriesCsv(entries, accounts, MESSAGES.en).split('\r\n');

    expect(lines[0]).toBe('﻿Date;Entry type;Category;Account;Amount;Currency;Amount in EUR;Note');
    expect(lines.slice(1)).toEqual([
      '01.11.2026;Expense;Rent;Sparkasse;1234,56;EUR;1234,56;"Miete ""November"""',
      '02.11.2026;Income;BAföG;Sparkasse;934,00;EUR;934,00;BAföG',
      '03.11.2026;Transfer;To Cash;Sparkasse;50,00;EUR;50,00;',
      // A separator in a name is quoted; a note that starts like a formula gets a ' first.
      `04.11.2026;Expense;Eating out;"SBI; India";250,00;INR;2,63;"'=HYPERLINK(""x"")"`,
      '',
    ]);
  });

  it('writes the headers, types and categories in the phone’s language', () => {
    const lines = entriesCsv(entries.slice(1, 3), accounts, MESSAGES.de).split('\r\n');
    expect(lines[0]).toBe(`﻿${['Datum', MESSAGES.de.entries.form.typeLabel, 'Kategorie', 'Konto', 'Betrag', 'Währung', 'Betrag in EUR', 'Notiz'].join(';')}`);
    expect(lines[1]).toBe(`01.11.2026;Ausgabe;${MESSAGES.de.categories.rent};Sparkasse;1234,56;EUR;1234,56;"Miete ""November"""`);
    expect(lines[2]).toBe('03.11.2026;Umbuchung;An Cash;Sparkasse;50,00;EUR;50,00;');
  });

  it('writes only the header when there are no entries', () => {
    expect(entriesCsv([], accounts, MESSAGES.en)).toBe('﻿Date;Entry type;Category;Account;Amount;Currency;Amount in EUR;Note\r\n');
  });
});

describe('entriesFileName', () => {
  it('names the file by the day it is made', () => {
    expect(entriesFileName(new Date('2026-11-09T10:00:00'))).toBe('studentsbudget-entries-2026-11-09.csv');
  });
});
