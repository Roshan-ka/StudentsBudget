import type { SupabaseClient } from '@supabase/supabase-js';
import { describe, expect, it } from 'vitest';
import {
  amIModerator,
  commentQueueItemOf,
  discountQueueItemOf,
  moderate,
  moderateComment,
  moderateDiscount,
  queueItemOf,
  readCommentQueue,
  readDiscountQueue,
  readQueue,
} from './moderation';

function answering(data: unknown, error: { code?: string; message?: string } | null) {
  const calls: { fn: string; args: unknown }[] = [];
  const client = {
    rpc: async (fn: string, args?: unknown) => {
      calls.push({ fn, args });
      return { data, error };
    },
  } as unknown as SupabaseClient;
  return { client, calls };
}

const row = {
  id: 'p1',
  body: 'An advert for a phone shop.',
  city: 'regensburg',
  category: 'shopping',
  link: null,
  lang: 'en',
  created_at: '2026-11-05T12:00:00Z',
  username: 'bea',
  reports: 6,
  reports_since_kept: 5,
  hidden_by_hand: false,
  hidden_by_reports: true,
  kept_at: null,
  last_report: '2026-11-05T13:00:00Z',
};

describe('the moderation queue', () => {
  it('reads each row, counting the reports since the post was last kept', () => {
    expect(queueItemOf(row)).toEqual({
      id: 'p1',
      body: 'An advert for a phone shop.',
      city: 'regensburg',
      categoryId: 'shopping',
      lang: 'en',
      createdAt: '2026-11-05T12:00:00Z',
      username: 'bea',
      reports: 5,
      hiddenByHand: false,
      hiddenByReports: true,
    });
    expect(queueItemOf({ ...row, city: 'munich' })).toBeNull();
  });

  it('says why it shows nothing: the code owed, or not a moderator', async () => {
    expect(await readQueue(answering([row], null).client)).toHaveLength(1);
    expect(await readQueue(answering(null, { code: '42501', message: 'the second step is owed' }).client)).toBe('needs-code');
    expect(await readQueue(answering(null, { code: '42501', message: 'not a moderator' }).client)).toBe('not-moderator');
    expect(await readQueue(answering(null, { code: 'XX000', message: 'down' }).client)).toBe('failed');
  });
});

describe('moderating', () => {
  it('asks whether the account moderates', async () => {
    expect(await amIModerator(answering(true, null).client)).toBe(true);
    expect(await amIModerator(answering(null, { code: 'XX000' }).client)).toBeNull();
  });

  it('hides or keeps a post', async () => {
    const { client, calls } = answering(null, null);
    expect(await moderate(client, 'p1', 'keep')).toBe('done');
    expect(calls).toEqual([{ fn: 'moderate_hack', args: { p_id: 'p1', p_action: 'keep' } }]);
    expect(await moderate(answering(null, { code: '42501', message: 'the second step is owed' }).client, 'p1', 'hide')).toBe(
      'needs-code',
    );
  });
});

describe('the reported comments (community, chunk 3)', () => {
  const comment = {
    id: 'c1',
    hack_id: 'p2',
    body: 'Buy followers cheap!',
    lang: 'en',
    created_at: '2026-11-11T12:00:00Z',
    username: 'spam_bot',
    reports: 5,
    reports_since_kept: 5,
    hidden_by_hand: false,
    hidden_by_reports: true,
    kept_at: null,
    last_report: '2026-11-11T13:00:00Z',
  };

  it('reads each row, with the post it is on', () => {
    expect(commentQueueItemOf(comment)).toEqual({
      id: 'c1',
      hackId: 'p2',
      body: 'Buy followers cheap!',
      lang: 'en',
      createdAt: '2026-11-11T12:00:00Z',
      username: 'spam_bot',
      reports: 5,
      hiddenByHand: false,
      hiddenByReports: true,
    });
    expect(commentQueueItemOf({ ...comment, hack_id: null })).toBeNull();
  });

  it('says why it shows nothing, as the post queue does', async () => {
    expect(await readCommentQueue(answering([comment], null).client)).toHaveLength(1);
    expect(await readCommentQueue(answering(null, { code: '42501', message: 'the second step is owed' }).client)).toBe(
      'needs-code',
    );
    expect(await readCommentQueue(answering(null, { code: '42501', message: 'not a moderator' }).client)).toBe(
      'not-moderator',
    );
    expect(await readCommentQueue(answering(null, { code: 'XX000', message: 'down' }).client)).toBe('failed');
  });

  it('hides or keeps a comment', async () => {
    const { client, calls } = answering(null, null);
    expect(await moderateComment(client, 'c1', 'hide')).toBe('done');
    expect(calls).toEqual([{ fn: 'moderate_comment', args: { p_id: 'c1', p_action: 'hide' } }]);
    expect(await moderateComment(answering(null, { code: 'XX000' }).client, 'c1', 'keep')).toBe('failed');
  });
});

describe('the reported discounts (community, chunk 7)', () => {
  const discount = {
    id: 'd1',
    place: 'Phone Shop Deluxe',
    offer: '50 % off everything, today only!',
    conditions: null,
    link: 'https://www.example.de/deals',
    lang: 'en',
    created_at: '2026-11-11T12:00:00Z',
    username: 'spam_shop',
    reports: 5,
    reports_since_kept: 5,
    hidden_by_hand: false,
    hidden_by_reports: true,
    kept_at: null,
    last_report: '2026-11-11T13:00:00Z',
  };

  it('reads each row, without conditions as none', () => {
    expect(discountQueueItemOf(discount)).toEqual({
      id: 'd1',
      place: 'Phone Shop Deluxe',
      offer: '50 % off everything, today only!',
      conditions: '',
      link: 'https://www.example.de/deals',
      lang: 'en',
      createdAt: '2026-11-11T12:00:00Z',
      username: 'spam_shop',
      reports: 5,
      hiddenByHand: false,
      hiddenByReports: true,
    });
    expect(discountQueueItemOf({ ...discount, conditions: 'Weekdays' })?.conditions).toBe('Weekdays');
    expect(discountQueueItemOf({ ...discount, link: null })).toBeNull();
  });

  it('says why it shows nothing, as the post queue does', async () => {
    const { client, calls } = answering([discount], null);
    expect(await readDiscountQueue(client)).toHaveLength(1);
    expect(calls).toEqual([{ fn: 'discount_queue', args: undefined }]);
    expect(await readDiscountQueue(answering(null, { code: '42501', message: 'the second step is owed' }).client)).toBe(
      'needs-code',
    );
    expect(await readDiscountQueue(answering(null, { code: '42501', message: 'not a moderator' }).client)).toBe(
      'not-moderator',
    );
    expect(await readDiscountQueue(answering(null, { code: 'XX000', message: 'down' }).client)).toBe('failed');
  });

  it('hides or keeps a discount', async () => {
    const { client, calls } = answering(null, null);
    expect(await moderateDiscount(client, 'd1', 'keep')).toBe('done');
    expect(calls).toEqual([{ fn: 'moderate_discount', args: { p_id: 'd1', p_action: 'keep' } }]);
    expect(
      await moderateDiscount(answering(null, { code: '42501', message: 'the second step is owed' }).client, 'd1', 'hide'),
    ).toBe('needs-code');
    expect(await moderateDiscount(answering(null, { code: 'XX000' }).client, 'd1', 'hide')).toBe('failed');
  });
});
