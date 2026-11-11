import type { SupabaseClient } from '@supabase/supabase-js';
import type { Discount } from '@/data/discounts';
import { LABELS, type PostingLabel, type PostingName } from '@/features/hacks/posting-name';
import { todayIso } from '@/lib/dates';

// Discounts students added from the app (docs/superpowers/plans/2026-11-11-community.md, chunk 5): read from the
// database's `community_discounts_feed` (migration 20261111101604_community_discounts.sql), shown in the Discounts list
// beside the app's own, always marked as added by a student. Each becomes a `Discount`, so it sorts, filters and takes
// votes like the others; what only a student's discount has (who added it, whether it is this account's, the language
// it was written in) comes beside it.

/** What a student's discount has beyond a `Discount`. */
export type StudentInfo = { author: PostingName | null; mine: boolean; lang: string };

export type StudentDiscount = { discount: Discount; info: StudentInfo };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

const text = (value: unknown): string | null => (typeof value === 'string' && value.trim() !== '' ? value : null);

/** An https address the browser can read; the source line shows its host. */
function isHttpsUrl(value: string): boolean {
  try {
    return new URL(value).protocol === 'https:';
  } catch {
    return false;
  }
}

/**
 * One feed row as a discount, or null for a row this build can't read (left out, not an error). Its source is filled in
 * by the list, in the phone's language ("Added by @lena"); its link is the page the student gave, and its checked day
 * the day it was added.
 */
export function studentDiscountOf(row: unknown): StudentDiscount | null {
  if (!isRecord(row)) return null;
  const id = text(row.id);
  const place = text(row.place);
  const offer = text(row.offer);
  const categoryId = text(row.category);
  const link = text(row.link);
  const lang = text(row.lang);
  const createdAt = text(row.created_at);
  if (id === null || place === null || offer === null || categoryId === null || lang === null || createdAt === null) {
    return null;
  }
  if (link === null || !isHttpsUrl(link) || Number.isNaN(Date.parse(createdAt))) return null;
  const label = LABELS.find((known): known is PostingLabel => known === row.label) ?? null;
  return {
    discount: {
      id,
      place,
      address: text(row.address) ?? '',
      offer,
      conditions: text(row.conditions) ?? '',
      categoryId,
      source: '',
      url: link,
      checked: todayIso(new Date(createdAt)),
    },
    info: {
      author:
        typeof row.username === 'string'
          ? { username: row.username, label, batch: typeof row.batch === 'number' ? row.batch : null }
          : null,
      mine: row.mine === true,
      lang,
    },
  };
}

/** The students' discounts the signed-in account may see, newest first, as rows; null when they couldn't be loaded. */
async function readRows(supabase: SupabaseClient): Promise<unknown[] | null> {
  try {
    const { data, error } = await supabase.rpc('community_discounts_feed');
    if (error || !Array.isArray(data)) {
      console.error('StudentsBudget: could not load the students’ discounts', error);
      return null;
    }
    return data;
  } catch (thrown) {
    console.error('StudentsBudget: could not load the students’ discounts', thrown);
    return null;
  }
}

const discountsOf = (rows: readonly unknown[]): StudentDiscount[] =>
  rows.map(studentDiscountOf).filter((item): item is StudentDiscount => item !== null);

/** Where this phone keeps the last list it loaded, with whose it is (localStorage): the server's rows as they came. */
export const STUDENT_DISCOUNTS_CACHE_KEY = 'studentsbudget-student-discounts';

/**
 * The students' discounts for `userId`: loaded now and kept, or, when they can't be loaded, the list this phone last
 * kept for that account (another account's is never shown). Null when there is neither.
 */
export async function readStudentDiscounts(
  supabase: SupabaseClient | null,
  userId: string,
): Promise<StudentDiscount[] | null> {
  const rows = supabase !== null && navigator.onLine ? await readRows(supabase) : null;
  if (rows !== null) {
    try {
      localStorage.setItem(STUDENT_DISCOUNTS_CACHE_KEY, JSON.stringify({ userId, rows }));
    } catch {
      // Storage that refuses it only means no list to fall back on.
    }
    return discountsOf(rows);
  }
  try {
    const stored: unknown = JSON.parse(localStorage.getItem(STUDENT_DISCOUNTS_CACHE_KEY) ?? 'null');
    if (!isRecord(stored) || stored.userId !== userId || !Array.isArray(stored.rows)) return null;
    return discountsOf(stored.rows);
  } catch {
    return null;
  }
}

/** Forgets the kept list: on sign-out, so the next person on this phone never sees it. */
export function forgetStudentDiscounts(): void {
  try {
    localStorage.removeItem(STUDENT_DISCOUNTS_CACHE_KEY);
  } catch {
    // Nothing to do.
  }
}

/** Deletes one of the signed-in account's own discounts. */
export async function deleteStudentDiscount(supabase: SupabaseClient, id: string): Promise<'deleted' | 'failed'> {
  try {
    const { error } = await supabase.rpc('delete_discount', { p_id: id });
    if (!error) return 'deleted';
    console.error('StudentsBudget: could not delete the discount', error);
    return 'failed';
  } catch (thrown) {
    console.error('StudentsBudget: could not delete the discount', thrown);
    return 'failed';
  }
}

/** Reports someone else's discount: it leaves this account's list at once. */
export async function reportStudentDiscount(
  supabase: SupabaseClient,
  id: string,
): Promise<'reported' | 'gone' | 'failed'> {
  try {
    const { error } = await supabase.rpc('report_discount', { p_id: id });
    if (!error) return 'reported';
    if (error.hint === 'not-found') return 'gone';
    console.error('StudentsBudget: could not report the discount', error);
    return 'failed';
  } catch (thrown) {
    console.error('StudentsBudget: could not report the discount', thrown);
    return 'failed';
  }
}
