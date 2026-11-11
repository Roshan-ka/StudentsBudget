import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { expect, test, type Page, type Request, type Route } from '@playwright/test';
import { MESSAGES } from '../../src/i18n/messages';
import { openApp, waitForApp } from './app';

/**
 * A Supabase project that is configured but never reached (`.invalid` never resolves). The Playwright configs start
 * the server with it, so the account UI shows; the specs answer its calls with `mockSupabaseAuth`. The VAPID key (RFC
 * 8291's example public key) shows the weekly reminder; nothing is ever sent with it.
 */
export const E2E_SUPABASE_ENV = {
  NEXT_PUBLIC_SUPABASE_URL: 'https://e2e.supabase.invalid',
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_e2e',
  NEXT_PUBLIC_VAPID_PUBLIC_KEY: 'BP4z9KsN6nGRTbVYI_c7VJSPQTBtkgcy27mlmlMoZIIgDll6e3vCYLocInmYWAmS6TlzAC8wEqKK6PBru3jl7A8',
  // The AI features (the AI phase): their parts show, and specs answer the function with `mockAiFunction` (ai.ts).
  NEXT_PUBLIC_AI: '1',
};

/** Every Supabase Auth call. Matched by path, so it also catches a dev server that has the real project in .env.local. */
export const SUPABASE_AUTH = '**/auth/v1/**';

// Every answer to the browser is cross-origin: the page is on localhost, Supabase on its own host.
const CORS = {
  'access-control-allow-origin': '*',
  'access-control-allow-headers': '*',
  'access-control-allow-methods': 'GET, POST, PUT, DELETE, OPTIONS',
};

/** The mocked user id of an email: a stable one per email, so two emails are two accounts (linking keeps them apart). */
export function e2eUserIdOf(email: string): string {
  return `00000000-0000-4000-8000-${createHash('sha1').update(email).digest('hex').slice(0, 12)}`;
}

/** How the mocked session's access token ends; the data mock checks for it. */
const SESSION_SIGNATURE = '.e2e-signature';

/** Whether a request carries the mocked session's token, as a signed-in page sends it (the AI function's mock, ai.ts). */
export function signedInRequest(request: Request): boolean {
  return (request.headers()['authorization'] ?? '').endsWith(SESSION_SIGNATURE);
}

function base64url(value: object): string {
  return Buffer.from(JSON.stringify(value)).toString('base64url');
}

/** The one code the mocked authenticator accepts; any other is wrong. */
export const E2E_TOTP_CODE = '246802';
/** The code every mocked sign-up email holds (P2.4); any other is wrong or expired. */
export const E2E_EMAIL_CODE = '135792';
/** The key the mocked authenticator hands out. */
export const E2E_TOTP_SECRET = 'JBSWY3DPEHPK3PXP';

/** An authenticator factor as Supabase Auth lists it on the user. */
type MockFactor = { id: string; friendly_name: string; factor_type: 'totp'; status: 'verified' | 'unverified' };

/** Each account's authenticators, by email. Passed to `mockSupabaseAuth` on two pages, they share one account. */
export type AuthFactors = Map<string, MockFactor[]>;

/** A passkey as the account keeps it: what it lists, plus the credential id the device signs in with. */
type MockPasskey = { id: string; friendly_name?: string; created_at: string; last_used_at?: string; credentialId: string };

function userFor(email: string, factors: MockFactor[]) {
  return {
    id: e2eUserIdOf(email),
    aud: 'authenticated',
    role: 'authenticated',
    email,
    app_metadata: { provider: 'email', providers: ['email'] },
    user_metadata: {},
    created_at: new Date().toISOString(),
    factors: factors.map((f) => ({ ...f, created_at: 'x', updated_at: 'x' })),
  };
}

/**
 * A session as Supabase Auth returns it, valid for an hour of real time (ahead of any clock a spec pins). `aal` is the
 * assurance level its token states: 'aal2' once an authenticator code was given. `methods` are how it signed in (the
 * `amr` claim): 'password', 'otp' for an emailed code, 'webauthn' for a passkey, plus 'totp' once the code was given.
 */
