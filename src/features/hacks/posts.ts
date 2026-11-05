import type { SupabaseClient } from '@supabase/supabase-js';
import type { Language } from '@/i18n/languages';

// Posting and deleting a hack (docs/superpowers/plans/2026-11-05-hacks-feed.md, chunk 5), through the database's
// `post_hack` and `delete_hack` (migration 20261105110007_hacks.sql), which check the user, the username and the daily
// limit. The fields are checked here first, by the table's own rules, so a post it would refuse is never sent.

/** The categories a post can be in, in the app's order. */
export const HACK_CATEGORIES = [
  'food',
  'eating-out',
  'going-out',
  'transport',
  'rent',
  'study',
  'subscriptions',
  'shopping',
  'health',
  'other',
] as const;

export const CITIES = ['regensburg', 'anywhere'] as const;
export type HackCity = (typeof CITIES)[number];

// The table's checks (migration 20261105110007_hacks.sql); change both together.
export const BODY_MIN = 10;
export const BODY_MAX = 500;
export const LINK_MAX = 300;
const LINK_PATTERN = /^https:\/\/\S+$/;

/** What the form holds while someone types. */
export type HackDraft = { body: string; categoryId: string; city: HackCity; link: string };

export const EMPTY_HACK: HackDraft = { body: '', categoryId: 'food', city: 'regensburg', link: '' };

/** A post as it is sent. */
export type NewHack = { body: string; categoryId: string; city: HackCity; link: string | null };

export type HackProblem = 'short' | 'long' | 'link';

/** Checks the form: the post to send, or the first problem. The text and the link are trimmed. */
export function checkHack(draft: HackDraft): { ok: true; hack: NewHack } | { ok: false; problem: HackProblem } {
  const body = draft.body.trim();
  if (body.length < BODY_MIN) return { ok: false, problem: 'short' };
  if (body.length > BODY_MAX) return { ok: false, problem: 'long' };
  const link = draft.link.trim();
  if (link !== '' && (!LINK_PATTERN.test(link) || link.length > LINK_MAX)) return { ok: false, problem: 'link' };
  return { ok: true, hack: { body, categoryId: draft.categoryId, city: draft.city, link: link === '' ? null : link } };
}

export type PostResult = 'posted' | 'needs-username' | 'daily-limit' | 'invalid' | 'failed';

/** Posts for the signed-in account, in the phone's language. */
export async function postHack(supabase: SupabaseClient, hack: NewHack, lang: Language): Promise<PostResult> {
  try {
    const { error } = await supabase.rpc('post_hack', {
      p_body: hack.body,
      p_city: hack.city,
      p_category: hack.categoryId,
      p_link: hack.link,
      p_lang: lang,
    });
    if (!error) return 'posted';
    if (error.hint === 'needs-username' || error.hint === 'daily-limit') return error.hint;
    // 23514: a check of the table refused it, which the phone's own checks should have caught.
    if (error.code === '23514') return 'invalid';
    console.error('StudentsBudget: could not post the hack', error);
    return 'failed';
  } catch (thrown) {
    console.error('StudentsBudget: could not post the hack', thrown);
    return 'failed';
  }
}

/** Deletes one of the signed-in account's own posts. */
export async function deleteHack(supabase: SupabaseClient, id: string): Promise<'deleted' | 'failed'> {
  try {
    const { error } = await supabase.rpc('delete_hack', { p_id: id });
    if (!error) return 'deleted';
    console.error('StudentsBudget: could not delete the hack', error);
    return 'failed';
  } catch (thrown) {
    console.error('StudentsBudget: could not delete the hack', thrown);
    return 'failed';
  }
}
