import type { SupabaseClient } from '@supabase/supabase-js';
import { CATEGORIES } from '@/data/categories';
import type { Language } from '@/i18n/languages';

// Adding a discount from the app (docs/superpowers/plans/2026-11-11-community.md, chunk 6), through the database's
// `post_discount` (migration 20261111101604_community_discounts.sql), which checks the user, the username and the daily
// limit. The fields are checked here first, by the table's own rules, so a discount it would refuse is never sent.

/** The categories a discount can be in: every expense category, in the app's order. */
export const DISCOUNT_CATEGORIES: readonly string[] = CATEGORIES.filter((category) => category.kind !== 'oneoff').map(
  (category) => category.id,
);

// The table's checks (migration 20261111101604_community_discounts.sql); change both together.
export const PLACE_MIN = 2;
export const PLACE_MAX = 80;
export const ADDRESS_MAX = 120;
export const OFFER_MIN = 3;
export const OFFER_MAX = 120;
export const CONDITIONS_MAX = 300;
export const LINK_MAX = 300;
const LINK_PATTERN = /^https:\/\/\S+$/;

/** What the form holds while someone types. */
export type DiscountDraft = {
  place: string;
  offer: string;
  conditions: string;
  address: string;
  categoryId: string;
  link: string;
};

export const EMPTY_DISCOUNT: DiscountDraft = {
  place: '',
  offer: '',
  conditions: '',
  address: '',
  categoryId: 'eating-out',
  link: '',
};

/** A discount as it is sent: an empty address or conditions left out. */
export type NewDiscount = {
  place: string;
  offer: string;
  conditions: string | null;
  address: string | null;
  categoryId: string;
  link: string;
};

export type DiscountProblem =
  | 'placeShort'
  | 'placeLong'
  | 'offerShort'
  | 'offerLong'
  | 'conditionsLong'
  | 'addressLong'
  | 'link';

/** The field each problem is about, so the form can tie its message to it. */
export const PROBLEM_FIELD: Record<DiscountProblem, keyof DiscountDraft> = {
  placeShort: 'place',
  placeLong: 'place',
  offerShort: 'offer',
  offerLong: 'offer',
  conditionsLong: 'conditions',
  addressLong: 'address',
  link: 'link',
};

/** Checks the form: the discount to send, or the first problem, in the form's order. Every field is trimmed. */
export function checkDiscount(
  draft: DiscountDraft,
): { ok: true; discount: NewDiscount } | { ok: false; problem: DiscountProblem } {
  const place = draft.place.trim();
  const offer = draft.offer.trim();
  const conditions = draft.conditions.trim();
  const address = draft.address.trim();
  const link = draft.link.trim();
  if (place.length < PLACE_MIN) return { ok: false, problem: 'placeShort' };
  if (place.length > PLACE_MAX) return { ok: false, problem: 'placeLong' };
  if (offer.length < OFFER_MIN) return { ok: false, problem: 'offerShort' };
  if (offer.length > OFFER_MAX) return { ok: false, problem: 'offerLong' };
  if (conditions.length > CONDITIONS_MAX) return { ok: false, problem: 'conditionsLong' };
  if (address.length > ADDRESS_MAX) return { ok: false, problem: 'addressLong' };
  if (!LINK_PATTERN.test(link) || link.length > LINK_MAX) return { ok: false, problem: 'link' };
  return {
    ok: true,
    discount: {
      place,
      offer,
      conditions: conditions === '' ? null : conditions,
      address: address === '' ? null : address,
      categoryId: draft.categoryId,
      link,
    },
  };
}

export type AddResult = 'added' | 'needs-username' | 'daily-limit' | 'invalid' | 'failed';

/** Adds a discount for the signed-in account, in the phone's language. */
export async function addDiscount(supabase: SupabaseClient, discount: NewDiscount, lang: Language): Promise<AddResult> {
  try {
    const { error } = await supabase.rpc('post_discount', {
      p_place: discount.place,
      p_address: discount.address,
      p_offer: discount.offer,
      p_conditions: discount.conditions,
      p_category: discount.categoryId,
      p_link: discount.link,
      p_lang: lang,
    });
    if (!error) return 'added';
    if (error.hint === 'needs-username' || error.hint === 'daily-limit') return error.hint;
    // 23514: a check of the table refused it, which the phone's own checks should have caught.
    if (error.code === '23514') return 'invalid';
    console.error('StudentsBudget: could not add the discount', error);
    return 'failed';
  } catch (thrown) {
    console.error('StudentsBudget: could not add the discount', thrown);
    return 'failed';
  }
}
