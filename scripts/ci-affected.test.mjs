import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  e2eArgs,
  forScope,
  githubOutput,
  importsOf,
  readRepo,
  routePages,
  runOptions,
  selectAffected,
  statusContext,
  statusDescription,
  summary,
  unresolvedImports,
  verdict,
} from './ci-affected.mjs';

/**
 * A small made-up app, shaped like the real one: the root layout loads app-init (and through it the database), Home
 * holds the check-in card, the check-in page and the entries page share the entries list, and two specs import data.
 * Only code files need their text; everything else is ''.
 */
const REPO = {
  'src/app/layout.tsx': "import { AppInit } from '@/components/app-init';\nimport './globals.css';\n",
  'src/app/globals.css': '',
  'src/app/favicon.ico': '',
  'src/app/manifest.ts': '',
  'src/components/app-init.tsx': "import { db } from '@/db/db';\nimport { registerServiceWorker } from '@/lib/sw-register';\n",
  'src/db/db.ts': "import type { Plan } from './types';\n",
  'src/db/types.ts': '',
  'src/lib/sw-register.ts': '',
  'src/lib/money.ts': '',
  'src/lib/money.test.ts': "import { formatMoney } from './money';\n",
  'src/lib/orphan.ts': '',
  'src/data/notes.json': '',
  'src/app/page.tsx': "import { db } from '@/db/db';\nimport { HomeScreen } from '@/features/home/home';\n",
  'src/features/home/home.tsx': "import {\n  CheckInCard,\n  type CardProps,\n} from '@/features/check-in/check-in-card';\n",
  'src/features/check-in/check-in-card.tsx': "import { formatMoney } from '@/lib/money';\n",
  'src/app/check-in/page.tsx': "import { CheckInView } from '@/features/check-in/check-in-view';\n",
  'src/app/check-in/loading.tsx': '',
  'src/features/check-in/check-in-view.tsx':
    "import { weekRows } from './week-rows';\nexport { EntriesList } from '@/features/entries/entries-list';\n",
  'src/features/check-in/week-rows.ts': '',
  'src/features/entries/entries-list.tsx': "import { formatMoney } from '../../lib/money';\n",
  'src/app/entries/page.tsx': "const list = await import('@/features/entries/entries-list');\n",
  'src/app/setup/page.tsx': "import { Wizard } from '@/features/setup/wizard';\n",
  'src/features/setup/wizard.tsx': '',
  'src/app/settings/page.tsx': "import { PushButton } from '@/sync/push';\n",
  'src/sync/push.ts': '',
  'src/sync/store.ts': "import { checkRow } from '@/db/schemas';\n",
  'src/sync/store.contract.test.ts': "import { supabaseStore } from './store';\n",
  'src/db/schemas.ts': '',
  'src/app/tips/page.tsx': "import { TipsView } from '../../features/tips/tips-view';\n",
  'src/features/tips/tips-view.tsx': "import { TIPS } from '@/data/tips';\n",
  'src/data/tips.ts': '',
  'src/app/charts/page.tsx': '',
  'e2e/helpers/setup.ts': '',
  'e2e/smoke.spec.ts': '',
  'e2e/check-in.spec.ts': "import { completeSetup } from './helpers/setup';\n",
  'e2e/entries.spec.ts': '',
  'e2e/tips.spec.ts': "import { TIPS } from '../src/data/tips';\n",
  'e2e/swaps.spec.ts': "import { TIPS } from '../src/data/tips';\nimport type { Plan } from '../src/db/types';\n",
  'e2e/setup.spec.ts': '',
  'e2e/offline.spec.ts': '',
  'docs/plan.md': '',
  'README.md': '',
  '.claude/settings.json': '',
  'public/sw.js': '',
  'public/icon-192.png': '',
  'supabase/migrations/1_init.sql': '',
  'next.config.ts': '',
  'package.json': '',
  'package-lock.json': '',
  'fixtures/demo.json': '',
  'mcp/server.ts': '',
  'scripts/supabase-test-env.mjs': '',
  'scripts/write-city-pack.mjs': '',
  '.github/workflows/ci.yml': '',
};

