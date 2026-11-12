import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { applyMutation, flattenReport, isExpectFailure, judgeProof, owners, parseMutations, proofLines, summarize } from './judge.mjs';

const ROOT = path.resolve('/repo');
const SPEC = 'e2e/a.spec.ts';
const ABS = path.join(ROOT, 'e2e', 'a.spec.ts');
const EXPECT_ERROR = 'Error: expect(received).toBe(expected) // Object.is equality';

/** A Playwright JSON report: one file, tests given as { title, line, project, status, at?, message?, expectedStatus? }. */
function report(tests, { describe: group } = {}) {
  const specs = tests.map((t) => ({
    title: t.title,
    file: 'a.spec.ts',
    line: t.line,
    tests: [
      {
        projectName: t.project ?? 'chrome',
        expectedStatus: t.expectedStatus ?? 'passed',
        results: t.status === undefined ? [] : [
          {
            status: t.status,
            ...(t.status === 'failed' || t.status === 'timedOut'
              ? { error: { message: `\u001b[31m${t.message ?? EXPECT_ERROR}\u001b[39m\nmore`, ...(t.at ? { location: { file: ABS, line: t.at, column: 5 } } : {}) } }
              : {}),
          },
        ],
      },
    ],
  }));
  const file = group ? { title: 'a.spec.ts', file: 'a.spec.ts', specs: [], suites: [{ title: group, specs }] } : { title: 'a.spec.ts', file: 'a.spec.ts', specs };
  return { config: { rootDir: path.join(ROOT, 'e2e') }, suites: [file] };
}

const flat = (tests, opts) => flattenReport(report(tests, opts), ROOT);
const passed = (title, line, project) => ({ title, line, project, status: 'passed' });

describe('parseMutations', () => {
  const good = { name: 'm', file: 'src/a.ts', find: 'a', replace: 'b', expect: { [SPEC]: ['shows-a'] } };

  it('takes a valid file', () => {
    const { mutations, problems } = parseMutations({ format: 0, mutations: [good] });
    expect(problems).toEqual([]);
    expect(mutations).toEqual([good]);
  });

  it('names every problem at once', () => {
    const { problems } = parseMutations({
      format: 1,
      mutations: [
        good,
        { ...good },
        { name: 'out', file: '../x.ts', find: 'a', replace: 'a', expect: {} },
        { name: 'ids', file: 'src/a.ts', find: 'a', replace: 'b', expect: { [SPEC]: ['Bad Id'] } },
      ],
    });
    expect(problems).toEqual([
      'format must be 0',
      'mutation 2 "m": the name is used twice',
      'mutation 3 "out": file must be a path inside the repo',
      'mutation 3 "out": replace equals find, so it changes nothing',
      'mutation 3 "out": expect names no spec, so it would prove nothing',
      `mutation 4 "ids": "${SPEC}": proof ids are lower case, digits and dashes`,
    ]);
  });

  it('refuses an empty list', () => {
    expect(parseMutations({ format: 0, mutations: [] }).problems).toEqual(['mutations must list at least one']);
  });
});

describe('proofLines and applyMutation', () => {
  it('finds each proof id with its lines', () => {
    const source = ["test('a', () => {", "  expect(x).toBe(1); // proof: one", '  // proof: two', '  expect(y).toBe(2); // proof: one'].join('\n');
    expect(proofLines(source)).toEqual(new Map([['one', [2, 4]], ['two', [3]]]));
  });

  it('applies a find that occurs once, and calls any other count stale', () => {
    expect(applyMutation('a DENY b', { find: 'DENY', replace: '$&X' })).toEqual({ ok: true, text: 'a $&X b' });
    expect(applyMutation('a b', { find: 'DENY', replace: 'X' })).toEqual({ ok: false, reason: 'find no longer matches the file' });
    expect(applyMutation('DENY DENY', { find: 'DENY', replace: 'X' }).ok).toBe(false);
  });

  it("matches a find over several lines in the file's own line endings", () => {
    const find = 'if (error) {\n  show(error);';
    const replace = 'if (error) {\n  return;';
    expect(applyMutation('a\r\nif (error) {\r\n  show(error);\r\n}', { find, replace })).toEqual({ ok: true, text: 'a\r\nif (error) {\r\n  return;\r\n}' });
    expect(applyMutation('a\nif (error) {\n  show(error);\n}', { find, replace })).toEqual({ ok: true, text: 'a\nif (error) {\n  return;\n}' });
  });
});

describe('flattenReport', () => {
  it('gives repo-relative paths, titles under their group, and the first line of the error without colours', () => {
    const [entry] = flat([{ title: 'shows a', line: 10, status: 'failed', at: 12 }], { describe: 'group' });
    expect(entry).toEqual({
      spec: SPEC,
      line: 10,
      title: 'group › shows a',
      project: 'chrome',
      expectedStatus: 'passed',
      status: 'failed',
      at: { spec: SPEC, line: 12 },
      message: EXPECT_ERROR,
      expectFailure: true,
    });
  });

  it('says when a test has no result', () => {
    expect(flat([{ title: 't', line: 3 }])[0].status).toBe('did not run');
  });
});

describe('isExpectFailure', () => {
  it('knows an assertion by its first line, or by the line after its own message', () => {
    expect(isExpectFailure('Error: expect(locator).toBeVisible() failed')).toBe(true);
    expect(isExpectFailure('expect.soft(received).toBe(expected)')).toBe(true);
    expect(isExpectFailure('Error: the total\n\nexpect(received).toBe(expected)')).toBe(true);
    expect(isExpectFailure('Error: locator.click: Timeout 5000ms exceeded.\nCall log:\n  - waiting for expect(x)')).toBe(false);
    expect(isExpectFailure('')).toBe(false);
  });
});

