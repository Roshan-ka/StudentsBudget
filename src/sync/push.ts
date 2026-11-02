import { db } from '@/db/db';
import type { OutboxEntry } from '@/db/types';
import { applyFromAccount, checkRow, type Checked } from './pull';
import { BadRow } from './rows';
import type { PulledRow, UserDataStore } from './store';
import { dexieHome, SERVER_TABLES, type ServerRow, type ServerTable } from './tables';

/** What a push sent: rows written to the account, and rows it now holds as deleted. */
export type PushResult = { sent: number; deleted: number };

/**
 * Sends this phone's changes to the account (P2.2): every row in the outbox as it is now, table by table in
 * SERVER_TABLES order. A row still on the phone goes as an upsert, the whole row (a plan edit sends the whole plan); a
 * row gone from the phone goes as a tombstone. A row only the poster changed (`auto`) is added only where the account
 * has none; where it has one, the account's copy comes back instead. Once a table is written, its outbox entries go, except those whose row
 * changed again meanwhile (their seq moved on): that change stays queued for the next push. A refused write throws,
 * and leaves the outbox as it was for that table and every table after it.
 */
export async function push(store: UserDataStore): Promise<PushResult> {
  const queue = await db.outbox.toArray();
  const result: PushResult = { sent: 0, deleted: 0 };
  for (const table of SERVER_TABLES) {
    const queued = queue.filter((entry) => entry.table === table);
    if (queued.length === 0) continue;
    const home = dexieHome(table);
    const rows: unknown[] = await db.table(home.dexie).bulkGet(queued.map((entry) => home.keyOf(entry.id)));
    const upserts: ServerRow[] = [];
    const automatic: ServerRow[] = [];
    const gone: string[] = [];
    queued.forEach((entry, i) => {
      const row = rows[i];
      if (typeof row !== 'object' || row === null) gone.push(entry.id);
      else if (entry.auto) automatic.push({ id: entry.id, data: row });
      else upserts.push({ id: entry.id, data: row });
    });
    if (upserts.length > 0) await store.upsert(table, upserts);
    const accountCopies = automatic.length > 0 ? await store.insertNew(table, automatic) : [];
    if (gone.length > 0) await store.tombstone(table, gone);
    await settle(queued);
    await takeAccountCopies(accountCopies);
    result.sent += upserts.length + automatic.length - accountCopies.length;
    result.deleted += gone.length;
  }
  return result;
}

/**
 * The poster wrote these rows from what this phone knew, but the account already had them, changed or deleted on
 * another phone: its copy wins, on this phone too. Taken after the outbox is settled, so a row the person changed
 * meanwhile stays theirs. A copy this app can't read is left for the pull to report.
 */
async function takeAccountCopies(copies: PulledRow[]): Promise<void> {
  const checked: Checked[] = [];
  for (const copy of copies) {
    try {
      checked.push(checkRow(copy));
    } catch (error) {
      if (!(error instanceof BadRow)) throw error;
      console.error('StudentsBudget: the account holds a row this app cannot read:', error.message);
    }
  }
  if (checked.length > 0) await applyFromAccount(checked);
}

/** Removes the outbox entries that were sent, but not one whose row changed again while it was being sent. */
async function settle(sent: OutboxEntry[]): Promise<void> {
  const keys = sent.map((entry): [ServerTable, string] => [entry.table, entry.id]);
  await db.transaction('rw', db.outbox, async () => {
    const now = await db.outbox.bulkGet(keys);
    // `===`, never `<=`: a seq only rises per row, not across tabs.
    await db.outbox.bulkDelete(keys.filter((_, i) => now[i]?.seq === sent[i].seq));
  });
}