function sessionFor(email: string, aal: 'aal1' | 'aal2' = 'aal1', factors: MockFactor[] = [], methods: string[] = ['password']) {
  const now = Math.floor(Date.now() / 1000);
  const user = userFor(email, factors);
  const amr = methods.map((method) => ({ method, timestamp: now }));
  const claims = { sub: e2eUserIdOf(email), email, role: 'authenticated', aud: 'authenticated', aal, amr, iat: now, exp: now + 3600 };
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
 * Answers Supabase Auth like a project with email and password sign-in, "Confirm email" off, authenticator apps on
 * (two-step sign-in) and passkeys on (relying party localhost): a new account is signed in at once. `accounts` maps
 * each existing email to its password. The authenticator accepts only E2E_TOTP_CODE. A passkey needs a browser that
 * can make one, such as Chrome with a virtual authenticator (`addVirtualAuthenticator`). `factors` shares the
 * accounts' authenticators with another page, a second phone; each page keeps its own session. With `confirmations`,
 * "Confirm email" is on (P2.4): a new account gets no session until `/verify` is given E2E_EMAIL_CODE, and its password
 * alone answers `email_not_confirmed`; `/resend` always says a new email went. "Forgot password" works either way:
 * `/recover` mails an account E2E_EMAIL_CODE, which `/verify` takes once as a `recovery` code (aal1, so an account with
 * two-step sign-in still owes its authenticator), and `PUT /user` sets the new password (at aal2 when the account has
 * an authenticator, as Supabase Auth wants). Returns every call, in order.
 */
export async function mockSupabaseAuth(
  page: Page,
  accounts: Record<string, string> = {},
  options: { factors?: AuthFactors; confirmations?: boolean } = {},
): Promise<AuthCall[]> {
  const passwords = new Map(Object.entries(accounts));
  // Accounts made while "Confirm email" is on, until their emailed code is given, and accounts whose "Forgot password"
  // code was mailed and not used yet.
  const unconfirmed = new Set<string>();
  const resetting = new Set<string>();
  const calls: AuthCall[] = [];
  // Each account's authenticator factors, the account signed in, and whether its session gave a code.
  const factorsOf: AuthFactors = options.factors ?? new Map();
  let current: string | null = null;
  let currentAal: 'aal1' | 'aal2' = 'aal1';
  let currentMethods: string[] = ['password'];
  const factors = (email: string) => factorsOf.get(email) ?? [];
  const verified = (email: string) => factors(email).filter((f) => f.status === 'verified');
  const signedIn = (email: string, aal: 'aal1' | 'aal2', methods: string[] = ['password']) => {
    current = email;
    currentAal = aal;
    currentMethods = methods;
    return sessionFor(email, aal, verified(email), methods);
  };
  // Each account's passkeys, and which account a passkey's credential (the device's key) signs in.
  const passkeysOf = new Map<string, MockPasskey[]>();
  const passkeys = (email: string) => passkeysOf.get(email) ?? [];
  // What the account lists of a passkey: never the credential id.
  const listedPasskey = (p: MockPasskey) => ({
    id: p.id,
    friendly_name: p.friendly_name,
    created_at: p.created_at,
    last_used_at: p.last_used_at,
  });
  const owners = new Map<string, string>();
  let challenges = 0;

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
      if (options.confirmations) {
        // The user alone, with no session: Supabase Auth's answer while the email waits for its code.
        unconfirmed.add(email);
        return reply(route, 200, userFor(email, []));
      }
      return reply(route, 200, signedIn(email, 'aal1'));
    }
    if (path === '/token' && url.searchParams.get('grant_type') === 'password') {
      // The password alone: aal1, with the account's confirmed authenticators listed, as Supabase Auth does.
      if (email !== undefined && passwords.get(email) === password) {
        if (unconfirmed.has(email)) return reply(route, 400, { error_code: 'email_not_confirmed', msg: 'Email not confirmed' });
        return reply(route, 200, signedIn(email, 'aal1'));
      }
      return reply(route, 400, { error_code: 'invalid_credentials', msg: 'Invalid login credentials' });
    }
    if (path === '/verify') {
      // The code from the sign-up email confirms the account and signs it in. A wrong code and an expired one get the
      // same answer from Supabase Auth.
      const { token, type } = (body ?? {}) as { token?: string; type?: string };
      if (email !== undefined && unconfirmed.has(email) && (type === 'email' || type === 'signup') && token === E2E_EMAIL_CODE) {
        unconfirmed.delete(email);
        return reply(route, 200, signedIn(email, 'aal1', ['otp']));
      }
      // A "Forgot password" code signs in like the password: aal1, with the account's authenticators listed.
      if (email !== undefined && resetting.has(email) && type === 'recovery' && token === E2E_EMAIL_CODE) {
        resetting.delete(email);
        return reply(route, 200, signedIn(email, 'aal1', ['otp']));
      }
      return reply(route, 403, { error_code: 'otp_expired', msg: 'Token has expired or is invalid' });
    }
    // A new sign-up email; Supabase Auth says the same whether or not the email has an account.
    if (path === '/resend') return reply(route, 200, {});
    // A "Forgot password" email: only an existing account gets a code, but the answer is the same for any email.
    if (path === '/recover') {
      if (email !== undefined && passwords.has(email)) resetting.add(email);
      return reply(route, 200, {});
    }
    if (path === '/logout') {
      current = null;
      return reply(route, 204);
    }
    // Signing in with a passkey: the device picks one of its passkeys for this site (no email asked), and the account
    // that registered it is signed in at aal1, like the password; one with two-step sign-in still owes the code.
    if (path === '/passkeys/authentication/options') {
      challenges += 1;
      return reply(route, 200, {
        challenge_id: `sign-in-${challenges}`,
        options: { challenge: randomBytes(32).toString('base64url'), rpId: 'localhost', userVerification: 'preferred', timeout: 60_000 },
      });
    }
    if (path === '/passkeys/authentication/verify') {
      const { credential } = (body ?? {}) as { credential?: { id?: string } };
      const owner = owners.get(credential?.id ?? '');
      if (owner === undefined) return reply(route, 400, { error_code: 'webauthn_verification_failed', msg: 'Unknown passkey' });
      const used = passkeys(owner).find((p) => p.credentialId === credential?.id);
      if (used !== undefined) used.last_used_at = new Date().toISOString();
      // Without the account's authenticators: the real answer isn't documented (a beta), so the app must find them
      // itself (a refreshed session lists them) and not rely on this answer to show the code step.
      signedIn(owner, 'aal1', ['webauthn']);
      return reply(route, 200, sessionFor(owner, 'aal1', [], ['webauthn']));
    }
    if (current === null) return reply(route, 401, { error_code: 'no_authorization', msg: 'Not signed in' });
    const who = current;

    if (path === '/token' && url.searchParams.get('grant_type') === 'refresh_token') {
      // Still aal2 only while a confirmed authenticator is left.
      return reply(route, 200, signedIn(who, currentAal === 'aal2' && verified(who).length > 0 ? 'aal2' : 'aal1', currentMethods));
    }
    if (path === '/user' && request.method() === 'GET') return reply(route, 200, userFor(who, factors(who)));
    if (path === '/user' && request.method() === 'PUT') {
      // A new password: on an account with two-step sign-in only from a session that gave the code, and never the
      // password it already has.
      if (password === undefined) return reply(route, 200, userFor(who, factors(who)));
      if (verified(who).length > 0 && currentAal !== 'aal2') {
        return reply(route, 401, { error_code: 'insufficient_aal', msg: 'AAL2 session is required to update email or password when MFA is enabled.' });
      }
      if (passwords.get(who) === password) {
        return reply(route, 422, { error_code: 'same_password', msg: 'New password should be different from the old password.' });
      }
      passwords.set(who, password);
      return reply(route, 200, userFor(who, factors(who)));
    }
    if (path === '/passkeys/registration/options') {
      challenges += 1;
      return reply(route, 200, {
        challenge_id: `register-${challenges}`,
        options: {
          rp: { name: 'StudentsBudget', id: 'localhost' },
          user: { id: Buffer.from(e2eUserIdOf(who)).toString('base64url'), name: who, displayName: who },
          challenge: randomBytes(32).toString('base64url'),
          pubKeyCredParams: [
            { type: 'public-key', alg: -7 },
            { type: 'public-key', alg: -257 },
          ],
          timeout: 60_000,
          attestation: 'none',
          authenticatorSelection: { residentKey: 'required', userVerification: 'preferred' },
          // The device refuses a second passkey for an account it already holds one for.
          excludeCredentials: passkeys(who).map((p) => ({ type: 'public-key', id: p.credentialId })),
        },
      });
    }
    if (path === '/passkeys/registration/verify') {
      const { credential } = (body ?? {}) as { credential?: { id?: string } };
      const credentialId = credential?.id ?? '';
      if (owners.has(credentialId)) return reply(route, 422, { error_code: 'webauthn_credential_exists', msg: 'Passkey exists' });
      // No friendly name: the app shows "Passkey".
      const added: MockPasskey = { id: randomUUID(), created_at: new Date().toISOString(), credentialId };
      passkeysOf.set(who, [...passkeys(who), added]);
      owners.set(credentialId, who);
      return reply(route, 200, listedPasskey(added));
    }
    if (path === '/passkeys' && request.method() === 'GET') return reply(route, 200, passkeys(who).map(listedPasskey));
    const passkeyPath = path.match(/^\/passkeys\/([0-9a-f-]{36})$/);
    if (passkeyPath !== null && request.method() === 'DELETE') {
      const gone = passkeys(who).find((p) => p.id === passkeyPath[1]);
      if (gone === undefined) return reply(route, 404, { error_code: 'passkey_not_found', msg: 'Passkey not found' });
      passkeysOf.set(who, passkeys(who).filter((p) => p !== gone));
      owners.delete(gone.credentialId);
      return reply(route, 200, {});
    }
    if (path === '/factors' && request.method() === 'POST') {
      // Without an issuer from the app, the account server names the authenticator entry after the site's host.
      const { friendly_name: name = '', issuer = 'localhost' } = (body ?? {}) as { friendly_name?: string; issuer?: string };
      if (factors(who).some((f) => f.friendly_name === name)) {
        return reply(route, 422, { error_code: 'mfa_factor_name_conflict', msg: 'A factor with this name exists' });
      }
      // Unique across pages, which may share the account's factors.
      const factor: MockFactor = { id: `factor-${randomUUID()}`, friendly_name: name, factor_type: 'totp', status: 'unverified' };
      factorsOf.set(who, [...factors(who), factor]);
      const svg = '<svg xmlns="http://www.w3.org/2000/svg" width="8" height="8"><rect width="8" height="8" fill="#000"/></svg>';
      return reply(route, 200, {
        id: factor.id,
        type: 'totp',
        friendly_name: name,
        totp: {
          qr_code: svg,
          secret: E2E_TOTP_SECRET,
          uri: `otpauth://totp/${encodeURIComponent(issuer)}:${encodeURIComponent(who)}?secret=${E2E_TOTP_SECRET}&issuer=${encodeURIComponent(issuer)}`,
        },
      });
    }
    const factorPath = path.match(/^\/factors\/([^/]+)(\/challenge|\/verify)?$/);
    const factor = factorPath === null ? undefined : factors(who).find((f) => f.id === factorPath[1]);
    if (factorPath !== null && factor === undefined) {
      return reply(route, 404, { error_code: 'mfa_factor_not_found', msg: 'Factor not found' });
    }
    if (factorPath !== null && factor !== undefined) {
      if (factorPath[2] === '/challenge') {
        return reply(route, 200, { id: `challenge-${factor.id}`, type: 'totp', expires_at: Math.floor(Date.now() / 1000) + 300 });
      }
      if (factorPath[2] === '/verify') {
        const { code } = (body ?? {}) as { code?: string };
        if (code !== E2E_TOTP_CODE) {
          return reply(route, 422, { error_code: 'mfa_verification_failed', msg: 'Invalid TOTP code entered' });
        }
        factor.status = 'verified';
        return reply(route, 200, signedIn(who, 'aal2', [...new Set([...currentMethods, 'totp'])]));
      }
      if (request.method() === 'DELETE') {
        // A confirmed authenticator can only be removed by a session that gave its code.
        if (factor.status === 'verified' && currentAal !== 'aal2') {
          return reply(route, 403, { error_code: 'insufficient_aal', msg: 'AAL2 required' });
        }
        factorsOf.set(who, factors(who).filter((f) => f.id !== factor.id));
        return reply(route, 200, { id: factor.id });
      }
    }
    return reply(route, 404, { error_code: 'not_found', msg: `No mock for ${path}` });
  });

  return calls;
}

