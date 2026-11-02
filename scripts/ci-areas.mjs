// Pure helper for scripts/ci-changes.mjs: which CI jobs a pull request needs, from the files it changes. A path no rule
// names counts as app code, so a new kind of file runs everything until it is listed here.

/** Notes only: Markdown anywhere, and the docs vault. A pull request with nothing else starts no CI run (ci.yml). */
function isNotes(file) {
  return file.endsWith('.md') || file.startsWith('docs/');
}

/** Paths the web app never loads: e2e, the offline check and the build have nothing of theirs to test there. */
const OUTSIDE_APP = ['supabase/', 'mcp/', '.mcp.json', '.claude/'];

/**
 * What the db job tests: the migrations and pgTAP tests, and the account store's contract tests (src/sync/store.ts and
 * what it imports), with the tools and settings they run on. CI changes run it too.
 */
const DB = [
  'supabase/',
  'src/sync/',
  'src/db/',
  'src/lib/',
  'scripts/supabase-test-env.mjs',
  'package.json',
  'package-lock.json',
  'vitest.config.ts',
  'tsconfig.json',
  '.github/',
];

/** `app`: the build, e2e and the offline check are needed. `db`: the db job is. Lint, typecheck and unit tests always run. */
export function areasOf(files) {
  const code = files.filter((file) => !isNotes(file));
  return {
    app: code.some((file) => !OUTSIDE_APP.some((prefix) => file.startsWith(prefix))),
    db: code.some((file) => DB.some((prefix) => file.startsWith(prefix))),
  };
}
