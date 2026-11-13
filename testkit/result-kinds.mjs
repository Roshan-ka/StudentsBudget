// Result kinds (testkit/README.md, "Result kinds"): every test of a run in one of these, so a summary never calls a run
// green while something didn't run or can't be judged. Pure functions; result-kinds-reporter.mjs feeds them.

export const KINDS = ['verified', 'failed', 'inconclusive', 'not run', 'skipped by design', 'quarantined', 'known bug'];

/**
 * The skip allow-list entry a skip's message matches: its `message`, or else its `reason`, found in the message; an
 * entry for the test's own file first (a skip in a shared helper names the helper's file).
 */
export function allowListEntry(allowList, file, message) {
  const hits = (allowList ?? []).filter((e) => message.includes(e.message ?? e.reason));
  return hits.find((e) => e.file === file) ?? hits[0];
}

/**
 * One test's kind, from what Playwright reports.
 * @param test { file, tags: string[], expectedStatus, annotations: { type, description }[] }
 * @param result { status, retry } of its last run; `runs` how many runs it had, `flaky` whether an earlier one failed
 * @returns {{ kind: string, note?: string }}
 */
export function kindOf(test, result, { flaky = false, allowList = [] } = {}) {
  const note = (type) => test.annotations?.find((a) => a.type === type)?.description;
  if (test.tags?.includes('@quarantine')) return { kind: 'quarantined', note: note('quarantine') ?? 'no owner or fix-by date given' };
  if (!result || result.status === 'interrupted') return { kind: 'not run', note: result ? 'interrupted' : 'did not run' };
  if (result.status === 'skipped') {
    const message = note('skip') ?? note('fixme') ?? '';
    const entry = allowListEntry(allowList, test.file, message);
    if (entry?.kind === 'by-design') return { kind: 'skipped by design', note: message };
    return { kind: 'not run', note: message ? `${message}${entry ? '' : ' (not on the skip allow-list)'}` : 'skipped without a reason' };
  }
  if (test.expectedStatus === 'failed') {
    if (result.status === 'failed') return { kind: 'known bug', note: note('issue') ?? note('fail') ?? 'no issue named' };
    return { kind: 'failed', note: 'a known bug (test.fail) passed: it is fixed, or the test no longer reaches it' };
  }
  if (result.status === 'passed') return flaky ? { kind: 'inconclusive', note: 'passed only on a retry' } : { kind: 'verified' };
  return { kind: 'failed', note: result.status };
}

/** Counts per kind, and whether the run holds: nothing failed, inconclusive or not run. */
export function tally(rows) {
  const counts = Object.fromEntries(KINDS.map((k) => [k, rows.filter((r) => r.kind === k).length]));
  return { counts, ok: rows.length > 0 && counts.failed + counts.inconclusive + counts['not run'] === 0 };
}

/** The summary as Markdown: the verdict, the counts, then every test that isn't plainly verified, with why. */
export function summaryMarkdown(title, rows) {
  const { counts, ok } = tally(rows);
  const blocking = ['failed', 'inconclusive', 'not run'].filter((k) => counts[k]).map((k) => `${counts[k]} ${k}`);
  const verdict = ok ? `**${counts.verified} verified**, nothing failed, inconclusive or not run` : `**not all verified**: ${blocking.join(', ') || 'no test ran'}`;
  const lines = [`### ${title}`, '', verdict, '', `| ${KINDS.join(' | ')} |`, `|${KINDS.map(() => '---').join('|')}|`, `| ${KINDS.map((k) => counts[k]).join(' | ')} |`, ''];
  const listed = rows.filter((r) => r.kind !== 'verified');
  if (listed.length) {
    lines.push('| Test | Kind | Why |', '|---|---|---|');
    for (const r of listed) lines.push(`| ${r.title} [${r.project}] | ${r.kind} | ${r.note ?? ''} |`);
    lines.push('');
  }
  return lines.join('\n');
}
