import { describe, expect, it } from 'vitest';
import type { Operator } from '@/data/legal';
import { legalLangFor, sectionsFor, type LegalBlock, type LegalSection } from './content';
import { impressumSections } from './impressum';
import { privacySections } from './privacy-notice';

const operator: Operator = {
  name: 'Erika Mustermann',
  street: 'Musterstraße 1',
  postcode: '93053',
  city: 'Regensburg',
  country: 'Deutschland',
  email: 'erika@example.com',
};

const PAGES: [string, LegalSection[]][] = [
  ['privacy', privacySections(operator)],
  ['impressum', impressumSections(operator)],
];

const textOf = (blocks: readonly LegalBlock[]) =>
  blocks.map((block) => (block.kind === 'p' ? block.text : block.kind === 'list' ? block.items.join(' ') : block.lines.join(' '))).join(' ');

describe('the legal pages’ texts', () => {
  for (const [page, sections] of PAGES) {
    it(`${page}: every section has a German and an English text, and an anchor of its own`, () => {
      const ids = sections.map((section) => section.id);
      expect(new Set(ids).size).toBe(ids.length);
      for (const section of sections) {
        expect(section.id).toMatch(/^[a-z][a-z-]*$/);
        for (const lang of ['de', 'en'] as const) {
          expect(section[lang].heading.trim(), `${section.id} ${lang}`).not.toBe('');
          expect(textOf(section[lang].blocks).trim(), `${section.id} ${lang}`).not.toBe('');
        }
      }
    });
  }

  it('names the operator, with address and email, in the Impressum and as the controller', () => {
    for (const [page, sections] of PAGES) {
      const all = sections.map((section) => textOf(section.de.blocks) + textOf(section.en.blocks)).join(' ');
      for (const part of [operator.name, operator.street, `${operator.postcode} ${operator.city}`, operator.email]) {
        expect(all, `${page}: ${part}`).toContain(part);
      }
    }
  });

  it('is German on a German phone, and English on any other, with a note on a French or Spanish one', () => {
    expect(legalLangFor('de')).toEqual({ lang: 'de', fallback: false });
    expect(legalLangFor('en')).toEqual({ lang: 'en', fallback: false });
    expect(legalLangFor('fr')).toEqual({ lang: 'en', fallback: true });
    expect(legalLangFor('es')).toEqual({ lang: 'en', fallback: true });
  });

  it('shows a section only in a build that has what it describes', () => {
    const at = (id: string, when: LegalSection['when']): LegalSection => ({
      id,
      when,
      de: { heading: id, blocks: [{ kind: 'p', text: id }] },
      en: { heading: id, blocks: [{ kind: 'p', text: id }] },
    });
    const sections = [at('a', 'always'), at('b', 'supabase'), at('c', 'ai'), at('d', 'reminder'), at('e', 'map')];
    const none = { supabase: false, ai: false, aiSetup: false, reminder: false, map: false };
    expect(sectionsFor(sections, none).map((s) => s.id)).toEqual(['a']);
    expect(sectionsFor(sections, { ...none, supabase: true, map: true }).map((s) => s.id)).toEqual(['a', 'b', 'e']);
  });
});
