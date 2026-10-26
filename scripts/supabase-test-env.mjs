// Prints the running local Supabase stack's API URL and browser key as SUPABASE_TEST_URL and SUPABASE_TEST_KEY lines,
// for the contract tests (`npm run test:contract`). CI appends them to $GITHUB_ENV. It reads `supabase status -o json`,
// so the CLI's env format and quoting don't matter. Needs the stack to be running (`npm run supabase:start`).
import { execFileSync } from 'node:child_process';

const output = execFileSync('npx', ['supabase', 'status', '-o', 'json'], {
  encoding: 'utf8',
  // npx is a .cmd file on Windows, which only runs through a shell.
  shell: process.platform === 'win32',
});
// Anything the CLI prints around the JSON (a notice about a newer version) is cut off.
const status = JSON.parse(output.slice(output.indexOf('{'), output.lastIndexOf('}') + 1));
const url = status.API_URL;
const key = status.PUBLISHABLE_KEY ?? status.ANON_KEY;
if (!url || !key) {
  console.error(`supabase status gave no API_URL or browser key. It gave: ${Object.keys(status).join(', ')}`);
  process.exit(1);
}
process.stdout.write(`SUPABASE_TEST_URL=${url}\nSUPABASE_TEST_KEY=${key}\n`);
