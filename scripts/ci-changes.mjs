// Prints `app=…` and `db=…` lines for $GITHUB_OUTPUT: which CI jobs this pull request needs (scripts/ci-areas.mjs).
// CI checks out the pull request's merge commit, whose first parent is the base branch as it is now, so the diff
// between the two is exactly what merging would change.
import { execFileSync } from 'node:child_process';
import { areasOf } from './ci-areas.mjs';

const files = execFileSync('git', ['diff', '--name-only', 'HEAD^1', 'HEAD'], { encoding: 'utf8' })
  .split('\n')
  .filter(Boolean);
const { app, db } = areasOf(files);
console.error(`${files.length} changed files: app=${app}, db=${db}`);
process.stdout.write(`app=${app}\ndb=${db}\n`);