/** Route → the specs that open it; the charts route is left out on purpose. */
const MAP = {
  routes: {
    '/': 'all',
    '/check-in': ['check-in'],
    '/entries': ['check-in', 'entries'],
    '/manifest.webmanifest': ['smoke'],
    '/settings': 'all',
    '/setup': 'all',
    '/tips': ['tips'],
  },
  allOnly: ['setup'],
};

const select = (changed, more = {}) => selectAffected({ changed, repo: REPO, map: MAP, ...more });

describe('importsOf', () => {
  it('finds static, type-only, side-effect, re-exported, multi-line and dynamic imports', () => {
    const source = [
      "import { a } from '@/lib/a';",
      "import type { B } from './b';",
      "import './globals.css';",
      "export { c } from '../c';",
      "export * from '@/lib/d';",
      'import {',
      '  e,',
      '  type E,',
      "} from '@/lib/e';",
      "const f = await import('@/lib/f');",
      "import { useState } from 'react';",
    ].join('\n');
    expect(importsOf(source)).toEqual(['@/lib/a', './b', './globals.css', '../c', '@/lib/d', '@/lib/e', '@/lib/f', 'react']);
  });
});

describe('selectAffected', () => {
  it('runs nothing for docs-only changes', () => {
    expect(select(['docs/plan.md', 'README.md', '.claude/settings.json'])).toMatchObject({
      run: false,
      e2e: 'none',
      offline: false,
      db: false,
    });
  });

  it('runs the checks but no e2e spec for a unit test', () => {
    expect(select(['src/lib/money.test.ts'])).toMatchObject({ run: true, e2e: 'none', offline: false, db: false });
  });

  it("picks a leaf module's route specs, plus smoke", () => {
    expect(select(['src/features/check-in/week-rows.ts'])).toMatchObject({
      run: true,
      e2e: ['check-in.spec.ts', 'smoke.spec.ts'],
      offline: false,
      db: false,
    });
  });

  it('picks every route that imports a shared module, through re-exports and dynamic imports', () => {
    expect(select(['src/features/entries/entries-list.tsx']).e2e).toEqual([
      'check-in.spec.ts',
      'entries.spec.ts',
      'smoke.spec.ts',
    ]);
  });

  it('resolves relative imports, as well as @/', () => {
    expect(select(['src/features/tips/tips-view.tsx']).e2e).toEqual(['smoke.spec.ts', 'tips.spec.ts']);
  });

  it('picks a spec that imports the changed module itself', () => {
    expect(select(['src/data/tips.ts']).e2e).toEqual(['smoke.spec.ts', 'swaps.spec.ts', 'tips.spec.ts']);
  });

  it('gives a file in a route folder that nothing imports to that route', () => {
    expect(select(['src/app/check-in/loading.tsx']).e2e).toEqual(['check-in.spec.ts', 'smoke.spec.ts']);
  });

  it('runs everything when a change reaches the root layout', () => {
    for (const file of ['src/app/layout.tsx', 'src/components/app-init.tsx', 'src/db/types.ts', 'src/app/globals.css']) {
      expect(select([file]), file).toMatchObject({ e2e: 'all', offline: true });
    }
  });

  it('runs everything when a change reaches a route mapped to all: setup, Home or Settings', () => {
    for (const file of ['src/features/setup/wizard.tsx', 'src/features/check-in/check-in-card.tsx', 'src/lib/money.ts']) {
      expect(select([file]).e2e, file).toBe('all');
    }
  });

  it('runs everything for a route the map does not list', () => {
    expect(select(['src/app/charts/page.tsx']).e2e).toBe('all');
  });

  it('runs everything, the offline check and the db job for a path no rule matches', () => {
    for (const file of [
      'fixtures/demo.json',
      'scripts/supabase-test-env.mjs',
      '.github/workflows/ci.yml',
      'next.config.ts',
      'package.json',
      'package-lock.json',
      'public/icon-192.png',
      'src/app/favicon.ico',
      'e2e/helpers/setup.ts',
      'src/data/notes.json',
    ]) {
      expect(select([file]), file).toMatchObject({ run: true, e2e: 'all', offline: true, db: true });
    }
  });

  it('runs only the checks for the MCP server, which the web app never loads', () => {
    expect(select(['mcp/server.ts', '.mcp.json'])).toMatchObject({ run: true, e2e: 'none', offline: false, db: false });
  });

  it('runs only the checks for the script that writes the AI city pack into supabase/', () => {
    expect(select(['scripts/write-city-pack.mjs'])).toMatchObject({ run: true, e2e: 'none', offline: false, db: false });
  });

  it('runs no e2e spec for a module that no page or spec imports', () => {
    expect(select(['src/lib/orphan.ts'])).toMatchObject({ run: true, e2e: 'none' });
  });

  it('drops a deleted module from the walk', () => {
    expect(select(['src/features/old.tsx', 'src/features/check-in/week-rows.ts']).e2e).toEqual([
      'check-in.spec.ts',
      'smoke.spec.ts',
    ]);
    expect(select(['src/features/old.tsx'])).toMatchObject({ run: true, e2e: 'none' });
  });

  it('still runs everything when a deleted path is one no rule matches', () => {
    expect(select(['vitest.config.ts'])).toMatchObject({ e2e: 'all', offline: true, db: true });
  });

  it('runs a changed spec, plus smoke', () => {
    expect(select(['e2e/tips.spec.ts']).e2e).toEqual(['smoke.spec.ts', 'tips.spec.ts']);
  });

  it('never lists offline.spec.ts: a change to it turns on the offline check', () => {
    expect(select(['e2e/offline.spec.ts'])).toMatchObject({ run: true, e2e: 'none', offline: true });
    expect(select(['e2e/offline.spec.ts', 'e2e/tips.spec.ts']).e2e).toEqual(['smoke.spec.ts', 'tips.spec.ts']);
  });

  it('turns on the offline check for the service worker and the manifest', () => {
    expect(select(['public/sw.js'])).toMatchObject({ run: true, e2e: 'none', offline: true, db: false });
    expect(select(['src/app/manifest.ts'])).toMatchObject({ e2e: ['smoke.spec.ts'], offline: true });
    expect(select(['src/lib/sw-register.ts'])).toMatchObject({ e2e: 'all', offline: true });
  });

  it('turns on the db job for the database, the account store and its test env', () => {
    expect(select(['supabase/migrations/1_init.sql'])).toMatchObject({ run: true, e2e: 'none', offline: false, db: true });
    expect(select(['src/sync/push.ts'])).toMatchObject({ e2e: 'all', db: true });
    expect(select(['src/lib/supabase/client.ts'])).toMatchObject({ db: true });
  });

  it('turns on the db job for a module the contract tests import', () => {
    const selection = select(['src/db/schemas.ts']);
    expect(selection).toMatchObject({ run: true, e2e: 'none', db: true });
    expect(selection.why.db).toEqual(['`src/db/schemas.ts` is imported by the contract tests']);
  });

  it('runs everything when a full run is asked for, even with nothing changed', () => {
    for (const changed of [['docs/plan.md'], []]) {
      expect(select(changed, { full: true }), JSON.stringify(changed)).toMatchObject({
        run: true,
        e2e: 'all',
        offline: true,
        db: true,
      });
    }
  });

  it('runs nothing when nothing changed', () => {
    expect(select([])).toMatchObject({ run: false, e2e: 'none', offline: false, db: false });
  });

  it('says why each spec was picked', () => {
    const { why } = select(['src/features/check-in/week-rows.ts', 'src/data/tips.ts']);
    expect(why['check-in.spec.ts']).toEqual(['`src/features/check-in/week-rows.ts` → /check-in']);
    expect(why['swaps.spec.ts']).toEqual(['`src/data/tips.ts` is imported by the spec']);
    expect(why['smoke.spec.ts']).toEqual(['runs with every list']);
    expect(select(['src/db/types.ts']).why.all).toEqual(['`src/db/types.ts` reaches the root layout']);
    expect(select(['src/features/setup/wizard.tsx']).why.all).toEqual(['`src/features/setup/wizard.tsx` → /setup']);
    expect(select(['fixtures/demo.json']).why.all).toEqual(['`fixtures/demo.json`: no rule matches it']);
    expect(select(['README.md'], { full: true }).why.all).toEqual(['a full run was asked for']);
  });
});

