/**
 * Who runs StudentsBudget, for the Impressum and the privacy notice (legal pages, chunk 1;
 * docs/superpowers/plans/2026-11-12-legal-pages.md). Roshan fills these in himself, on chunk 1's branch before it
 * merges: until then each is a placeholder, the pages show it as one, and a Production build on Vercel refuses to run
 * (`assertLegalReady`, called by next.config.ts), so the live site keeps its last good deploy.
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

export const OPERATOR: Operator = {
  name: `${PLACEHOLDER}: your full name`,
  street: `${PLACEHOLDER}: street and number`,
  postcode: PLACEHOLDER,
  city: PLACEHOLDER,
  country: 'Deutschland',
  email: `${PLACEHOLDER}: an email address you read`,
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
