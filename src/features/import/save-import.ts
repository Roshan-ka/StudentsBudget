import { db } from '@/db/db';
import { loadRates } from '@/db/rates';
import type { Entry } from '@/db/types';
import { buildEntry } from '@/features/entries/build-entry';
import type { CurrencyCode, Minor } from '@/lib/money';
import { newId } from '@/lib/new-id';
import { planImport, type SkippedRow } from './plan-import';
import type { ReadRows } from './read-rows';

// Saving an import (CSV import, docs/superpowers/plans/2026-11-09-csv-import-export.md; Roshan, 09-11-2026: saved
// straight away, with a summary and Undo). Everything happens in one transaction: what the phone holds is read again
// and the import planned again inside it, so a second tap, or the same file in another tab, finds the first import's
// entries and adds nothing. On a linked phone the outbox middleware records every write, as for any other.

export type SavedImport = {
  ok: true;
  batchId: string;
  added: Entry[];
  skipped: SkippedRow[];
  /** How each account's starting balance moved (rows dated before it was added), for the summary and for Undo. */
  openingChanges: Map<string, Minor>;
};

/** Nothing was written: the account is gone, or an account in another currency has no exchange rate yet. */
export type ImportRefused = { ok: false; reason: 'noAccount' } | { ok: false; reason: 'noRate'; currency: CurrencyCode };

export function saveImport({
  read,
  accountId,
  batchId = newId(),
  now = new Date(),
}: {
  read: ReadRows;
  accountId: string;
  batchId?: string;
  now?: Date;
}): Promise<SavedImport | ImportRefused> {
  return db.transaction('rw', [db.entries, db.accounts, db.plan, db.categories, db.fxRates], async () => {
    const [accounts, entries, categories, plan, rates] = await Promise.all([
      db.accounts.toArray(),
      db.entries.toArray(),
      db.categories.toArray(),
      db.plan.get('current'),
      // Read in this transaction too (fxRates is in its scope): a manual rate wins over the ECB's.
      loadRates(),
    ]);
    const account = accounts.find((candidate) => candidate.id === accountId);
    if (account === undefined) return { ok: false, reason: 'noAccount' } as const;

    const planned = planImport({ read, account, accounts, entries, categories, plan: plan ?? null, batchId, now });

    // Every entry is built before anything is written, so a missing rate leaves the phone as it was.
    const added: Entry[] = [];
    for (const { input, imported } of planned.add) {
      // The account the entry is booked on: a transfer's sending account, which for money in is the other one.
      const bookedOn = accounts.find((candidate) => candidate.id === input.accountId);
      if (bookedOn === undefined) return { ok: false, reason: 'noAccount' } as const;
      const built = buildEntry(input, bookedOn, rates, now);
      if (!built.ok) return { ok: false, reason: 'noRate', currency: bookedOn.currency } as const;
      added.push({ ...built.entry, imported });
    }

    if (added.length > 0) await db.entries.bulkAdd(added);
    for (const [id, change] of planned.openingChanges) {
      const touched = accounts.find((candidate) => candidate.id === id);
      if (touched !== undefined) await db.accounts.update(id, { openingMinor: touched.openingMinor + change });
    }
    return { ok: true, batchId, added, skipped: planned.skipped, openingChanges: planned.openingChanges } as const;
  });
}

/**
 * Takes an import back: its entries go (a linked phone records the deletes, so the account gets tombstones at the next
 * sync), and each account's start moves back. An import already taken back, or never saved, changes nothing, so a
 * second tap can't move a start twice. Offered in the summary, right after the import.
 */
export function undoImport(saved: Pick<SavedImport, 'batchId' | 'openingChanges'>): Promise<{ removed: number }> {
  return db.transaction('rw', [db.entries, db.accounts], async () => {
    const ids = await db.entries
      .filter((entry) => entry.imported?.batchId === saved.batchId)
      .primaryKeys();
    if (ids.length === 0) return { removed: 0 };
    await db.entries.bulkDelete(ids);
    for (const [id, change] of saved.openingChanges) {
      const account = await db.accounts.get(id);
      if (account !== undefined) await db.accounts.update(id, { openingMinor: account.openingMinor - change });
    }
    return { removed: ids.length };
  });
}
