import { afterEach, describe, expect, it, vi } from 'vitest';
import { accountFromSettings, type ReadAccount } from './account.ts';
import type { BudgetOverview } from './budget.ts';
import { call, connect } from './test-client.ts';

// The account module with the real supabase-js, against a fake account server: which requests it makes, and when.

const settings = { url: 'https://project.supabase.co', publishableKey: 'sb_publishable_x', email: 'a@example.com', password: 'p' };
const CREATED = '2026-10-01T08:00:00.000Z';
const verified = { id: 'f1', factor_type: 'totp', status: 'verified', friendly_name: 'Phone', created_at: CREATED, updated_at: CREATED };

/** A token with these claims. supabase-js reads them but can't check the signature, so any will do. */
function token(claims: Record<string, unknown>): string {
  const part = (value: unknown) => Buffer.from(JSON.stringify(value)).toString('base64url');
  return `${part({ alg: 'HS256', typ: 'JWT' })}.${part(claims)}.c2lnbmF0dXJl`;
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
}

/**
 * The account server: a password sign-in gets an aal1 session with the user's factors of that moment, `GET /user`
 * lists them as they are now, and the tables show the session no rows (nothing saved, or hidden by the database).
 */
function fakeServer() {
  const server = { factors: [] as (typeof verified)[], calls: [] as string[] };
  const user = () => ({ id: 'u1', aud: 'authenticated', role: 'authenticated', email: settings.email, factors: server.factors, app_metadata: {}, user_metadata: {}, created_at: CREATED });
  vi.stubGlobal('fetch', async (input: string | URL | Request, init?: RequestInit) => {
    const url = new URL(input instanceof Request ? input.url : input);
    server.calls.push(`${init?.method ?? 'GET'} ${url.pathname}`);
    if (url.pathname === '/auth/v1/token') {
      const claims = { sub: 'u1', role: 'authenticated', aal: 'aal1', exp: Math.floor(Date.now() / 1000) + 3600 };
      return json({ access_token: token(claims), token_type: 'bearer', expires_in: 3600, refresh_token: 'r', user: user() });
    }
    if (url.pathname === '/auth/v1/user') return json(user());
    if (url.pathname.startsWith('/rest/v1/')) return json([]);
    return json({ message: 'not found' }, 404);
  });
  return server;
}

async function overview(read: ReadAccount): Promise<BudgetOverview> {
  return (await call<BudgetOverview>(await connect('2026-10-21', read), 'budget_overview')).data;
}

describe('the account session with two-step sign-in', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('asks the account server, not the session, whether a code is needed when a read finds nothing', async () => {
    const server = fakeServer();
    const read = accountFromSettings(settings);
    // No factor at sign-in, and nothing saved: really empty.
    expect(await overview(read)).toMatchObject({ state: 'empty', budget: null });

    // The step is turned on in the app. The server's session, signed in with the password, stays valid, and the
    // factors it was handed at sign-in still list none.
    server.factors = [verified];
    const o = await overview(read);
    expect(o).toMatchObject({ state: 'needs-second-step', budget: null });
    expect(o.note).toContain('This account uses two-step sign-in.');
    expect(server.calls.filter((c) => c === 'POST /auth/v1/token')).toHaveLength(1);
    expect(server.calls.filter((c) => c === 'GET /auth/v1/user')).toHaveLength(2);
  });

  it('says so at sign-in, before reading anything, when the account already has the step', async () => {
    const server = fakeServer();
    server.factors = [verified];
    expect(await overview(accountFromSettings(settings))).toMatchObject({ state: 'needs-second-step', budget: null });
    expect(server.calls.some((c) => c.includes('/rest/v1/'))).toBe(false);
  });
});
