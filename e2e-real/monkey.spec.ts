import fs from 'node:fs';
import path from 'node:path';
import { aiSwitchedOff } from '../e2e/helpers/ai';
import { openApp } from '../e2e/helpers/app';
import { acceptPrivacyNotes } from '../e2e/helpers/privacy';
import { mockFrankfurter } from '../e2e/helpers/setup';
import { logText, readLog, replay, walk, watch } from '../testkit/walker.mjs';
import { CONSOLE_ALLOW, NEVER_CLICK } from './adapter';
import { codeStep, expect, giveCode, signedInAs, signIn, test } from './fixtures';

// The random clicker (nightly; tag @monkey, left out of every other run): a seeded walk through the real app as each
// role, failing on an uncaught page error, a console error that isn't by design, a 5xx answer, a request to a host
// outside the setup (the network guard), or the moderation queue shown to someone who isn't the moderator. Every walk
// writes its steps to .monkey/ (git-ignored) and attaches them; `npm run test:monkey -- --replay <file>` walks one again.
// MONKEY_MINUTES sets the student's and moderator's walk (the outsider walks half as long); 1 by default, 10 at night.

const BASE_MINUTES = Number(process.env.MONKEY_MINUTES ?? 1);
const REPLAY = process.env.MONKEY_REPLAY;
const LOG_DIR = path.join(process.cwd(), '.monkey');
const WALKERS = { outsider: BASE_MINUTES / 2, student: BASE_MINUTES, moderator: BASE_MINUTES } as const;

for (const [who, minutes] of Object.entries(WALKERS)) {
  test(`the random clicker as ${who}`, { tag: '@monkey' }, async ({ page, makeUser, moderator }, testInfo) => {
    test.setTimeout(minutes * 60_000 + 3 * 60_000);
    // No AI calls and no exchange-rate server: the walk is about the app, and the network guard allows neither.
    await aiSwitchedOff(page);
    await mockFrankfurter(page);
    await acceptPrivacyNotes(page);
    if (who === 'student') {
      const student = await makeUser({ secondFactor: 'none', username: true });
      await openApp(page, '/settings/account');
      await signIn(page, student);
      await expect(signedInAs(page, student.email)).toBeVisible();
    } else if (who === 'moderator') {
      await openApp(page, '/settings/account');
      await signIn(page, moderator);
      await expect(codeStep(page, moderator.email)).toBeVisible();
      await giveCode(page, moderator);
      await expect(signedInAs(page, moderator.email)).toBeVisible();
    }
    await openApp(page, '/');

    const forbidden = who === 'moderator' ? [] : [{ what: 'the moderation queue', locator: page.getByRole('list', { name: 'Reported posts', exact: true }) }];
    const watcher = watch(page, { consoleAllow: CONSOLE_ALLOW, forbidden });
    const seed = Number(process.env.MONKEY_SEED ?? Date.now() % 2 ** 31);
    const log = REPLAY
      ? await replay(page, readLog(fs.readFileSync(REPLAY, 'utf8')), { afterStep: watcher.check })
      : await walk(page, { seed, until: Date.now() + minutes * 60_000, neverClick: NEVER_CLICK, afterStep: watcher.check });

    fs.mkdirSync(LOG_DIR, { recursive: true });
    const file = path.join(LOG_DIR, `${who}-${testInfo.project.name}-${REPLAY ? 'replay' : seed}.jsonl`);
    fs.writeFileSync(file, logText(log));
    await testInfo.attach('steps', { path: file, contentType: 'text/plain' });
    const again = `npm run test:monkey -- --replay ${path.relative(process.cwd(), file).replace(/\\/g, '/')}`;
    expect(watcher.problems, `the walk as ${who}, seed ${seed}, ${log.length} steps; walk it again: ${again}`).toEqual([]);
  });
}
