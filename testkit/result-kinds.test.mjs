import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import ResultKindsReporter from './result-kinds-reporter.mjs';
import { allowListEntry, kindOf, summaryMarkdown, tally } from './result-kinds.mjs';

const ALLOW_LIST = [
  { file: 'e2e/passkeys.spec.ts', reason: 'VIRTUAL_ONLY', message: 'only Chromium has', kind: 'by-design' },
  { file: 'e2e/helpers/server.ts', reason: 'The reused server has no settings', kind: 'environment' },
];
const test = (more = {}) => ({ file: 'e2e/passkeys.spec.ts', tags: [], expectedStatus: 'passed', annotations: [], ...more });
const skip = (description) => ({ annotations: [{ type: 'skip', description }] });

describe('allowListEntry', () => {
  it('matches a skip by its message, or its reason, preferring an entry of the same file', () => {
    expect(allowListEntry(ALLOW_LIST, 'e2e/passkeys.spec.ts', 'Makes a passkey: only Chromium has one.')?.kind).toBe('by-design');
    expect(allowListEntry(ALLOW_LIST, 'e2e/a.spec.ts', 'The reused server has no settings: stop it.')?.kind).toBe('environment');
    expect(allowListEntry(ALLOW_LIST, 'e2e/a.spec.ts', 'something else')).toBeUndefined();
  });
});

describe('kindOf', () => {
  const opts = { allowList: ALLOW_LIST };

  it('sorts passed, failed and timed-out tests', () => {
    expect(kindOf(test(), { status: 'passed' }, opts)).toEqual({ kind: 'verified' });
    expect(kindOf(test(), { status: 'failed' }, opts)).toEqual({ kind: 'failed', note: 'failed' });
    expect(kindOf(test(), { status: 'timedOut' }, opts)).toEqual({ kind: 'failed', note: 'timedOut' });
    expect(kindOf(test(), { status: 'passed' }, { ...opts, flaky: true })).toEqual({ kind: 'inconclusive', note: 'passed only on a retry' });
  });

  it('calls a skip on the allow-list by design, and any other skip not run', () => {
    expect(kindOf(test(skip('Makes a passkey: only Chromium has one.')), { status: 'skipped' }, opts)).toEqual({
      kind: 'skipped by design',
      note: 'Makes a passkey: only Chromium has one.',
    });
    expect(kindOf(test(skip('The reused server has no settings: stop it.')), { status: 'skipped' }, opts).kind).toBe('not run');
    expect(kindOf(test(skip('a new reason')), { status: 'skipped' }, opts)).toEqual({ kind: 'not run', note: 'a new reason (not on the skip allow-list)' });
    expect(kindOf(test(), { status: 'skipped' }, opts)).toEqual({ kind: 'not run', note: 'skipped without a reason' });
    expect(kindOf(test(), undefined, opts)).toEqual({ kind: 'not run', note: 'did not run' });
  });

  it('lists known bugs apart, and fails one that passed', () => {
    const bug = test({ expectedStatus: 'failed', annotations: [{ type: 'issue', description: 'SB-12' }] });
    expect(kindOf(bug, { status: 'failed' }, opts)).toEqual({ kind: 'known bug', note: 'SB-12' });
    expect(kindOf(bug, { status: 'passed' }, opts).kind).toBe('failed');
  });

  it('lists a quarantined test apart, whatever it did', () => {
    const quarantined = test({ tags: ['@quarantine'], annotations: [{ type: 'quarantine', description: 'Roshan, fix by 2026-12-01' }] });
    expect(kindOf(quarantined, { status: 'failed' }, opts)).toEqual({ kind: 'quarantined', note: 'Roshan, fix by 2026-12-01' });
  });
});

describe('tally and summaryMarkdown', () => {
  it('holds only when nothing failed, is inconclusive or did not run', () => {
    expect(tally([{ kind: 'verified' }, { kind: 'skipped by design' }, { kind: 'known bug' }]).ok).toBe(true);
    expect(tally([{ kind: 'verified' }, { kind: 'not run' }]).ok).toBe(false);
    expect(tally([]).ok).toBe(false);
  });

  it('says so plainly, and lists every test that is not plainly verified', () => {
    const rows = [
      { title: 'a', project: 'chrome', kind: 'verified' },
      { title: 'b', project: 'phone', kind: 'skipped by design', note: 'only Chromium' },
      { title: 'c', project: 'chrome', kind: 'not run', note: 'server reused' },
    ];
    const text = summaryMarkdown('Journeys', rows);
    expect(text).toContain('### Journeys');
    expect(text).toContain('**not all verified**: 1 not run');
    expect(text).toContain('| b [phone] | skipped by design | only Chromium |');
    expect(text).not.toContain('| a [chrome]');
    expect(summaryMarkdown('J', rows.slice(0, 2))).toContain('**1 verified**, nothing failed, inconclusive or not run');
  });
});

describe('ResultKindsReporter', () => {
  /** A suite as Playwright hands it to a reporter, with what each test is and did. */
  function suiteOf(cases) {
    const tests = cases.map(([title, file, results, more = {}]) => ({
      title,
      location: { file: path.resolve(file) },
      tags: [],
      expectedStatus: 'passed',
      annotations: [],
      results,
      titlePath: () => ['', 'chrome', file, title],
      parent: { project: () => ({ name: 'chrome' }) },
      ...more,
    }));
    return { allTests: () => tests };
  }

  it('writes the summary and fails a run Playwright would pass when a test did not run', () => {
    const dir = mkdtempSync(path.join(tmpdir(), 'kinds-'));
    try {
      const allowList = path.join(dir, 'allow.json');
      writeFileSync(allowList, JSON.stringify(ALLOW_LIST));
      const outputFile = path.join(dir, 'out', 'kinds.md');
      const reporter = new ResultKindsReporter({ title: 'Journeys', allowList, outputFile });
      reporter.onBegin({ rootDir: process.cwd() }, suiteOf([
        ['signs in', 'e2e/a.spec.ts', [{ status: 'passed' }]],
        ['passkey', 'e2e/passkeys.spec.ts', [{ status: 'skipped' }], skip('only Chromium has one')],
        ['reminder', 'e2e/r.spec.ts', [{ status: 'skipped' }], skip('The reused server has no settings')],
      ]));
      const write = process.stdout.write;
      process.stdout.write = () => true;
      let ended;
      try {
        ended = reporter.onEnd({ status: 'passed' });
      } finally {
        process.stdout.write = write;
      }
      expect(ended).toEqual({ status: 'failed' });
      const text = readFileSync(outputFile, 'utf8');
      expect(text).toContain('**not all verified**: 1 not run');
      expect(text).toContain('| passkey [chrome] | skipped by design | only Chromium has one |');
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
