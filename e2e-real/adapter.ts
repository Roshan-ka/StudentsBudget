import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect, type APIRequestContext } from '@playwright/test';
import { freshCode, totpCode } from '../src/sync/totp';
import { SERVER_TABLES, type ServerTable } from '../src/sync/tables';
import { REAL_BASE_URL } from './env';

// StudentsBudget's adapter for the real-server e2e (testkit/README.md, "Adapter (v0)"): everything that knows the backend
// is the local Supabase stack lives here, so the kit in testkit/ never has to. Users are made through Playwright's
// request client, not src/sync/contract-users.ts or mailpit.ts (Node's fetch, which a test's network guard can't see).
// Codes come from src/sync/totp.ts, the contract tests' own authenticator (RFC 6238), so there is no second one.

/** Where supabase-js keeps the session in localStorage (AUTH_STORAGE_KEY, src/lib/supabase/client.ts). */
export const SESSION_KEY = 'studentsbudget-auth';

/** Every test user's password: throwaway accounts on a stack on this machine only. */
export const TEST_PASSWORD = 'stack-test-password';

const LOOPBACK = ['127.0.0.1', 'localhost', '[::1]'];

/**
 * The local stack's settings, from `node scripts/supabase-test-env.mjs`. Environment guard: users are made only on a
 * stack on this machine, never on a hosted project. Errors name the variables, never their values.
 */
export function backend() {
  const url = process.env.SUPABASE_TEST_URL;
  const key = process.env.SUPABASE_TEST_KEY;
  const mail = process.env.SUPABASE_TEST_MAIL_URL;
  if (!url || !key || !mail) {
    throw new Error('SUPABASE_TEST_URL, SUPABASE_TEST_KEY and SUPABASE_TEST_MAIL_URL are not set: start the local stack (CLAUDE.md, test:e2e:real)');
  }
  for (const address of [url, mail]) {
    const host = new URL(address).hostname;
    if (!LOOPBACK.includes(host)) throw new Error(`not the local stack: ${host}`);
  }
  return { url, key, mail };
}

/**
 * The hosts a real-server test's browser may reach (the network guard, testkit/network-guard.mjs): the app and the
 * stack's API. Mailpit is reached only through Playwright's `request`, which the guard doesn't route.
 */
export function allowedHosts(): string[] {
  return [REAL_BASE_URL, new URL(backend().url).origin];
}

type Session = { access_token: string; user?: { id: string } };
export type SecondFactor = 'none' | 'totp';
export type TestUser = {
  email: string;
  password: string;
  /** The authenticator's secret, for an account with two-step sign-in. Never logged. */
  secret?: string;
  /** The code that turned the authenticator on: the server may refuse it a second time (RFC 6238 §5.2). */
  usedCode?: string;
  /** The account's own API session (aal2 with two-step sign-in), for reading back and for its deletion. */
  session: Session;
};

// One run's addresses: test-<run>-<process>-<n>@example.com, so every test and worker has an account of its own.
const RUN = Date.now().toString(36);
let made = 0;
const newEmail = () => `test-${RUN}-${process.pid}-${++made}@example.com`;

/**
 * A request with the stack's key, and a user's token, whose failure never carries them. Playwright's error for a
 * request that fails (the stack down, say) lists the request's headers in its call log, which lands in
 * error-context.md and in reports; this keeps only the error's first line.
 */
async function call(request: APIRequestContext, method: 'get' | 'post', address: string, headers: Record<string, string>, data?: object) {
  try {
    return method === 'get' ? await request.get(address, { headers }) : await request.post(address, { headers, data });
  } catch (error) {
    throw new Error(`${method.toUpperCase()} ${new URL(address).pathname} failed: ${String((error as Error).message).split('\n')[0]}`);
  }
}

const headersFor = (token?: string) => ({ apikey: backend().key, ...(token ? { Authorization: `Bearer ${token}` } : {}) });

