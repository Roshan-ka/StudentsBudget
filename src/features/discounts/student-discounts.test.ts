import type { SupabaseClient } from '@supabase/supabase-js';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  STUDENT_DISCOUNTS_CACHE_KEY,
  deleteStudentDiscount,
  forgetStudentDiscounts,
  readStudentDiscounts,
  reportStudentDiscount,
  studentDiscountOf,
} from './student-discounts';

/** A row as `community_discounts_feed` returns it. */
const row = (overrides: Record<string, unknown> = {}) => ({
  id: 'd1',
  place: 'Café Lena',
  address: 'Gesandtenstraße 1',
  offer: '10 % off with a student card',
  conditions: 'Weekdays only',
  category: 'eating-out',
  link: 'https://www.example.de/cafe',
  lang: 'de',
  created_at: '2026-11-11T09:30:00+00:00',
  username: 'lena',
  label: 'student',
  batch: 2027,
  mine: false,
  ...overrides,
});

/** A client whose every call answers `answer` (or throws it, when it is an Error). */
function clientAnswering(answer: { data?: unknown; error?: unknown } | Error) {
  const rpc = vi.fn(async () => {
    if (answer instanceof Error) throw answer;
    return { data: answer.data ?? null, error: answer.error ?? null };
  });
  return { client: { rpc } as unknown as SupabaseClient, rpc };
}

describe('a feed row', () => {
  it('becomes a discount, its link the source and its day added the checked day', () => {
    expect(studentDiscountOf(row())).toEqual({
      discount: {
        id: 'd1',
        place: 'Café Lena',
        address: 'Gesandtenstraße 1',
        offer: '10 % off with a student card',
        conditions: 'Weekdays only',
        categoryId: 'eating-out',
        source: '',
        url: 'https://www.example.de/cafe',
        checked: '2026-11-11',
      },
      info: { author: { username: 'lena', label: 'student', batch: 2027 }, mine: false, lang: 'de' },
    });
  });

  it('leaves the address and conditions empty when the student gave none', () => {
    const item = studentDiscountOf(row({ address: null, conditions: null }));
    expect(item?.discount.address).toBe('');
    expect(item?.discount.conditions).toBe('');
  });

  it('keeps an author without a name as none, and an unknown label as none', () => {
    expect(studentDiscountOf(row({ username: null }))?.info.author).toBeNull();
    expect(studentDiscountOf(row({ label: 'professor', batch: null }))?.info.author).toEqual({
      username: 'lena',
      label: null,
      batch: null,
    });
  });

  it('takes its pin, when the student set one inside Regensburg, with its link and day (discount map, chunk 8)', () => {
    expect(studentDiscountOf(row({ lat: 49.01936, lng: 12.08965 }))?.discount.location).toEqual({
      lat: 49.01936,
      lng: 12.08965,
      source: 'student',
      url: 'https://www.example.de/cafe',
      checked: '2026-11-11',
    });
    // No pin, half a pin, or one outside the box: the discount is in the list only.
    expect(studentDiscountOf(row())?.discount.location).toBeUndefined();
    expect(studentDiscountOf(row({ lat: null, lng: null }))?.discount.location).toBeUndefined();
    expect(studentDiscountOf(row({ lat: 49.01936, lng: null }))?.discount.location).toBeUndefined();
    expect(studentDiscountOf(row({ lat: 48.13743, lng: 11.57549 }))?.discount.location).toBeUndefined();
    expect(studentDiscountOf(row({ lat: '49.01936', lng: '12.08965' }))?.discount.location).toBeUndefined();
  });

  it('is left out without its words, a readable https link or a date', () => {
    expect(studentDiscountOf(null)).toBeNull();
    for (const field of ['id', 'place', 'offer', 'category', 'link', 'lang', 'created_at']) {
      expect(studentDiscountOf(row({ [field]: null }))).toBeNull();
      expect(studentDiscountOf(row({ [field]: ' ' }))).toBeNull();
    }
    expect(studentDiscountOf(row({ link: 'http://www.example.de/cafe' }))).toBeNull();
    expect(studentDiscountOf(row({ link: 'https://[broken' }))).toBeNull();
    expect(studentDiscountOf(row({ created_at: 'yesterday' }))).toBeNull();
  });
});

