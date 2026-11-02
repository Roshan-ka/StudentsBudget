// Which tests a pull request's CI runs, from the files it changes. A changed module picks the e2e specs of every route
// whose page imports it (directly or through other modules), as e2e/affected-map.json lists them; a change that
// reaches the root layout, or a route every spec passes through, runs them all. A path no rule matches runs everything.
// Run by ci.yml: `node scripts/ci-affected.mjs` writes `run`, `e2e`, `offline` and `db` to $GITHUB_OUTPUT and a table
// of why each spec was picked to the job summary. The pure helpers take made-up input, so the unit tests can run them.
import { execFileSync } from 'node:child_process';
import { appendFileSync, existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const MAP_FILE = 'e2e/affected-map.json';
const LAYOUT = 'src/app/layout.tsx';
const MANIFEST = 'src/app/manifest.ts';

/** Notes only: nothing to check. */
const DOCS = /^(docs|\.claude)\/|\.md$/;
/** What the offline check (a production build with the service worker) depends on, besides a full e2e run. */
const OFFLINE = [
  /^public\//,
  /(^|\/)sw([.-][^/]*)?$/,
  /^src\/components\/app-init\.tsx$/,
  /^src\/lib\/sw-register\.ts$/,
  /^src\/app\/manifest\.ts$/,
  /^next\.config\./,
  /^e2e\/offline\.spec\.ts$/,
];
/** What the db job (migrations, pgTAP, the account store's contract tests) depends on, besides what those tests import. */
const DB = [/^supabase\//, /^src\/sync\//, /^src\/lib\/supabase\//, /^scripts\/supabase-test-env\.mjs$/, /^package-lock\.json$/];
/**
 * Paths with no e2e spec of their own: the database (e2e answers Supabase's calls itself), the service worker (only a
 * production build registers it), the MCP server (nothing in src/ imports it; its tests are unit tests), unit tests
 * (the checks job runs them all) and the offline spec (its own job).
 */
const NO_E2E = [
  /^supabase\//,
  /^public\/sw\.js$/,
  /^mcp\//,
  /^\.mcp\.json$/,
  /^src\/.*\.test\.ts$/,
  /^e2e\/offline\.spec\.ts$/,
];

const CODE = /\.tsx?$/;
const SPEC = /^e2e\/([^/]+)\.spec\.ts$/;
const CONTRACT_TEST = /\.contract\.test\.ts$/;

/** The modules the walk follows: the app (without its unit tests), the contract tests and everything in e2e/. */
const inGraph = (file) =>
  (file.startsWith('src/') && (!file.endsWith('.test.ts') || CONTRACT_TEST.test(file))) || file.startsWith('e2e/');

const SPECIFIER = /\b(?:import|export)\b[^'";]*?\bfrom\s*['"]([^'"]+)['"]|\bimport\s*\(\s*['"]([^'"]+)['"]|\bimport\s*['"]([^'"]+)['"]/g;

/** Every module specifier a source file imports or re-exports, in order, packages included. */
export function importsOf(source) {
  return [...source.matchAll(SPECIFIER)].map((match) => match[1] ?? match[2] ?? match[3]);
}

/**
 * The file an import names, as mcp/app-imports.ts resolves it: `@/` is src/, and `./` or `../` is relative to the
 * importer; tried as written, then with an extension, then as a folder. Unlike Node there, Next also compiles `.tsx`.
 * undefined for a package; null for an app path with no file behind it.
 */
function resolveImport(specifier, from, repo) {
  let base;
  if (specifier.startsWith('@/')) base = `src/${specifier.slice(2)}`;
  else if (specifier.startsWith('./') || specifier.startsWith('../')) base = path.posix.join(path.posix.dirname(from), specifier);
  else return undefined;
  const candidates = [base, `${base}.ts`, `${base}.tsx`, `${base}/index.ts`, `${base}/index.tsx`];
  return candidates.find((file) => Object.hasOwn(repo, file)) ?? null;
}

/** Each module → the modules that import it. */
function importersOf(repo) {
  const importers = new Map();
  for (const [file, source] of Object.entries(repo)) {
    if (!inGraph(file) || !CODE.test(file)) continue;
    for (const specifier of importsOf(source)) {
      const target = resolveImport(specifier, file, repo);
      if (!target) continue;
      if (!importers.has(target)) importers.set(target, new Set());
      importers.get(target).add(file);
    }
  }
  return importers;
}

/** The file and every module that imports it, directly or through others. */
function reachedFrom(file, importers) {
  const reached = new Set([file]);
  const queue = [file];
  while (queue.length > 0) {
    for (const importer of importers.get(queue.pop()) ?? []) {
      if (!reached.has(importer)) {
        reached.add(importer);
        queue.push(importer);
      }
    }
  }
  return reached;
}

/** Each route → its page: every folder under src/app with a page.tsx, and the web app manifest. */
export function routePages(repo) {
  const pages = new Map();
  for (const file of Object.keys(repo)) {
    const page = /^src\/app\/(?:(.*)\/)?page\.tsx$/.exec(file);
    if (page) pages.set(`/${page[1] ?? ''}`, file);
  }
  if (Object.hasOwn(repo, MANIFEST)) pages.set('/manifest.webmanifest', MANIFEST);
  return pages;
}

/** Every `@/` or relative import in the app and e2e/ that names no file, as `file: specifier`. */
export function unresolvedImports(repo) {
  const unresolved = [];
  for (const [file, source] of Object.entries(repo)) {
    if (!inGraph(file) || !CODE.test(file)) continue;
    for (const specifier of importsOf(source)) {
      if (resolveImport(specifier, file, repo) === null) unresolved.push(`${file}: ${specifier}`);
    }
  }
  return unresolved;
}

/**
 * What to run for the changed files. `repo` maps every file in the checkout to its text (only code files need it);
 * a changed file that is not in it was deleted. `map` is e2e/affected-map.json.
 * Returns `run` (false for notes only), `e2e` ('none', 'all' or the spec files), `offline`, `db`, and `why`: the
 * reasons for 'all', each spec, 'offline' and 'db'.
 */
export function selectAffected({ changed, repo, map, event = 'pull_request', labels = [] }) {
  const why = {};
  const pick = (target, reason) => {
    why[target] ??= [];
    if (!why[target].includes(reason)) why[target].push(reason);
  };
  const pickSpec = (name, reason) => pick(name === 'offline' ? 'offline' : `${name}.spec.ts`, reason);
  const everything = (reason) => {
    pick('all', reason);
    pick('db', reason);
  };

  let run = false;
  if (event !== 'pull_request') everything(event === 'schedule' ? 'the nightly run' : 'a manual run');
  if (labels.includes('ci:full')) everything('the `ci:full` label');
  if (why.all) run = true;

  const importers = importersOf(repo);
  const pages = routePages(repo);
  const routeOfPage = new Map([...pages].map(([route, page]) => [page, route]));
  /** The route of a file in a route folder that nothing imports, such as a loading.tsx. */
  const owningRoute = (file) => {
    for (let dir = path.posix.dirname(file); dir.startsWith('src/app'); dir = path.posix.dirname(dir)) {
      const route = routeOfPage.get(`${dir}/page.tsx`);
      if (route) return route;
    }
    return undefined;
  };

  for (const file of changed) {
    if (DOCS.test(file)) continue;
    run = true;
    const name = `\`${file}\``;
    if (OFFLINE.some((rule) => rule.test(file))) pick('offline', name);
    if (DB.some((rule) => rule.test(file))) pick('db', name);
    if (NO_E2E.some((rule) => rule.test(file))) continue;
    const spec = SPEC.exec(file);
    if (!file.startsWith('src/') && !spec) {
      everything(`${name}: no rule matches it`);
      continue;
    }
    // A deleted module picks nothing itself: the files that imported it changed too, or the build fails.
    if (!Object.hasOwn(repo, file)) continue;
    if (spec) {
      pickSpec(spec[1], `${name} changed`);
      continue;
    }

    const reached = reachedFrom(file, importers);
    if (reached.has(LAYOUT)) {
      pick('all', `${name} reaches the root layout`);
      continue;
    }
    const routes = new Set([...reached].map((module) => routeOfPage.get(module)).filter(Boolean));
    if (routes.size === 0 && !importers.has(file) && CODE.test(file) && owningRoute(file)) routes.add(owningRoute(file));
    const specs = [...reached].map((module) => SPEC.exec(module)?.[1]).filter(Boolean);
    const contract = [...reached].some((module) => CONTRACT_TEST.test(module));

    for (const route of routes) {
      const mapped = map.routes[route];
      if (mapped === undefined) pick('all', `${name} → ${route}, which ${MAP_FILE} does not list`);
      else if (mapped === 'all') pick('all', `${name} → ${route}`);
      else for (const mappedSpec of mapped) pickSpec(mappedSpec, `${name} → ${route}`);
    }
    for (const importer of specs) pickSpec(importer, `${name} is imported by the spec`);
    if (contract && !why.db?.includes(name)) pick('db', `${name} is imported by the contract tests`);
    // A module no page or spec imports needs no e2e spec; any other file there could be loaded some other way.
    if (routes.size === 0 && specs.length === 0 && !contract && !CODE.test(file)) everything(`${name}: no rule matches it`);
  }

  let e2e = 'none';
  if (why.all) {
    e2e = 'all';
    pick('offline', 'every e2e spec runs');
  } else if (Object.keys(why).some((target) => target.endsWith('.spec.ts'))) {
    if (!why['smoke.spec.ts']) pick('smoke.spec.ts', 'runs with every list');
    e2e = Object.keys(why)
      .filter((target) => target.endsWith('.spec.ts'))
      .sort();
  }
  return { run, e2e, offline: Boolean(why.offline), db: Boolean(why.db), why };
}

/** The specs as Playwright file arguments: each a regex over the path, anchored so `account` never runs `accounts`. */
export function e2eArgs(specs) {
  return specs.map((spec) => `e2e/${spec.replaceAll('.', '\\.')}$`).join(' ');
}

/** The lines for $GITHUB_OUTPUT. */
export function githubOutput({ run, e2e, offline, db }) {
  return `run=${run}\ne2e=${Array.isArray(e2e) ? e2eArgs(e2e) : e2e}\noffline=${offline}\ndb=${db}\n`;
}

/** Up to three reasons, then how many more. */
function reasonsText(reasons) {
  if (reasons.length <= 3) return reasons.join('; ');
  return `${reasons.slice(0, 3).join('; ')}, and ${reasons.length - 3} more`;
}

/** The job summary: a row for the e2e run (or each picked spec), the offline check and the db job, with why. */
export function summary({ run, e2e, offline, db, why }) {
  if (!run) return '### Affected tests\n\nDocs only: no checks run.\n';
  const rows = [];
  if (e2e === 'all') rows.push(['every e2e spec', why.all]);
  else if (e2e === 'none') rows.push(['no e2e spec', ['no changed file reaches a page or a spec']]);
  else for (const spec of e2e) rows.push([`\`${spec}\``, why[spec]]);
  if (offline) rows.push(['offline check', why.offline]);
  if (db) rows.push(['db job', why.db]);
  const table = rows.map(([what, reasons]) => `| ${what} | ${reasonsText(reasons)} |`);
  return ['### Affected tests', '', '| Runs | Why |', '|---|---|', ...table, ''].join('\n');
}

/** Every file in the checkout (tracked, or new and not ignored), with the text of the modules the walk follows. */
export function readRepo(root) {
  const listed = execFileSync('git', ['ls-files', '-z', '--cached', '--others', '--exclude-standard'], {
    cwd: root,
    encoding: 'utf8',
  });
  const repo = {};
  for (const file of listed.split('\0')) {
    const full = path.join(root, file);
    if (!file || !existsSync(full)) continue;
    repo[file] = inGraph(file) && CODE.test(file) ? readFileSync(full, 'utf8') : '';
  }
  return repo;
}

function main() {
  const root = fileURLToPath(new URL('..', import.meta.url));
  const event = process.env.GITHUB_EVENT_NAME ?? 'pull_request';
  const payload = process.env.GITHUB_EVENT_PATH ? JSON.parse(readFileSync(process.env.GITHUB_EVENT_PATH, 'utf8')) : {};
  const labels = (payload.pull_request?.labels ?? []).map((label) => label.name);
  // On a pull request, CI checks out the merge commit, whose first parent is the base branch as it is now
  // (fetch-depth: 2), so this diff is exactly what merging would change. Other runs test everything.
  const changed =
    event === 'pull_request'
      ? execFileSync('git', ['diff', '--name-only', '--no-renames', '-z', 'HEAD^1', 'HEAD'], { cwd: root, encoding: 'utf8' })
          .split('\0')
          .filter(Boolean)
      : [];
  const map = JSON.parse(readFileSync(path.join(root, MAP_FILE), 'utf8'));
  const selection = selectAffected({ changed, repo: readRepo(root), map, event, labels });
  const output = githubOutput(selection);
  const table = summary(selection);
  process.stdout.write(`${changed.length} changed files\n${output}\n${table}`);
  if (process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT, output);
  if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, table);
}

if (import.meta.main) main();
