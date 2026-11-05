import type { SupabaseClient } from '@supabase/supabase-js';
import type { Messages } from '@/i18n/messages';

// The name a student posts under in the hacks feed (docs/superpowers/plans/2026-11-05-hacks-feed.md): a unique
// @username, a label and an optional batch year, kept in the account's `public_profiles` row. Sign-up asks for them,
// Your account changes them, and other students will see them next to each post.

export const LABELS = ['student', 'graduate', 'alumni'] as const;
export type PostingLabel = (typeof LABELS)[number];

export type PostingName = { username: string; label: PostingLabel | null; batch: number | null };

/** What the fields hold while someone types: the batch is still text. */
export type PostingNameDraft = { username: string; label: PostingLabel; batch: string };

export const EMPTY_DRAFT: PostingNameDraft = { username: '', label: 'student', batch: '' };

// The database's rule (migration 20261105100426_public_profiles.sql), checked here first so a name it would refuse is
// never sent. Change both together.
const USERNAME_CHARACTERS = /^[a-z0-9_]*$/;
export const USERNAME_MIN = 3;
export const USERNAME_MAX = 20;
export const RESERVED_USERNAMES = ['admin', 'administrator', 'moderator', 'mod', 'studentsbudget', 'support', 'system'];
export const BATCH_MIN = 2000;
export const BATCH_MAX = 2100;

export type NameProblem = keyof Messages['auth']['postingName']['errors'];

/** The username as it is saved: without spaces around it or a leading @, in lower case. */
export function normaliseUsername(typed: string): string {
  return typed.trim().replace(/^@/, '').toLowerCase();
}

/** What is wrong with a username, or null when the database would take it (if nobody has it yet). */
export function usernameProblem(username: string): NameProblem | null {
  if (username === '') return 'empty';
  if (!USERNAME_CHARACTERS.test(username)) return 'characters';
  if (username.length < USERNAME_MIN) return 'short';
  if (username.length > USERNAME_MAX) return 'long';
  if (RESERVED_USERNAMES.includes(username)) return 'reserved';
  return null;
}

/** The batch year from its field: null when left blank, 'invalid' unless it is a year from 2000 to 2100. */
export function parseBatch(typed: string): number | null | 'invalid' {
  const trimmed = typed.trim();
  if (trimmed === '') return null;
  if (!/^\d{4}$/.test(trimmed)) return 'invalid';
  const year = Number(trimmed);
  return year >= BATCH_MIN && year <= BATCH_MAX ? year : 'invalid';
}

/** Checks the fields before anything is sent: the name to save, or the first problem. */
export function checkDraft(draft: PostingNameDraft): { ok: true; name: PostingName } | { ok: false; problem: NameProblem } {
  const username = normaliseUsername(draft.username);
  const problem = usernameProblem(username);
  if (problem !== null) return { ok: false, problem };
  const batch = parseBatch(draft.batch);
  if (batch === 'invalid') return { ok: false, problem: 'batch' };
  return { ok: true, name: { username, label: draft.label, batch } };
}

/** The fields filled from a saved name, for changing it. */
export function draftOf(name: PostingName): PostingNameDraft {
  return { username: name.username, label: name.label ?? 'student', batch: name.batch === null ? '' : String(name.batch) };
}

/** How others see the name: "@roshan · Student · Batch '27". */
export function postingNameText(name: PostingName, text: Messages['auth']['postingName']): string {
  const parts = [`@${name.username}`];
  if (name.label !== null) parts.push(text.labels[name.label]);
  if (name.batch !== null) parts.push(text.batchShort(name.batch));
  return parts.join(' · ');
}

function isLabel(value: unknown): value is PostingLabel {
  return LABELS.some((label) => label === value);
}

/** Whether a username is still free, asked before sign-up (signed out) or a change. Null when it couldn't be asked. */
export async function usernameAvailable(supabase: SupabaseClient, username: string): Promise<boolean | null> {
  try {
    const { data, error } = await supabase.rpc('username_available', { p_username: username });
    if (error || typeof data !== 'boolean') {
      console.error('StudentsBudget: could not check the username', error);
      return null;
    }
    return data;
  } catch (thrown) {
    console.error('StudentsBudget: could not check the username', thrown);
    return null;
  }
}

/** The signed-in account's own name: null when it has none yet, 'failed' when it couldn't be read. */
export async function readPostingName(supabase: SupabaseClient): Promise<PostingName | null | 'failed'> {
  try {
    const { data, error } = await supabase.from('public_profiles').select('username, label, batch').maybeSingle();
    if (error) {
      console.error('StudentsBudget: could not read the posting name', error);
      return 'failed';
    }
    if (data === null) return null;
    const row: Record<string, unknown> = data;
    if (typeof row.username !== 'string') return 'failed';
    return {
      username: row.username,
      label: isLabel(row.label) ? row.label : null,
      batch: typeof row.batch === 'number' ? row.batch : null,
    };
  } catch (thrown) {
    console.error('StudentsBudget: could not read the posting name', thrown);
    return 'failed';
  }
}

/** Saves the signed-in account's name, made or changed. 'taken' when someone else has the username. */
export async function savePostingName(
  supabase: SupabaseClient,
  userId: string,
  name: PostingName,
): Promise<'saved' | 'taken' | 'failed'> {
  try {
    const { error } = await supabase
      .from('public_profiles')
      .upsert({ user_id: userId, username: name.username, label: name.label, batch: name.batch });
    if (!error) return 'saved';
    // 23505: the unique username belongs to someone else.
    if (error.code === '23505') return 'taken';
    console.error('StudentsBudget: could not save the posting name', error);
    return 'failed';
  } catch (thrown) {
    console.error('StudentsBudget: could not save the posting name', thrown);
    return 'failed';
  }
}
