import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { checkMutationFile, checkSkips } from '../testkit/checks.mjs';

// StudentsBudget's side of testkit/ (testkit/README.md): the kit stays free of this app's names, every saved mutation
// still fits the code it names, and every skip in the e2e specs is on the allow-list with its kind.

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
  it('lists every skip in the e2e specs and helpers, and nothing else', () => {
    const files = filesUnder('e2e')
      .filter((f) => f.endsWith('.ts'))
      .map((f) => ({ path: f, source: read(f) }));
    expect(checkSkips(files, JSON.parse(read('e2e/skip-allow-list.json')))).toEqual([]);
  });
});
