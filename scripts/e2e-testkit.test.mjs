import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { checkMutationFile, checkSkips } from '../testkit/checks.mjs';
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
  it('lists every skip in the e2e specs and helpers, mocked and real, and nothing else', () => {
    const files = [...filesUnder('e2e'), ...filesUnder('e2e-real')]
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
