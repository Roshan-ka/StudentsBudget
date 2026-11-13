#!/usr/bin/env node
// The adapter's host side (testkit/README.md, "Adapter (v0)"): what needs the database itself, so it runs on the machine
// that runs the stack, before Playwright starts (CI's stack job on the runner; a lane job locally), never inside a
// test, whose browser image has no Docker.
//
//   node e2e-real/db.mjs seed [count]   moderators for the role tests: one per worker (playwright/.auth/moderators.json)
//   node e2e-real/db.mjs check-matrix   every server action guarded by private.acting_moderator() has a matrix row
//
// grantRole writes private.moderators through the database (`docker exec … psql`), never through an app function. The
// stack's variables come from `node scripts/supabase-test-env.mjs`; every address must be on this machine.

import { execFileSync } from 'node:child_process';
import { appendFileSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { missingActions, matrixMarkdown, parseMatrix } from '../testkit/role-matrix.mjs';
import { totpCode } from '../src/sync/totp.ts';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
export const MODERATORS_FILE = path.join(ROOT, 'playwright', '.auth', 'moderators.json');
export const MATRIX_FILE = path.join(ROOT, 'e2e-real', 'roles', 'matrix.json');
const PASSWORD = 'stack-test-password';
const LOOPBACK = ['127.0.0.1', 'localhost', '[::1]'];

/** The stack's settings; refuses a missing one or an address that isn't on this machine. Never prints a value. */
function backend() {
  const url = process.env.SUPABASE_TEST_URL;
  const key = process.env.SUPABASE_TEST_KEY;
  const mail = process.env.SUPABASE_TEST_MAIL_URL;
  if (!url || !key || !mail) throw new Error('SUPABASE_TEST_URL, SUPABASE_TEST_KEY and SUPABASE_TEST_MAIL_URL are not set (node scripts/supabase-test-env.mjs)');
  for (const address of [url, mail]) if (!LOOPBACK.includes(new URL(address).hostname)) throw new Error(`not the local stack: ${new URL(address).hostname}`);
  return { url, key, mail };
}

/** The database container of this checkout's stack: supabase_db_<project_id> (supabase/config.toml). */
function dbContainer() {
  const config = readFileSync(path.join(ROOT, 'supabase', 'config.toml'), 'utf8');
  const id = /^project_id\s*=\s*"([^"]+)"/m.exec(config)?.[1];
  if (!id) throw new Error('supabase/config.toml names no project_id');
  return `supabase_db_${id}`;
}

/** Runs SQL as postgres in the stack's database; returns psql's unaligned rows. */
export function psql(sql) {
  return execFileSync('docker', ['exec', dbContainer(), 'psql', '-U', 'postgres', '-d', 'postgres', '-At', '-v', 'ON_ERROR_STOP=1', '-c', sql], { encoding: 'utf8' })
    .split(/\r?\n/)
    .filter(Boolean);
}

/** discoverActions(): every public function whose body asks private.acting_moderator(), as `rpc:<name>`. */
export function discoverActions() {
  return psql(
    "select p.proname from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.prosrc like '%private.acting_moderator()%' order by 1",
  ).map((name) => `rpc:${name}`);
}

async function auth(pathPart, body, token) {
  const { url, key } = backend();
  const response = await fetch(`${url}/auth/v1/${pathPart}`, {
    method: 'POST',
    headers: { apikey: key, 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}) },
    body: JSON.stringify(body),
  });
  if (!response.ok) throw new Error(`auth/v1/${pathPart.replace(/\/[0-9a-f-]{36}\//, '/<id>/')} answered ${response.status}`);
  return response.json();
}

async function emailedCode(address) {
  const { mail } = backend();
  for (let tries = 0; tries < 40; tries += 1) {
    const found = await (await fetch(`${mail}/api/v1/search?query=${encodeURIComponent(`to:"${address}"`)}`)).json();
    const code = /\b(\d{6})\b/.exec(found.messages?.[0]?.Subject ?? '')?.[1];
    if (code) return code;
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error(`no emailed code to ${address} in Mailpit`);
}

/** A moderator: an account with its authenticator on, granted the role in private.moderators. */
async function makeModerator(run, index) {
  const email = `moderator-${run}-${index}@example.com`;
  await auth('signup', { email, password: PASSWORD });
  let session = await auth('verify', { type: 'email', email, token: await emailedCode(email) });
  const factor = await auth('factors', { factor_type: 'totp', friendly_name: 'Moderator phone' }, session.access_token);
  const challenge = await auth(`factors/${factor.id}/challenge`, {}, session.access_token);
  const usedCode = totpCode(factor.totp.secret);
  session = await auth(`factors/${factor.id}/verify`, { challenge_id: challenge.id, code: usedCode }, session.access_token);
  const id = session.user.id;
  if (!/^[0-9a-f-]{36}$/.test(id)) throw new Error('the verify answer named no user id');
  psql(`insert into private.moderators (user_id) values ('${id}') on conflict do nothing`);
  return { email, password: PASSWORD, secret: factor.totp.secret, usedCode, id, session: { access_token: session.access_token } };
}

/** Seeds `count` moderators, one per worker, into the git-ignored moderators file. Prints only how many. */
export async function seed(count = 4) {
  const run = Date.now().toString(36);
  const moderators = [];
  for (let i = 0; i < count; i += 1) moderators.push(await makeModerator(run, i));
  mkdirSync(path.dirname(MODERATORS_FILE), { recursive: true });
  execFileSync('git', ['-C', ROOT, 'check-ignore', '-q', MODERATORS_FILE]);
  writeFileSync(MODERATORS_FILE, `${JSON.stringify(moderators, null, 2)}\n`);
  console.log(`seeded ${moderators.length} moderators into playwright/.auth/moderators.json`);
}

/** check-matrix: the matrix parses, and covers every guarded server action the running database has. */
export function checkMatrix() {
  const { rows, problems } = parseMatrix(JSON.parse(readFileSync(MATRIX_FILE, 'utf8')));
  const missing = missingActions(rows, discoverActions());
  const table = matrixMarkdown('Role matrix', rows);
  console.log(table);
  if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, table);
  const all = [...problems, ...missing.map((action) => `${action} is guarded by acting_moderator() but has no row in e2e-real/roles/matrix.json`)];
  if (all.length) {
    console.error(`the role matrix:\n  ${all.join('\n  ')}`);
    process.exitCode = 1;
  }
}

if (import.meta.main) {
  const [command, count] = process.argv.slice(2);
  if (command === 'seed') await seed(count ? Number(count) : undefined);
  else if (command === 'check-matrix') checkMatrix();
  else {
    console.error('usage: node e2e-real/db.mjs seed [count] | check-matrix');
    process.exitCode = 2;
  }
}
