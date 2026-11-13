#!/usr/bin/env node
// Which specs' saved mutations a run must prove again (testkit/README.md, "Mutations"), from the files a branch changes:
//   - a changed spec that a saved mutation names (its assertions may have moved or changed)
//   - every spec a changed mutations file names
//   - every spec named by a mutation whose target file changed (the code it breaks is new)
//
//   node testkit/changed-proofs.mjs --mutations <dir> [--base origin/main] [--under <folder>/]
//
// prints the specs, space-separated, for testkit/red-green.mjs; `--under` keeps those in one folder (one config each).

import { execFileSync } from 'node:child_process';
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { parseMutations } from './judge.mjs';

/**
 * @param changed repo-relative paths the branch changes
 * @param mutationFiles [{ path, mutations }]: each saved mutations file and what parseMutations() made of it
 * @returns the specs to prove again, sorted
 */
export function specsToProve({ changed, mutationFiles }) {
  const touched = new Set(changed);
  const specs = new Set();
  for (const { path: file, mutations } of mutationFiles) {
    for (const m of mutations) {
      const named = Object.keys(m.expect);
      if (touched.has(file) || m.edits.some((edit) => touched.has(edit.file))) named.forEach((spec) => specs.add(spec));
      else named.filter((spec) => touched.has(spec)).forEach((spec) => specs.add(spec));
    }
  }
  return [...specs].sort();
}

function main() {
  const args = process.argv.slice(2);
  const option = (name, fallback) => {
    const i = args.indexOf(name);
    return i === -1 ? fallback : args[i + 1];
  };
  const dir = option('--mutations');
  if (!dir) {
    console.error('usage: node testkit/changed-proofs.mjs --mutations <dir> [--base origin/main] [--under <folder>/]');
    process.exit(2);
  }
  const base = option('--base', 'origin/main');
  const under = option('--under', '');
  const changed = execFileSync('git', ['diff', '--name-only', '--no-renames', `${base}...HEAD`], { encoding: 'utf8' }).split(/\r?\n/).filter(Boolean);
  const mutationFiles = readdirSync(dir)
    .filter((name) => name.endsWith('.json'))
    .map((name) => {
      const file = path.posix.join(dir.replace(/\\/g, '/').replace(/\/$/, ''), name);
      return { path: file, mutations: parseMutations(JSON.parse(readFileSync(file, 'utf8'))).mutations };
    });
  const specs = specsToProve({ changed, mutationFiles }).filter((spec) => spec.startsWith(under));
  process.stdout.write(`${specs.join(' ')}\n`);
}

if (import.meta.main) main();