/** Every call to the account's tables (PostgREST). Matched by path, like the auth calls. */
export const SUPABASE_REST = '**/rest/v1/**';

/** The account's tables as the mock keeps them: table → id → the row's data, null for a tombstone. */
export type ServerTables = Map<string, Map<string, unknown>>;

/** A phone's weekly reminder as `save_push_subscription` got it (the weekly reminder), and whose it is. */
export type ReminderRow = {
  user: string;
  p_endpoint: string;
  p_p256dh: string;
  p_auth: string;
  p_weekday: number;
  p_local_time: string;
  p_time_zone: string;
  p_lang: string;
};

/** The weekly reminders (`push_subscriptions`), by push address. */
export type ServerReminders = Map<string, ReminderRow>;

/** Each account's posting name (`public_profiles`, the hacks feed), by user id (`e2eUserIdOf`). */
export type ServerProfiles = Map<string, { username: string; label: string | null; batch: number | null }>;

/** One row of `moderation_queue`, as the database returns it to the moderator. */
export type QueueRow = {
  id: string;
  body: string;
  city: 'regensburg' | 'anywhere';
  category: string;
  link: string | null;
  lang: string;
  created_at: string;
  username: string | null;
  reports: number;
  reports_since_kept: number;
  hidden_by_hand: boolean;
  hidden_by_reports: boolean;
  kept_at: string | null;
  last_report: string | null;
};

