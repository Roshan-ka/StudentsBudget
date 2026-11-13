import { describe, expect, it } from 'vitest';
import { checkMutationFile, checkQuarantine, checkSkips, proofKind, skipSites, testAbove } from './checks.mjs';

describe('proofKind', () => {
  it('tells page matchers from value matchers', () => {
    expect(proofKind('await expect(link).toBeHidden(); // proof: x')).toBe('page');
    expect(proofKind('await expect(page).not.toHaveURL(/admin/); // proof: x')).toBe('page');
    expect(proofKind("expect(status).toBe(403); // proof: x")).toBe('value');
    expect(proofKind('// proof: x')).toBeNull();
  });
});

describe('testAbove', () => {
  it('finds the test a line is in, and whether it uses page', () => {
    const source = ["test('a', async ({ request }) => {", '  x;', '});', "test('b', async ({", '  page,', '}) => {', '  y;', '});'].join('\n');
    expect(testAbove(source, 2)).toEqual({ line: 1, usesPage: false });
    expect(testAbove(source, 7)).toEqual({ line: 4, usesPage: true });
  });
});

describe('checkMutationFile', () => {
  const SPEC = [
    "test('header', async ({ request }) => {",
    "  expect(value).toBe('DENY'); // proof: deny",
    '});',
    "test('page', async ({ page }) => {",
    '  await expect(link).toBeHidden(); // proof: hidden',
    "  expect(count).toBe(0); // proof: count",
    '  // proof: loose',
    '});',
  ].join('\n');
  const FILES = { 'src/a.ts': "value: 'DENY'", 'e2e/a.spec.ts': SPEC };
  const read = (p) => FILES[p] ?? null;
  const file = (expect, extra = {}) => ({ format: 0, mutations: [{ name: 'm', file: 'src/a.ts', find: 'DENY', replace: 'NO', expect, ...extra }] });

  it('passes a mutation that fits the code', () => {
    expect(checkMutationFile(file({ 'e2e/a.spec.ts': ['deny', 'hidden'] }), read)).toEqual([]);
  });

  it('names what no longer fits', () => {
    expect(checkMutationFile(file({ 'e2e/a.spec.ts': ['gone'] }, { find: 'ALLOW' }), read)).toEqual([
      '"m": src/a.ts: find no longer matches the file',
      '"m": proof id "gone" isn\'t in e2e/a.spec.ts',
    ]);
    expect(checkMutationFile(file({ 'e2e/b.spec.ts': ['x'] }), read)).toEqual(['"m": e2e/b.spec.ts doesn\'t exist']);
  });

  it('refuses a value proof in a page test, and a proof comment away from its matcher', () => {
    expect(checkMutationFile(file({ 'e2e/a.spec.ts': ['count', 'loose'] }), read)).toEqual([
      '"m": e2e/a.spec.ts:6: a value assertion proves only in a request-only test; the test at line 4 uses page, so assert on the page',
      '"m": e2e/a.spec.ts:7: the proof comment must sit on the line with the matcher, where a failure is reported',
    ]);
  });
});

describe('skips', () => {
  const SOURCE = [
    "test.skip(browserName !== 'chromium', 'Needs Chromium');",
    '// test.skip(old, "commented out");',
    'test.skip(',
    '  !webgl,',
    "  'Needs WebGL',",
    ');',
    "testInfo.skip(off, 'Server reused');",
  ].join('\n');

  it('finds skip calls with the text of their reason, not commented ones', () => {
    expect(skipSites(SOURCE).map((s) => s.line)).toEqual([1, 3, 7]);
  });

  it('passes when every skip is listed with the right count', () => {
    const list = [
      { file: 'e2e/a.spec.ts', reason: 'Needs Chromium', kind: 'by-design' },
      { file: 'e2e/a.spec.ts', reason: 'Needs WebGL', kind: 'by-design' },
      { file: 'e2e/a.spec.ts', reason: 'Server reused', kind: 'environment' },
    ];
    expect(checkSkips([{ path: 'e2e/a.spec.ts', source: SOURCE }], list)).toEqual([]);
  });

  it('names an unlisted skip, a count that is off, an entry for a missing file, and a bad kind', () => {
    const list = [
      { file: 'e2e/a.spec.ts', reason: 'Needs Chromium', kind: 'by-design', count: 2 },
      { file: 'e2e/a.spec.ts', reason: 'Server reused', kind: 'later' },
      { file: 'e2e/gone.spec.ts', reason: 'x', kind: 'by-design' },
    ];
    expect(checkSkips([{ path: 'e2e/a.spec.ts', source: SOURCE }], list)).toEqual([
      'entry 2: kind must be by-design or environment',
      "e2e/a.spec.ts:3: a skip that isn't on the allow-list (add it, with its kind)",
      'e2e/a.spec.ts: "Needs Chromium" matches 1 skip, the allow-list says 2',
      'e2e/gone.spec.ts: on the allow-list, but not among the files checked',
    ]);
  });
});

describe('checkQuarantine', () => {
  const file = (source) => [{ path: 'e2e/a.spec.ts', source }];

  it('passes a quarantined test with an owner and a date still ahead', () => {
    const source = "test('flaky', { tag: '@quarantine', annotation: { type: 'quarantine', description: 'Roshan, fix by 2026-12-01: WebKit' } }, async () => {});";
    expect(checkQuarantine(file(source), '2026-11-13')).toEqual([]);
  });

  it('names a quarantined test without a note, without an owner and date, or past its date', () => {
    expect(checkQuarantine(file("test('a', { tag: '@quarantine' }, async () => {});"), '2026-11-13')[0]).toContain('needs annotation');
    expect(checkQuarantine(file("test('a', { tag: '@quarantine', annotation: { type: 'quarantine', description: 'someday' } }, async () => {});"), '2026-11-13')[0]).toContain('owner and a date');
    expect(checkQuarantine(file("test('a', { tag: '@quarantine', annotation: { type: 'quarantine', description: 'Roshan, fix by 2026-11-01' } }, async () => {});"), '2026-11-13')).toEqual([
      'e2e/a.spec.ts:1: past its fix-by date (2026-11-01): fix the test, or take it out',
    ]);
    expect(checkQuarantine(file("// test('a', { tag: '@quarantine' })"), '2026-11-13')).toEqual([]);
  });
});
