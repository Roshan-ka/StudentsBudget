#!/usr/bin/env node
// npm run test:monkey -- [--who outsider|student|moderator] [--minutes M] [--seed N] [--replay .monkey/<file>.jsonl]
//
// The random clicker (e2e-real/monkey.spec.ts) by hand, on Chromium, one walk at a time. With --replay it walks a
// logged walk again, as the role in the file's name. Needs what the real-server e2e needs: the local stack up, its
// variables set (node scripts/supabase-test-env.mjs), and the moderators seeded (node e2e-real/db.mjs seed).

import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const args = process.argv.slice(2);
const option = (name) => {
  const i = args.indexOf(name);
  return i === -1 ? undefined : args[i + 1];
};

const replay = option('--replay');
const who = option('--who') ?? (replay ? path.basename(replay).split('-')[0] : undefined);
if (who && !['outsider', 'student', 'moderator'].includes(who)) {
  console.error(`--who must be outsider, student or moderator, not "${who}"`);
  process.exit(2);
}
const env = {
  ...process.env,
  E2E_MONKEY: '1',
  ...(option('--minutes') ? { MONKEY_MINUTES: option('--minutes') } : {}),
  ...(option('--seed') ? { MONKEY_SEED: option('--seed') } : {}),
  ...(replay ? { MONKEY_REPLAY: path.resolve(replay) } : {}),
};
const cli = path.join(ROOT, 'node_modules', '@playwright', 'test', 'cli.js');
const grep = who ? `the random clicker as ${who}` : '@monkey';
const done = spawnSync(process.execPath, [cli, 'test', '-c', 'e2e-real/playwright.config.ts', '--project=desktop-chrome', '--workers=1', '--grep', grep], {
  cwd: ROOT,
  env,
  stdio: 'inherit',
});
process.exit(done.status ?? 1);
