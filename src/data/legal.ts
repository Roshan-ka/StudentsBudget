/**
 * Who runs StudentsBudget, for the Impressum and the privacy notice (legal pages, chunk 1;
 * docs/superpowers/plans/2026-11-12-legal-pages.md). Roshan fills these in himself, in a commit of his own, so they
 * never pass through a chat: until then each is a placeholder, the pages show it as one, and a Production build on
 * Vercel refuses to run (`assertLegalReady`, called by next.config.ts), so the live site keeps its last good deploy.
 *
 * Plain values and no `@/` imports: next.config.ts reads this file too.
 */
export const PLACEHOLDER = 'TODO-FILL-IN';

export type Operator = {
  /** The person responsible: full name. */
  name: string;
  /** A postal address where letters reach the person (§ 5 DDG). */
  street: string;
  postcode: string;
  city: string;
  country: string;
  /** An address the person reads: the quick way to make contact. */
  email: string;
};

/*
 * ── Fill in your details here ──
 * Replace each 'TODO-FILL-IN: …' text inside its quotes with yours, keeping the quotes and the comma. For example:
 *
 *   name: 'Erika Mustermann',
 *   street: 'Musterstraße 1',
 *   postcode: '93053',
 *   city: 'Regensburg',
 *   email: 'erika@example.com',
 *
 * A value with an apostrophe in it goes in double quotes instead ("…"). Leave `country` as it is.
 * Everything here is public: on /impressum and /privacy, and in this repo and its SupportRW mirror.
 */
export const OPERATOR: Operator = {
  name: 'Roshan Anant Kadhiwala',
  street: 'Dr.Gessler Str.',
  postcode: '93051',
  city: 'Regensburg',
  country: 'Deutschland',
  email: 'roshankadhiwala666.de@gmail.com',
};

/** Whether every part of the operator's details is filled in. */
export function legalFilledIn(operator: Operator = OPERATOR): boolean {
  return Object.values(operator).every((value) => value.trim() !== '' && !value.includes(PLACEHOLDER));
}

/**
 * Stops a Production build while a placeholder is left: the Impressum and the privacy notice must name who runs the
 * site. Previews and local builds go on, showing the placeholders.
 */
export function assertLegalReady(vercelEnv: string | undefined, operator: Operator = OPERATOR): void {
  if (vercelEnv === 'production' && !legalFilledIn(operator)) {
    throw new Error(
      'The Impressum and the privacy notice still hold placeholders: fill in src/data/legal.ts before a Production deploy.',
    );
  }
}
