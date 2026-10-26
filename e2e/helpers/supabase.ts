import { expect, test, type Page, type Route } from '@playwright/test';

/**
 * A Supabase project that is configured but never reached (`.invalid` never resolves). The Playwright configs start
 * the server with it, so the account UI shows; the specs answer its calls with `mockSupabaseAuth`.
 */
export const E2E_SUPABASE_ENV = {
  NEXT_PUBLIC_SUPABASE_URL: 'https://e2e.supabase.invalid',
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_e2e',
};

/** Every Supabase Auth call. Matched by path, so it also catches a dev server that has the real project in .env.local. */
export const SUPABASE_AUTH = '**/auth/v1/**';

// Every answer to the browser is cross-origin: the page is on localhost, Supabase on its own host.
const CORS = {
  'access-control-allow-origin': '*',
  'access-control-allow-headers': '*',
  'access-control-allow-methods': 'GET, POST, PUT, DELETE, OPTIONS',
};

const USER_ID = '00000000-0000-4000-8000-000000000001';

/** How the mocked session's access token ends; the data mock checks for it. */
const SESSION_SIGNATURE = '.e2e-signature';

function base64url(value: object): string {
  return Buffer.from(JSON.stringify(value)).toString('base64url');
}

/** A session as Supabase Auth returns it, valid for an hour of real time (ahead of any clock a spec pins). */
function sessionFor(email: string) {
  const now = Math.floor(Date.now() / 1000);
  const user = {
    id: USER_ID,
    aud: 'authenticated',
    role: 'authenticated',
    email,
    app_metadata: { provider: 'email', providers: ['email'] },
    user_metadata: {},
    created_at: new Date().toISOString(),
  };
  const claims = { sub: USER_ID, email, role: 'authenticated', aud: 'authenticated', iat: now, exp: now + 3600 };
  return {
    access_token: `${base64url({ alg: 'HS256', typ: 'JWT' })}.${base64url(claims)}${SESSION_SIGNATURE}`,
    token_type: 'bearer',
    expires_in: 3600,
    expires_at: now + 3600,
    refresh_token: 'e2e-refresh-token',
    user,
  };
}

/** One call the mock answered: what was asked, and the JSON body sent with it. */
export type AuthCall = { method: string; path: string; search: string; body: unknown };

/**
 * Answers Supabase Auth like a project with email and password sign-in and "Confirm email" off: a new account is
 * signed in at once. `accounts` maps each existing email to its password. Returns every call, in order.
 */
export async function mockSupabaseAuth(page: Page, accounts: Record<string, string> = {}): Promise<AuthCall[]> {
  const passwords = new Map(Object.entries(accounts));
  const calls: AuthCall[] = [];

  const reply = (route: Route, status: number, json?: unknown) =>
    route.fulfill(json === undefined ? { status, headers: CORS } : { status, headers: CORS, json });

  await page.route(SUPABASE_AUTH, async (route) => {
    const request = route.request();
    if (request.method() === 'OPTIONS') return reply(route, 204);

    const url = new URL(request.url());
    const path = url.pathname.replace(/^.*\/auth\/v1/, '');
    const body: unknown = request.postData() ? request.postDataJSON() : null;
    calls.push({ method: request.method(), path, search: url.search, body });
    const { email, password } = (body ?? {}) as { email?: string; password?: string };

    if (path === '/signup') {
      if (email === undefined || password === undefined) return reply(route, 400, { error_code: 'validation_failed' });
      if (passwords.has(email)) {
        return reply(route, 422, { error_code: 'user_already_exists', msg: 'User already registered' });
      }
      passwords.set(email, password);
      return reply(route, 200, sessionFor(email));
    }
    if (path === '/token' && url.searchParams.get('grant_type') === 'password') {
      if (email !== undefined && passwords.get(email) === password) return reply(route, 200, sessionFor(email));
      return reply(route, 400, { error_code: 'invalid_credentials', msg: 'Invalid login credentials' });
    }
    if (path === '/logout') return reply(route, 204);
    return reply(route, 404, { error_code: 'not_found', msg: `No mock for ${path}` });
  });

  return calls;
}

