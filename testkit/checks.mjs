// Checks at rest, without running anything (testkit/README.md): saved mutation files still fit the code they name, and
// every skip in the specs is on the allow-list. Unit tests call these, so a change that breaks a proof or adds a skip
// fails in the pull request that made it, not at night.

import { applyMutation, parseMutations, proofLines } from './judge.mjs';

/** Matchers that assert on the page, a locator or a response's page state: a proof in a page test must use one. */
const PAGE_MATCHERS = new Set([
  'toBeAttached', 'toBeChecked', 'toBeDisabled', 'toBeEditable', 'toBeEmpty', 'toBeEnabled', 'toBeFocused', 'toBeHidden',
  'toBeInViewport', 'toBeVisible', 'toContainClass', 'toContainText', 'toHaveAccessibleDescription',
  'toHaveAccessibleErrorMessage', 'toHaveAccessibleName', 'toHaveAttribute', 'toHaveCSS', 'toHaveClass', 'toHaveCount',
  'toHaveId', 'toHaveJSProperty', 'toHaveRole', 'toHaveScreenshot', 'toHaveText', 'toHaveTitle', 'toHaveURL',
  'toHaveValue', 'toHaveValues', 'toMatchAriaSnapshot',
]);
const MATCHER = /\.(to[A-Z]\w*)\(/g;
const TEST_START = /^\s*test(?:\.(?:only|fail|fixme|slow))?\(/;
const SKIP_CALL = /\b(?:test|testInfo|test\.describe)\.skip\(/;
const COMMENT = /^\s*(?:\/\/|\*|\/\*)/;
const SKIP_KINDS = new Set(['by-design', 'environment']);

/** 'page' when every matcher on the line is a page matcher, 'value' when one isn't, null when the line has none. */
export function proofKind(text) {
  const matchers = [...text.matchAll(MATCHER)].map((m) => m[1]);
  if (matchers.length === 0) return null;
  return matchers.every((m) => PAGE_MATCHERS.has(m)) ? 'page' : 'value';
}

/** The test call that starts last at or above a line, with its signature up to the arrow, or null. */
export function testAbove(source, line) {
  const lines = source.split(/\r?\n/);
  for (let i = Math.min(line, lines.length) - 1; i >= 0; i -= 1) {
    if (!TEST_START.test(lines[i])) continue;
    const signature = [];
    for (let j = i; j < Math.min(i + 6, lines.length); j += 1) {
      signature.push(lines[j]);
      if (lines[j].includes('=>')) break;
    }
    return { line: i + 1, usesPage: /\{[^}]*\bpage\b[^}]*\}/.test(signature.join(' ')) };
  }
  return null;
}

/**
 * Every problem with one saved mutations file, as it stands against the repo.
 * @param read (repo-relative path) => the file's text, or null when it doesn't exist
 */
export function checkMutationFile(json, read) {
  const { mutations, problems } = parseMutations(json);
  for (const m of mutations) {
    const say = (text) => problems.push(`"${m.name}": ${text}`);
    const target = read(m.file);
    if (target === null) say(`${m.file} doesn't exist`);
    else {
      const applied = applyMutation(target, m);
      if (!applied.ok) say(`${m.file}: ${applied.reason}`);
    }
    for (const [spec, ids] of Object.entries(m.expect)) {
      const source = read(spec);
      if (source === null) {
        say(`${spec} doesn't exist`);
        continue;
      }
      const found = proofLines(source);
      for (const id of ids) {
        const lines = found.get(id) ?? [];
        if (lines.length === 0) {
          say(`proof id "${id}" isn't in ${spec}`);
          continue;
        }
        if (lines.length > 1) {
          say(`proof id "${id}" is on ${lines.length} lines of ${spec} (${lines.join(', ')}); each id marks one assertion`);
          continue;
        }
        const [line] = lines;
        const kind = proofKind(source.split(/\r?\n/)[line - 1]);
        if (kind === null) say(`${spec}:${line}: the proof comment must sit on the line with the matcher, where a failure is reported`);
        const test = testAbove(source, line);
        if (!test) say(`${spec}:${line} isn't inside a test`);
        else if (kind === 'value' && test.usesPage) {
          say(`${spec}:${line}: a value assertion proves only in a request-only test; the test at line ${test.line} uses page, so assert on the page`);
        }
      }
    }
  }
  return problems;
}

/** The skip calls in a file's source: their line and the text of the call (a few lines, for its reason). */
export function skipSites(source) {
  const lines = source.split(/\r?\n/);
  const sites = [];
  lines.forEach((text, i) => {
    if (!COMMENT.test(text) && SKIP_CALL.test(text)) sites.push({ line: i + 1, call: lines.slice(i, i + 4).join('\n') });
  });
  return sites;
}

/**
 * Every skip in the files must be on the allow-list, and every entry must still match its skips. An entry is
 * `{ file, reason, kind, count?, message? }`: `reason` is text found in the call (its message, or the constant holding
 * it), `message` text of the message the run reports when the call holds only a constant (result-kinds.mjs), `kind`
 * is `by-design` (a browser or option that can't run the test) or `environment` (a setup problem the run reports as
 * not run), `count` how many skips in the file carry it (1 by default).
 * @param files [{ path, source }]
 */
export function checkSkips(files, allowList) {
  const problems = [];
  const entries = Array.isArray(allowList) ? allowList : [];
  if (!Array.isArray(allowList)) problems.push('the allow-list must be a list');
  entries.forEach((e, i) => {
    if (typeof e?.file !== 'string' || typeof e?.reason !== 'string' || e.reason === '') problems.push(`entry ${i + 1}: needs a file and a reason`);
    if (!SKIP_KINDS.has(e?.kind)) problems.push(`entry ${i + 1}: kind must be by-design or environment`);
    if (e?.message !== undefined && (typeof e.message !== 'string' || e.message === '')) problems.push(`entry ${i + 1}: message, when given, is text`);
  });
  const matched = new Map(entries.map((e) => [e, 0]));
  for (const { path, source } of files) {
    const own = entries.filter((e) => e.file === path);
    for (const site of skipSites(source)) {
      const hit = own.find((e) => site.call.includes(e.reason));
      if (hit) matched.set(hit, matched.get(hit) + 1);
      else problems.push(`${path}:${site.line}: a skip that isn't on the allow-list (add it, with its kind)`);
    }
  }
  const paths = new Set(files.map((f) => f.path));
  for (const [e, n] of matched) {
    const want = e.count ?? 1;
    if (!paths.has(e.file)) problems.push(`${e.file}: on the allow-list, but not among the files checked`);
    else if (n !== want) problems.push(`${e.file}: "${e.reason}" matches ${n} skip${n === 1 ? '' : 's'}, the allow-list says ${want}`);
  }
  return problems;
}
