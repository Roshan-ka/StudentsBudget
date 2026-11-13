import fs from 'node:fs';
import { totpCode } from '../src/sync/totp';

// The live smoke's one account (Roshan's, made for it; see CLAUDE.md "Live smoke"), from the environment: the GitHub
// environment `live-smoke` on CI, the shell by hand. The leak check gives a throwaway one on the local stack instead.

export type LiveAccount = { email: string; password: string; secret: string; usedStep: number };

const STEP = 30_000;
/** A code with less time left than this may run out on its way to the server: the next one is taken instead. */
const MIN_LEFT = 3_000;

export function liveAccount(): LiveAccount {
  const { E2E_LIVE_EMAIL: email, E2E_LIVE_PASSWORD: password, E2E_LIVE_TOTP_SECRET: secret } = process.env;
  if (!email || !password || !secret) throw new Error('E2E_LIVE_EMAIL, E2E_LIVE_PASSWORD and E2E_LIVE_TOTP_SECRET are needed');
  return { email, password, secret, usedStep: Number(process.env.E2E_LIVE_USED_STEP ?? -1) };
}

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function readStep(stepFile: string): number {
  try {
    return Number(fs.readFileSync(stepFile, 'utf8')) || -1;
  } catch {
    return -1;
  }
}

/**
 * The authenticator code to type now, never one this run typed before: the step file (in the run's output folder, so a
 * retry reads it) holds the 30-second window of the last code typed, and a code of that window or an earlier one waits
 * for the next. Across runs the workflow's concurrency group makes a reuse unlikely, not impossible. On GitHub the code
 * is masked before it is typed; that's belt and braces, as nothing prints it (the leak check holds that).
 */
export async function liveCode(account: LiveAccount, stepFile: string): Promise<string> {
  const last = Math.max(readStep(stepFile), account.usedStep);
  let now = Date.now();
  if (Math.floor(now / STEP) <= last) await wait((last + 1) * STEP - now + 200);
  now = Date.now();
  if (STEP - (now % STEP) < MIN_LEFT) await wait(STEP - (now % STEP) + 200);
  now = Date.now();
  fs.writeFileSync(stepFile, String(Math.floor(now / STEP)));
  const code = totpCode(account.secret, now);
  if (process.env.GITHUB_ACTIONS === 'true') process.stdout.write(`::add-mask::${code}\n`);
  return code;
}
