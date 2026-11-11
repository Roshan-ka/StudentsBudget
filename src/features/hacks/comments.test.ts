import { readFileSync } from 'node:fs';
import type { SupabaseClient } from '@supabase/supabase-js';
import { describe, expect, it } from 'vitest';
import { MESSAGES } from '@/i18n/messages';
import {
  checkComment,
  COMMENT_MAX,
  COMMENT_MIN,
  commentOf,
  deleteComment,
  postComment,
  readCommentCounts,
  readComments,
  reportComment,
} from './comments';

/** A client whose every call answers `answer`, keeping what was asked. */
function fakeSupabase(answer: { data?: unknown; error: { code?: string; hint?: string; message?: string } | null }) {
  const calls: { fn: string; args: unknown }[] = [];
  const client = {
    rpc: async (fn: string, args: unknown) => {
      calls.push({ fn, args });
      return { data: answer.data ?? null, error: answer.error };
    },
  } as unknown as SupabaseClient;
  return { client, calls };
}

const ROW = {
  id: 'c1',
  body: 'Good tip, thanks',
  lang: 'en',
  created_at: '2026-11-11T10:00:00Z',
  username: 'bea',
  label: 'student',
  batch: 2027,
  mine: false,
};

describe('a new comment', () => {
  it('is trimmed, and must be 3 to 300 characters', () => {
    expect(checkComment('  Good tip  ')).toEqual({ ok: true, body: 'Good tip' });
    expect(checkComment(' ok ')).toEqual({ ok: false, problem: 'short' });
    expect(checkComment('x'.repeat(COMMENT_MAX + 1))).toEqual({ ok: false, problem: 'long' });
    expect(checkComment('x'.repeat(COMMENT_MAX))).toMatchObject({ ok: true });
  });

  it('follows the table’s check, and its messages state the same numbers in every language', () => {
    const sql = readFileSync('supabase/migrations/20261111092551_hack_comments.sql', 'utf8');
    expect(sql).toContain(`char_length(body) between ${COMMENT_MIN} and ${COMMENT_MAX}`);
    for (const [code, messages] of Object.entries(MESSAGES)) {
      const errors = messages.tips.hacks.comments.errors;
      expect(errors.short, code).toContain(String(COMMENT_MIN));
      expect(errors.long, code).toContain(String(COMMENT_MAX));
    }
  });
});

describe('reading', () => {
  it('reads a row with its posting name, and leaves out one it can’t read', () => {
    expect(commentOf(ROW)).toEqual({
      id: 'c1',
      body: 'Good tip, thanks',
      lang: 'en',
      createdAt: '2026-11-11T10:00:00Z',
      author: { username: 'bea', label: 'student', batch: 2027 },
      mine: false,
    });
    expect(commentOf({ ...ROW, username: null, label: null, batch: null, mine: true })).toMatchObject({ author: null, mine: true });
    expect(commentOf({ ...ROW, created_at: 'yesterday' })).toBeNull();
    expect(commentOf({ ...ROW, id: 7 })).toBeNull();
    expect(commentOf('c1')).toBeNull();
  });

  it('loads a post’s comments, or null when it can’t', async () => {
    const { client, calls } = fakeSupabase({ data: [ROW, { broken: true }], error: null });
    expect((await readComments(client, 'h1'))?.map((comment) => comment.id)).toEqual(['c1']);
    expect(calls).toEqual([{ fn: 'comments_for', args: { p_hack_id: 'h1' } }]);
    expect(await readComments(fakeSupabase({ error: { code: '42501' } }).client, 'h1')).toBeNull();
  });

  it('loads the counts by post', async () => {
    const { client } = fakeSupabase({ data: [{ hack_id: 'h1', comments: 3 }, { hack_id: 'h2', comments: 'x' }], error: null });
    expect(await readCommentCounts(client)).toEqual(new Map([['h1', 3]]));
    expect(await readCommentCounts(fakeSupabase({ error: { code: '42501' } }).client)).toBeNull();
  });
});

describe('writing', () => {
  it('sends the comment in the phone’s language', async () => {
    const { client, calls } = fakeSupabase({ data: 'c1', error: null });
    expect(await postComment(client, 'h1', 'Good tip', 'de')).toBe('posted');
    expect(calls).toEqual([{ fn: 'post_comment', args: { p_hack_id: 'h1', p_body: 'Good tip', p_lang: 'de' } }]);
  });

  it('reads the database’s refusals by their hint or code', async () => {
    const post = (error: { code?: string; hint?: string }) => postComment(fakeSupabase({ error }).client, 'h1', 'Good tip', 'en');
    expect(await post({ code: 'P0001', hint: 'needs-username' })).toBe('needs-username');
    expect(await post({ code: 'P0001', hint: 'daily-limit' })).toBe('daily-limit');
    expect(await post({ code: 'P0001', hint: 'not-found' })).toBe('gone');
    expect(await post({ code: '23514' })).toBe('invalid');
    expect(await post({ code: '42501' })).toBe('failed');
  });

  it('deletes one’s own and reports others’, or says it could not', async () => {
    expect(await deleteComment(fakeSupabase({ error: null }).client, 'c1')).toBe('deleted');
    expect(await deleteComment(fakeSupabase({ error: { code: 'P0001', hint: 'not-found' } }).client, 'c1')).toBe('failed');
    expect(await reportComment(fakeSupabase({ error: null }).client, 'c1')).toBe('reported');
    expect(await reportComment(fakeSupabase({ error: { code: 'P0001', hint: 'not-found' } }).client, 'c1')).toBe('gone');
    expect(await reportComment(fakeSupabase({ error: { code: '42501' } }).client, 'c1')).toBe('failed');
  });
});
