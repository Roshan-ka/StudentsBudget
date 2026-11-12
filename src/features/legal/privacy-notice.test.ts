import { describe, expect, it } from 'vitest';
import type { Operator } from '@/data/legal';
import { NOTE_SECTIONS, PRIVACY_NOTES, type PrivacyNoteId } from '@/features/privacy/notes';
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

describe('the privacy notice (legal pages, chunks 2 and 3)', () => {
  it('starts with the controller, ends with the rights, and shows each part only where the build has it', () => {
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
      ['account', 'supabase'],
      ['sign-in', 'supabase'],
      ['shared', 'supabase'],
      ['reminder', 'reminder'],
      ['ai', 'ai'],
      ['transfers', 'always'],
      ['rights', 'always'],
    ]);
    const bare = sectionsFor(sections, { supabase: false, ai: false, reminder: false, map: false }).map((at) => at.id);
    for (const id of ['map', 'translate', 'account', 'sign-in', 'shared', 'reminder', 'ai']) expect(bare).not.toContain(id);
  });

  it('has a section for every in-app note to link to, shown in every build where the note can show', () => {
    // A note shows only with its feature, so its section needs no more than the feature's build.
    const needs: Record<PrivacyNoteId, LegalSection['when']> = {
      mic: 'always',
      account: 'supabase',
      passkey: 'supabase',
      rates: 'always',
      votes: 'supabase',
      post: 'supabase',
      hackVotes: 'supabase',
      translate: 'supabase',
      reminder: 'reminder',
      ai: 'ai',
    };
    for (const note of Object.keys(PRIVACY_NOTES) as PrivacyNoteId[]) {
      const target = section(NOTE_SECTIONS[note]);
      expect([needs[note], 'always'], `${note} → ${target.id}`).toContain(target.when);
    }
  });

  it('names the app’s buttons and pages as the app shows them, in each language', () => {
    for (const lang of ['de', 'en'] as const) {
      const t = MESSAGES[lang];
      const settings = t.shell.headings.settings;
      expect(words('on-your-phone', lang)).toContain(`${settings} → ${t.shell.headings.backup} → ${t.backup.delete.button}`);
      expect(words('speech', lang)).toContain(t.entries.quickAdd.mic);
      expect(words('speech', lang)).toContain(t.entries.quickAdd.label);
      expect(words('map', lang)).toContain(t.tips.discountMap.showMe);
      expect(words('translate', lang)).toContain(t.tips.hacks.translate);
      expect(words('account', lang)).toContain(`${settings} → ${t.shell.headings.account} → ${t.auth.deleteAccount.heading}`);
      expect(words('sign-in', lang)).toContain(`${settings} → ${t.shell.headings.account}`);
      for (const feature of [t.entries.quickAdd.label, t.shell.headings.ask, t.setup.chat.open]) {
        expect(words('ai', lang)).toContain(feature);
      }
      expect(words('rights', lang)).toContain(`${settings} → ${t.shell.headings.backup}`);
      expect(words('rights', lang)).toContain(t.backup.export.button);
      expect(words('rights', lang)).toContain(t.backup.delete.button);
    }
  });

  it('says no cookies are set, and gives a legal basis wherever the app or a service for it processes data', () => {
    expect(words('on-your-phone', 'de')).toContain('Cookies setzt sie keine');
    expect(words('on-your-phone', 'en')).toContain('It sets no cookies');
    expect(words('on-your-phone', 'de')).toContain('§ 25 Abs. 2 Nr. 2 TDDDG');
    expect(words('on-your-phone', 'en')).toContain('Section 25 (2) no. 2 TDDDG');
    for (const id of ['hosting', 'speed-insights', 'exchange-rates']) {
      expect(words(id, 'de'), id).toContain('Art. 6 Abs. 1 lit. f DSGVO');
      expect(words(id, 'en'), id).toContain('Art. 6 (1) (f) GDPR');
    }
    for (const id of ['account', 'sign-in', 'shared', 'reminder', 'ai']) {
      expect(words(id, 'de'), id).toContain('Art. 6 Abs. 1 lit. b DSGVO');
      expect(words(id, 'en'), id).toContain('Art. 6 (1) (b) GDPR');
    }
    expect(words('transfers', 'de')).toContain('Art. 45 DSGVO');
    expect(words('transfers', 'de')).toContain('Art. 46 Abs. 2 lit. c DSGVO');
    expect(words('transfers', 'en')).toContain('Art. 45 GDPR');
    expect(words('transfers', 'en')).toContain('Art. 46 (2) (c) GDPR');
  });

  it('names the supervisory authority with its address', () => {
    for (const lang of ['de', 'en'] as const) {
      expect(words('rights', lang)).toContain('Bayerisches Landesamt für Datenschutzaufsicht (BayLDA)');
      expect(words('rights', lang)).toContain('91522 Ansbach');
    }
  });
});