describe('the list', () => {
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
    vi.stubGlobal('navigator', { onLine: true });
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('is loaded, leaves out rows it can not read, and is kept for the account', async () => {
    const { client, rpc } = clientAnswering({ data: [row(), row({ id: 'd2', link: null })] });
    const items = await readStudentDiscounts(client, 'user-a');
    expect(rpc).toHaveBeenCalledWith('community_discounts_feed');
    expect(items?.map((item) => item.discount.id)).toEqual(['d1']);
    expect(JSON.parse(stored[STUDENT_DISCOUNTS_CACHE_KEY])).toEqual({ userId: 'user-a', rows: [row(), row({ id: 'd2', link: null })] });
  });

  it('falls back on the list kept for the same account, never another', async () => {
    await readStudentDiscounts(clientAnswering({ data: [row()] }).client, 'user-a');
    const failing = clientAnswering({ error: { message: 'refused' } }).client;
    expect((await readStudentDiscounts(failing, 'user-a'))?.map((item) => item.discount.id)).toEqual(['d1']);
    expect(await readStudentDiscounts(failing, 'user-b')).toBeNull();
    expect((await readStudentDiscounts(clientAnswering(new Error('offline')).client, 'user-a'))?.length).toBe(1);
  });

  it('reads the kept list offline, or without a client, without asking', async () => {
    await readStudentDiscounts(clientAnswering({ data: [row()] }).client, 'user-a');
    vi.stubGlobal('navigator', { onLine: false });
    const { client, rpc } = clientAnswering({ data: [] });
    expect((await readStudentDiscounts(client, 'user-a'))?.length).toBe(1);
    expect(rpc).not.toHaveBeenCalled();
    expect((await readStudentDiscounts(null, 'user-a'))?.length).toBe(1);
  });

  it('is gone once forgotten, and a damaged one reads as none', async () => {
    const failing = clientAnswering({ error: { message: 'refused' } }).client;
    await readStudentDiscounts(clientAnswering({ data: [row()] }).client, 'user-a');
    forgetStudentDiscounts();
    expect(await readStudentDiscounts(failing, 'user-a')).toBeNull();
    stored[STUDENT_DISCOUNTS_CACHE_KEY] = '{not json';
    expect(await readStudentDiscounts(failing, 'user-a')).toBeNull();
  });
});

describe('deleting and reporting', () => {
  beforeEach(() => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('deletes by the id, and says when it failed', async () => {
    const { client, rpc } = clientAnswering({});
    expect(await deleteStudentDiscount(client, 'd1')).toBe('deleted');
    expect(rpc).toHaveBeenCalledWith('delete_discount', { p_id: 'd1' });
    expect(await deleteStudentDiscount(clientAnswering({ error: { hint: 'not-found' } }).client, 'd1')).toBe('failed');
    expect(await deleteStudentDiscount(clientAnswering(new Error('offline')).client, 'd1')).toBe('failed');
  });

  it('reports by the id; a discount that is gone says so', async () => {
    const { client, rpc } = clientAnswering({});
    expect(await reportStudentDiscount(client, 'd1')).toBe('reported');
    expect(rpc).toHaveBeenCalledWith('report_discount', { p_id: 'd1' });
    expect(await reportStudentDiscount(clientAnswering({ error: { hint: 'not-found' } }).client, 'd1')).toBe('gone');
    expect(await reportStudentDiscount(clientAnswering({ error: { hint: 'own-post' } }).client, 'd1')).toBe('failed');
    expect(await reportStudentDiscount(clientAnswering(new Error('offline')).client, 'd1')).toBe('failed');
  });
});