/** One row of `hacks_feed` (the hacks feed), as the database returns it to the signed-in account. */
export type FeedRow = {
  id: string;
  body: string;
  city: 'regensburg' | 'anywhere';
  category: string;
  link: string | null;
  lang: string;
  created_at: string;
  username: string | null;
  label: string | null;
  batch: number | null;
  mine: boolean;
  ups: number;
  worked: number;
  outdated: number;
  my_up: boolean;
  my_verdict: 'worked' | 'outdated' | null;
};

/** One comment as the mock keeps it (community, chunk 2): `comments_for`'s row, with the post it is on. */
export type CommentRow = {
  id: string;
  hack_id: string;
  body: string;
  lang: string;
  created_at: string;
  username: string | null;
  label: string | null;
  batch: number | null;
  mine: boolean;
};

/** One row of `comment_queue` (community, chunk 3), as the database returns it. */
export type CommentQueueRow = {
  id: string;
  hack_id: string;
  body: string;
  lang: string;
  created_at: string;
  username: string | null;
  reports: number;
  reports_since_kept: number;
  hidden_by_hand: boolean;
  hidden_by_reports: boolean;
  kept_at: string | null;
  last_report: string | null;
};

/** One discount a student added (community, chunk 5): `community_discounts_feed`'s row, as the database returns it. */
export type StudentDiscountRow = {
  id: string;
  place: string;
  address: string | null;
  offer: string;
  conditions: string | null;
  category: string;
  link: string;
  lang: string;
  created_at: string;
  username: string | null;
  label: string | null;
  batch: number | null;
  mine: boolean;
};

/** The claims of the mocked session that sent a request. */
function claimsOf(request: Request): { sub?: string; aal?: string } {
  const token = (request.headers()['authorization'] ?? '').replace(/^Bearer /, '');
  return JSON.parse(Buffer.from(token.split('.')[1] ?? '', 'base64url').toString() || '{}') as { sub?: string; aal?: string };
}

/**
 * Each row's revision, as the database's stamp_sync trigger keeps it, per account (the tables object): the user's
 * next revision on every write. A row a spec seeds straight into the tables gets one when a pull first sees it.
 */
const revisions = new WeakMap<ServerTables, { last: number; of: Map<string, number> }>();

function revisionsOf(tables: ServerTables) {
  let kept = revisions.get(tables);
  if (kept === undefined) {
    kept = { last: 0, of: new Map() };
    revisions.set(tables, kept);
  }
  return kept;
}

function stampRevision(tables: ServerTables, table: string, id: string): number {
  const kept = revisionsOf(tables);
  kept.last += 1;
  kept.of.set(`${table}/${id}`, kept.last);
  return kept.last;
}

function revisionOf(tables: ServerTables, table: string, id: string): number {
  return revisionsOf(tables).of.get(`${table}/${id}`) ?? stampRevision(tables, table, id);
}

