import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  FEED_CACHE_KEY,
  forgetFeedCache,
  hackCategoryIds,
  linkHost,
  postOf,
  readFeedCache,
  saveFeedCache,
  translateUrl,
  type HackPost,
} from './feed';

/** A row as `hacks_feed` returns it. */
const row = (overrides: Record<string, unknown> = {}) => ({
  id: 'p1',
  body: 'Bread is half price after 6 pm',
  city: 'regensburg',
  category: 'food',
  link: 'https://www.example.de/bakery',
  lang: 'en',
  created_at: '2026-11-05T09:30:00+00:00',
  username: 'roshan',
  label: 'student',
  batch: 2027,
  mine: false,
  ups: 3,
  worked: 2,
  outdated: 1,
  my_up: true,
  my_verdict: 'worked',
  ...overrides,
});

describe('a feed row', () => {
  it('becomes a post, author and totals included', () => {
    expect(postOf(row())).toEqual({
      id: 'p1',
      body: 'Bread is half price after 6 pm',
      city: 'regensburg',
      categoryId: 'food',
      link: 'https://www.example.de/bakery',
      lang: 'en',
      createdAt: '2026-11-05T09:30:00+00:00',
      author: { username: 'roshan', label: 'student', batch: 2027 },
      mine: false,
      ups: 3,
      worked: 2,
      outdated: 1,
      myUp: true,
      myVerdict: 'worked',
    });
  });

  it('keeps what it can and leaves out what it cannot read', () => {
    expect(postOf(row({ label: 'teacher', batch: '2027', link: 'http://x.de', my_verdict: 'great', ups: null }))).toMatchObject({
      author: { username: 'roshan', label: null, batch: null },
      link: null,
      myVerdict: null,
      ups: 0,
    });
    expect(postOf(row({ username: null }))?.author).toBeNull();
    expect(postOf(row({ city: 'munich' }))).toBeNull();
    expect(postOf(row({ created_at: 'yesterday' }))).toBeNull();
    expect(postOf('a row')).toBeNull();
  });
});

describe('the feed’s chips', () => {
  it('list each category once, in the app’s order', () => {
    const posts = [row({ category: 'transport' }), row({ category: 'food' }), row({ category: 'transport' })].map(postOf) as HackPost[];
    expect(hackCategoryIds(posts)).toEqual(['food', 'transport']);
  });
});

describe('the kept list', () => {
  let stored: Record<string, string>;

  beforeEach(() => {
    stored = {};
    vi.stubGlobal('localStorage', {
      getItem: (key: string) => stored[key] ?? null,
      setItem: (key: string, value: string) => {
        stored[key] = value;
      },
      removeItem: (key: string) => {
        delete stored[key];
      },
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('comes back for the account that loaded it, and for no other', () => {
    const posts = [postOf(row()) as HackPost];
    saveFeedCache('user-a', posts, '2026-11-05T10:00:00.000Z');
    expect(readFeedCache('user-a')).toEqual({ posts, loadedAt: '2026-11-05T10:00:00.000Z' });
    expect(readFeedCache('user-b')).toBeNull();
  });

  it('is gone once forgotten, and a damaged one reads as none', () => {
    saveFeedCache('user-a', [postOf(row()) as HackPost], '2026-11-05T10:00:00.000Z');
    forgetFeedCache();
    expect(readFeedCache('user-a')).toBeNull();
    stored[FEED_CACHE_KEY] = '{not json';
    expect(readFeedCache('user-a')).toBeNull();
  });
});

describe('a post’s link', () => {
  it('reads as its site', () => {
    expect(linkHost('https://www.rvv.de/tickets/semester')).toBe('www.rvv.de');
  });
});

describe('the translate link', () => {
  it('opens Google Translate with the text, from any language into the phone’s', () => {
    const url = new URL(translateUrl('Das Semesterticket gilt am Wochenende & nachts?', 'en'));
    expect(url.origin).toBe('https://translate.google.com');
    expect(Object.fromEntries(url.searchParams)).toEqual({
      sl: 'auto',
      tl: 'en',
      text: 'Das Semesterticket gilt am Wochenende & nachts?',
      op: 'translate',
    });
  });
});