describe('owners', () => {
  it('takes the test that starts last above the line, in every project and variant', () => {
    const green = flat([passed('a', 3, 'chrome'), passed('b · en', 10, 'chrome'), passed('b · de', 10, 'chrome'), passed('b · en', 10, 'phone'), passed('c', 20)]);
    expect(owners(green, SPEC, 12).map((e) => `${e.title}|${e.project}`)).toEqual(['b · en|chrome', 'b · de|chrome', 'b · en|phone']);
    expect(owners(green, SPEC, 2)).toEqual([]);
  });
});

describe('judgeProof', () => {
  const green = flat([passed('a', 3, 'chrome'), passed('b', 10, 'chrome'), passed('b', 10, 'phone')]);
  const judge = (redTests, lines = [12], g = green) => judgeProof({ green: g, red: flat(redTests), spec: SPEC, lines });

  it('proves when every owning test fails with an expect error on the proof line', () => {
    const red = [{ title: 'b', line: 10, project: 'chrome', status: 'failed', at: 12 }, { title: 'b', line: 10, project: 'phone', status: 'failed', at: 12 }];
    expect(judge(red)).toEqual({ verdict: 'proven', reason: `red at ${SPEC}:12 in 2 tests` });
  });

  it('still proves after an edit above the test moved it down', () => {
    const moved = flat([passed('a', 3, 'chrome'), passed('b', 15, 'chrome'), passed('b', 15, 'phone')]);
    const red = [{ title: 'b', line: 15, project: 'chrome', status: 'failed', at: 17 }, { title: 'b', line: 15, project: 'phone', status: 'failed', at: 17 }];
    expect(judge(red, [17], moved).verdict).toBe('proven');
  });

  it('is not proven when one project stays green', () => {
    const red = [{ title: 'b', line: 10, project: 'chrome', status: 'failed', at: 12 }, { title: 'b', line: 10, project: 'phone', status: 'passed' }];
    expect(judge(red)).toEqual({ verdict: 'not-proven', reason: 'stayed green: b [phone]' });
  });

  it('is not proven when the test fails on another line', () => {
    const red = [{ title: 'b', line: 10, project: 'chrome', status: 'failed', at: 11 }, { title: 'b', line: 10, project: 'phone', status: 'failed', at: 12 }];
    expect(judge(red).verdict).toBe('not-proven');
    expect(judge(red).reason).toContain(`red elsewhere: b [chrome] at ${SPEC}:11`);
  });

  it("proves an assertion that carries its own message (Playwright puts the message first)", () => {
    // As the live run on security-headers.spec.ts reported it: `expect(headers[…], path).toBe('DENY')`.
    const message = 'Error: /\n\nexpect(received).toBe(expected) // Object.is equality\n\nExpected: "DENY"';
    const red = ['chrome', 'phone'].map((project) => ({ title: 'b', line: 10, project, status: 'failed', at: 12, message }));
    expect(judge(red).verdict).toBe('proven');
  });

  it('is not proven when the failure on the proof line is an action, not an assertion', () => {
    const red = ['chrome', 'phone'].map((project) => ({ title: 'b', line: 10, project, status: 'failed', at: 12, message: 'Error: locator.click: Timeout 5000ms exceeded.' }));
    expect(judge(red).reason).toContain('(not an expect failure)');
  });

  it('calls a proof id that is gone, or on two lines, stale', () => {
    expect(judge([], [])).toEqual({ verdict: 'stale', reason: 'the proof id is no longer in the spec' });
    expect(judge([], [12, 14]).verdict).toBe('stale');
    expect(judge([], [1]).verdict).toBe('stale');
  });

  it('is inconclusive when a test was not green before, timed out, or every owner was skipped', () => {
    const notGreen = flat([{ title: 'b', line: 10, project: 'chrome', status: 'failed', at: 12 }]);
    expect(judge([], [12], notGreen).verdict).toBe('inconclusive');
    const red = ['chrome', 'phone'].map((project) => ({ title: 'b', line: 10, project, status: 'timedOut', at: 12 }));
    expect(judge(red)).toEqual({ verdict: 'inconclusive', reason: 'b [chrome]: timed out' });
    const skipped = flat([{ title: 'b', line: 10, project: 'phone', status: 'skipped' }]);
    expect(judge([], [12], skipped).verdict).toBe('inconclusive');
  });

  it('leaves a skipped project out and judges the rest', () => {
    const someSkipped = flat([passed('b', 10, 'chrome'), { title: 'b', line: 10, project: 'phone', status: 'skipped' }]);
    expect(judge([{ title: 'b', line: 10, project: 'chrome', status: 'failed', at: 12 }], [12], someSkipped).verdict).toBe('proven');
  });

  it('does not judge a known-bug test', () => {
    const knownBug = flat([{ title: 'b', line: 10, project: 'chrome', status: 'failed', at: 12, expectedStatus: 'failed' }]);
    expect(judge([], [12], knownBug).verdict).toBe('known-bug');
  });
});

describe('summarize', () => {
  it('holds only when nothing is not proven, stale or inconclusive', () => {
    expect(summarize([{ verdict: 'proven' }, { verdict: 'known-bug' }]).ok).toBe(true);
    expect(summarize([{ verdict: 'proven' }, { verdict: 'stale' }]).ok).toBe(false);
    expect(summarize([]).ok).toBe(false);
  });
});
