import { CITIES } from '@/data/cities';
import { DISCOUNTS } from '@/data/discounts';
import { SEMESTER_FEES, SEMESTER_PERIODS } from '@/data/semesters';
import { SWAPS } from '@/data/swaps';
import { TIPS } from '@/data/tips';
import { UNIVERSITIES } from '@/features/profile/profile';
import { amountText } from '@/features/swaps/suggest';
import { categoryNameIn } from '@/i18n/category-name';
import { discountIn, feePartIn, periodIn, rangeIn, reRegistrationIn, swapIn, tipIn } from '@/i18n/city';
import { contentLang } from '@/i18n/content';
import type { Language } from '@/i18n/languages';
import type { Messages } from '@/i18n/messages';
import type { IsoDate } from '@/lib/dates';
import { packId } from '../../../supabase/functions/_shared/ai/pack';

// The sources of an Ask answer (the AI phase, chunk 10, docs/superpowers/plans/2026-11-09-ai-phase-1.md): the model
// cites city data by id, and the page shows each item again from the app's own data, in the phone's language where it
// is translated. So a source's words, its link and its checked date never come from the model. The ids are the pack's
// own (`packId`), and sources.test.ts holds that every item of the pack is found here.

/** One sourced figure: what it covers, where it comes from, when that was checked, and the language of its words. */
export type AskSourcePart = {
  label: string;
  source: string;
  url: string;
  checked: IsoDate;
  textLang: 'en' | undefined;
};

/** A cited item: its name in the phone's language (or English, marked so) and its sourced parts. */
export type AskSource = { id: string; name: string; nameLang: 'en' | undefined; parts: AskSourcePart[] };

const universityName = (id: string) => UNIVERSITIES.find((u) => u.id === id)?.name ?? id;

/** Every item the pack can cite, by id, as the page shows it. */
function allSources(t: Messages, lang: Language, locale: string): Map<string, AskSource> {
  const sources = new Map<string, AskSource>();
  const add = (id: string, name: string, nameLang: 'en' | undefined, parts: AskSourcePart[]) =>
    sources.set(id, { id, name, nameLang, parts });
  const city = CITIES.regensburg;

  for (const range of city.ranges.map((r) => rangeIn(r, lang))) {
    const name = categoryNameIn(t, range.categoryId);
    add(packId.range(range.categoryId), name, undefined, [{ label: name, ...range }]);
  }
  // Prices have no translation: their label stays English, marked so.
  for (const price of city.prices) {
    const textLang = contentLang(lang);
    add(packId.price(price.label), price.label, textLang, [{ ...price, textLang }]);
  }
  for (const tip of TIPS.map((x) => tipIn(x, lang))) {
    add(packId.tip(tip.id), tip.title, tip.textLang, [{ label: tip.title, ...tip }]);
  }
  for (const discount of DISCOUNTS.map((x) => discountIn(x, lang))) {
    add(packId.discount(discount.id), discount.place, undefined, [{ label: discount.place, ...discount }]);
  }
  for (const swap of SWAPS.map((x) => swapIn(x, lang))) {
    const parts: AskSourcePart[] =
      swap.toSource === undefined || swap.toUrl === undefined
        ? [{ label: swap.title, ...swap }]
        : [
            { label: t.tips.swap.sourceOf(amountText(swap.fromMinor, locale)), ...swap },
            {
              label: t.tips.swap.sourceOf(amountText(swap.toMinor, locale)),
              source: swap.toSource,
              url: swap.toUrl,
              checked: swap.checked,
              textLang: swap.textLang,
            },
          ];
    add(packId.swap(swap.id), swap.title, swap.textLang, parts);
  }
  for (const period of SEMESTER_PERIODS.map((x) => periodIn(x, lang))) {
    const term = period.term === 'winter' ? t.profile.winter : t.profile.summer;
    const name = t.ask.semester(term, universityName(period.university));
    add(packId.semester(period.university, period.term), name, undefined, [{ label: name, ...period }]);
  }
  for (const fee of SEMESTER_FEES) {
    const parts: AskSourcePart[] = (fee.parts ?? []).map((part) => feePartIn(part, lang));
    if (fee.reRegistration) {
      parts.push({ label: t.profile.fee.reRegistration, ...reRegistrationIn(fee.reRegistration, lang) });
    }
    if (parts.length === 0) continue;
    add(packId.fee(fee.university, fee.starts), t.ask.fee(universityName(fee.university)), undefined, parts);
  }
  return sources;
}

/** The sources an answer cites, as the page shows them, in the order cited; an id the app doesn't know is left out. */
export function askSourcesOf(ids: readonly string[], t: Messages, lang: Language, locale: string): AskSource[] {
  const sources = allSources(t, lang, locale);
  return ids.flatMap((id) => {
    const source = sources.get(id);
    return source === undefined ? [] : [source];
  });
}
