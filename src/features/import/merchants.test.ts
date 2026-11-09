import { describe, expect, it } from 'vitest';
import { CATEGORIES } from '@/data/categories';
import { chainRule, fold, IN_RULES, merchantKey, OUT_RULES } from './merchants';

const category = (text: string, direction: 'out' | 'in' = 'out') => chainRule(text, direction)?.categoryId ?? null;

describe('the chain list', () => {
  it('only gives categories that exist, of the right kind for money out and money in', () => {
    const kinds = new Map(CATEGORIES.map((c) => [c.id, c.kind]));
    for (const rule of OUT_RULES) expect(kinds.get(rule.categoryId), rule.label).toMatch(/^(flexible|fixed|oneoff)$/);
    for (const rule of IN_RULES) expect(kinds.get(rule.categoryId), rule.label).toBe('income');
  });

  it('knows the big chains, however the bank writes them', () => {
    expect(category('REWE Markt GmbH')).toBe('food');
    expect(category('REWE SAGT DANKE 1234')).toBe('food');
    expect(category('Lidl sagt Danke')).toBe('food');
    expect(category('ALDI SUED')).toBe('food');
    expect(category('dm-drogerie markt')).toBe('personal-care');
    expect(category('ROSSMANN 2214')).toBe('personal-care');
    expect(category('Mensa Uni Regensburg')).toBe('eating-out');
    expect(category('Lieferando.de')).toBe('eating-out');
    expect(category('RVV Regensburger Verkehrsverbund')).toBe('transport');
    expect(category('DB Vertrieb GmbH')).toBe('transport');
    expect(category('Spotify P1234')).toBe('subscriptions');
    expect(category('Netflix')).toBe('subscriptions');
    expect(category('Rundfunk ARD, ZDF, Deutschlandradio')).toBe('utilities');
    expect(category('Vodafone GmbH')).toBe('phone');
    expect(category('Easy Apotheke Regensburg')).toBe('health');
    expect(category('AMZN Mktp DE')).toBe('shopping');
  });

  it('takes the narrower rule first: Aldi Talk, Amazon Prime, and rent paid to the Studierendenwerk', () => {
    expect(category('ALDI TALK Aufladung')).toBe('phone');
    expect(category('Amazon Prime Mitgliedschaft')).toBe('subscriptions');
    expect(category('Studierendenwerk Niederbayern/Oberpfalz Miete November')).toBe('rent');
    expect(category('Studierendenwerk Niederbayern/Oberpfalz Mensakarte')).toBe('eating-out');
  });

  it('reads money in apart: BAföG in any spelling, salary, the blocked account, a scholarship, parents', () => {
    expect(category('Bundesamt fuer Ausbildungsfoerderung BAFOEG 10/2026', 'in')).toBe('income-bafoeg');
    expect(category('BAföG Oktober', 'in')).toBe('income-bafoeg');
    expect(category('Lohn/Gehalt 10/2026', 'in')).toBe('income-job');
    expect(category('Expatrio Global Services', 'in')).toBe('income-sperrkonto');
    expect(category('Deutschlandstipendium', 'in')).toBe('income-scholarship');
    expect(category('Taschengeld November', 'in')).toBe('income-parents');
    // Money in from a shop is no salary: the in-list doesn't hold the shops.
    expect(category('REWE Markt GmbH', 'in')).toBeNull();
  });

  it('knows nothing else, and matches whole words only', () => {
    expect(category('Bäckerei Müller')).toBeNull();
    expect(category('Mietwagen Sixt')).toBeNull();
    expect(category('Brewery Rewerk')).toBeNull();
  });
});

describe('fold', () => {
  it('writes umlauts and ß out, in lower case, with one space between words', () => {
    expect(fold('  BAföG  Größe  ')).toBe('bafoeg groesse');
  });
});

describe('merchantKey', () => {
  it('keeps a shop’s name and drops what changes between bookings', () => {
    expect(merchantKey('REWE Markt GmbH', '')).toBe('rewe');
    expect(merchantKey('REWE SAGT DANKE 1234', '')).toBe('rewe');
    expect(merchantKey('Lidl sagt Danke', '2026-11-03 Debitk.99')).toBe('lidl');
    expect(merchantKey('dm-drogerie markt', '')).toBe('dm-drogerie');
    expect(merchantKey('Max Mustermann', 'Rent share')).toBe('max mustermann');
    expect(merchantKey('Bäckerei Müller', '')).toBe('baeckerei mueller');
  });

  it('falls back to the purpose without a payee, and is empty without either', () => {
    expect(merchantKey('', 'Spotify P1234')).toBe('spotify');
    expect(merchantKey('', '')).toBe('');
  });
});
