import type { SupabaseClient } from '@supabase/supabase-js';
import { describe, expect, it } from 'vitest';
import type { HackPost } from './feed';
import { nextVote, reportHack, voteHack, withVote } from './votes';

const post: HackPost = {
  id: 'p1',
  body: 'Bread is half price after 6 pm',
  city: 'regensburg',
  categoryId: 'food',
  link: null,
  lang: 'en',
  createdAt: '2026-11-05T12:00:00Z',
  author: { username: 'bea', label: null, batch: null },
  mine: false,
  ups: 3,
  worked: 2,
  outdated: 1,
  myUp: false,
  myVerdict: null,
};

function answering(error: { code?: string; hint?: string } | null) {
  const calls: { fn: string; args: unknown }[] = [];
  const client = {
    rpc: async (fn: string, args: unknown) => {
      calls.push({ fn, args });
      return { data: null, error };
    },
  } as unknown as SupabaseClient;
  return { client, calls };
}

describe('a tap on a vote button', () => {
  it('toggles the upvote, and toggles a verdict, one replacing the other', () => {
    expect(nextVote(post, 'up')).toEqual({ up: true, verdict: null });
    expect(nextVote({ ...post, myUp: true }, 'up')).toEqual({ up: false, verdict: null });
    expect(nextVote(post, 'worked')).toEqual({ up: false, verdict: 'worked' });
    expect(nextVote({ ...post, myVerdict: 'worked' }, 'worked')).toEqual({ up: false, verdict: null });
    expect(nextVote({ ...post, myUp: true, myVerdict: 'worked' }, 'outdated')).toEqual({ up: true, verdict: 'outdated' });
  });

  it('moves the totals by the change only', () => {
    const upvoted = withVote(post, { up: true, verdict: 'worked' });
    expect(upvoted).toMatchObject({ ups: 4, worked: 3, outdated: 1, myUp: true, myVerdict: 'worked' });
    expect(withVote(upvoted, { up: true, verdict: 'outdated' })).toMatchObject({ ups: 4, worked: 2, outdated: 2 });
    expect(withVote(upvoted, { up: false, verdict: null })).toMatchObject({ ups: 3, worked: 2, outdated: 1 });
  });
});

describe('saving', () => {
  it('sends the whole vote', async () => {
    const { client, calls } = answering(null);
    expect(await voteHack(client, 'p1', { up: true, verdict: 'outdated' })).toBe('saved');
    expect(calls).toEqual([{ fn: 'vote_hack', args: { p_id: 'p1', p_up: true, p_verdict: 'outdated' } }]);
  });

  it('says when the post is gone, and reports', async () => {
    expect(await voteHack(answering({ code: 'P0001', hint: 'not-found' }).client, 'p1', { up: true, verdict: null })).toBe('gone');
    expect(await voteHack(answering({ code: '42501' }).client, 'p1', { up: true, verdict: null })).toBe('failed');
    const { client, calls } = answering(null);
    expect(await reportHack(client, 'p1')).toBe('reported');
    expect(calls).toEqual([{ fn: 'report_hack', args: { p_id: 'p1' } }]);
    expect(await reportHack(answering({ code: 'P0001', hint: 'not-found' }).client, 'p1')).toBe('gone');
  });
});
