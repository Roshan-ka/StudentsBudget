import { describe, expect, it } from 'vitest';
import { assertLegalReady, legalFilledIn, OPERATOR, PLACEHOLDER, type Operator } from './legal';

const filled: Operator = {
  name: 'Erika Mustermann',
  street: 'Musterstraße 1',
  postcode: '93053',
  city: 'Regensburg',
  country: 'Deutschland',
  email: 'erika@example.com',
};

describe('who runs the site', () => {
  it('counts as filled in only with every part given and no placeholder left', () => {
    expect(legalFilledIn(filled)).toBe(true);
    expect(legalFilledIn({ ...filled, city: PLACEHOLDER })).toBe(false);
    expect(legalFilledIn({ ...filled, email: `${PLACEHOLDER}: an email address you read` })).toBe(false);
    expect(legalFilledIn({ ...filled, street: ' ' })).toBe(false);
  });

  it('stops a Production build while a placeholder is left, and nothing else', () => {
    const waiting = { ...filled, name: PLACEHOLDER };
    expect(() => assertLegalReady('production', waiting)).toThrow(/src\/data\/legal\.ts/);
    expect(() => assertLegalReady('production', filled)).not.toThrow();
    expect(() => assertLegalReady('preview', waiting)).not.toThrow();
    expect(() => assertLegalReady(undefined, waiting)).not.toThrow();
  });

  // Red until Roshan's details are in OPERATOR, so the quick check says what a Production build would: #218 and #224
  // were merged with placeholders, CI green, and only the Production build stopped (12-11-2026).
  it('is filled in, so a Production build can run', () => {
    expect(legalFilledIn(OPERATOR), 'fill in OPERATOR in src/data/legal.ts').toBe(true);
  });
});