describe('e2eArgs', () => {
  it('anchors each file, so a name never matches a longer one', () => {
    expect(e2eArgs(['account.spec.ts', 'smoke.spec.ts'])).toBe('e2e/account\\.spec\\.ts$ e2e/smoke\\.spec\\.ts$');
    // Playwright reads each argument as a case-insensitive regex over the absolute path.
    const [account] = e2eArgs(['account.spec.ts']).split(' ').map((arg) => new RegExp(arg, 'gi'));
    expect(account.test('/home/runner/work/app/e2e/account.spec.ts')).toBe(true);
    account.lastIndex = 0;
    expect(account.test('/home/runner/work/app/e2e/accounts.spec.ts')).toBe(false);
  });
});

describe('runOptions', () => {
  it('runs a changed run on Chromium in the default language by default', () => {
    expect(runOptions({})).toEqual({
      scope: 'changed',
      full: false,
      e2e: true,
      browsers: 'chromium',
      languages: 'default',
      projectArgs: '--project=desktop-chrome',
      auto: ['browsers', 'languages'],
    });
  });

  it('runs a full run on every browser and language by default', () => {
    expect(runOptions({ scope: 'full', browsers: 'auto', languages: 'auto' })).toMatchObject({
      full: true,
      browsers: 'all',
      languages: 'all',
      projectArgs: '',
    });
  });

  it('takes browsers and languages as chosen, whatever the scope', () => {
    expect(runOptions({ scope: 'changed', browsers: 'all', languages: 'all' })).toMatchObject({
      full: false,
      browsers: 'all',
      languages: 'all',
      projectArgs: '',
      auto: [],
    });
    expect(runOptions({ scope: 'full', browsers: 'chromium', languages: 'default' })).toMatchObject({
      full: true,
      projectArgs: '--project=desktop-chrome',
      languages: 'default',
    });
  });

  it('runs no e2e in a pull request’s automatic run (quick), on Chromium otherwise as a changed run', () => {
    expect(runOptions({ scope: 'quick' })).toMatchObject({ scope: 'quick', full: false, e2e: false, browsers: 'chromium' });
  });

  it('refuses a value the inputs do not offer', () => {
    expect(() => runOptions({ scope: 'everything' })).toThrow(/scope/);
    expect(() => runOptions({ browsers: 'webkit' })).toThrow(/browsers/);
    expect(() => runOptions({ languages: 'de' })).toThrow(/languages/);
  });
});