async function auth<T>(request: APIRequestContext, path: string, data: object, token?: string): Promise<T> {
  const response = await call(request, 'post', `${backend().url}/auth/v1/${path}`, headersFor(token), data);
  expect(response.ok(), `auth/v1/${path.replace(/\/[0-9a-f-]{36}\//, '/<id>/')} answered ${response.status()}`).toBe(true);
  return (await response.json()) as T;
}

/** The newest emailed 6-digit code to `address`: its subject is "StudentsBudget: <code>" (supabase/config.toml). */
export async function readEmailCode(request: APIRequestContext, address: string): Promise<string> {
  const { mail } = backend();
  let code: string | undefined;
  await expect
    .poll(
      async () => {
        const response = await request.get(`${mail}/api/v1/search`, { params: { query: `to:"${address}"` } });
        const found = (await response.json()) as { messages?: { Subject: string }[] };
        code = /\b(\d{6})\b/.exec(found.messages?.[0]?.Subject ?? '')?.[1];
        return code;
      },
      { message: `the emailed code to ${address} in Mailpit`, timeout: 10_000 },
    )
    .toBeTruthy();
  return code as string;
}

/** The authenticator's current code. */
export const totp = (secret: string, time?: number) => totpCode(secret, time);

/** A code the server takes now: never the one that turned the authenticator on (waits for the next window if needed). */
export const freshTotp = (user: TestUser) => freshCode(user.secret as string, user.usedCode as string);

/**
 * A confirmed account, signed up and confirmed through the API. With `secondFactor: 'totp'`, its authenticator is on
 * and verified, and its session is aal2. With `username`, sign-up gives it a name to post under (public_profiles).
 * Every user made here is a student; a moderator comes from the host side's seed (`moderatorFor`, e2e-real/db.mjs).
 */
export async function createUser(
  request: APIRequestContext,
  { secondFactor, username = false }: { secondFactor: SecondFactor; username?: boolean },
): Promise<TestUser> {
  const email = newEmail();
  // 3 to 20 of a-z, 0-9 and _ (public_profiles' rule), from the address's run, process and number.
  const name = `u${email.slice('test-'.length, email.indexOf('@')).replace(/-/g, '_')}`.slice(0, 20);
  await auth(request, 'signup', { email, password: TEST_PASSWORD, ...(username ? { data: { username: name, label: 'student' } } : {}) });
  let session = await auth<Session>(request, 'verify', { type: 'email', email, token: await readEmailCode(request, email) });
  if (secondFactor === 'none') return { email, password: TEST_PASSWORD, session };
  const factor = await auth<{ id: string; totp: { secret: string } }>(request, 'factors', { factor_type: 'totp', friendly_name: 'Test phone' }, session.access_token);
  const challenge = await auth<{ id: string }>(request, `factors/${factor.id}/challenge`, {}, session.access_token);
  const usedCode = totp(factor.totp.secret);
  session = await auth<Session>(request, `factors/${factor.id}/verify`, { challenge_id: challenge.id, code: usedCode }, session.access_token);
  return { email, password: TEST_PASSWORD, secret: factor.totp.secret, usedCode, session };
}

/** Deletes the account with its own session (`delete_my_account`, P2.5): aal2 for one with two-step sign-in. */
export async function deleteUser(request: APIRequestContext, user: TestUser) {
  const response = await call(request, 'post', `${backend().url}/rest/v1/rpc/delete_my_account`, headersFor(user.session.access_token), {});
  expect(response.ok(), `teardown: delete_my_account answered ${response.status()} for ${user.email}`).toBe(true);
}

/**
 * The account's rows in one of its tables, as stored, read by the row's owner (row-level security shows a user only
 * their own). A check that a sign-in or a refused write changed nothing compares these before and after.
 */
export async function readBack(request: APIRequestContext, user: TestUser, table: ServerTable): Promise<unknown[]> {
  const response = await call(request, 'get', `${backend().url}/rest/v1/${table}?select=*&order=id`, headersFor(user.session.access_token));
  expect(response.ok(), `reading ${table} back answered ${response.status()}`).toBe(true);
  return (await response.json()) as unknown[];
}

