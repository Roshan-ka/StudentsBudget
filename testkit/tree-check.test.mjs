import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import treeCheck, { treeChanges } from './tree-check.mjs';

describe('treeChanges', () => {
  it('names what appeared and what went away', () => {
    expect(treeChanges(['?? a.txt', ' M b.ts'], ['?? a.txt', ' M b.ts'])).toEqual([]);
    expect(treeChanges([' M b.ts'], [' M b.ts', '?? new.json'])).toEqual(['?? new.json']);
    expect(treeChanges([' M b.ts', '?? a.txt'], [' M b.ts'])).toEqual(['gone: ?? a.txt']);
  });
});

describe('the tree check as a globalSetup', () => {
  let dir;
  afterEach(() => rmSync(dir, { recursive: true, force: true }));

  /** A small git checkout that ignores out/, as a repo ignores its test output. */
  function repo() {
    dir = mkdtempSync(path.join(tmpdir(), 'tree-check-'));
    execFileSync('git', ['init', '-q'], { cwd: dir });
    writeFileSync(path.join(dir, '.gitignore'), 'out/\n');
    return dir;
  }

  it('passes when the run left the checkout as it was, ignored output included', async () => {
    const root = repo();
    const teardown = await treeCheck({ rootDir: root });
    execFileSync('git', ['-C', root, 'check-ignore', '-q', 'out/x'], { stdio: 'ignore' });
    await expect(teardown()).resolves.toBeUndefined();
  });

  it('fails the run when a test wrote a file into the repo, naming it', async () => {
    const root = repo();
    const teardown = await treeCheck({ rootDir: root });
    writeFileSync(path.join(root, 'written-by-a-test.json'), '{}');
    await expect(teardown()).rejects.toThrow('the run changed files in the repo:\n  ?? written-by-a-test.json');
  });
});
