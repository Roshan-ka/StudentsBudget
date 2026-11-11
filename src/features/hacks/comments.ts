import type { SupabaseClient } from '@supabase/supabase-js';
import type { Language } from '@/i18n/languages';
import { LABELS, type PostingLabel, type PostingName } from './posting-name';

// Comments on hacks (docs/superpowers/plans/2026-11-11-community.md, chunk 2): flat, under each post, oldest first,
// through the database's functions (migration 20261111092551_hack_comments.sql), which check the user, the username,
// the post and the daily limit. The text is checked here first, by the table's own rule, so a comment it would refuse
// is never sent.

// The table's check (migration 20261111092551_hack_comments.sql); change both together.
export const COMMENT_MIN = 3;
export const COMMENT_MAX = 300;

/** One comment as the app shows it. The author is null only for a comment whose author has no username. */
export type HackComment = {
  id: string;
  body: string;
  lang: string;
  createdAt: string;
  author: PostingName | null;
  mine: boolean;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** One row of `comments_for` as a comment, or null for a row this build can't read (left out, not an error). */
export function commentOf(row: unknown): HackComment | null {
  if (!isRecord(row)) return null;
  const { id, body, lang, created_at: createdAt } = row;
  if (typeof id !== 'string' || typeof body !== 'string' || typeof lang !== 'string') return null;
  if (typeof createdAt !== 'string' || Number.isNaN(Date.parse(createdAt))) return null;
  const label = LABELS.find((known): known is PostingLabel => known === row.label) ?? null;
  return {
    id,
    body,
    lang,
    createdAt,
    author:
      typeof row.username === 'string'
        ? { username: row.username, label, batch: typeof row.batch === 'number' ? row.batch : null }
        : null,
    mine: row.mine === true,
  };
}

/** The comments on a post the signed-in account may see, oldest first; null when they couldn't be loaded. */
export async function readComments(supabase: SupabaseClient, hackId: string): Promise<HackComment[] | null> {
  try {
    const { data, error } = await supabase.rpc('comments_for', { p_hack_id: hackId });
    if (error || !Array.isArray(data)) {
      console.error('StudentsBudget: could not load the comments', error);
      return null;
    }
    return data.map(commentOf).filter((comment): comment is HackComment => comment !== null);
  } catch (thrown) {
    console.error('StudentsBudget: could not load the comments', thrown);
    return null;
  }
}

/** How many comments each post has, by its id (posts with none are missing); null when they couldn't be loaded. */
export async function readCommentCounts(supabase: SupabaseClient): Promise<ReadonlyMap<string, number> | null> {
  try {
    const { data, error } = await supabase.rpc('comment_counts');
    if (error || !Array.isArray(data)) {
      console.error('StudentsBudget: could not load the comment counts', error);
      return null;
    }
    const counts = new Map<string, number>();
    for (const row of data) {
      if (isRecord(row) && typeof row.hack_id === 'string' && typeof row.comments === 'number') {
        counts.set(row.hack_id, row.comments);
      }
    }
    return counts;
  } catch (thrown) {
    console.error('StudentsBudget: could not load the comment counts', thrown);
    return null;
  }
}

export type CommentProblem = 'short' | 'long';

/** Checks what was typed: the comment to send, trimmed, or the problem. */
export function checkComment(text: string): { ok: true; body: string } | { ok: false; problem: CommentProblem } {
  const body = text.trim();
  if (body.length < COMMENT_MIN) return { ok: false, problem: 'short' };
  if (body.length > COMMENT_MAX) return { ok: false, problem: 'long' };
  return { ok: true, body };
}

export type CommentResult = 'posted' | 'needs-username' | 'daily-limit' | 'gone' | 'invalid' | 'failed';

/** Comments for the signed-in account, in the phone's language. */
export async function postComment(
  supabase: SupabaseClient,
  hackId: string,
  body: string,
  lang: Language,
): Promise<CommentResult> {
  try {
    const { error } = await supabase.rpc('post_comment', { p_hack_id: hackId, p_body: body, p_lang: lang });
    if (!error) return 'posted';
    if (error.hint === 'needs-username' || error.hint === 'daily-limit') return error.hint;
    if (error.hint === 'not-found') return 'gone';
    // 23514: a check of the table refused it, which the phone's own check should have caught.
    if (error.code === '23514') return 'invalid';
    console.error('StudentsBudget: could not post the comment', error);
    return 'failed';
  } catch (thrown) {
    console.error('StudentsBudget: could not post the comment', thrown);
    return 'failed';
  }
}

/** Deletes one of the signed-in account's own comments. */
export async function deleteComment(supabase: SupabaseClient, id: string): Promise<'deleted' | 'failed'> {
  try {
    const { error } = await supabase.rpc('delete_comment', { p_id: id });
    if (!error) return 'deleted';
    console.error('StudentsBudget: could not delete the comment', error);
    return 'failed';
  } catch (thrown) {
    console.error('StudentsBudget: could not delete the comment', thrown);
    return 'failed';
  }
}

/** Reports someone else's comment: it leaves this account's list at once. */
export async function reportComment(supabase: SupabaseClient, id: string): Promise<'reported' | 'gone' | 'failed'> {
  try {
    const { error } = await supabase.rpc('report_comment', { p_id: id });
    if (!error) return 'reported';
    if (error.hint === 'not-found') return 'gone';
    console.error('StudentsBudget: could not report the comment', error);
    return 'failed';
  } catch (thrown) {
    console.error('StudentsBudget: could not report the comment', thrown);
    return 'failed';
  }
}
