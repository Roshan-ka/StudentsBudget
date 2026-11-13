import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { totpCode } from '../src/sync/totp.ts';
import { checkMutationFile, checkQuarantine, checkSkips } from '../testkit/checks.mjs';
import { totp } from '../testkit/leak-check.mjs';
import { missingActions, parseMatrix, proofProblems } from '../testkit/role-matrix.mjs';

// StudentsBudget's side of testkit/ (testkit/README.md): the kit stays free of this app's names, every saved mutation
// still fits the code it names, every skip in the e2e specs is on the allow-list with its kind, and the role matrix
// is whole: it parses, its proofs exist, and it names every function the migrations guard with acting_moderator().

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const read = (rel) => {
  const file = path.join(ROOT, rel);
  return existsSync(file) ? readFileSync(file, 'utf8') : null;
};

/** Every file under a folder, repo-relative with forward slashes. */
function filesUnder(rel) {
  const out = [];
  const walk = (dir) => {
    for (const name of readdirSync(path.join(ROOT, dir))) {
      const child = `${dir}/${name}`;
      if (statSync(path.join(ROOT, child)).isDirectory()) walk(child);
      else out.push(child);
    }
  };
  walk(rel);
  return out.sort();
}

describe('testkit/', () => {
  it("names nothing of this app: not its name, its backend or its roles", () => {
    const hits = filesUnder('testkit').flatMap((file) =>
      read(file)
        .split(/\r?\n/)
        .flatMap((text, i) => (/supabase|studentsbudget|moderat|aal/i.test(text) ? [`${file}:${i + 1}`] : [])),
    );
    expect(hits).toEqual([]);
  });
});

describe('e2e/mutations/', () => {
  const files = filesUnder('e2e/mutations').filter((f) => f.endsWith('.json'));

  it('holds at least one saved mutation', () => {
    expect(files.length).toBeGreaterThan(0);
  });

  it.each(files)('%s still fits the code it names', (file) => {
    expect(checkMutationFile(JSON.parse(read(file)), read)).toEqual([]);
  });
});

describe('e2e/skip-allow-list.json', () => {
  // It reads every e2e file: over 5 s on a busy laptop (2026-11-13, while the heavy lane ran a harness suite).
  it('lists every skip in the e2e specs and helpers, mocked, real and live, and nothing else', { timeout: 30_000 }, () => {
    const files = [...filesUnder('e2e'), ...filesUnder('e2e-real'), ...filesUnder('e2e-live')]
      .filter((f) => f.endsWith('.ts'))
      .map((f) => ({ path: f, source: read(f) }));
    expect(checkSkips(files, JSON.parse(read('e2e/skip-allow-list.json')))).toEqual([]);
  });
});

/**
 * The public functions whose body asks private.acting_moderator(), from the migrations' text: `rpc:<name>`. The stack
 * job checks the same against the running database (`node e2e-real/db.mjs check-matrix`, pg_proc), which also sees a
 * function a later migration replaced.
 */
