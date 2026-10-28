import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { authErrorMessage } from '@/features/account/auth-errors';
import { parseSupabaseEnv, type SupabaseEnv } from '@/lib/supabase/env';
import { StoreError, supabaseStore, type UserDataStore } from '@/sync/store';
import { listed } from '@/sync/summary';

// Reading the user's account from the server: the app's own Supabase settings and store, signed in as the user, so
// row-level security keeps every read to their own rows. Read-only: nothing here writes.

/** The account as the budget tools read it. */
export type AccountReader = {
  store: UserDataStore;
  /**
   * When the plan row was last written. A save writes it after every other row but before deleting what the phone no
   * longer has, so this is the last save that got as far as the plan.
   */
  lastSavedAt(): Promise<string | null>;
};

/** Why the account couldn't be read, in words the model can pass on. */
export class AccountProblem extends Error {
  readonly state: 'not-set-up' | 'sign-in-failed' | 'unreachable';

  constructor(state: AccountProblem['state'], message: string) {
    super(message);
    this.name = 'AccountProblem';
    this.state = state;
  }
}

export type AccountSettings = SupabaseEnv & { email: string; password: string };

/** Environment variables by name; `process.env` is one, and tests pass their own. */
type Env = Record<string, string | undefined>;

/** The settings the server needs, from `.env.local` (loaded by server.ts) or the environment. */
export function readAccountSettings(env: Env = process.env): AccountSettings | { missing: string[] } {
  const project = parseSupabaseEnv({
    url: env.NEXT_PUBLIC_SUPABASE_URL,
    publishableKey: env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  });
  const email = env.STUDENTSBUDGET_MCP_EMAIL?.trim() ?? '';
  const password = env.STUDENTSBUDGET_MCP_PASSWORD ?? '';
  const missing = [
    ...(project === null ? ['NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY'] : []),
    ...(email === '' ? ['STUDENTSBUDGET_MCP_EMAIL'] : []),
    ...(password === '' ? ['STUDENTSBUDGET_MCP_PASSWORD'] : []),
  ];
  return project === null || missing.length > 0 ? { missing } : { ...project, email, password };
}

async function signIn(settings: AccountSettings): Promise<SupabaseClient> {
  // No storage and no refresh timer: the session lives in this process, and an expired one is replaced by signing in
  // again (see accountFromSettings).
  const client = createClient(settings.url, settings.publishableKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
  let result: Awaited<ReturnType<typeof client.auth.signInWithPassword>>;
  try {
    result = await client.auth.signInWithPassword({ email: settings.email, password: settings.password });
  } catch (error) {
    throw new AccountProblem('unreachable', authErrorMessage(error));
  }
  if (result.error) {
    const unreachable = result.error.name === 'AuthRetryableFetchError';
    throw new AccountProblem(unreachable ? 'unreachable' : 'sign-in-failed', authErrorMessage(result.error));
  }
  return client;
}

/** The store with its writes taken away: the server only reads, whatever a caller tries. */
export function readOnly(store: UserDataStore): UserDataStore {
  const refuse = async () => {
    throw new Error('The StudentsBudget MCP server only reads the account.');
  };
  return { listIds: store.listIds, listRows: store.listRows, upsert: refuse, tombstone: refuse };
}

function readerOf(client: SupabaseClient): AccountReader {
  return {
    store: readOnly(supabaseStore(client)),
    async lastSavedAt() {
      const answer = await client.from('plans').select('updated_at').eq('id', 'current').is('deleted_at', null).maybeSingle();
      if (answer.error) throw new StoreError('plans', answer.status, answer.error.code ?? '', answer.error.message);
      const row = answer.data as { updated_at?: unknown } | null;
      return typeof row?.updated_at === 'string' ? row.updated_at : null;
    },
  };
}

/** Signs in with supabase-js and hands back the account as the tools read it. */
async function signedInReader(settings: AccountSettings): Promise<AccountReader> {
  return readerOf(await signIn(settings));
}

/** Reads the account with whatever is to hand to `task`; throws an AccountProblem when it can't. */
export type ReadAccount = <T>(task: (reader: AccountReader) => Promise<T>) => Promise<T>;

/**
 * Signs in on first use and keeps the session. A failed sign-in is not kept, so the next call tries again. A read
 * that gets a 401 (the session ran out) signs in afresh and runs once more; any other error is passed on as it is.
 * `connect` is replaceable for tests.
 */
export function accountFromSettings(
  settings: AccountSettings,
  connect: (settings: AccountSettings) => Promise<AccountReader> = signedInReader,
): ReadAccount {
  let session: Promise<AccountReader> | null = null;
  const connected = () => {
    session ??= connect(settings).catch((error: unknown) => {
      session = null;
      throw error;
    });
    return session;
  };
  return async <T>(task: (reader: AccountReader) => Promise<T>): Promise<T> => {
    const current = connected();
    try {
      return await task(await current);
    } catch (error) {
      if (!(error instanceof StoreError && error.status === 401)) throw error;
      // Only this session is dropped: another call may already have signed in afresh.
      if (session === current) session = null;
      return task(await connected());
    }
  };
}

/** The account the settings name, or one that explains which settings are missing. */
export function accountFromEnv(env: Env = process.env): ReadAccount {
  const settings = readAccountSettings(env);
  if ('missing' in settings) {
    return async () => {
      throw new AccountProblem(
        'not-set-up',
        `The server has no account to read: add ${listed(settings.missing)} to .env.local in the StudentsBudget ` +
          'folder (git-ignored), then restart the server.',
      );
    };
  }
  return accountFromSettings(settings);
}