/**
 * Answers the account's tables like PostgREST does for one signed-in user: read ids or whole rows (by id, a page at a
 * time after the last id, tombstones left out when asked), upsert rows, a tombstone being a row with data null, and
 * pull every change after a revision (`rpc/sync_pull`, revisions kept per account). A hard delete is refused, as the
 * database refuses it. A call without the mocked session's token gets 401, as row-level
 * security would refuse it, so a spec cannot pass while the app sends its calls signed out. `failWith` makes every call
 * answer with that status instead. `tables` shares the account with another page, a second phone. `rpc/delete_my_account`
 * (P2.5) empties the tables; with `twoStep`, the account has two-step sign-in, so only a token at aal2 may, as the
 * database wants. `rpc/linked_account_exists` says yes for every user id but those in `gone` (deleted accounts, which a
 * spec may add to as it runs). `rpc/discount_confirmations` (P2.6) answers `confirmations`, other students' totals,
 * as the database returns them (none by default). `profiles` holds the accounts' posting names (the hacks feed): each
 * signed-in account reads and saves only its own, a username another account has is refused (23505), and
 * `rpc/username_available`, which answers signed out too, says whether any of them has a name. `rpc/hacks_feed`
 * answers `feed`, the posts as the database returns them (none by default); `rpc/post_hack` adds to it (an account in
 * `profiles` only, and none with `dailyLimit`), `rpc/delete_hack` takes one's own post out, `rpc/vote_hack` moves a
 * post's totals and `rpc/report_hack` takes it out, as for the reporter. `moderator` makes the account the app's
 * moderator: `rpc/moderation_queue` answers `queue` and `rpc/moderate_hack` changes it, at aal2 only. Comments
 * (community, chunk 2) are kept in `comments`: `rpc/comments_for` answers a post's, oldest first, `rpc/comment_counts`
 * counts them for the posts in `feed`, `rpc/post_comment` adds one (a username first, a post in `feed`, none with
 * `commentLimit`), `rpc/delete_comment` takes one's own out and `rpc/report_comment` takes another's out. For the
 * moderator, `rpc/comment_queue` answers `commentQueue` and `rpc/moderate_comment` changes it, at aal2 only. The
 * discounts students added (community, chunk 5) are kept in `studentDiscounts`: `rpc/community_discounts_feed` answers
 * them, `rpc/delete_discount` takes one's own out and `rpc/report_discount` takes another's out.
 * `rpc/save_push_subscription` keeps a phone's weekly reminder in `reminders` by its address (with `twoStep`, at aal2
 * only), and a delete of `push_subscriptions` by `endpoint` takes the owner's row out. Returns the tables, to look at
 * and to seed.
 */
