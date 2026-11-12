import { describe, expect, it } from 'vitest';
import type { Operator } from '@/data/legal';
import { MESSAGES } from '@/i18n/messages';
import { sectionsFor, type LegalBlock, type LegalLang, type LegalSection } from './content';
import { privacySections } from './privacy-notice';

const operator: Operator = {
  name: 'Erika Mustermann',
  street: 'Musterstraße 1',
  postcode: '93053',
  city: 'Regensburg',
  country: 'Deutschland',
  email: 'erika@example.com',
};

const sections = privacySections(operator);
const section = (id: string): LegalSection => {
  const found = sections.find((at) => at.id === id);
  if (found === undefined) throw new Error(`no section ${id}`);
  return found;
};
const textOf = (blocks: readonly LegalBlock[]) =>
  blocks.map((block) => (block.kind === 'p' ? block.text : block.kind === 'list' ? block.items.join(' ') : block.lines.join(' '))).join(' ');
const words = (id: string, lang: LegalLang) => textOf(section(id)[lang].blocks);

describe('the privacy notice, part 1 (legal pages, chunk 2)', () => {
  it('starts with the controller, ends with what is still to come, and shows each part only where the build has it', () => {
    expect(sections.map(({ id, when }) => [id, when])).toEqual([
      ['controller', 'always'],
      ['overview', 'always'],
      ['on-your-phone', 'always'],
      ['hosting', 'always'],
      ['speed-insights', 'always'],
      ['exchange-rates', 'always'],
      ['map', 'map'],
      ['speech', 'always'],
      ['translate', 'supabase'],
      ['in-progress', 'always'],
    ]);
    const bare = sectionsFor(sections, { supabase: false, ai: false, reminder: false, map: false }).map((at) => at.id);
    expect(bare).not.toContain('map');
    expect(bare).not.toContain('translate');
  });

  it('names the app’s buttons and pages as the app shows them, in each language', () => {
    for (const lang of ['de', 'en'] as const) {
      const t = MESSAGES[lang];
      expect(words('on-your-phone', lang)).toContain(
        `${t.shell.headings.settings} → ${t.shell.headings.backup} → ${t.backup.delete.button}`,
      );
      expect(words('speech', lang)).toContain(t.entries.quickAdd.mic);
      expect(words('speech', lang)).toContain(t.entries.quickAdd.label);
      expect(words('map', lang)).toContain(t.tips.discountMap.showMe);
      expect(words('translate', lang)).toContain(t.tips.hacks.translate);
    }
  });

  it('says no cookies are set, and gives a legal basis wherever the app or its host processes data', () => {
    expect(words('on-your-phone', 'de')).toContain('Cookies setzt sie keine');
    expect(words('on-your-phone', 'en')).toContain('It sets no cookies');
    for (const id of ['hosting', 'speed-insights', 'exchange-rates']) {
      expect(words(id, 'de'), id).toContain('Art. 6 Abs. 1 lit. f DSGVO');
      expect(words(id, 'en'), id).toContain('Art. 6 (1) (f) GDPR');
    }
    expect(words('on-your-phone', 'de')).toContain('§ 25 Abs. 2 Nr. 2 TDDDG');
    expect(words('on-your-phone', 'en')).toContain('Section 25 (2) no. 2 TDDDG');
  });
});
