import type { SupabaseClient } from '@supabase/supabase-js';
import { z } from 'zod';
import type { ServerRow, ServerTable } from './tables';

/** A row as it comes back from the account: its id, and data that still has to be checked. */
export type StoredRow = { id: string; data: unknown };

/** What saving to and loading from the account need from its database. The app uses `supabaseStore`; tests a fake. */
export type UserDataStore = {
  /** The ids of every row the signed-in user has in `table`, tombstones left out. */
  listIds(table: ServerTable): Promise<string[]>;
  /** Every row the signed-in user has in `table`, by id, tombstones left out. */
  listRows(table: ServerTable): Promise<StoredRow[]>;
  /** Adds the rows, or replaces the user's rows that have the same ids. */
  upsert(table: ServerTable, rows: ServerRow[]): Promise<void>;
  /**
   * Deletes the user's rows with these ids by writing tombstones: the row stays with no data, and the database marks it
   * deleted, so other phones learn of the delete. An id the account never had gets a tombstone too, which reads leave
   * out and a pull applies as a delete of nothing.
   */
  tombstone(table: ServerTable, ids: string[]): Promise<void>;
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

// Rows per request. Upserts stay well under the API's body limit; a page asks for the API's default maximum (a server
// set lower sends shorter pages, which reading copes with).
const UPSERT_BATCH = 500;
const PAGE = 1000;

const idRows = z.array(z.object({ id: z.string() }));
const fullRows = z.array(z.object({ id: z.string(), data: z.unknown() }));

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
  /**
   * Every row of `table` with the given columns, a page at a time in id order. Each page starts after the last id of
   * the one before, and only an empty page ends the read: a server that sends shorter pages than asked for, or a row
   * deleted in the meantime, never makes it skip rows.
   */
  async function readAll<T extends { id: string }>(
    table: ServerTable,
    columns: string,
    rows: z.ZodType<T[]>,
  ): Promise<T[]> {
    const all: T[] = [];
    let after: string | null = null;
    for (;;) {
      const query = client.from(table).select(columns).is('deleted_at', null);
      const answer = await (after === null ? query : query.gt('id', after)).order('id').limit(PAGE);
      check(table, answer);
      const page = rows.parse(answer.data);
      if (page.length === 0) return all;
      all.push(...page);
      after = page[page.length - 1].id;
    }
  }

  return {
    async listIds(table) {
      return (await readAll(table, 'id', idRows)).map((row) => row.id);
    },
    async listRows(table) {
      return readAll(table, 'id, data', fullRows);
    },
    async upsert(table, rows) {
      for (const batch of batches(rows, UPSERT_BATCH)) {
        check(table, await client.from(table).upsert(batch, { onConflict: 'user_id,id' }));
      }
    },
    async tombstone(table, ids) {
      // An upsert, not an update: every write then takes the user's revision counter before the row (see the sync
      // migration), so two phones of one user can't lock the two in opposite orders and deadlock.
      for (const batch of batches(ids, UPSERT_BATCH)) {
        const tombstones = batch.map((id) => ({ id, data: null }));
        check(table, await client.from(table).upsert(tombstones, { onConflict: 'user_id,id' }));
      }
    },
  };
}