describe('statusContext', () => {
  it('posts full-gate only for a full run on every browser and language', () => {
    for (const [browsers, languages] of [['auto', 'auto'], ['all', 'all'], ['auto', 'all'], ['all', 'auto']]) {
      expect(statusContext({ scope: 'full', browsers, languages }), `${browsers}/${languages}`).toBe('full-gate');
    }
  });

  it('posts partial-check for a full run narrowed to one browser or the default language', () => {
    expect(statusContext({ scope: 'full', browsers: 'chromium', languages: 'auto' })).toBe('partial-check');
    expect(statusContext({ scope: 'full', browsers: 'auto', languages: 'default' })).toBe('partial-check');
  });

  it('posts quick-check for a changed run, whatever its browsers and languages', () => {
    expect(statusContext({})).toBe('quick-check');
    expect(statusContext({ scope: 'changed', browsers: 'all', languages: 'all' })).toBe('quick-check');
  });
});

describe('statusDescription', () => {
  it('names the short commit and the options', () => {
    expect(statusDescription('0123456789abcdef', runOptions({ scope: 'full' }))).toBe(
      '0123456 · full · browsers all · languages all',
    );
    expect(statusDescription('0123456789abcdef', runOptions({}))).toBe(
      '0123456 · changed · browsers chromium · languages default',
    );
  });
});