export async function mockSupabaseData(
  page: Page,
  options: {
    failWith?: number;
    tables?: ServerTables;
    twoStep?: boolean;
    gone?: ReadonlySet<string>;
    profiles?: ServerProfiles;
    feed?: FeedRow[];
    dailyLimit?: boolean;
    comments?: CommentRow[];
    commentLimit?: boolean;
    studentDiscounts?: StudentDiscountRow[];
    moderator?: boolean;
    queue?: QueueRow[];
    commentQueue?: CommentQueueRow[];
    reminders?: ServerReminders;
    confirmations?: { discount_id: string; last_works: string | null; works_since: number; outdated_since: number }[];
  } = {},
): Promise<ServerTables> {
  const tables: ServerTables = options.tables ?? new Map();
  const profiles: ServerProfiles = options.profiles ?? new Map();
  const feed: FeedRow[] = options.feed ?? [];
  const comments: CommentRow[] = options.comments ?? [];
  const studentDiscounts: StudentDiscountRow[] = options.studentDiscounts ?? [];
  const reminders: ServerReminders = options.reminders ?? new Map();
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

    // username_available: asked signed out too, before a sign-up. Free unless an account in `profiles` has it.
    if (request.url().includes('/rest/v1/rpc/username_available') && request.method() === 'POST') {
      const { p_username: wanted } = request.postDataJSON() as { p_username: string };
      const taken = [...profiles.values()].some((profile) => profile.username === wanted);
      return route.fulfill({ status: 200, headers: CORS, json: !taken });
    }

    if (!(request.headers()['authorization'] ?? '').endsWith(SESSION_SIGNATURE)) {
      return route.fulfill({ status: 401, headers: CORS, json: { code: 'PGRST301', message: 'not signed in' } });
    }

    const url = new URL(request.url());
    const path = url.pathname.replace(/^.*\/rest\/v1\//, '');
    // delete_my_account: the account and every row go. An account with two-step sign-in needs the code given (aal2).
    if (path === 'rpc/delete_my_account' && request.method() === 'POST') {
      if (options.twoStep && claimsOf(request).aal !== 'aal2') {
        return route.fulfill({ status: 403, headers: CORS, json: { code: '42501', message: 'the second step is owed' } });
      }
      tables.clear();
      return route.fulfill({ status: 204, headers: CORS });
    }
    // save_push_subscription (the weekly reminder): this phone's row, by its address, for whoever saves it.
    if (path === 'rpc/save_push_subscription' && request.method() === 'POST') {
      if (options.twoStep && claimsOf(request).aal !== 'aal2') {
        return route.fulfill({ status: 403, headers: CORS, json: { code: '42501', message: 'the second step is owed' } });
      }
      const sent = request.postDataJSON() as Omit<ReminderRow, 'user'>;
      reminders.set(sent.p_endpoint, { user: claimsOf(request).sub ?? '', ...sent });
      return route.fulfill({ status: 204, headers: CORS });
    }
    // push_subscriptions: the owner deletes a phone's reminder by its address.
    if (path === 'push_subscriptions' && request.method() === 'DELETE') {
      const endpoint = url.searchParams.get('endpoint')?.replace(/^eq\./, '') ?? '';
      if (reminders.get(endpoint)?.user === claimsOf(request).sub) reminders.delete(endpoint);
      return route.fulfill({ status: 204, headers: CORS });
    }
    // public_profiles: each account reads and writes only its own posting name. A username another account has is
    // refused as the unique index would refuse it (23505). The sign-up trigger isn't played: seed `profiles` instead.
    if (path === 'public_profiles') {
      const me = claimsOf(request).sub ?? '';
      if (request.method() === 'GET') {
        const own = profiles.get(me);
        return route.fulfill({ status: 200, headers: CORS, json: own ? [own] : [] });
      }
      if (request.method() === 'POST') {
        const sent = request.postDataJSON() as { username: string; label?: string | null; batch?: number | null };
        const row = Array.isArray(sent) ? (sent[0] as typeof sent) : sent;
        if ([...profiles].some(([user, profile]) => user !== me && profile.username === row.username)) {
          return route.fulfill({ status: 409, headers: CORS, json: { code: '23505', message: 'duplicate key value' } });
        }
        profiles.set(me, { username: row.username, label: row.label ?? null, batch: row.batch ?? null });
        return route.fulfill({ status: 201, headers: CORS });
      }
    }
    // Comments (community, chunk 2), on the posts in `feed`.
    if (path === 'rpc/comment_counts' && request.method() === 'POST') {
      const counts = new Map<string, number>();
      for (const comment of comments) {
        if (feed.some((post) => post.id === comment.hack_id)) counts.set(comment.hack_id, (counts.get(comment.hack_id) ?? 0) + 1);
      }
      return route.fulfill({ status: 200, headers: CORS, json: [...counts].map(([hackId, n]) => ({ hack_id: hackId, comments: n })) });
    }
    if (path === 'rpc/comments_for' && request.method() === 'POST') {
      const { p_hack_id: hackId } = request.postDataJSON() as { p_hack_id: string };
      const json = comments
        .filter((comment) => comment.hack_id === hackId && feed.some((post) => post.id === hackId))
        .map(({ id, body, lang, created_at, username, label, batch, mine }) => ({ id, body, lang, created_at, username, label, batch, mine }));
      return route.fulfill({ status: 200, headers: CORS, json });
    }
    if (['rpc/post_comment', 'rpc/delete_comment', 'rpc/report_comment'].includes(path) && request.method() === 'POST') {
      const refuse = (hint: string) =>
        route.fulfill({ status: 400, headers: CORS, json: { code: 'P0001', message: hint, hint, details: null } });
      if (path === 'rpc/post_comment') {
        const sent = request.postDataJSON() as { p_hack_id: string; p_body: string; p_lang: string };
        const profile = profiles.get(claimsOf(request).sub ?? '');
        if (profile === undefined) return refuse('needs-username');
        if (!feed.some((post) => post.id === sent.p_hack_id)) return refuse('not-found');
        if (options.commentLimit) return refuse('daily-limit');
        if (sent.p_body.length < 3 || sent.p_body.length > 300) {
          return route.fulfill({ status: 400, headers: CORS, json: { code: '23514', message: 'check violation' } });
        }
        const id = randomUUID();
        comments.push({
          id,
          hack_id: sent.p_hack_id,
          body: sent.p_body,
          lang: sent.p_lang,
          created_at: new Date().toISOString(),
          username: profile.username,
          label: profile.label,
          batch: profile.batch,
          mine: true,
        });
        return route.fulfill({ status: 200, headers: CORS, json: id });
      }
      const { p_id: id } = request.postDataJSON() as { p_id: string };
      const at = comments.findIndex((comment) => comment.id === id);
      if (path === 'rpc/delete_comment') {
        if (at < 0 || !comments[at].mine) return refuse('not-found');
      } else {
        if (at < 0) return refuse('not-found');
        if (comments[at].mine) return refuse('own-post');
      }
      comments.splice(at, 1);
      return route.fulfill({ status: 204, headers: CORS });
    }
    if (path === 'rpc/community_discounts_feed' && request.method() === 'POST') {
      return route.fulfill({ status: 200, headers: CORS, json: studentDiscounts });
    }
    if ((path === 'rpc/delete_discount' || path === 'rpc/report_discount') && request.method() === 'POST') {
      const refuse = (hint: string) =>
        route.fulfill({ status: 400, headers: CORS, json: { code: 'P0001', message: hint, hint, details: null } });
      const { p_id: id } = request.postDataJSON() as { p_id: string };
      const at = studentDiscounts.findIndex((discount) => discount.id === id);
      if (path === 'rpc/delete_discount') {
        if (at < 0 || !studentDiscounts[at].mine) return refuse('not-found');
      } else {
        if (at < 0) return refuse('not-found');
        if (studentDiscounts[at].mine) return refuse('own-post');
      }
      studentDiscounts.splice(at, 1);
      return route.fulfill({ status: 204, headers: CORS });
    }
    // hacks_feed: the posts the signed-in account may see (the hacks feed), as given in `feed`.
    if (path === 'rpc/hacks_feed' && request.method() === 'POST') {
      return route.fulfill({ status: 200, headers: CORS, json: feed });
    }
    // post_hack: a username first (else hint 'needs-username'), `dailyLimit` refuses (hint 'daily-limit'), and the
    // table's length check (23514). The post joins `feed` first, as the signed-in account's own.
    if (path === 'rpc/post_hack' && request.method() === 'POST') {
      const sent = request.postDataJSON() as {
        p_body: string;
        p_city: FeedRow['city'];
        p_category: string;
        p_link: string | null;
        p_lang: string;
      };
      const profile = profiles.get(claimsOf(request).sub ?? '');
      const refuse = (hint: string) =>
        route.fulfill({ status: 400, headers: CORS, json: { code: 'P0001', message: hint, hint, details: null } });
      if (profile === undefined) return refuse('needs-username');
      if (options.dailyLimit) return refuse('daily-limit');
      if (sent.p_body.length < 10 || sent.p_body.length > 500) {
        return route.fulfill({ status: 400, headers: CORS, json: { code: '23514', message: 'check violation' } });
      }
      const id = randomUUID();
      feed.unshift({
        id,
        body: sent.p_body,
        city: sent.p_city,
        category: sent.p_category,
        link: sent.p_link,
        lang: sent.p_lang,
        created_at: new Date().toISOString(),
        username: profile.username,
        label: profile.label,
        batch: profile.batch,
        mine: true,
        ups: 0,
        worked: 0,
        outdated: 0,
        my_up: false,
        my_verdict: null,
      });
      return route.fulfill({ status: 200, headers: CORS, json: id });
    }
    // vote_hack: the whole vote on someone else's post moves its totals (one's own: hint 'own-post'; a post not in
    // `feed`: hint 'not-found'). report_hack: the post leaves `feed`, as it leaves the reporter's list.
    if ((path === 'rpc/vote_hack' || path === 'rpc/report_hack') && request.method() === 'POST') {
      const sent = request.postDataJSON() as { p_id: string; p_up?: boolean; p_verdict?: FeedRow['my_verdict'] };
      const at = feed.findIndex((row) => row.id === sent.p_id);
      const refuse = (hint: string) =>
        route.fulfill({ status: 400, headers: CORS, json: { code: 'P0001', message: hint, hint, details: null } });
      if (at < 0) return refuse('not-found');
      const row = feed[at];
      if (row.mine) return refuse('own-post');
      if (path === 'rpc/report_hack') {
        feed.splice(at, 1);
        return route.fulfill({ status: 204, headers: CORS });
      }
      const up = sent.p_up === true;
      const verdict = sent.p_verdict ?? null;
      const step = (was: boolean, is: boolean) => (is === was ? 0 : is ? 1 : -1);
      row.ups += step(row.my_up, up);
      row.worked += step(row.my_verdict === 'worked', verdict === 'worked');
      row.outdated += step(row.my_verdict === 'outdated', verdict === 'outdated');
      row.my_up = up;
      row.my_verdict = verdict;
      return route.fulfill({ status: 204, headers: CORS });
    }
    // am_i_moderator: `moderator`. moderation_queue and moderate_hack: the moderator only, at aal2 (42501 with the
    // database's messages otherwise); 'hide' hides a `queue` row by hand, 'keep' shows it again and zeroes its reports.
    if (path === 'rpc/am_i_moderator' && request.method() === 'POST') {
      return route.fulfill({ status: 200, headers: CORS, json: options.moderator === true });
    }
    // The posts' queue (`queue`) and the comments' (`commentQueue`, community, chunk 3): the moderator at aal2 only.
    const queueOf = { 'rpc/moderation_queue': 'posts', 'rpc/moderate_hack': 'posts', 'rpc/comment_queue': 'comments', 'rpc/moderate_comment': 'comments' } as const;
    if (path in queueOf && request.method() === 'POST') {
      const refuse = (message: string) =>
        route.fulfill({ status: 403, headers: CORS, json: { code: '42501', message, hint: null, details: null } });
      if (options.moderator !== true) return refuse('not a moderator');
      if (claimsOf(request).aal !== 'aal2') return refuse('the second step is owed');
      const queue: (QueueRow | CommentQueueRow)[] =
        queueOf[path as keyof typeof queueOf] === 'posts' ? (options.queue ?? []) : (options.commentQueue ?? []);
      if (path === 'rpc/moderation_queue' || path === 'rpc/comment_queue') {
        return route.fulfill({ status: 200, headers: CORS, json: queue });
      }
      const { p_id: id, p_action: action } = request.postDataJSON() as { p_id: string; p_action: 'hide' | 'keep' };
      const item = queue.find((row) => row.id === id);
      if (item === undefined) {
        const json = { code: 'P0001', message: 'not-found', hint: 'not-found' };
        return route.fulfill({ status: 400, headers: CORS, json });
      }
      item.hidden_by_hand = action === 'hide';
      if (action === 'keep') {
        item.hidden_by_reports = false;
        item.reports_since_kept = 0;
        item.kept_at = new Date().toISOString();
      }
      return route.fulfill({ status: 204, headers: CORS });
    }
    // delete_hack: the signed-in account's own post leaves `feed`; any other is refused (hint 'not-found').
    if (path === 'rpc/delete_hack' && request.method() === 'POST') {
      const { p_id: id } = request.postDataJSON() as { p_id: string };
      const at = feed.findIndex((row) => row.id === id && row.mine);
      if (at < 0) {
        const json = { code: 'P0001', message: 'not-found', hint: 'not-found' };
        return route.fulfill({ status: 400, headers: CORS, json });
      }
      feed.splice(at, 1);
      return route.fulfill({ status: 204, headers: CORS });
    }
    // discount_confirmations: other students' totals per discount, since the date asked.
    if (path === 'rpc/discount_confirmations' && request.method() === 'POST') {
      return route.fulfill({ status: 200, headers: CORS, json: options.confirmations ?? [] });
    }
    // linked_account_exists: whether the account a phone is linked to still exists.
    if (path === 'rpc/linked_account_exists' && request.method() === 'POST') {
      const { p_user_id: userId } = request.postDataJSON() as { p_user_id: string };
      return route.fulfill({ status: 200, headers: CORS, json: !(options.gone?.has(userId) ?? false) });
    }
    // sync_pull: every row written after a revision, from every table, tombstones included, in revision order.
    if (path === 'rpc/sync_pull' && request.method() === 'POST') {
      const { p_since: since, p_limit: limit } = request.postDataJSON() as { p_since: number; p_limit: number };
      const changes = [...tables].flatMap(([tbl, rows]) =>
        [...rows.keys()].map((id) => ({ tbl, id, data: rows.get(id), rev: revisionOf(tables, tbl, id) })),
      );
      const json = changes
        .filter((change) => change.rev > since)
        .sort((a, b) => a.rev - b.rev)
        .slice(0, limit)
        .map((change) => ({ ...change, deleted_at: change.data === null ? new Date().toISOString() : null }));
      return route.fulfill({ status: 200, headers: CORS, json });
    }
    const rows = table(path);
    if (request.method() === 'GET') {
      const after = url.searchParams.get('id')?.match(/^gt\.(.*)$/)?.[1] ?? null;
      // `id=in.(a,b)`: these ids only, tombstones included unless asked otherwise.
      const only = url.searchParams.get('id')?.match(/^in\.\((.*)\)$/)?.[1]?.split(',').map((id) => id.replace(/^"|"$/g, ''));
      const limit = Number(url.searchParams.get('limit') ?? 1000);
      const liveOnly = url.searchParams.get('deleted_at') === 'is.null';
      const ids = [...rows.keys()]
        .sort()
        .filter((id) => after === null || id > after)
        .filter((id) => only === undefined || only.includes(id))
        .filter((id) => !liveOnly || rows.get(id) !== null)
        .slice(0, limit);
      const columns = url.searchParams.get('select') ?? '';
      const json = ids.map((id) => ({
        id,
        ...(columns.includes('data') ? { data: rows.get(id) } : {}),
        ...(columns.includes('rev') ? { rev: revisionOf(tables, path, id) } : {}),
      }));
      return route.fulfill({ status: 200, headers: CORS, json });
    }
    if (request.method() === 'POST') {
      // `resolution=ignore-duplicates` (insert-only, the poster's rows): a row the account has, a tombstone too, stays.
      const prefer = request.headers()['prefer'] ?? '';
      const ignoreDuplicates = prefer.includes('resolution=ignore-duplicates');
      const added: { id: string }[] = [];
      for (const row of request.postDataJSON() as { id: string; data: unknown }[]) {
        if (ignoreDuplicates && rows.has(row.id)) continue;
        rows.set(row.id, row.data);
        stampRevision(tables, path, row.id);
        added.push({ id: row.id });
      }
      // `return=representation` (a select after the write): the rows written, as PostgREST's RETURNING gives them.
      if (prefer.includes('return=representation')) return route.fulfill({ status: 201, headers: CORS, json: added });
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
 * Signs out from Settings → Your account, in English (06-11-2026): the question, the last sync, then the phone is
 * cleared and the start page opens.
 */
export async function signOut(page: Page) {
  await page.getByRole('button', { name: 'Sign out', exact: true }).click();
  await expect(page.getByText('Sign out of this phone?', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Sign out', exact: true }).click();
  await expect(page).toHaveURL('/start');
  await waitForApp(page);
}

/**
 * The session runs out on this phone, as an expired one does: it is dropped from storage (AUTH_STORAGE_KEY in
 * src/lib/supabase/client.ts) and the account page opens again. Unlike signing out, the data and the link stay.
 */
export async function endSession(page: Page) {
  await page.evaluate(() => localStorage.removeItem('studentsbudget-auth'));
  await openApp(page, '/settings/account');
}

/** "Accounts aren't set up in this copy of the app…" in every language: a spec may run under any locale. */
const ACCOUNTS_OFF = Object.values(MESSAGES).map((messages) => messages.auth.view.off);

/**
 * Skips the spec when the server shows no account UI: Playwright reused a server that was started without the
 * Supabase settings. Stop that server, or run on another port (E2E_PORT=3201), to run the spec.
 *
 * Whatever the phone's language: the page prerenders in English and switches to the phone's language right after it
 * hydrates, so a check for the English heading missed a German phone once the production build switched that fast.
 */
export async function skipUnlessAccountsShow(page: Page) {
  await openApp(page, '/settings/account');
  await expect(page.locator('h2[data-page-heading]')).toBeVisible();
  // Without settings the view starts 'off', never 'loading', so the text is there once the app has started.
  let isOff = false;
  for (const text of ACCOUNTS_OFF) isOff ||= (await page.getByText(text).count()) > 0;
  test.skip(isOff, 'The reused server has no Supabase settings: stop it, or run with E2E_PORT=3201.');
}

/**
 * Gives a Chromium page a device that makes and keeps passkeys and says yes on its own, as Face ID would: Chrome's
 * virtual authenticator, through the DevTools protocol. WebKit has nothing like it, so passkey specs run on Chromium.
 */
export async function addVirtualAuthenticator(page: Page) {
  const devtools = await page.context().newCDPSession(page);
  await devtools.send('WebAuthn.enable');
  await devtools.send('WebAuthn.addVirtualAuthenticator', {
    options: {
      protocol: 'ctap2',
      transport: 'internal',
      hasResidentKey: true,
      hasUserVerification: true,
      isUserVerified: true,
      automaticPresenceSimulation: true,
    },
  });
}