function guardedInMigrations() {
  const guarded = new Set();
  for (const file of filesUnder('supabase/migrations').filter((f) => f.endsWith('.sql'))) {
    const text = read(file);
    for (const match of text.matchAll(/create (?:or replace )?function public\.(\w+)\(/g)) {
      const open = text.indexOf('$$', match.index);
      const body = text.slice(open, text.indexOf('$$', open + 2));
      if (body.includes('private.acting_moderator()')) guarded.add(`rpc:${match[1]}`);
    }
  }
  return [...guarded];
}

describe('e2e-real/roles/matrix.json', () => {
  const { rows, problems } = parseMatrix(JSON.parse(read('e2e-real/roles/matrix.json')));

  it('parses', () => {
    expect(problems).toEqual([]);
  });

  it('cites only proofs that exist: proof ids in the specs, and pgTAP checks by name', () => {
    const pgtap = filesUnder('supabase/tests')
      .filter((f) => f.endsWith('.sql'))
      .map(read)
      .join('\n');
    const hasExternal = (suite, name) => suite === 'pgtap' && pgtap.includes(`'${name}'`);
    expect(proofProblems(rows, { readSpec: read, hasExternal })).toEqual([]);
  });

  it('names every function the migrations guard with acting_moderator()', () => {
    const guarded = guardedInMigrations();
    expect(guarded.length).toBeGreaterThan(0);
    expect(missingActions(rows, guarded)).toEqual([]);
  });
});

describe('quarantined tests', () => {
  it('each name an owner and a fix-by date that has not passed', () => {
    const files = [...filesUnder('e2e'), ...filesUnder('e2e-real')]
      .filter((f) => f.endsWith('.ts'))
      .map((f) => ({ path: f, source: read(f) }));
    expect(checkQuarantine(files, new Date().toISOString().slice(0, 10))).toEqual([]);
  });
});

/** The lines of a workflow's top-level block `key:` (or of a job, `  name:`), up to the next line as far out. */
function block(text, key) {
  const lines = text.split(/\r?\n/);
  const start = lines.findIndex((line) => line === `${key}:`);
  if (start === -1) return [];
  const indent = key.length - key.trimStart().length;
  const out = [];
  for (const line of lines.slice(start + 1)) {
    if (line.trim() && !line.trim().startsWith('#') && line.length - line.trimStart().length <= indent) break;
    out.push(line);
  }
  return out;
}
/** The keys one level inside a block. */
const keysOf = (lines) => {
  const inner = Math.min(...lines.filter((line) => line.trim() && !line.trim().startsWith('#')).map((line) => line.length - line.trimStart().length));
  return lines.filter((line) => line.length - line.trimStart().length === inner && /^\s*[\w-]+:/.test(line)).map((line) => line.trim().split(':')[0]);
};

// The live smoke types a real password and key (the skill's scheduled-runs.md, A9 and E6): its config records nothing,
// its workflow uploads nothing, starts only on a schedule or by hand, keeps the secrets in the live-smoke environment,
// runs one at a time, and runs the leak check first.
describe('the live smoke (e2e-live/, .github/workflows/live-smoke.yml)', () => {
  const config = read('e2e-live/playwright.config.ts');
  const workflow = read('.github/workflows/live-smoke.yml');

  it('records nothing, with one worker and one browser', () => {
    for (const setting of ["trace: 'off'", "screenshot: 'off'", "video: 'off'", 'workers: 1,', "process.env.PLAYWRIGHT_NO_COPY_PROMPT = '1'"]) {
      expect(config, setting).toContain(setting);
    }
    expect(config.match(/name: '[\w-]+'/g)).toEqual(["name: 'desktop-chrome'"]);
  });

  it('starts on a schedule or by hand only, one run at a time, and uploads nothing', () => {
    expect(keysOf(block(workflow, 'on'))).toEqual(['schedule', 'workflow_dispatch']);
    expect(block(workflow, 'concurrency').map((line) => line.trim())).toEqual(['group: live-smoke', 'cancel-in-progress: false', '']);
    expect(workflow).not.toMatch(/upload-artifact|pull_request/);
  });

  it('runs the smoke after the leak check, with the secrets of the live-smoke environment and nowhere else', () => {
    expect(keysOf(block(workflow, 'jobs'))).toEqual(['leak-check', 'smoke']);
    const smoke = block(workflow, '  smoke').join('\n');
    expect(smoke).toMatch(/^ {4}needs: leak-check$/m);
    expect(smoke).toMatch(/^ {4}environment: live-smoke$/m);
    expect(block(workflow, '  leak-check').join('\n')).toContain('node e2e-live/leak-check.mjs');
    const secrets = workflow.match(/secrets\.\w+/g);
    expect(secrets).toEqual(['secrets.E2E_LIVE_EMAIL', 'secrets.E2E_LIVE_PASSWORD', 'secrets.E2E_LIVE_TOTP_SECRET']);
    expect(smoke.match(/secrets\.\w+/g)).toEqual(secrets);
  });

  it('looks for the same codes the smoke types: the kit computes them as src/sync/totp.ts does', () => {
    const key = 'JBSWY3DPEHPK3PXPJBSWY3DPEHPK3PXP';
    for (const time of [0, 59_000, 1_763_000_000_000, Date.now()]) expect(totp(key, time), String(time)).toBe(totpCode(key, time));
  });
});
