import fs from 'node:fs';
import path from 'node:path';
import { request } from '@playwright/test';
import { createUser } from '../e2e-real/adapter';

// The leak check's account (e2e-live/leak-check.mjs): a throwaway one on the local stack, with two-step sign-in on and
// the password leak-check.mjs chose, put where the smoke reads the live one. Its email and key go to
// .leak-check/account.json (git-ignored, outside what the check searches), so leak-check.mjs can look for them.
export default async function leakCheckAccount() {
  const password = process.env.E2E_LEAK_PASSWORD;
  if (!password) throw new Error('E2E_LEAK_PASSWORD is not set: run the leak check through `npm run test:leak-check`');
  const context = await request.newContext();
  const user = await createUser(context, { secondFactor: 'totp', password });
  await context.dispose();
  process.env.E2E_LIVE_EMAIL = user.email;
  process.env.E2E_LIVE_PASSWORD = password;
  process.env.E2E_LIVE_TOTP_SECRET = user.secret;
  // The code that turned the authenticator on: the smoke's first code waits for the window after it.
  process.env.E2E_LIVE_USED_STEP = String(Math.floor(Date.now() / 30_000));
  const dir = path.join(process.cwd(), '.leak-check');
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'account.json'), JSON.stringify({ email: user.email, secret: user.secret }));
}
