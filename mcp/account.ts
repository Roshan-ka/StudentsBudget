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
  /** When the plan row was last written, which a save does last: the time of the last complete save. */
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

function readerOf(client: SupabaseClient): AccountReader {
  return {
    store: supabaseStore(client),
    async lastSavedAt() {
      const answer = await client.from('plans').select('updated_at').eq('id', 'current').is('deleted_at', null).maybeSingle();
      if (answer.error) throw new StoreError('plans', answer.status, answer.error.code ?? '', answer.error.message);
      const row = answer.data as { updated_at?: unknown } | null;
      return typeof row?.updated_at === 'string' ? row.updated_at : null;
    },
  };
}

/**
 * Hands out a signed-in reader, signing in on first use and keeping the session. `read` runs once more on a fresh
 * sign-in when the session has run out (401).
 */
export function accountFromSettings(settings: AccountSettings) {
  let client: Promise<SupabaseClient> | null = null;
  const connected = () => {
    client ??= signIn(settings).catch((error: unknown) => {
      client = null;
      throw error;
    });
    return client;
  };
  return async function read<T>(task: (reader: AccountReader) => Promise<T>): Promise<T> {
    try {
      return await task(readerOf(await connected()));
    } catch (error) {
      if (!(error instanceof StoreError && error.status === 401)) throw error;
      client = null;
      return task(readerOf(await connected()));
    }
  };
}

/** Reads the account with whatever is to hand to `task`; throws an AccountProblem when it can't. */
export type ReadAccount = <T>(task: (reader: AccountReader) => Promise<T>) => Promise<T>;

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
