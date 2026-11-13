#!/usr/bin/env node
// npm run test:leak-check: the live smoke's leak check (A9; testkit/README.md, "Leak check"), on the local stack.
//
// Runs the live config (e2e-live/playwright.config.ts) with E2E_LEAK_CHECK: a throwaway account with two-step sign-in
// and a password chosen here, the app built against the stack, and a test that signs in with the code, signs out and
// then fails on purpose (retried once on CI, as the live run is). Then it searches everything the run printed and every
// file it left in test-results/live for the password, the email, the authenticator key and every code the key gave
// meanwhile. Exit 0: the run failed where it should and nothing leaked. 1: a leak, a recording, or a run that never
// reached its end (so it proved nothing). Needs the stack's variables (node scripts/supabase-test-env.mjs).

import { spawnSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { codesBetween, filesUnder, findLeaks, recordings, redact } from '../testkit/leak-check.mjs';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const OUT = path.join(ROOT, '.leak-check');
const RESULTS = path.join(ROOT, 'test-results', 'live');
const DELIBERATE = 'leak check: failing on purpose, after signing out';

fs.rmSync(OUT, { recursive: true, force: true });
fs.rmSync(RESULTS, { recursive: true, force: true });
const password = `leak-check-${randomBytes(8).toString('hex')}`;
const started = Date.now();
const run = spawnSync(process.execPath, [path.join(ROOT, 'node_modules', '@playwright', 'test', 'cli.js'), 'test', '-c', 'e2e-live/playwright.config.ts', '--grep', '@smoke'], {
  cwd: ROOT,
  env: { ...process.env, E2E_LEAK_CHECK: '1', E2E_LEAK_PASSWORD: password },
  encoding: 'utf8',
  maxBuffer: 256 * 1024 * 1024,
});
const ended = Date.now();
const output = `${run.stdout ?? ''}\n${run.stderr ?? ''}`;

let account = { email: '', secret: '' };
try {
  account = JSON.parse(fs.readFileSync(path.join(OUT, 'account.json'), 'utf8'));
} catch {
  // No account: the setup failed before making one; the run proves nothing (below).
}
const codes = account.secret ? codesBetween(account.secret, started, ended) : [];
const secrets = [
  { name: 'password', value: password },
  { name: 'email', value: account.email },
  { name: 'authenticator key', value: account.secret },
  ...codes.map((value) => ({ name: 'code', value, digits: true })),
];

const files = filesUnder(RESULTS);
const texts = [{ where: 'the run’s output', text: output }, ...files.map((file) => ({ where: path.relative(ROOT, file).replace(/\\/g, '/'), text: fs.readFileSync(file, 'latin1') }))];
const leaks = findLeaks(texts, secrets);
const recorded = recordings(files).map((file) => path.relative(ROOT, file).replace(/\\/g, '/'));
const reachedEnd = run.status !== 0 && output.includes(DELIBERATE);

// The run's output, safe to print: every secret in it replaced by its name.
process.stdout.write(`${redact(output, secrets)}\n`);
console.log('— leak check —');
const problems = [];
if (run.error) problems.push(`the run didn't start: ${run.error.message}`);
if (!account.secret) problems.push('no account was made (leak-check.setup.ts), so nothing was typed: the run proves nothing');
else if (!reachedEnd) problems.push(`the run didn't fail on purpose at its end ("${DELIBERATE}"), so not every secret was typed: it proves nothing`);
for (const { where, line, name } of leaks) problems.push(`the ${name} is in ${where}, line ${line}`);
for (const file of recorded) problems.push(`a recording was kept: ${file}`);
if (problems.length) {
  for (const problem of problems) console.log(`✗ ${problem}`);
  process.exit(1);
}
console.log(`✓ the run signed in with the code, signed out and failed on purpose; ${texts.length} texts (its output and ${files.length} files) hold none of the password, the email, the key or ${codes.length} codes, and nothing was recorded`);