describe('verdict', () => {
  /** What `toJSON(needs)` gives the gate job: each job's result, and the selection as `changes`' outputs. */
  const needs = (results, selection = { run: 'true', e2e: 'all', offline: 'true', db: 'true' }) => ({
    changes: { result: results.changes ?? 'success', outputs: results.changes === 'failure' ? {} : selection },
    ...Object.fromEntries(
      ['checks', 'e2e', 'e2e-report', 'offline', 'db']
        .filter((job) => results[job] !== undefined)
        .map((job) => [job, { result: results[job], outputs: {} }]),
    ),
  });
  const allPassed = { checks: 'success', e2e: 'success', 'e2e-report': 'success', offline: 'success', db: 'success' };

  it('passes a full run only when every job passed', () => {
    expect(verdict('full', needs(allPassed)).state).toBe('success');
  });

  it('fails a full run when a needed job was skipped, cancelled, failed or left no result', () => {
    for (const [job, result] of [
      ['e2e', 'skipped'],
      ['db', 'cancelled'],
      ['offline', 'failure'],
      ['e2e-report', 'skipped'],
      ['checks', undefined],
    ]) {
      const { state, problems } = verdict('full', needs({ ...allPassed, [job]: result }));
      expect(state, `${job} ${result}`).toBe('failure');
      expect(problems, `${job} ${result}`).toEqual([`${job}: ${result ?? 'no result'}, but this full run needs it`]);
    }
  });

  it('fails any run whose changes job did not pass', () => {
    expect(verdict('full', needs({ ...allPassed, changes: 'failure' })).state).toBe('failure');
    expect(verdict('changed', needs({ changes: 'cancelled' })).state).toBe('failure');
  });

  it('passes a changed run when every job passed or was skipped', () => {
    const selection = { run: 'true', e2e: 'e2e/smoke\\.spec\\.ts$', offline: 'false', db: 'false' };
    const results = { checks: 'success', e2e: 'success', 'e2e-report': 'success', offline: 'skipped', db: 'skipped' };
    expect(verdict('changed', needs(results, selection))).toEqual({ state: 'success', problems: [] });
  });

  it('fails a changed run when a job failed or was cancelled, and ignores the report merge', () => {
    const results = { checks: 'success', e2e: 'cancelled', 'e2e-report': 'failure', offline: 'skipped', db: 'skipped' };
    expect(verdict('changed', needs(results))).toEqual({ state: 'failure', problems: ['e2e: cancelled'] });
  });
});

describe('githubOutput', () => {
  it('writes run, e2e, offline and db, with the list as Playwright arguments, and the browsers and languages', () => {
    expect(githubOutput(select(['src/features/check-in/week-rows.ts']), runOptions({}))).toBe(
      'run=true\ne2e=e2e/check-in\\.spec\\.ts$ e2e/smoke\\.spec\\.ts$\noffline=false\ndb=false\n' +
        'projects=--project=desktop-chrome\nlanguages=default\n',
    );
    expect(githubOutput(select(['README.md'], { full: true }), runOptions({ scope: 'full' }))).toBe(
      'run=true\ne2e=all\noffline=true\ndb=true\nprojects=\nlanguages=all\n',
    );
  });
});

describe('summary', () => {
  it('has a row for each picked spec and each extra job, with the reasons', () => {
    const text = summary(select(['src/features/check-in/week-rows.ts', 'src/sync/push.ts', 'public/sw.js']));
    expect(text).toContain('| every e2e spec | `src/sync/push.ts` → /settings |');
    expect(text).toContain('| offline check | `public/sw.js`; every e2e spec runs |');
    expect(text).toContain('| db job | `src/sync/push.ts` |');
  });

  it('lists the specs of a subset, and shortens a long list of reasons', () => {
    const text = summary(select(['src/features/entries/entries-list.tsx']));
    expect(text).toContain('| `entries.spec.ts` | `src/features/entries/entries-list.tsx` → /entries |');
    expect(text).toContain('| `smoke.spec.ts` | runs with every list |');
    const changed = ['a', 'b', 'c', 'd', 'e'].map((name) => `src/features/check-in/${name}.ts`);
    const repo = { ...REPO, ...Object.fromEntries(changed.map((file) => [file, ''])) };
    repo['src/features/check-in/check-in-view.tsx'] += changed.map((file) => `import '@/${file.slice(4, -3)}';\n`).join('');
    const long = summary(selectAffected({ changed, repo, map: MAP }));
    expect(long).toContain('`src/features/check-in/c.ts` → /check-in, and 2 more |');
  });

  it('says so when no e2e spec runs', () => {
    expect(summary(select(['src/lib/money.test.ts']))).toContain('| no e2e spec |');
    expect(summary(select(['docs/plan.md']))).toContain('No checks run: notes only.');
    expect(summary(select([]))).toContain('No checks run: nothing changed against main.');
  });

  it('states the options the run used, and which of them were automatic', () => {
    expect(summary(select([]), runOptions({}))).toContain(
      'Scope **changed** · browsers **chromium** (auto) · languages **default** (auto)',
    );
    expect(summary(select(['README.md'], { full: true }), runOptions({ scope: 'full', browsers: 'chromium' }))).toContain(
      'Scope **full** · browsers **chromium** · languages **all** (auto)',
    );
  });
});