/** Every call to the account's tables (PostgREST). Matched by path, like the auth calls. */
export const SUPABASE_REST = '**/rest/v1/**';

/** The account's tables as the mock keeps them: table → id → the row's data, null for a tombstone. */
export type ServerTables = Map<string, Map<string, unknown>>;

/**
 * Answers the account's tables like PostgREST does for one signed-in user: read ids or whole rows (by id, a page at a
 * time after the last id, tombstones left out when asked), and upsert rows, a tombstone being a row with data null. A
 * hard delete is refused, as the database refuses it. A call without the mocked session's token gets 401, as row-level
 * security would refuse it, so a spec cannot pass while the app sends its calls signed out. `failWith` makes every call
 * answer with that status instead. `tables` shares the account with another page, a second phone. Returns the tables,
 * to look at and to seed.
 */
export async function mockSupabaseData(
  page: Page,
  options: { failWith?: number; tables?: ServerTables } = {},
): Promise<ServerTables> {
  const tables: ServerTables = options.tables ?? new Map();
  const table = (name: string) => {
    if (!tables.has(name)) tables.set(name, new Map());
    return tables.get(name)!;
  };

  await page.route(SUPABASE_REST, async (route) => {
    const request = route.request();
    if (request.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: CORS });
    if (options.failWith !== undefined) {
      return route.fulfill({ status: options.failWith, headers: CORS, json: { code: 'XX000', message: 'mock failure' } });
    }

    if (!(request.headers()['authorization'] ?? '').endsWith(SESSION_SIGNATURE)) {
      return route.fulfill({ status: 401, headers: CORS, json: { code: 'PGRST301', message: 'not signed in' } });
    }

    const url = new URL(request.url());
    const rows = table(url.pathname.replace(/^.*\/rest\/v1\//, ''));
    if (request.method() === 'GET') {
      const after = url.searchParams.get('id')?.match(/^gt\.(.*)$/)?.[1] ?? null;
      const limit = Number(url.searchParams.get('limit') ?? 1000);
      const liveOnly = url.searchParams.get('deleted_at') === 'is.null';
      const ids = [...rows.keys()]
        .sort()
        .filter((id) => after === null || id > after)
        .filter((id) => !liveOnly || rows.get(id) !== null)
        .slice(0, limit);
      const withData = (url.searchParams.get('select') ?? '').includes('data');
      const json = ids.map((id) => (withData ? { id, data: rows.get(id) } : { id }));
      return route.fulfill({ status: 200, headers: CORS, json });
    }
    if (request.method() === 'POST') {
      for (const row of request.postDataJSON() as { id: string; data: unknown }[]) rows.set(row.id, row.data);
      return route.fulfill({ status: 201, headers: CORS });
    }
    if (request.method() === 'DELETE') {
      return route.fulfill({ status: 403, headers: CORS, json: { code: '42501', message: 'permission denied' } });
    }
    return route.fulfill({ status: 405, headers: CORS });
  });

  return tables;
}

/**
 * Skips the spec when the server shows no account UI: Playwright reused a dev server that was started without the
 * Supabase settings. Stop that server, or run on another port (E2E_PORT=3001), to run the spec.
 */
export async function skipUnlessAccountsShow(page: Page) {
  await page.goto('/settings/account');
  const heading = page.getByRole('heading', { level: 2, name: 'Your account', exact: true });
  await expect(heading).toBeVisible();
  // The first render already says so: without settings the view starts 'off', never 'loading'.
  const isOff = (await page.getByText("Accounts aren't set up in this copy of the app.", { exact: false }).count()) > 0;
  test.skip(isOff, 'The reused dev server has no Supabase settings: stop it, or run with E2E_PORT=3001.');
}
