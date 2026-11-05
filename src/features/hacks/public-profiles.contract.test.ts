import { describe, expect, it } from 'vitest';
import { newId } from '@/lib/new-id';
import { confirmedUser, MAIL_URL, STACK_KEY, STACK_URL, stackClient } from '@/sync/contract-users';

// The name a student posts under (the hacks feed, chunk 1; docs/superpowers/plans/2026-11-05-hacks-feed.md) against the
// local Supabase stack: sign-up sends a username, label and batch as user metadata, and the database keeps them in
// public_profiles. pgTAP (public_profiles.test.sql) covers the username rule, bad metadata and the grants. Runs with
// `npm run test:contract`.

/** A username of this run only: the local stack keeps earlier runs' users. */
const freshUsername = () => `c_${newId().replaceAll('-', '').slice(0, 12)}`;

type ProfileRow = { username: string; label: string | null; batch: number | null };

async function ownProfile(user: Awaited<ReturnType<typeof confirmedUser>>): Promise<ProfileRow[]> {
  const answer = await user.from('public_profiles').select('username, label, batch');
  expect(answer.error).toBeNull();
  return answer.data as ProfileRow[];
}

describe.runIf(Boolean(STACK_URL && STACK_KEY && MAIL_URL))('posting names against a real Supabase stack (hacks feed)', () => {
  it('keeps the username, label and batch a sign-up asked for, and only for that user', async () => {
    const username = freshUsername();
    const first = await confirmedUser(undefined, { lang: 'en', username, label: 'student', batch: '2027' });
    expect(await ownProfile(first)).toEqual([{ username, label: 'student', batch: 2027 }]);

    // A second sign-up asking for the same name still signs up, but gets no name: the app asks for one later.
    const second = await confirmedUser(undefined, { lang: 'en', username, label: 'graduate' });
    expect(await ownProfile(second)).toEqual([]);
  });

  it('tells anyone, signed out too, whether a username is free, and nothing more', async () => {
    const taken = freshUsername();
    await confirmedUser(undefined, { username: taken });
    const signedOut = stackClient();

    const takenAnswer = await signedOut.rpc('username_available', { p_username: taken });
    expect(takenAnswer).toMatchObject({ data: false, error: null });
    const freeAnswer = await signedOut.rpc('username_available', { p_username: freshUsername() });
    expect(freeAnswer).toMatchObject({ data: true, error: null });
    const reserved = await signedOut.rpc('username_available', { p_username: 'admin' });
    expect(reserved).toMatchObject({ data: false, error: null });

    // Signed out, the table itself stays shut.
    const read = await signedOut.from('public_profiles').select('username');
    expect(read.error).not.toBeNull();
  });
});
