import { describe, expect, it } from 'vitest';
import { MESSAGES } from '@/i18n/messages';
import { CITY_PACK } from '../../../supabase/functions/_shared/ai/city-pack';
import { askSourcesOf } from './sources';

// The sources of an Ask answer, found again in the app's own data (the AI phase, chunk 10).

describe('askSourcesOf', () => {
  it('finds every item the city pack can cite, each with a source, a link and a checked day', () => {
    const ids = CITY_PACK.map((item) => item.id);
    const sources = askSourcesOf(ids, MESSAGES.en, 'en', 'en-IE');
    expect(sources.map((source) => source.id)).toEqual(ids);
    for (const source of sources) {
      expect(source.parts.length, source.id).toBeGreaterThan(0);
      for (const part of source.parts) {
        expect(part.label, source.id).not.toBe('');
        expect(part.source, source.id).not.toBe('');
        expect(part.url, source.id).toMatch(/^https:\/\//);
        expect(part.checked, source.id).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      }
    }
  });

  it('keeps the order cited, and leaves out an id the app doesn’t know', () => {
    const sources = askSourcesOf(['range:rent', 'tip:made-up', 'semester:ur:winter'], MESSAGES.en, 'en', 'en-IE');
    expect(sources.map((source) => [source.id, source.name])).toEqual([
      ['range:rent', 'Rent'],
      ['semester:ur:winter', 'Winter semester at Universität Regensburg'],
    ]);
  });

  it('names the items in the phone’s language, a tip in German where it is translated', () => {
    const [tip] = askSourcesOf(['tip:cafeteria-surprise-bags'], MESSAGES.de, 'de', 'de-DE');
    expect(tip.nameLang).toBeUndefined();
    expect(tip.name).not.toBe('Grab a cafeteria surprise bag');
    const [range] = askSourcesOf(['range:rent'], MESSAGES.de, 'de', 'de-DE');
    expect(range.name).toBe(MESSAGES.de.categories.rent);
  });

  it('shows a cited checklist item with its own source and link, named in the phone’s language', () => {
    const [english] = askSourcesOf(['checklist:register-your-address'], MESSAGES.en, 'en', 'en-IE');
    expect(english).toMatchObject({ id: 'checklist:register-your-address', name: 'Register your address', nameLang: undefined });
    expect(english.parts).toEqual([
      expect.objectContaining({ label: 'Register your address', url: 'https://www.gesetze-im-internet.de/bmg/__17.html' }),
    ]);
    const [german] = askSourcesOf(['checklist:register-your-address'], MESSAGES.de, 'de', 'de-DE');
    expect(german.nameLang).toBeUndefined();
    expect(german.name).not.toBe('Register your address');
    expect(german.parts[0].url).toBe(english.parts[0].url);
  });
});
