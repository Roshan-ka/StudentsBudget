import { readFileSync } from 'node:fs';
import type { SupabaseClient } from '@supabase/supabase-js';
import { describe, expect, it } from 'vitest';
import { CATEGORIES } from '@/data/categories';
import { MESSAGES } from '@/i18n/messages';
import { BODY_MAX, BODY_MIN, checkHack, deleteHack, EMPTY_HACK, HACK_CATEGORIES, LINK_MAX, postHack } from './posts';

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

describe('a new post', () => {
  it('is trimmed, with an empty link left out', () => {
    expect(checkHack({ ...EMPTY_HACK, body: '  Bread is half price after 6 pm  ', link: ' ' })).toEqual({
      ok: true,
      hack: { body: 'Bread is half price after 6 pm', categoryId: 'food', city: 'regensburg', link: null },
    });
  });

  it('says what is wrong, by the table’s rules', () => {
    expect(checkHack({ ...EMPTY_HACK, body: 'Too short' })).toEqual({ ok: false, problem: 'short' });
    expect(checkHack({ ...EMPTY_HACK, body: 'x'.repeat(BODY_MAX + 1) })).toEqual({ ok: false, problem: 'long' });
    const body = 'Bread is half price after 6 pm';
    expect(checkHack({ ...EMPTY_HACK, body, link: 'http://www.example.de' })).toEqual({ ok: false, problem: 'link' });
    expect(checkHack({ ...EMPTY_HACK, body, link: 'https://www.example.de/a b' })).toEqual({ ok: false, problem: 'link' });
    expect(checkHack({ ...EMPTY_HACK, body, link: `https://${'x'.repeat(LINK_MAX)}` })).toEqual({ ok: false, problem: 'link' });
    expect(checkHack({ ...EMPTY_HACK, body, link: 'https://www.rvv.de/semesterticket' })).toMatchObject({ ok: true });
  });

  it('follows the table’s checks, and its messages state the same numbers', () => {
    const sql = readFileSync('supabase/migrations/20261105110007_hacks.sql', 'utf8');
    expect(sql).toContain(`char_length(body) between ${BODY_MIN} and ${BODY_MAX}`);
    expect(sql).toContain(`char_length(link) <= ${LINK_MAX}`);
    const errors = MESSAGES.en.tips.hacks.form.errors;
    expect(errors.short).toContain(String(BODY_MIN));
    expect(errors.long).toContain(String(BODY_MAX));
  });

  it('can be in app categories only', () => {
    const known = new Set(CATEGORIES.map((category) => category.id));
    expect(HACK_CATEGORIES.filter((id) => !known.has(id))).toEqual([]);
  });
});

describe('posting', () => {
  const hack = { body: 'Bread is half price after 6 pm', categoryId: 'food', city: 'regensburg' as const, link: null };

  it('sends the post in the phone’s language', async () => {
    const { client, calls } = fakeSupabase({ data: 'p1', error: null });
    expect(await postHack(client, hack, 'de')).toBe('posted');
    expect(calls).toEqual([
      {
        fn: 'post_hack',
        args: { p_body: hack.body, p_city: 'regensburg', p_category: 'food', p_link: null, p_lang: 'de' },
      },
    ]);
  });

  it('reads the database’s refusals by their hint or code', async () => {
    expect(await postHack(fakeSupabase({ error: { code: 'P0001', hint: 'needs-username' } }).client, hack, 'en')).toBe(
      'needs-username',
    );
    expect(await postHack(fakeSupabase({ error: { code: 'P0001', hint: 'daily-limit' } }).client, hack, 'en')).toBe(
      'daily-limit',
    );
    expect(await postHack(fakeSupabase({ error: { code: '23514' } }).client, hack, 'en')).toBe('invalid');
    expect(await postHack(fakeSupabase({ error: { code: '42501' } }).client, hack, 'en')).toBe('failed');
  });

  it('deletes one’s own post, or says it could not', async () => {
    expect(await deleteHack(fakeSupabase({ error: null }).client, 'p1')).toBe('deleted');
    expect(await deleteHack(fakeSupabase({ error: { code: 'P0001', hint: 'not-found' } }).client, 'p1')).toBe('failed');
  });
});
