import type { SupabaseClient } from '@supabase/supabase-js';
import { orderOf } from '@/features/entries/categories';
import { LABELS, type PostingLabel, type PostingName } from './posting-name';

// The hacks feed (docs/superpowers/plans/2026-11-05-hacks-feed.md, chunk 4): the posts every signed-in account reads,
// from the database's `hacks_feed` (migration 20261105110007_hacks.sql), and the last list this phone loaded, kept for
// when it can't load one.

export type HackVerdict = 'worked' | 'outdated';

/** One post as the app shows it. The author is null only for a post whose author has no username. */
export type HackPost = {
  id: string;
  body: string;
  city: 'regensburg' | 'anywhere';
  categoryId: string;
  link: string | null;
  lang: string;
  createdAt: string;
  author: PostingName | null;
  mine: boolean;
  ups: number;
  worked: number;
  outdated: number;
  myUp: boolean;
  myVerdict: HackVerdict | null;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

const count = (value: unknown): number => (typeof value === 'number' && Number.isFinite(value) ? value : 0);

/** One row of `hacks_feed` as a post, or null for a row this build can't read (it is left out, not an error). */
export function postOf(row: unknown): HackPost | null {
  if (!isRecord(row)) return null;
  const { id, body, city, category, link, lang, created_at: createdAt } = row;
  if (typeof id !== 'string' || typeof body !== 'string' || typeof category !== 'string') return null;
  if (city !== 'regensburg' && city !== 'anywhere') return null;
  if (typeof lang !== 'string' || typeof createdAt !== 'string' || Number.isNaN(Date.parse(createdAt))) return null;
  const label = LABELS.find((known): known is PostingLabel => known === row.label) ?? null;
  return {
    id,
    body,
    city,
    categoryId: category,
    link: typeof link === 'string' && link.startsWith('https://') ? link : null,
    lang,
    createdAt,
    author:
      typeof row.username === 'string'
        ? { username: row.username, label, batch: typeof row.batch === 'number' ? row.batch : null }
        : null,
    mine: row.mine === true,
    ups: count(row.ups),
    worked: count(row.worked),
    outdated: count(row.outdated),
    myUp: row.my_up === true,
    myVerdict: row.my_verdict === 'worked' || row.my_verdict === 'outdated' ? row.my_verdict : null,
  };
}

/** The posts the signed-in account may see, newest first; null when they couldn't be loaded. */
export async function readFeed(supabase: SupabaseClient): Promise<HackPost[] | null> {
  try {
    const { data, error } = await supabase.rpc('hacks_feed');
    if (error || !Array.isArray(data)) {
      console.error('StudentsBudget: could not load the hacks feed', error);
      return null;
    }
    return data.map(postOf).filter((post): post is HackPost => post !== null);
  } catch (thrown) {
    console.error('StudentsBudget: could not load the hacks feed', thrown);
    return null;
  }
}

/** The categories the posts are in, in the app's category order: the feed's filter chips. */
export function hackCategoryIds(posts: readonly HackPost[]): string[] {
  return [...new Set(posts.map((post) => post.categoryId))].sort((a, b) => orderOf(a) - orderOf(b));
}

/** Where this phone keeps the last list it loaded, with whose it is and when (localStorage). */
export const FEED_CACHE_KEY = 'studentsbudget-hacks-feed';

type FeedCache = { userId: string; loadedAt: string; posts: HackPost[] };

/** Keeps the list just loaded. Storage that refuses it only means no list to fall back on. */
export function saveFeedCache(userId: string, posts: HackPost[], loadedAt: string): void {
  try {
    localStorage.setItem(FEED_CACHE_KEY, JSON.stringify({ userId, loadedAt, posts } satisfies FeedCache));
  } catch {
    // Nothing to do.
  }
}

/** The last list `userId` loaded on this phone, or null: another account's list is never shown. */
export function readFeedCache(userId: string): { posts: HackPost[]; loadedAt: string } | null {
  try {
    const stored: unknown = JSON.parse(localStorage.getItem(FEED_CACHE_KEY) ?? 'null');
    if (!isRecord(stored) || stored.userId !== userId || typeof stored.loadedAt !== 'string') return null;
    if (!Array.isArray(stored.posts)) return null;
    const posts = stored.posts.map(cachedPostOf).filter((post): post is HackPost => post !== null);
    return { posts, loadedAt: stored.loadedAt };
  } catch {
    return null;
  }
}

/** Forgets the kept list: on sign-out, so the next person on this phone never sees it. */
export function forgetFeedCache(): void {
  try {
    localStorage.removeItem(FEED_CACHE_KEY);
  } catch {
    // Nothing to do.
  }
}

/** A post as the cache keeps it (the app's own shape), read back with the same care as a row. */
function cachedPostOf(value: unknown): HackPost | null {
  if (!isRecord(value)) return null;
  const author = isRecord(value.author) ? value.author : null;
  return postOf({
    id: value.id,
    body: value.body,
    city: value.city,
    category: value.categoryId,
    link: value.link,
    lang: value.lang,
    created_at: value.createdAt,
    username: author?.username,
    label: author?.label,
    batch: author?.batch,
    mine: value.mine,
    ups: value.ups,
    worked: value.worked,
    outdated: value.outdated,
    my_up: value.myUp,
    my_verdict: value.myVerdict,
  });
}

/** The site a post's link goes to, for its text ("www.rvv.de"); the link itself when it can't be read. */
export function linkHost(link: string): string {
  try {
    return new URL(link).hostname;
  } catch {
    return link;
  }
}

/**
 * Google Translate's page for a post's text, into the phone's language (chunk 8): the standard way out to a
 * translation. The text goes in the address, so the first use on a phone waits for its data-protection note.
 */
export function translateUrl(body: string, into: string): string {
  const query = new URLSearchParams({ sl: 'auto', tl: into, text: body, op: 'translate' });
  return `https://translate.google.com/?${query.toString()}`;
}
