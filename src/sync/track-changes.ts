import type { DBCore, DBCoreMutateRequest, DBCoreMutateResponse, DBCoreTable, Middleware } from 'dexie';
import type { OutboxEntry } from '@/db/types';
import { dexieSync, type DexieSync } from './tables';

// The two tables this middleware writes to besides the user's own write. Both are in db.version(4).
const OUTBOX = 'outbox';
const SYNC_STATE = 'syncState';

/** Transactions whose writes are never recorded: those that apply rows from the account (see `untracked`). */
const untrackedTransactions = new WeakSet<object>();

/** Marks a Dexie transaction (its `idbtrans`) as one whose writes are not recorded. */
export function markUntracked(transaction: object): void {
  untrackedTransactions.add(transaction);
}

// Rises with every recorded change, and with the clock across reloads, so a push can tell whether a row changed again
// while it was being sent.
let lastSeq = 0;
function nextSeq(): number {
  lastSeq = Math.max(lastSeq + 1, Date.now());
  return lastSeq;
}

/** The primary key of each operation of a write, in order. All synced tables have inbound keys (a key path). */
function keysOf(table: DBCoreTable, req: DBCoreMutateRequest): unknown[] {
  if (req.type === 'delete') return req.keys;
  if (req.type === 'deleteRange') return [];
  const extract = table.schema.primaryKey.extractKey;
  return req.keys ?? req.values.map((value: unknown) => (extract ? extract(value) : undefined));
}

/**
 * Writes the user's change, then, in the same transaction, records the server ids of the rows it changed in the
 * outbox: only while the phone is linked to an account (`syncState.userId`), and never for a transaction marked
 * untracked. A range delete (`clear`, only used by `replaceAll`) is not recorded: linking and restoring handle it.
 */
async function mutateAndRecord(
  down: DBCore,
  table: DBCoreTable,
  sync: DexieSync,
  req: DBCoreMutateRequest,
): Promise<DBCoreMutateResponse> {
  const res = await table.mutate(req);
  if (req.type === 'deleteRange' || untrackedTransactions.has(req.trans)) return res;

  // Only the operations that went through: a failed one changed nothing.
  const ids = keysOf(table, req)
    .filter((_, operation) => !(operation in res.failures))
    .map(sync.idOf)
    .filter((id): id is string => id !== null);
  if (ids.length === 0) return res;

  const state: unknown = await down.table(SYNC_STATE).get({ trans: req.trans, key: 'current' });
  const linked = typeof state === 'object' && state !== null && 'userId' in state && typeof state.userId === 'string';
  if (!linked) return res;

  const seq = nextSeq();
  const values: OutboxEntry[] = [...new Set(ids)].map((id) => ({ table: sync.server, id, seq }));
  await down.table(OUTBOX).mutate({ type: 'put', trans: req.trans, values });
  return res;
}

/**
 * The DBCore middleware behind live sync: every write to a synced table (see `dexieSync`) also records which rows
 * changed, in the same transaction, so a change and its outbox entry are saved together or not at all. Read-write
 * transactions over a synced table are widened to include the outbox and the sync state. Registered in db.ts.
 */
export const trackChanges: Middleware<DBCore> = {
  stack: 'dbcore',
  name: 'TrackChanges',
  create(down) {
    return {
      transaction(stores, mode, options) {
        const widen = mode === 'readwrite' && stores.some((name) => dexieSync(name) !== null);
        return down.transaction(widen ? [...new Set([...stores, OUTBOX, SYNC_STATE])] : stores, mode, options);
      },
      table(name) {
        const table = down.table(name);
        const sync = dexieSync(name);
        if (sync === null) return table;
        return { ...table, mutate: (req: DBCoreMutateRequest) => mutateAndRecord(down, table, sync, req) };
      },
    };
  },
};
