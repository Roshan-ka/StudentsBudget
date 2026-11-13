// Red before green, judged without AI (testkit/README.md, "Mutations"). Pure functions: no file is read and no process
// started here. testkit/red-green.mjs does the running; testkit/checks.mjs checks saved mutation files at rest.
//
// A saved mutation breaks the app on purpose. Each test it names must then fail with an `expect` error on the line that
// carries its proof id (`// proof: <id>`). Failing anywhere else, or staying green, means the test doesn't prove what it
// claims. The proof id is found by text at run time, so edits above a test never break its proof.

import path from 'node:path';

export const FORMAT = 0;

const ID = /^[a-z0-9][a-z0-9-]*$/;
const PROOF = /\/\/\s*proof:\s*([a-z0-9][a-z0-9-]*)/g;
/** The colour codes Playwright puts into error messages (ESC, then `[…m`). */
const ANSI = new RegExp(`${String.fromCharCode(27)}\\[[0-9;]*m`, 'g');
const EXPECT_FAILURE = /^(?:Error:\s*)?expect(?:\.\w+)?\(/;
const EXPECT_LINE = /^expect(?:\.\w+)?\(/;

/**
 * Whether an error is a failed assertion: `expect(…)`, `expect.soft(…)` or `expect.poll(…)` starts it, or follows the
 * assertion's own message (`expect(value, 'message')` puts the message first: `Error: message`, then `expect(…)`).
 */
export function isExpectFailure(message) {
  const lines = (message ?? '').replace(ANSI, '').split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  if (EXPECT_FAILURE.test(lines[0] ?? '')) return true;
  return /^Error:/.test(lines[0] ?? '') && EXPECT_LINE.test(lines[1] ?? '');
}

/** A repo-relative path with forward slashes that stays inside the repo, or null. */
function relativeInside(p) {
  if (typeof p !== 'string' || p === '' || path.isAbsolute(p) || /^[a-zA-Z]:/.test(p)) return null;
  const clean = path.posix.normalize(p.replace(/\\/g, '/'));
  return clean.startsWith('../') || clean === '..' || clean === '.' ? null : clean;
}

/**
 * Checks one mutations file's JSON. Returns every mutation it can use and every problem, so a file is fixed in one go.
 * A mutation is one edit (`file`, `find`, `replace`), or several at once (`edits`: a list of them) for a behaviour two
 * guards hold, where breaking either alone changes nothing (defence in depth). Each comes back with `edits`, and `file`,
 * the first edit's file.
 * @returns {{ mutations: { name: string, file: string, edits: { file: string, find: string, replace: string }[], expect: Record<string, string[]> }[], problems: string[] }}
 */
export function parseMutations(json) {
  const problems = [];
  const mutations = [];
  if (json?.format !== FORMAT) problems.push(`format must be ${FORMAT}`);
  const list = json?.mutations;
  if (!Array.isArray(list) || list.length === 0) {
    problems.push('mutations must list at least one');
    return { mutations, problems };
  }
  const names = new Set();
  list.forEach((m, i) => {
    const label = `mutation ${i + 1}${typeof m?.name === 'string' && m.name ? ` "${m.name}"` : ''}`;
    const before = problems.length;
    if (typeof m?.name !== 'string' || m.name.trim() === '') problems.push(`${label}: needs a name`);
    else if (names.has(m.name)) problems.push(`${label}: the name is used twice`);
    else names.add(m.name);
    const several = m?.edits !== undefined;
    if (several && (!Array.isArray(m.edits) || m.edits.length < 2)) problems.push(`${label}: edits must list two or more; one edit goes in file, find and replace`);
    const raw = several ? (Array.isArray(m.edits) ? m.edits : []) : [m];
    const edits = raw.map((edit, j) => {
      const at = several ? `${label} edit ${j + 1}` : label;
      const file = relativeInside(edit?.file);
      if (!file) problems.push(`${at}: file must be a path inside the repo`);
      if (typeof edit?.find !== 'string' || edit.find === '') problems.push(`${at}: find must be the exact text to change`);
      if (typeof edit?.replace !== 'string') problems.push(`${at}: replace must be the text to put there`);
      else if (edit.replace === edit.find) problems.push(`${at}: replace equals find, so it changes nothing`);
      return { file, find: edit?.find, replace: edit?.replace };
    });
    const expect = {};
    const entries = Object.entries(m?.expect ?? {});
    if (entries.length === 0) problems.push(`${label}: expect names no spec, so it would prove nothing`);
    for (const [spec, ids] of entries) {
      const where = relativeInside(spec);
      if (!where) problems.push(`${label}: "${spec}" must be a spec path inside the repo`);
      else if (!Array.isArray(ids) || ids.length === 0) problems.push(`${label}: "${spec}" needs at least one proof id`);
      else if (!ids.every((id) => typeof id === 'string' && ID.test(id))) problems.push(`${label}: "${spec}": proof ids are lower case, digits and dashes`);
      else if (new Set(ids).size !== ids.length) problems.push(`${label}: "${spec}" names a proof id twice`);
      else expect[where] = [...ids];
    }
    if (problems.length === before) mutations.push({ name: m.name, file: edits[0].file, edits, expect });
  });
  return { mutations, problems };
}

/** Every proof id in a spec's source, with the lines (1-based) that carry it. */
export function proofLines(source) {
  const found = new Map();
  source.split(/\r?\n/).forEach((text, i) => {
    for (const match of text.matchAll(PROOF)) {
      const lines = found.get(match[1]) ?? [];
      lines.push(i + 1);
      found.set(match[1], lines);
    }
  });
  return found;
}

/**
 * The mutation applied to a file's text: `find` must occur exactly once, or the mutation is stale. A `find` over several
 * lines matches the file's own line endings, so one saved mutation fits a Windows checkout (CRLF) and CI (LF) alike.
 */
export function applyMutation(text, { find, replace }) {
  const eol = text.includes('\r\n') ? '\r\n' : '\n';
  const target = find.replace(/\r?\n/g, eol);
  const count = text.split(target).length - 1;
  if (count === 0) return { ok: false, reason: 'find no longer matches the file' };
  if (count > 1) return { ok: false, reason: `find matches ${count} places, so it isn't clear which to change` };
  return { ok: true, text: text.replace(target, () => replace.replace(/\r?\n/g, eol)) };
}

/**
 * Every edit of a mutation applied, file by file (two edits of one file in turn): the new texts by file, or why the
 * mutation is stale. `read(file)` gives a file's text, or null when it doesn't exist.
 */
export function applyEdits(edits, read) {
  const texts = new Map();
  for (const edit of edits) {
    const current = texts.has(edit.file) ? texts.get(edit.file) : read(edit.file);
    if (current === null) return { ok: false, reason: `${edit.file} doesn't exist` };
    const applied = applyMutation(current, edit);
    if (!applied.ok) return { ok: false, reason: `${edit.file}: ${applied.reason}` };
    texts.set(edit.file, applied.text);
  }
  return { ok: true, texts };
}

const firstLine = (message) => (message ?? '').replace(ANSI, '').trim().split(/\r?\n/)[0] ?? '';

/**
 * One entry per test and project from Playwright's JSON report, its last result only (runs here use no retries).
 * Paths are repo-relative with forward slashes.
 * @returns {{ spec: string, line: number, title: string, project: string, expectedStatus: string, status: string, at?: { spec: string, line: number }, message: string, expectFailure: boolean }[]}
 */
export function flattenReport(report, repoRoot) {
  const rootDir = report?.config?.rootDir ?? repoRoot;
  const rel = (file) => path.relative(repoRoot, path.isAbsolute(file) ? file : path.join(rootDir, file)).replace(/\\/g, '/');
  const entries = [];
  const walk = (suite, titles) => {
    for (const spec of suite.specs ?? []) {
      for (const test of spec.tests ?? []) {
        const result = (test.results ?? []).at(-1);
        const error = result?.error ?? result?.errors?.find((e) => e?.location) ?? result?.errors?.[0];
        const location = error?.location ?? result?.errorLocation;
        entries.push({
          spec: rel(spec.file),
          line: spec.line,
          title: [...titles, spec.title].join(' › '),
          project: test.projectName ?? '',
          expectedStatus: test.expectedStatus ?? 'passed',
          status: result?.status ?? 'did not run',
          ...(location?.file ? { at: { spec: rel(location.file), line: location.line } } : {}),
          message: firstLine(error?.message),
          expectFailure: isExpectFailure(error?.message),
        });
      }
    }
    for (const child of suite.suites ?? []) walk(child, [...titles, child.title]);
  };
  // A file's own suite is titled with its path: leave it out of the test titles.
  for (const top of report?.suites ?? []) walk(top, []);
  return entries;
}

const keyOf = (e) => `${e.project}|${e.spec}|${e.line}|${e.title}`;

/** The tests that own a line: those that start last at or above it in the spec (every project, every variant). */
export function owners(entries, spec, line) {
  const above = entries.filter((e) => e.spec === spec && e.line <= line);
  if (above.length === 0) return [];
  const start = Math.max(...above.map((e) => e.line));
  return above.filter((e) => e.line === start);
}

/** One test under a mutation. */
export function judgeEntry(red, spec, line) {
  if (!red) return { verdict: 'inconclusive', reason: 'did not run under the mutation' };
  if (red.expectedStatus === 'failed') return { verdict: 'known-bug' };
  if (red.status === 'passed') return { verdict: 'stayed-green' };
  if (red.status === 'timedOut') return { verdict: 'inconclusive', reason: 'timed out' };
  if (red.status !== 'failed') return { verdict: 'inconclusive', reason: red.status };
  if (!red.at) return { verdict: 'inconclusive', reason: `failed without a location: ${red.message}` };
  const at = `${red.at.spec}:${red.at.line}`;
  if (red.at.spec !== spec || red.at.line !== line) return { verdict: 'red-elsewhere', at, message: red.message };
  if (!red.expectFailure) return { verdict: 'red-elsewhere', at, message: red.message, reason: 'not an expect failure' };
  return { verdict: 'red-at-proof', at };
}

const label = (e) => `${e.title} [${e.project}]`;

/**
 * One proof id under one mutation, over every test that owns its line.
 * @param green flattenReport() of the run before the mutation; red: of the run under it
 * @param lines the lines carrying the id in the spec (proofLines), [] when it's gone
 * @returns {{ verdict: 'proven' | 'not-proven' | 'stale' | 'known-bug' | 'inconclusive', reason?: string }}
 */
export function judgeProof({ green, red, spec, lines }) {
  if (!lines || lines.length === 0) return { verdict: 'stale', reason: 'the proof id is no longer in the spec' };
  if (lines.length > 1) return { verdict: 'stale', reason: `the proof id is on ${lines.length} lines (${lines.join(', ')})` };
  const [line] = lines;
  const own = owners(green, spec, line);
  if (own.length === 0) return { verdict: 'stale', reason: `line ${line} isn't inside a test that ran` };
  const ran = own.filter((e) => e.status !== 'skipped');
  if (ran.length === 0) return { verdict: 'inconclusive', reason: 'every test that owns the line was skipped' };
  if (ran.some((e) => e.expectedStatus === 'failed')) return { verdict: 'known-bug', reason: 'a known-bug test (test.fail) is not judged' };
  const notGreen = ran.filter((e) => e.status !== 'passed');
  if (notGreen.length > 0) return { verdict: 'inconclusive', reason: `not green before the mutation: ${notGreen.map(label).join('; ')}` };

  const byKey = new Map(red.map((e) => [keyOf(e), e]));
  const judged = ran.map((e) => ({ test: e, ...judgeEntry(byKey.get(keyOf(e)), spec, line) }));
  const pick = (verdict) => judged.filter((j) => j.verdict === verdict);
  if (pick('stayed-green').length) return { verdict: 'not-proven', reason: `stayed green: ${pick('stayed-green').map((j) => label(j.test)).join('; ')}` };
  if (pick('red-elsewhere').length) {
    const j = pick('red-elsewhere')[0];
    return { verdict: 'not-proven', reason: `red elsewhere: ${label(j.test)} at ${j.at}${j.reason ? ` (${j.reason})` : ''}: ${j.message}` };
  }
  if (pick('inconclusive').length) {
    const j = pick('inconclusive')[0];
    return { verdict: 'inconclusive', reason: `${label(j.test)}: ${j.reason}` };
  }
  if (pick('known-bug').length) return { verdict: 'known-bug', reason: 'a known-bug test (test.fail) is not judged' };
  return { verdict: 'proven', reason: `red at ${spec}:${line} in ${judged.length} test${judged.length === 1 ? '' : 's'}` };
}

/** Counts per verdict, and whether the run holds: nothing not proven, stale or inconclusive. Known bugs don't block. */
export function summarize(rows) {
  const count = (v) => rows.filter((r) => r.verdict === v).length;
  const totals = {
    proven: count('proven'),
    notProven: count('not-proven'),
    stale: count('stale'),
    inconclusive: count('inconclusive'),
    knownBug: count('known-bug'),
  };
  return { ...totals, ok: rows.length > 0 && totals.notProven + totals.stale + totals.inconclusive === 0 };
}

/** `--shard i/n` read as `{ index, total }`, or null when it isn't one (1 <= i <= n). */
export function parseShard(text) {
  const match = /^(\d+)\/(\d+)$/.exec(String(text ?? ''));
  if (!match) return null;
  const index = Number(match[1]);
  const total = Number(match[2]);
  return index >= 1 && total >= 1 && index <= total ? { index, total } : null;
}

/** Every `total`-th item, starting at the `index`-th: n shards together take each item exactly once. */
export function inShard(list, { index, total }) {
  return list.filter((_, k) => k % total === index - 1);
}
