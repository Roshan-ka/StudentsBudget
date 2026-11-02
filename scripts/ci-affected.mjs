// Which tests a CI run needs, from the files the branch changes against main. A changed module picks the e2e specs of
// every route whose page imports it (directly or through other modules), as e2e/affected-map.json lists them; a change
// that reaches the root layout, or a route every spec passes through, runs them all. A path no rule matches runs
// everything. Run by ci.yml: `node scripts/ci-affected.mjs`, with the run's options in CI_SCOPE, CI_BROWSERS and
// CI_LANGUAGES (see runOptions), writes `run`, `e2e`, `offline`, `db`, `projects` and `languages` to $GITHUB_OUTPUT, and
// the options and why each spec was picked to the job summary. `node scripts/ci-affected.mjs verdict` gives the gate job
// the commit status to post (see gate). The pure helpers take made-up input, so the unit tests can run them.
import { execFileSync } from 'node:child_process';
import { appendFileSync, existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const MAP_FILE = 'e2e/affected-map.json';
const LAYOUT = 'src/app/layout.tsx';
const MANIFEST = 'src/app/manifest.ts';
/** playwright.config.ts's Chromium project. Every project is Chromium plus the iPhone's WebKit. */
const CHROMIUM_PROJECT = 'desktop-chrome';
/** What ci.yml's Run workflow inputs offer. */
const CHOICES = { scope: ['changed', 'full', 'quick'], browsers: ['auto', 'chromium', 'all'], languages: ['auto', 'default', 'all'] };

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
 * a changed file that is not in it was deleted. `map` is e2e/affected-map.json. `full` runs everything.
 * Returns `run` (false for notes only, or nothing changed), `e2e` ('none', 'all' or the spec files), `offline`, `db`,
 * and `why`: the reasons for 'all', each spec, 'offline' and 'db', or for 'skip' when nothing runs.
 */
export function selectAffected({ changed, repo, map, full = false }) {
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

  if (full) everything('a full run was asked for');
  let run = full;

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
  if (!run) pick('skip', changed.length === 0 ? 'nothing changed against main' : 'notes only');
  return { run, e2e, offline: Boolean(why.offline), db: Boolean(why.db), why };
}

/**
 * What a run's inputs mean. `scope`: what the branch changes against main (`changed`), or everything (`full`), or
 * `quick`, a pull request's automatic run: `changed` without e2e and the offline check (`e2e` false; see forScope).
 * `browsers` and `languages`: `auto` is Chromium and the default language for a changed run, everything for a full one.
 * StudentsBudget is English only, so `languages` is passed on to e2e (E2E_LANGUAGES) and no spec reads it yet.
 * Throws on a value the inputs don't offer. `auto` lists the options that were left on auto.
 */
export function runOptions({ scope = 'changed', browsers = 'auto', languages = 'auto' }) {
  for (const [name, value] of Object.entries({ scope, browsers, languages })) {
    if (!CHOICES[name].includes(value)) {
      throw new RangeError(`${name} must be one of ${CHOICES[name].join(', ')}, not "${value}".`);
    }
  }
  const full = scope === 'full';
  const chosenBrowsers = browsers === 'auto' ? (full ? 'all' : 'chromium') : browsers;
  return {
    scope,
    full,
    e2e: scope !== 'quick',
    browsers: chosenBrowsers,
    languages: languages === 'auto' ? (full ? 'all' : 'default') : languages,
    projectArgs: chosenBrowsers === 'chromium' ? `--project=${CHROMIUM_PROJECT}` : '',
    auto: Object.entries({ browsers, languages })
      .filter(([, value]) => value === 'auto')
      .map(([name]) => name),
  };
}

/**
 * The commit status a run posts. `full-gate`, the check merging waits for, only for a full run on every browser and
 * language; a full run narrowed by an option posts `partial-check`, so it can never stand in for the full test. A
 * changed run posts `quick-check`.
 */
export function statusContext(inputs) {
  const options = runOptions(inputs);
  if (!options.full) return 'quick-check';
  return options.browsers === 'all' && options.languages === 'all' ? 'full-gate' : 'partial-check';
}

/** The status's description: the tested commit, short, and the options the run used. */
export function statusDescription(sha, options) {
  return `${sha.slice(0, 7)} · ${options.scope} · browsers ${options.browsers} · languages ${options.languages}`;
}

/** The jobs after `changes`, as ci.yml names them. */
const JOBS = ['checks', 'e2e', 'e2e-report', 'offline', 'db'];

/**
 * The run's verdict, from what `toJSON(needs)` gives the gate job. `changes` must always pass. A full run needs every
 * job to pass: one that was skipped, cancelled or left no result is coverage the run doesn't have. A changed run
 * passes when every job passed or was skipped, and its report merge doesn't count. Returns `state` ('success' or
 * 'failure') and the `problems` behind a failure.
 */
export function verdict(scope, needs) {
  const problems = [];
  const changes = needs.changes?.result ?? 'no result';
  if (changes !== 'success') problems.push(`changes: ${changes}`);
  for (const job of JOBS) {
    const result = needs[job]?.result;
    if (scope === 'full') {
      if (changes === 'success' && result !== 'success') {
        problems.push(`${job}: ${result ?? 'no result'}, but this full run needs it`);
      }
    } else if (job !== 'e2e-report' && result !== undefined && result !== 'success' && result !== 'skipped') {
      problems.push(`${job}: ${result}`);
    }
  }
  return { state: problems.length === 0 ? 'success' : 'failure', problems };
}

const QUICK_REASON = 'a pull request’s automatic run has no e2e: start a changed or full run by hand';

/**
 * The selection a run's scope allows. A pull request's automatic run (`quick`, Roshan 2026-11-02) leaves out e2e and
 * the offline check, which only runs started by hand test; the checks and the db job stay as picked.
 */
export function forScope(selection, options) {
  if (options.e2e) return selection;
  return { ...selection, e2e: 'none', offline: false, why: { ...selection.why, quick: [QUICK_REASON] } };
}

/** The specs as Playwright file arguments: each a regex over the path, anchored so `account` never runs `accounts`. */
export function e2eArgs(specs) {
  return specs.map((spec) => `e2e/${spec.replaceAll('.', '\\.')}$`).join(' ');
}

/** The lines for $GITHUB_OUTPUT. `projects` is Playwright's project argument, empty for every project. */
export function githubOutput({ run, e2e, offline, db }, options = runOptions({})) {
  const list = Array.isArray(e2e) ? e2eArgs(e2e) : e2e;
  return `run=${run}\ne2e=${list}\noffline=${offline}\ndb=${db}\nprojects=${options.projectArgs}\nlanguages=${options.languages}\n`;
}

/** Up to three reasons, then how many more. */
function reasonsText(reasons) {
  if (reasons.length <= 3) return reasons.join('; ');
  return `${reasons.slice(0, 3).join('; ')}, and ${reasons.length - 3} more`;
}

/**
 * The job summary: the options the run used, then a row for the e2e run (or each picked spec), the offline check and
 * the db job, with why.
 */
export function summary({ run, e2e, offline, db, why }, options = runOptions({})) {
  const chosen = (name) => `${name} **${options[name]}**${options.auto.includes(name) ? ' (auto)' : ''}`;
  const head = `### Affected tests\n\nScope **${options.scope}** · ${chosen('browsers')} · ${chosen('languages')}\n\n`;
  if (!run) return `${head}No checks run: ${why.skip[0]}.\n`;
  const rows = [];
  if (e2e === 'all') rows.push(['every e2e spec', why.all]);
  else if (e2e === 'none') rows.push(['no e2e spec', why.quick ?? ['no changed file reaches a page or a spec']]);
  else for (const spec of e2e) rows.push([`\`${spec}\``, why[spec]]);
  if (offline) rows.push(['offline check', why.offline]);
  if (db) rows.push(['db job', why.db]);
  const table = rows.map(([what, reasons]) => `| ${what} | ${reasonsText(reasons)} |`);
  return [`${head}| Runs | Why |`, '|---|---|', ...table, ''].join('\n');
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

/** The run's Run workflow inputs, as ci.yml passes them on. */
function inputsFromEnv() {
  return {
    scope: process.env.CI_SCOPE || undefined,
    browsers: process.env.CI_BROWSERS || undefined,
    languages: process.env.CI_LANGUAGES || undefined,
  };
}

/** Appends lines to $GITHUB_OUTPUT and the job summary, when the run has them. */
function report(output, table) {
  if (process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT, output);
  if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, table);
}

function main() {
  const root = fileURLToPath(new URL('..', import.meta.url));
  const options = runOptions(inputsFromEnv());
  // What the checked-out branch changes since it left main (three dots: newer commits on main don't count). CI checks
  // out the whole history (fetch-depth: 0), so origin/main is there.
  const changed = execFileSync('git', ['diff', '--name-only', '--no-renames', '-z', 'origin/main...HEAD'], {
    cwd: root,
    encoding: 'utf8',
  })
    .split('\0')
    .filter(Boolean);
  const map = JSON.parse(readFileSync(path.join(root, MAP_FILE), 'utf8'));
  const selection = forScope(selectAffected({ changed, repo: readRepo(root), map, full: options.full }), options);
  const output = githubOutput(selection, options);
  const table = summary(selection, options);
  process.stdout.write(`${changed.length} changed files\n${output}\n${table}`);
  report(output, table);
}

/**
 * `node scripts/ci-affected.mjs verdict`, for the gate job: reads every job's result (NEEDS, `toJSON(needs)`), the
 * inputs and the tested commit (SHA), and writes the status to post: `context`, `state` and `description`.
 */
function gate() {
  const inputs = inputsFromEnv();
  const options = runOptions(inputs);
  const context = statusContext(inputs);
  const { state, problems } = verdict(options.scope, JSON.parse(process.env.NEEDS ?? '{}'));
  const description = statusDescription(process.env.SHA ?? '', options);
  const output = `context=${context}\nstate=${state}\ndescription=${description}\n`;
  const table = [`### ${context}: ${state}`, '', description, '', ...problems.map((problem) => `- ${problem}`), ''].join('\n');
  process.stdout.write(`${output}\n${table}`);
  report(output, table);
}

if (import.meta.main) (process.argv[2] === 'verdict' ? gate : main)();
