import type { SupabaseClient } from '@supabase/supabase-js';
import { z } from 'zod';
import type { ServerRow, ServerTable } from './tables';

/** What saving to the account needs from its database. The app uses `supabaseStore`; tests use an in-memory fake. */
export type UserDataStore = {
  /** The ids of every row the signed-in user has in `table`. */
  listIds(table: ServerTable): Promise<string[]>;
  /** Adds the rows, or replaces the user's rows that have the same ids. */
  upsert(table: ServerTable, rows: ServerRow[]): Promise<void>;
  /** Deletes the user's rows with these ids. */
  remove(table: ServerTable, ids: string[]): Promise<void>;
};

/** A request the account's database refused or never answered. `status` is the HTTP status, 0 without an answer. */
export class StoreError extends Error {
  constructor(
    readonly table: ServerTable,
    readonly status: number,
    readonly code: string,
    message: string,
  ) {
    super(`${table}: ${message}`);
    this.name = 'StoreError';
  }
}

// Rows per request. Upserts stay well under the API's body limit; a page is the API's default maximum; a delete names
// its ids in the URL, so it stays short.
const UPSERT_BATCH = 500;
const PAGE = 1000;
const DELETE_BATCH = 100;

const idRows = z.array(z.object({ id: z.string() }));

function batches<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

/** What supabase-js gives back for a request, reduced to what a StoreError needs. */
type Answer = { error: { message: string; code: string } | null; status: number };

function check(table: ServerTable, { error, status }: Answer): void {
  if (error) throw new StoreError(table, status, error.code, error.message);
}

/**
 * The account's tables through supabase-js. Row-level security keeps every call to the signed-in user's own rows, and
 * `user_id` is filled in by the database, so no call names a user.
 */
export function supabaseStore(client: SupabaseClient): UserDataStore {
  return {
    async listIds(table) {
      const ids: string[] = [];
      for (let from = 0; ; from += PAGE) {
        const answer = await client
          .from(table)
          .select('id')
          .order('id')
          .range(from, from + PAGE - 1);
        check(table, answer);
        const page = idRows.parse(answer.data);
        ids.push(...page.map((row) => row.id));
        if (page.length < PAGE) return ids;
      }
    },
    async upsert(table, rows) {
      for (const batch of batches(rows, UPSERT_BATCH)) {
        check(table, await client.from(table).upsert(batch, { onConflict: 'user_id,id' }));
      }
    },
    async remove(table, ids) {
      for (const batch of batches(ids, DELETE_BATCH)) {
        check(table, await client.from(table).delete().in('id', batch));
      }
    },
  };
}