describe('the real app', () => {
  const root = fileURLToPath(new URL('..', import.meta.url));
  const repo = readRepo(root);
  const map = JSON.parse(readFileSync(new URL('../e2e/affected-map.json', import.meta.url), 'utf8'));
  const specs = Object.keys(repo)
    .filter((file) => /^e2e\/[^/]+\.spec\.ts$/.test(file))
    .map((file) => file.slice('e2e/'.length, -'.spec.ts'.length));
  const listed = Object.values(map.routes).filter(Array.isArray).flat();

  it('names a Playwright project that exists for Chromium', () => {
    const config = readFileSync(new URL('../playwright.config.ts', import.meta.url), 'utf8');
    expect(config).toContain(`name: '${runOptions({}).projectArgs.slice('--project='.length)}'`);
  });

  it('resolves every @/ and relative import in src/ and e2e/', () => {
    expect(unresolvedImports(repo)).toEqual([]);
  });

  it('maps every route, and only routes that exist', () => {
    expect(Object.keys(map.routes).sort()).toEqual([...routePages(repo).keys()].sort());
  });

  it('maps every spec but offline.spec.ts, through a route or allOnly', () => {
    const mapped = new Set([...listed, ...map.allOnly]);
    expect(specs.filter((spec) => spec !== 'offline' && !mapped.has(spec))).toEqual([]);
  });

  it('names only specs that exist, never offline.spec.ts, and none both on a route and in allOnly', () => {
    expect([...listed, ...map.allOnly].filter((spec) => !specs.includes(spec) || spec === 'offline')).toEqual([]);
    expect(map.allOnly.filter((spec) => listed.includes(spec))).toEqual([]);
  });
});

// A pull request that is ready for review runs by itself, without e2e (Roshan, 2026-11-02): lint, types, build, unit
// tests and the db job when reached. e2e and the offline check run only when started by hand.
describe('forScope', () => {
  const picked = () => select(['src/features/check-in/week-rows.ts', 'src/sync/push.ts', 'public/sw.js']);

  it('leaves a changed or full run as picked', () => {
    const selection = picked();
    expect(forScope(selection, runOptions({}))).toBe(selection);
    expect(forScope(selection, runOptions({ scope: 'full' }))).toBe(selection);
  });

  it('drops e2e and the offline check from a quick run, and keeps the db job', () => {
    const quick = forScope(picked(), runOptions({ scope: 'quick' }));
    expect(quick).toMatchObject({ run: true, e2e: 'none', offline: false, db: true });
    expect(githubOutput(quick, runOptions({ scope: 'quick' }))).toContain('e2e=none\noffline=false\ndb=true\n');
  });

  it('says in the summary why no e2e ran, and how to get it', () => {
    const text = summary(forScope(picked(), runOptions({ scope: 'quick' })), runOptions({ scope: 'quick' }));
    expect(text).toContain('Scope **quick**');
    expect(text).toContain('| no e2e spec | a pull request’s automatic run has no e2e: start a changed or full run by hand |');
  });
});

describe('a quick run’s verdict', () => {
  it('posts quick-check, and passes with e2e, its report and the offline check skipped', () => {
    expect(statusContext({ scope: 'quick' })).toBe('quick-check');
    const needs = {
      changes: { result: 'success' },
      checks: { result: 'success' },
      e2e: { result: 'skipped' },
      'e2e-report': { result: 'skipped' },
      offline: { result: 'skipped' },
      db: { result: 'success' },
    };
    expect(verdict('quick', needs)).toEqual({ state: 'success', problems: [] });
    expect(verdict('quick', { ...needs, checks: { result: 'failure' } }).state).toBe('failure');
  });
});
