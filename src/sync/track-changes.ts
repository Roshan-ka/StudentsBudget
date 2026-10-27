import type {
  DBCore,
  DBCoreDeleteRangeRequest,
  DBCoreMutateRequest,
  DBCoreMutateResponse,
  DBCoreTable,
  DBCoreTransaction,
  Middleware,
} from 'dexie';
import type { OutboxEntry } from '@/db/types';
import { dexieSync, type DexieSync, type ServerTable } from './tables';

// The two tables this middleware reads and writes besides the user's own write. Both are in db.version(4).
const OUTBOX = 'outbox';
const SYNC_STATE = 'syncState';

/** Transactions whose writes are never recorded: those that apply rows from the account (see `untracked`). */
const untrackedTransactions = new WeakSet<object>();

/** Marks a Dexie transaction (its `idbtrans`) as one whose writes are not recorded. */
export function markUntracked(transaction: object): void {
  untrackedTransactions.add(transaction);
}

// Rises with every recorded change in this tab. Across tabs and reloads, `record` also keeps it above the seq a row
// already has, so a push can tell whether a row changed again while it was being sent.
let lastSeq = 0;

/** Whether this phone is linked to an account, read in the write's own transaction. */
async function isLinked(down: DBCore, trans: DBCoreTransaction): Promise<boolean> {
  const state: unknown = await down.table(SYNC_STATE).get({ trans, key: 'current' });
  return typeof state === 'object' && state !== null && 'userId' in state && typeof state.userId === 'string';
}

/** The primary keys of the rows a range delete is about to remove. */
async function keysInRange(table: DBCoreTable, req: DBCoreDeleteRangeRequest): Promise<unknown[]> {
  const { result } = await table.query({
    trans: req.trans,
    values: false,
    query: { index: table.schema.primaryKey, range: req.range },
  });
  return result;
}

/** The primary key of each operation of a write, in order. All synced tables have inbound keys (a key path). */
function keysOf(table: DBCoreTable, req: Exclude<DBCoreMutateRequest, DBCoreDeleteRangeRequest>): unknown[] {
  if (req.type === 'delete') return req.keys;
  const extract = table.schema.primaryKey.extractKey;
  return req.keys ?? req.values.map((value: unknown) => (extract ? extract(value) : undefined));
}

/**
 * Puts one outbox entry per id, all with one seq: above this tab's last one, and above the seq each row already has
 * (another tab, or a clock that went back, may have set a higher one). A refused outbox write fails the whole write.
 */
async function record(down: DBCore, trans: DBCoreTransaction, table: ServerTable, ids: string[]): Promise<void> {
  const existing: unknown[] = await down.table(OUTBOX).getMany({ trans, keys: ids.map((id) => [table, id]) });
  let seq = Math.max(lastSeq + 1, Date.now());
  for (const entry of existing) {
    if (typeof entry === 'object' && entry !== null && 'seq' in entry && typeof entry.seq === 'number') {
      seq = Math.max(seq, entry.seq + 1);
    }
  }
  lastSeq = seq;
  const values: OutboxEntry[] = ids.map((id) => ({ table, id, seq }));
  const res = await down.table(OUTBOX).mutate({ type: 'put', trans, values });
  if (res.numFailures > 0) throw Object.values(res.failures)[0];
}

/**
 * Writes the user's change and, in the same transaction, records the server ids of the rows it changed in the outbox:
 * only while the phone is linked to an account (`syncState.userId`), and never in a transaction marked untracked. A
 * range delete (`clear()`, a collection's `delete()`) names no keys, so the keys in its range are read first.
 */
async function mutateAndRecord(
  down: DBCore,
  table: DBCoreTable,
  sync: DexieSync,
  req: DBCoreMutateRequest,
): Promise<DBCoreMutateResponse> {
  if (untrackedTransactions.has(req.trans) || !(await isLinked(down, req.trans))) return table.mutate(req);

  if (req.type === 'deleteRange') {
    const rangeKeys = await keysInRange(table, req);
    const res = await table.mutate(req);
    if (res.numFailures === 0) await recordKeys(down, req.trans, sync, rangeKeys);
    return res;
  }
  const res = await table.mutate(req);
  // Only the operations that went through: a failed one changed nothing.
  await recordKeys(
    down,
    req.trans,
    sync,
    keysOf(table, req).filter((_, operation) => !(operation in res.failures)),
  );
  return res;
}

/** Records the rows with these Dexie keys, as their server ids; keys that don't sync (ECB rates) are left out. */
async function recordKeys(down: DBCore, trans: DBCoreTransaction, sync: DexieSync, keys: unknown[]): Promise<void> {
  const ids = [...new Set(keys.map(sync.idOf).filter((id): id is string => id !== null))];
  if (ids.length > 0) await record(down, trans, sync.server, ids);
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
