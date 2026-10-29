import type { BackupData } from '@/db/bulk';

/** The account's tables (supabase/migrations/20261023121726_user_data.sql), in the order they are saved. */
export const SERVER_TABLES = [
  'accounts',
  'entries',
  'plans',
  'guesses',
  'manual_rates',
  'week_results',
  'discount_votes',
  'profiles',
] as const;

export type ServerTable = (typeof SERVER_TABLES)[number];

/** One row as the account keeps it: the Dexie row's key, and the row itself as JSON. */
export type ServerRow = { id: string; data: object };

/** One value per server table, made by `make`. Spelled out, so a new table cannot be left out without a type error. */
export function byTable<T>(make: (table: ServerTable) => T): Record<ServerTable, T> {
  return {
    accounts: make('accounts'),
    entries: make('entries'),
    plans: make('plans'),
    guesses: make('guesses'),
    manual_rates: make('manual_rates'),
    week_results: make('week_results'),
    discount_votes: make('discount_votes'),
    profiles: make('profiles'),
  };
}

/**
 * This phone's data as the account's rows, table by table, from one snapshot (`exportAll`). The categories are built
 * into the app and stay out, and so do the ECB rates, which are only a copy of the day's published rates; a manual
 * rate is the user's own and goes, keyed by its currency.
 */
export function serverRowsOf(d: BackupData): Record<ServerTable, ServerRow[]> {
  return {
    accounts: d.accounts.map((a) => ({ id: a.id, data: a })),
    entries: d.entries.map((e) => ({ id: e.id, data: e })),
    plans: d.plan ? [{ id: d.plan.id, data: d.plan }] : [],
    guesses: d.guesses.map((g) => ({ id: g.categoryId, data: g })),
    manual_rates: d.fxRates.filter((r) => r.source === 'manual').map((r) => ({ id: r.currency, data: r })),
    week_results: d.weekResults.map((w) => ({ id: w.weekStart, data: w })),
    discount_votes: d.discountVotes.map((v) => ({ id: v.discountId, data: v })),
    profiles: d.profile ? [{ id: d.profile.id, data: d.profile }] : [],
  };
}

/** How a Dexie table syncs: the server table it goes to, and the server id of one of its keys (null: not synced). */
export type DexieSync = { server: ServerTable; idOf: (key: unknown) => string | null };

const stringKey = (key: unknown): string | null => (typeof key === 'string' ? key : null);

/**
 * Every Dexie table the account keeps, by its Dexie name. The same rules as `serverRowsOf`: the plan and the profile are
 * 'current', a manual rate goes by its currency, and an ECB rate (key [currency, 'ecb']) and the built-in categories
 * stay on the phone.
 */
const DEXIE_SYNC: Readonly<Record<string, DexieSync>> = {
  accounts: { server: 'accounts', idOf: stringKey },
  entries: { server: 'entries', idOf: stringKey },
  plan: { server: 'plans', idOf: stringKey },
  guesses: { server: 'guesses', idOf: stringKey },
  fxRates: {
    server: 'manual_rates',
    idOf: (key) => (Array.isArray(key) && key[1] === 'manual' && typeof key[0] === 'string' ? key[0] : null),
  },
  weekResults: { server: 'week_results', idOf: stringKey },
  discountVotes: { server: 'discount_votes', idOf: stringKey },
  profile: { server: 'profiles', idOf: stringKey },
};

/** How the Dexie table `name` syncs, or null when it stays on the phone. */
export function dexieSync(name: string): DexieSync | null {
  return Object.hasOwn(DEXIE_SYNC, name) ? DEXIE_SYNC[name] : null;
}

/** Where a server row lives on the phone: its Dexie table, and that table's key for the row's server id. */
export type DexieHome = { dexie: string; keyOf: (id: string) => string | [string, string] };

/** The other way round from `DEXIE_SYNC`: a manual rate's id is its currency, its Dexie key [currency, 'manual']. */
const DEXIE_HOME = byTable((table): DexieHome => {
  switch (table) {
    case 'plans':
      return { dexie: 'plan', keyOf: (id) => id };
    case 'manual_rates':
      return { dexie: 'fxRates', keyOf: (id) => [id, 'manual'] };
    case 'week_results':
      return { dexie: 'weekResults', keyOf: (id) => id };
    case 'discount_votes':
      return { dexie: 'discountVotes', keyOf: (id) => id };
    case 'profiles':
      return { dexie: 'profile', keyOf: (id) => id };
    default:
      return { dexie: table, keyOf: (id) => id };
  }
});

/** Where the rows of the server table `table` live on the phone. */
export function dexieHome(table: ServerTable): DexieHome {
  return DEXIE_HOME[table];
}
