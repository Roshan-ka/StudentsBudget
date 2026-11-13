// The tree check (testkit/README.md, "Tree check"), as a Playwright globalSetup: it records what git sees in the
// checkout before the run, and the teardown it returns fails the run when that changed, naming the files. A test that
// writes into the repo (a fixture file, a download, a saved sign-in in the wrong folder) is caught; git-ignored output
// (test results, the build, saved sign-ins in their ignored folder) isn't counted.

import { execFileSync } from 'node:child_process';

/** What git sees: one line per changed or untracked file, ignored files left out. */
export function treeState(cwd) {
  return execFileSync('git', ['-C', cwd, 'status', '--porcelain=v1', '--untracked-files=all'], { encoding: 'utf8' })
    .split(/\r?\n/)
    .filter(Boolean)
    .sort();
}

/** The lines that differ between two states: what appeared, and what went away. */
export function treeChanges(before, after) {
  const was = new Set(before);
  const is = new Set(after);
  return [...after.filter((line) => !was.has(line)), ...before.filter((line) => !is.has(line)).map((line) => `gone: ${line}`)];
}

/** The globalSetup: Playwright runs the function it returns as the global teardown. */
export default async function treeCheck(config) {
  const cwd = config.rootDir;
  const before = treeState(cwd);
  return async () => {
    const changes = treeChanges(before, treeState(cwd));
    if (changes.length) throw new Error(`the tree check: the run changed files in the repo:\n  ${changes.join('\n  ')}`);
  };
}
