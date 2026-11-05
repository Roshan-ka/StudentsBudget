import type { SupabaseClient } from '@supabase/supabase-js';
import type { HackPost, HackVerdict } from './feed';

// Voting on and reporting a hack (docs/superpowers/plans/2026-11-05-hacks-feed.md, chunk 6), through the database's
// `vote_hack` and `report_hack` (migration 20261105110007_hacks.sql). A vote is an upvote plus "worked for me" or
// "outdated" (one of the two at most), sent whole each time; never on one's own post.

/** A button under a post. */
export type VoteButton = 'up' | HackVerdict;

/** The account's whole vote on a post. */
export type Vote = { up: boolean; verdict: HackVerdict | null };

/** The vote after tapping a button: the upvote and each verdict toggle; a verdict replaces the other. */
export function nextVote(post: HackPost, tapped: VoteButton): Vote {
  if (tapped === 'up') return { up: !post.myUp, verdict: post.myVerdict };
  return { up: post.myUp, verdict: post.myVerdict === tapped ? null : tapped };
}

/** The post as it is once the vote is saved: the totals moved by the change, and the account's own vote. */
export function withVote(post: HackPost, vote: Vote): HackPost {
  const step = (was: boolean, is: boolean) => (is === was ? 0 : is ? 1 : -1);
  return {
    ...post,
    ups: Math.max(0, post.ups + step(post.myUp, vote.up)),
    worked: Math.max(0, post.worked + step(post.myVerdict === 'worked', vote.verdict === 'worked')),
    outdated: Math.max(0, post.outdated + step(post.myVerdict === 'outdated', vote.verdict === 'outdated')),
    myUp: vote.up,
    myVerdict: vote.verdict,
  };
}

/** 'gone' when the post was deleted or hidden meanwhile (hint 'not-found'). */
export async function voteHack(supabase: SupabaseClient, id: string, vote: Vote): Promise<'saved' | 'gone' | 'failed'> {
  try {
    const { error } = await supabase.rpc('vote_hack', { p_id: id, p_up: vote.up, p_verdict: vote.verdict });
    if (!error) return 'saved';
    if (error.hint === 'not-found') return 'gone';
    console.error('StudentsBudget: could not save the vote', error);
    return 'failed';
  } catch (thrown) {
    console.error('StudentsBudget: could not save the vote', thrown);
    return 'failed';
  }
}

/** Reports a post: it is hidden for this account at once. 'gone' when it was deleted meanwhile. */
export async function reportHack(supabase: SupabaseClient, id: string): Promise<'reported' | 'gone' | 'failed'> {
  try {
    const { error } = await supabase.rpc('report_hack', { p_id: id });
    if (!error) return 'reported';
    if (error.hint === 'not-found') return 'gone';
    console.error('StudentsBudget: could not report the post', error);
    return 'failed';
  } catch (thrown) {
    console.error('StudentsBudget: could not report the post', thrown);
    return 'failed';
  }
}
