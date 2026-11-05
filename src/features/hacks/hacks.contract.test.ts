import { describe, expect, it } from 'vitest';
import { newId } from '@/lib/new-id';
import { confirmedUser, MAIL_URL, STACK_KEY, STACK_URL, stackClient } from '@/sync/contract-users';

// The hacks feed's posts, votes and reports (chunk 3; docs/superpowers/plans/2026-11-05-hacks-feed.md) against the
// local Supabase stack, as real signed-in users. pgTAP (hacks.test.sql) covers the 5-report hide, the moderator, the
// second step and the daily limit. Runs with `npm run test:contract`.

/** A username of this run only: the local stack keeps earlier runs' users. */
const freshUsername = () => `c_${newId().replaceAll('-', '').slice(0, 12)}`;

/** One row of `hacks_feed`, as PostgREST returns it. */
type FeedRow = {
  id: string;
  body: string;
  username: string | null;
  label: string | null;
  mine: boolean;
  ups: number;
  worked: number;
  outdated: number;
  my_up: boolean;
  my_verdict: string | null;
};

type User = Awaited<ReturnType<typeof confirmedUser>>;

async function post(user: User, body: string): Promise<string> {
  const answer = await user.rpc('post_hack', {
    p_body: body,
    p_city: 'regensburg',
    p_category: 'food',
    p_link: null,
    p_lang: 'en',
  });
  expect(answer.error).toBeNull();
  return answer.data as string;
}

async function feedOf(user: User): Promise<FeedRow[]> {
  const answer = await user.rpc('hacks_feed');
  expect(answer.error).toBeNull();
  return answer.data as FeedRow[];
}

describe.runIf(Boolean(STACK_URL && STACK_KEY && MAIL_URL))('the hacks feed against a real Supabase stack (hacks feed)', () => {
  it('shows a post to another account under its author’s username, with the votes totalled', async () => {
    const authorName = freshUsername();
    const author = await confirmedUser(undefined, { username: authorName, label: 'student' });
    const reader = await confirmedUser(undefined, { username: freshUsername() });
    const body = `Contract run ${newId()}: bread is half price after 6 pm`;
    const id = await post(author, body);

    const vote = await reader.rpc('vote_hack', { p_id: id, p_up: true, p_verdict: 'worked' });
    expect(vote.error).toBeNull();

    const row = (await feedOf(reader)).find((candidate) => candidate.id === id);
    expect(row).toMatchObject({
      body,
      username: authorName,
      label: 'student',
      mine: false,
      ups: 1,
      worked: 1,
      outdated: 0,
      my_up: true,
      my_verdict: 'worked',
    });
    expect(row).not.toHaveProperty('user_id');
    expect((await feedOf(author)).find((candidate) => candidate.id === id)).toMatchObject({ mine: true, my_up: false });

    // Not on one's own post.
    const own = await author.rpc('vote_hack', { p_id: id, p_up: true, p_verdict: null });
    expect(own.error?.hint).toBe('own-post');
  });

  it('hides a reported post from its reporter only, and lets nothing around the functions', async () => {
    const author = await confirmedUser(undefined, { username: freshUsername() });
    const reporter = await confirmedUser(undefined, { username: freshUsername() });
    const other = await confirmedUser(undefined, { username: freshUsername() });
    const id = await post(author, `Contract run ${newId()}: the library lends laptops`);

    const report = await reporter.rpc('report_hack', { p_id: id });
    expect(report.error).toBeNull();
    expect((await feedOf(reporter)).some((row) => row.id === id)).toBe(false);
    expect((await feedOf(other)).some((row) => row.id === id)).toBe(true);

    // No username, no post.
    const nameless = await confirmedUser();
    const refused = await nameless.rpc('post_hack', {
      p_body: 'A post from an account without a name',
      p_city: 'anywhere',
      p_category: 'food',
      p_link: null,
      p_lang: 'en',
    });
    expect(refused.error?.hint).toBe('needs-username');

    // The table takes no direct writes, and nobody here moderates.
    const direct = await author.from('hacks').insert({ body: 'Written around the functions', city: 'anywhere', category: 'food', lang: 'en' });
    expect(direct.error).not.toBeNull();
    expect((await reporter.rpc('am_i_moderator')).data).toBe(false);
    expect((await reporter.rpc('moderation_queue')).error).not.toBeNull();
  });

  it('answers only a signed-in user', async () => {
    const answer = await stackClient().rpc('hacks_feed');
    expect(answer.data).toBeNull();
    expect(answer.error).not.toBeNull();
  });
});
