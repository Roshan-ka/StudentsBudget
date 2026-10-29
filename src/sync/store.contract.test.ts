import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { beforeAll, describe, expect, it } from 'vitest';
import { newId } from '@/lib/new-id';
import { supabaseStore } from './store';
import { totpCode } from './totp';

// The app's account store against a real Supabase stack: the local one that `npm run supabase:start` and the CI `db`
// job run, with the migrations applied. The e2e specs mock PostgREST; this checks that what the store sends is what
// the real API and database answer, and that two-step sign-in holds there: a password alone changes no authenticator
// and reads no row. Runs only with SUPABASE_TEST_URL and SUPABASE_TEST_KEY set (`npm run test:contract`; `node
// scripts/supabase-test-env.mjs` prints them), and is skipped in `npm test` otherwise.

const STACK_URL = process.env.SUPABASE_TEST_URL;
const STACK_KEY = process.env.SUPABASE_TEST_KEY;

const PASSWORD = 'contract-test-password';

/** One row of a pull, as sync_pull returns it. */
type Change = { tbl: string; id: string; data: unknown; deleted_at: string | null; rev: number };

/** A new user, signed in. The local stack lets anyone sign up, with no email confirmation (supabase/config.toml). */
async function newUser(email = `contract-${newId()}@example.com`): Promise<SupabaseClient> {
  const client = createClient(STACK_URL ?? '', STACK_KEY ?? '', {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await client.auth.signUp({ email, password: PASSWORD });
  if (error || !data.session) throw error ?? new Error('sign-up gave no session');
  return client;
}

/** Every change of the client's user after `since`, a page of `limit` at a time, as the app will pull them. */
async function pullAll(client: SupabaseClient, since: number, limit: number): Promise<Change[]> {
  const all: Change[] = [];
  for (let after = since; ; ) {
    const { data, error } = await client.rpc('sync_pull', { p_since: after, p_limit: limit });
    if (error) throw error;
    const page = data as Change[];
    if (page.length === 0) return all;
    all.push(...page);
    after = page[page.length - 1].rev;
  }
}

const ids = Array.from({ length: 2500 }, (_, i) => `c${String(i).padStart(4, '0')}`);

describe.runIf(Boolean(STACK_URL && STACK_KEY))('the account store against a real Supabase stack', () => {
  let a: SupabaseClient;
  let b: SupabaseClient;

  beforeAll(async () => {
    a = await newUser();
    b = await newUser();
  }, 30_000);

  it('writes 2,500 rows and reads every one back, across pages', async () => {
    const store = supabaseStore(a);
    await store.upsert(
      'entries',
      ids.map((id, n) => ({ id, data: { n } })),
    );
    expect([...(await store.listIds('entries'))].sort()).toEqual(ids);
    const rows = await store.listRows('entries');
    expect(rows).toHaveLength(2500);
    expect(rows.find((row) => row.id === 'c1234')?.data).toEqual({ n: 1234 });
    // Writing the same rows again changes nothing about what is there.
    await store.upsert('entries', [{ id: 'c1234', data: { n: 1234 } }]);
    expect(await store.listIds('entries')).toHaveLength(2500);
  }, 60_000);

  it('writes tombstones that reads leave out, and brings a row back when it is written again', async () => {
    const store = supabaseStore(a);
    await store.tombstone('entries', ids.slice(0, 100));
    const left = await store.listIds('entries');
    expect(left).toHaveLength(2400);
    expect(left).not.toContain('c0000');
    // An id the account never had gets a tombstone, which reads leave out.
    await store.tombstone('entries', ['never-saved']);
    expect(await store.listIds('entries')).not.toContain('never-saved');

    await store.upsert('entries', [{ id: 'c0000', data: { n: 0, back: true } }]);
    expect(await store.listIds('entries')).toContain('c0000');
    expect((await store.listRows('entries')).find((row) => row.id === 'c0000')?.data).toEqual({ n: 0, back: true });
  }, 60_000);

  it('refuses a hard delete', async () => {
    const { error } = await a.from('entries').delete().eq('id', 'c1000');
    expect(error?.code).toBe('42501');
    expect(await supabaseStore(a).listIds('entries')).toContain('c1000');
  });

  it('pulls every change after a revision, oldest first, with the tombstones, page by page', async () => {
    const changes = await pullAll(a, 0, 1000);
    // One change per row: the latest one. The 2,500 rows, of which c0001–c0099 are tombstones, and the tombstone of
    // never-saved, the id the account never had.
    expect(changes.map((c) => c.id).sort()).toEqual([...ids, 'never-saved']);
    const revs = changes.map((c) => c.rev);
    expect(revs).toEqual([...revs].sort((x, y) => x - y));
    expect(new Set(revs).size).toBe(revs.length);
    const tombstones = changes.filter((c) => c.data === null);
    expect(tombstones.map((c) => c.id).sort()).toEqual([...ids.slice(1, 100), 'never-saved']);
    expect(tombstones.every((c) => c.deleted_at !== null && c.tbl === 'entries')).toBe(true);

    // After the last revision there is nothing; a new write shows up on its own.
    const last = revs[revs.length - 1];
    expect(await pullAll(a, last, 1000)).toEqual([]);
    await supabaseStore(a).upsert('entries', [{ id: 'c2000', data: { n: 2000, edited: true } }]);
    const next = await pullAll(a, last, 1000);
    expect(next.map((c) => [c.id, c.data])).toEqual([['c2000', { n: 2000, edited: true }]]);
  }, 60_000);

  it("keeps each user to their own rows: B reads, pulls and changes none of A's", async () => {
    const storeB = supabaseStore(b);
    expect(await storeB.listIds('entries')).toEqual([]);
    expect(await pullAll(b, 0, 1000)).toEqual([]);

    // The same id under B is B's own row; A's stays as it was.
    await storeB.upsert('entries', [{ id: 'c0500', data: { owner: 'b' } }]);
    await storeB.tombstone('entries', ['c0600']);
    expect(await storeB.listIds('entries')).toEqual(['c0500']);
    const rowsA = await supabaseStore(a).listRows('entries');
    expect(rowsA.find((row) => row.id === 'c0500')?.data).toEqual({ n: 500 });
    expect(rowsA.find((row) => row.id === 'c0600')?.data).toEqual({ n: 600 });
  }, 60_000);
});

/** The authenticator's code now, once it differs from `used`: the account server may refuse a code given twice. */
async function freshCode(secret: string, used: string): Promise<string> {
  for (;;) {
    const code = totpCode(secret);
    if (code !== used) return code;
    // Into the next 30-second step.
    await new Promise((resolve) => setTimeout(resolve, 30_000 - (Date.now() % 30_000) + 200));
  }
}

describe.runIf(Boolean(STACK_URL && STACK_KEY))('two-step sign-in against a real Supabase stack', () => {
  it('lets a password alone neither add an authenticator nor remove one, and shows it no rows', async () => {
    const email = `contract-${newId()}@example.com`;
    const client = await newUser(email);
    await supabaseStore(client).upsert('entries', [{ id: 'e1', data: { n: 1 } }]);

    // The owner turns two-step sign-in on: an authenticator, confirmed with its first code.
    const enrolled = await client.auth.mfa.enroll({ factorType: 'totp', friendlyName: 'Owner phone' });
    if (enrolled.error) throw enrolled.error;
    const { id: factorId, totp } = enrolled.data;
    const firstCode = totpCode(totp.secret);
    expect((await client.auth.mfa.challengeAndVerify({ factorId, code: firstCode })).error).toBeNull();
    expect((await client.auth.signOut()).error).toBeNull();

    // Someone with the password only signs in: aal1, with the code still owed, and the database shows them nothing.
    expect((await client.auth.signInWithPassword({ email, password: PASSWORD })).error).toBeNull();
    expect((await client.auth.mfa.getAuthenticatorAssuranceLevel()).data).toMatchObject({ currentLevel: 'aal1', nextLevel: 'aal2' });
    expect(await supabaseStore(client).listIds('entries')).toEqual([]);

    // They can't add an authenticator of their own, which would let them give the code ...
    const added = await client.auth.mfa.enroll({ factorType: 'totp', friendlyName: 'Other phone' });
    expect(added.data).toBeNull();
    expect(added.error?.code).toBe('insufficient_aal');
    // ... nor remove the owner's, which would turn the step off.
    const removed = await client.auth.mfa.unenroll({ factorId });
    expect(removed.data).toBeNull();
    expect(removed.error?.code).toBe('insufficient_aal');
    const factors = await client.auth.mfa.listFactors();
    expect(factors.data?.all.map((f) => [f.id, f.status])).toEqual([[factorId, 'verified']]);

    // With a code from the authenticator (aal2), the rows are there.
    const code = await freshCode(totp.secret, firstCode);
    expect((await client.auth.mfa.challengeAndVerify({ factorId, code })).error).toBeNull();
    expect((await client.auth.mfa.getAuthenticatorAssuranceLevel()).data?.currentLevel).toBe('aal2');
    expect(await supabaseStore(client).listIds('entries')).toEqual(['e1']);
  }, 90_000);
});
