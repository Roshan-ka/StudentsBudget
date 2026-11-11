import type { SupabaseClient } from '@supabase/supabase-js';
import { CITIES, type HackCity } from './posts';

// Moderating the hacks feed (docs/superpowers/plans/2026-11-05-hacks-feed.md, chunk 7), through the database's
// `am_i_moderator`, `moderation_queue` and `moderate_hack` (migration 20261105110007_hacks.sql). The moderator is set
// by hand in the database, and the queue and the actions answer only a session that gave the authenticator code.

/** A post someone reported (or the moderator hid), as the moderator sees it. */
export type QueueItem = {
  id: string;
  body: string;
  city: HackCity;
  categoryId: string;
  lang: string;
  createdAt: string;
  username: string | null;
  /** Reports since the moderator last kept it: what counts towards hiding it for everyone. */
  reports: number;
  hiddenByHand: boolean;
  hiddenByReports: boolean;
};

export type QueueAnswer = QueueItem[] | 'needs-code' | 'not-moderator' | 'failed';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** Which of the database's refusals an error is: the second step owed, or not a moderator. */
function refusalOf(error: { code?: string; message?: string }): 'needs-code' | 'not-moderator' | null {
  if (error.code !== '42501') return null;
  return error.message?.includes('second step') ? 'needs-code' : 'not-moderator';
}

/** Whether the signed-in account moderates; null when it couldn't be asked. */
export async function amIModerator(supabase: SupabaseClient): Promise<boolean | null> {
  try {
    const { data, error } = await supabase.rpc('am_i_moderator');
    if (error || typeof data !== 'boolean') {
      console.error('StudentsBudget: could not ask whether this account moderates', error);
      return null;
    }
    return data;
  } catch (thrown) {
    console.error('StudentsBudget: could not ask whether this account moderates', thrown);
    return null;
  }
}

/** One queue row as an item, or null for a row this build can't read. */
export function queueItemOf(row: unknown): QueueItem | null {
  if (!isRecord(row)) return null;
  const { id, body, city, category, lang, created_at: createdAt } = row;
  if (typeof id !== 'string' || typeof body !== 'string' || typeof category !== 'string') return null;
  const place = CITIES.find((known) => known === city);
  if (place === undefined || typeof lang !== 'string' || typeof createdAt !== 'string') return null;
  return {
    id,
    body,
    city: place,
    categoryId: category,
    lang,
    createdAt,
    username: typeof row.username === 'string' ? row.username : null,
    reports: typeof row.reports_since_kept === 'number' ? row.reports_since_kept : 0,
    hiddenByHand: row.hidden_by_hand === true,
    hiddenByReports: row.hidden_by_reports === true,
  };
}

/** The reported posts, or why there are none to show. */
export async function readQueue(supabase: SupabaseClient): Promise<QueueAnswer> {
  try {
    const { data, error } = await supabase.rpc('moderation_queue');
    if (error) {
      const refusal = refusalOf(error);
      if (refusal !== null) return refusal;
      console.error('StudentsBudget: could not load the moderation queue', error);
      return 'failed';
    }
    if (!Array.isArray(data)) return 'failed';
    return data.map(queueItemOf).filter((item): item is QueueItem => item !== null);
  } catch (thrown) {
    console.error('StudentsBudget: could not load the moderation queue', thrown);
    return 'failed';
  }
}

/** Hides a post from every feed, or keeps it (it shows again, and its report count starts afresh). */
export async function moderate(
  supabase: SupabaseClient,
  id: string,
  action: 'hide' | 'keep',
): Promise<'done' | 'needs-code' | 'failed'> {
  try {
    const { error } = await supabase.rpc('moderate_hack', { p_id: id, p_action: action });
    if (!error) return 'done';
    if (refusalOf(error) === 'needs-code') return 'needs-code';
    console.error('StudentsBudget: could not moderate the post', error);
    return 'failed';
  } catch (thrown) {
    console.error('StudentsBudget: could not moderate the post', thrown);
    return 'failed';
  }
}

/** A comment someone reported (or the moderator hid), as the moderator sees it (community, chunk 3). */
export type CommentQueueItem = {
  id: string;
  hackId: string;
  body: string;
  lang: string;
  createdAt: string;
  username: string | null;
  /** Reports since the moderator last kept it: what counts towards hiding it for everyone. */
  reports: number;
  hiddenByHand: boolean;
  hiddenByReports: boolean;
};

export type CommentQueueAnswer = CommentQueueItem[] | 'needs-code' | 'not-moderator' | 'failed';

/** One `comment_queue` row as an item, or null for a row this build can't read. */
export function commentQueueItemOf(row: unknown): CommentQueueItem | null {
  if (!isRecord(row)) return null;
  const { id, hack_id: hackId, body, lang, created_at: createdAt } = row;
  if (typeof id !== 'string' || typeof hackId !== 'string' || typeof body !== 'string') return null;
  if (typeof lang !== 'string' || typeof createdAt !== 'string') return null;
  return {
    id,
    hackId,
    body,
    lang,
    createdAt,
    username: typeof row.username === 'string' ? row.username : null,
    reports: typeof row.reports_since_kept === 'number' ? row.reports_since_kept : 0,
    hiddenByHand: row.hidden_by_hand === true,
    hiddenByReports: row.hidden_by_reports === true,
  };
}

/** The reported comments (migration 20261111092551_hack_comments.sql), or why there are none to show. */
export async function readCommentQueue(supabase: SupabaseClient): Promise<CommentQueueAnswer> {
  try {
    const { data, error } = await supabase.rpc('comment_queue');
    if (error) {
      const refusal = refusalOf(error);
      if (refusal !== null) return refusal;
      console.error('StudentsBudget: could not load the reported comments', error);
      return 'failed';
    }
    if (!Array.isArray(data)) return 'failed';
    return data.map(commentQueueItemOf).filter((item): item is CommentQueueItem => item !== null);
  } catch (thrown) {
    console.error('StudentsBudget: could not load the reported comments', thrown);
    return 'failed';
  }
}

/** Hides a comment from every list, or keeps it (it shows again, and its report count starts afresh). */
export async function moderateComment(
  supabase: SupabaseClient,
  id: string,
  action: 'hide' | 'keep',
): Promise<'done' | 'needs-code' | 'failed'> {
  try {
    const { error } = await supabase.rpc('moderate_comment', { p_id: id, p_action: action });
    if (!error) return 'done';
    if (refusalOf(error) === 'needs-code') return 'needs-code';
    console.error('StudentsBudget: could not moderate the comment', error);
    return 'failed';
  } catch (thrown) {
    console.error('StudentsBudget: could not moderate the comment', thrown);
    return 'failed';
  }
}
