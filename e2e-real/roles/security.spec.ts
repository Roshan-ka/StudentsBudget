import type { APIRequestContext } from '@playwright/test';
import { postHack, readBack, rest, type SecondFactor, type TestUser } from '../adapter';
import { expect, test } from '../fixtures';

type MakeUser = (options: { secondFactor: SecondFactor; username?: boolean }) => Promise<TestUser>;

// Security basics against the real database, request-only (the matrix's server cells with subject other-user, and
// signed out): someone signed out reaches no account table and no moderator check; one student reads, changes,
// deletes and adds nothing of another's; and a post can be deleted only by its author. Row-level security answers a
// refused read or change with nothing in it (200 or 204), so a refused write is checked by reading the row back as its
// owner. One proof per test: a test stops at its first failure, so each proof needs a test of its own.

const REFUSED = [401, 403];
const statusOf = (what: string, status: number) => `${what} answered ${status}`;

test('signed out, the account tables are refused', async ({ request }) => {
  const read = await rest(request, null, 'get', 'plans?select=id');
  expect(REFUSED, statusOf('reading plans signed out', read.status())).toContain(read.status()); // proof: anon-read
});

test('signed out, the moderator check is refused', async ({ request }) => {
  const ask = await rest(request, null, 'post', 'rpc/am_i_moderator', {});
  expect(REFUSED, statusOf('am_i_moderator signed out', ask.status())).toContain(ask.status()); // proof: anon-rpc
});

/** Student A with one plan row, and student B, who must not reach it. */
async function twoStudents(makeUser: MakeUser, request: APIRequestContext) {
  const a = await makeUser({ secondFactor: 'none' });
  const b = await makeUser({ secondFactor: 'none' });
  const id = `cross-user-${Date.now().toString(36)}`;
  const made = await rest(request, a.session.access_token, 'post', 'plans', { id, data: { owner: 'a' } });
  expect(made.ok(), statusOf('A adding a plan row', made.status())).toBe(true);
  return { a, b, id, original: await readBack(request, a, 'plans') };
}

test("one student can't read another's rows", async ({ request, makeUser }) => {
  const { b, id } = await twoStudents(makeUser, request);
  const read = await rest(request, b.session.access_token, 'get', `plans?id=eq.${id}&select=*`);
  expect(await read.json(), "B reading A's plan row").toEqual([]); // proof: other-read
});

test("one student can't change another's rows", async ({ request, makeUser }) => {
  const { a, b, id, original } = await twoStudents(makeUser, request);
  await rest(request, b.session.access_token, 'patch', `plans?id=eq.${id}`, { data: { owner: 'b' } });
  expect(await readBack(request, a, 'plans'), "A's rows after B tried to change one").toEqual(original); // proof: other-change
});

test("one student can't delete another's rows", async ({ request, makeUser }) => {
  const { a, b, id, original } = await twoStudents(makeUser, request);
  await rest(request, b.session.access_token, 'delete', `plans?id=eq.${id}`);
  expect(await readBack(request, a, 'plans'), "A's rows after B tried to delete one").toEqual(original); // proof: other-delete
});

test("one student can't add a row to another's account", async ({ request, makeUser }) => {
  const { a, b, id } = await twoStudents(makeUser, request);
  const added = await rest(request, b.session.access_token, 'post', 'plans', { user_id: a.session.user?.id, id: `${id}-b`, data: { owner: 'b' } });
  expect(REFUSED, statusOf("B adding a row for A", added.status())).toContain(added.status()); // proof: other-insert
});

test("one student can't delete another's post", async ({ request, makeUser }) => {
  const author = await makeUser({ secondFactor: 'none', username: true });
  const other = await makeUser({ secondFactor: 'none' });
  const post = await postHack(request, author, `A post nobody else may delete, ${Date.now().toString(36)}`);
  const response = await rest(request, other.session.access_token, 'post', 'rpc/delete_hack', { p_id: post });
  const answer = JSON.parse((await response.text()) || '{}') as { hint?: string };
  expect(answer.hint, statusOf("B deleting A's post", response.status())).toBe('not-found'); // proof: other-post
});