/**
 * A REST or RPC call as `token`'s user, or signed out (null): the raw response, refused or not, for a test to judge.
 * `path` is under /rest/v1/ (`plans?id=eq.x`, `rpc/report_hack`).
 */
export async function rest(request: APIRequestContext, token: string | null, method: 'get' | 'post' | 'patch' | 'delete', path: string, data?: object) {
  const headers = { ...headersFor(token ?? undefined), 'content-type': 'application/json', Prefer: 'return=representation' };
  try {
    return await request.fetch(`${backend().url}/rest/v1/${path}`, { method: method.toUpperCase(), headers, ...(data ? { data } : {}) });
  } catch (error) {
    throw new Error(`${method.toUpperCase()} /rest/v1/${path.split('?')[0]} failed: ${String((error as Error).message).split('\n')[0]}`);
  }
}

/** A new post by `user` (who needs a username), in Regensburg, about food, in English: its id. */
export async function postHack(request: APIRequestContext, user: TestUser, body: string): Promise<string> {
  const response = await rest(request, user.session.access_token, 'post', 'rpc/post_hack', { p_body: body, p_city: 'regensburg', p_category: 'food', p_link: null, p_lang: 'en' });
  expect(response.ok(), `post_hack answered ${response.status()}`).toBe(true);
  return (await response.json()) as string;
}

/** `user` reports the post: it goes into the moderator's queue. */
export async function reportHack(request: APIRequestContext, user: TestUser, id: string) {
  const response = await rest(request, user.session.access_token, 'post', 'rpc/report_hack', { p_id: id });
  expect(response.ok(), `report_hack answered ${response.status()}`).toBe(true);
}

/**
 * The moderator seeded for this worker (`node e2e-real/db.mjs seed`, before the run), in private.moderators: with
 * `totp`, its authenticator is on; with `none`, it has no second factor, so it signs in at aal1 and only the guard's
 * own aal2 rule stops it. Each worker has its own, so two never give the same account's code at once.
 */
export function moderatorFor(parallelIndex: number, secondFactor: SecondFactor = 'totp'): TestUser {
  const file = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'playwright', '.auth', 'moderators.json');
  if (!existsSync(file)) throw new Error('no seeded moderators: run `node e2e-real/db.mjs seed` with the stack up first');
  const seeded = JSON.parse(readFileSync(file, 'utf8')) as Record<SecondFactor, TestUser[]>;
  const moderator = seeded[secondFactor]?.[parallelIndex];
  if (!moderator) throw new Error(`no seeded moderator for worker ${parallelIndex}: seed more (node e2e-real/db.mjs seed <count>)`);
  return moderator;
}

/** Every table of the account (src/sync/tables.ts), read back. */
export async function readAccount(request: APIRequestContext, user: TestUser): Promise<Record<ServerTable, unknown[]>> {
  const entries = await Promise.all(SERVER_TABLES.map(async (table) => [table, await readBack(request, user, table)] as const));
  return Object.fromEntries(entries) as Record<ServerTable, unknown[]>;
}

/**
 * What the random clicker (testkit/walker.mjs) must never press: what can't be undone or ends the walk. A name that
 * contains one of these, or matches it, is left alone.
 */
export const NEVER_CLICK: (string | RegExp)[] = [
  'Delete my account',
  'Delete everything',
  /^Sign out/i,
  'Change password',
  /^Remove (authenticator|passkey|Passkey)/,
  /turn off two-step/i,
  /^Restore/i,
  /^Import/i,
];

/**
 * Console errors that are no finding on a walk: the browser's own line for a request the server refused (4xx), which a
 * student's or an outsider's walk meets by design (a moderator page, an account call signed out).
 */
export const CONSOLE_ALLOW: (string | RegExp)[] = [/Failed to load resource: the server responded with a status of 4\d\d/];
