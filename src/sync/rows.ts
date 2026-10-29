import type { z } from 'zod';
import {
  accountRow,
  discountVoteRow,
  entryRow,
  guessRow,
  planRow,
  profileRow,
  rateRow,
  weekResultRow,
} from '@/db/schemas';
import type { StoredRow } from './store';
import type { ServerTable } from './tables';

/** A row from the account that is not one the app could have saved. */
export class BadRow extends Error {}

/** Checks one row of a table, and that its id is the key the phone files it under; throws a BadRow otherwise. */
function rowCheck<T>(table: ServerTable, schema: z.ZodType<T>, keyOf: (row: T) => string) {
  return (row: StoredRow): T => {
    const parsed = schema.safeParse(row.data);
    if (!parsed.success) throw new BadRow(`a row of ${table} isn't the app's data`);
    if (keyOf(parsed.data) !== row.id) throw new BadRow(`a row of ${table} is filed under the wrong id`);
    return parsed.data;
  };
}

const manualRate = rateRow.refine((rate) => rate.source === 'manual');

/**
 * Each server table's row check, by the row schemas the backup uses (src/db/schemas.ts): what Load and a pull accept
 * from the account. The account keeps only manual rates.
 */
export const ROW_CHECKS = {
  accounts: rowCheck('accounts', accountRow, (a) => a.id),
  entries: rowCheck('entries', entryRow, (e) => e.id),
  plans: rowCheck('plans', planRow, (p) => p.id),
  guesses: rowCheck('guesses', guessRow, (g) => g.categoryId),
  manual_rates: rowCheck('manual_rates', manualRate, (r) => r.currency),
  week_results: rowCheck('week_results', weekResultRow, (w) => w.weekStart),
  discount_votes: rowCheck('discount_votes', discountVoteRow, (v) => v.discountId),
  profiles: rowCheck('profiles', profileRow, (p) => p.id),
} satisfies Record<ServerTable, (row: StoredRow) => object>;
