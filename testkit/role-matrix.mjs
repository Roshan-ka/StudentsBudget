// The role matrix (testkit/README.md, "Role matrix"): who may do what, as rows of role × level × subject × action ×
// channel → allowed or refused, each naming where it is proven. Pure functions: the app's specs hold every assertion,
// the adapter discovers the protected actions, and these keep the matrix complete and its proofs real.

export const FORMAT = 0;
const SUBJECTS = new Set(['own', 'other-user', 'other-tenant']);
const CHANNELS = new Set(['ui', 'server']);
const EXPECTS = new Set(['allowed', 'refused']);
const SPEC_PROOF = /^([^#\s]+\.spec\.ts)#([a-z0-9][a-z0-9-]*)$/;
const EXTERNAL_PROOF = /^external:([a-z0-9-]+):(.+)$/;

const keyOf = (row) => [row.role, row.level, row.subject, row.action, row.channel].join(' · ');

/**
 * Checks a matrix file's JSON. A row's `proof` is `<spec>#<proof id>` (an e2e assertion, red before green proves it)
 * or `external:<suite>:<name>` (another suite proves it, such as a database test); a row may instead carry a `flag`, a
 * question for a person, and no proof yet.
 * @returns {{ rows: object[], problems: string[] }}
 */
export function parseMatrix(json) {
  const problems = [];
  if (json?.format !== FORMAT) problems.push(`format must be ${FORMAT}`);
  const list = json?.rows;
  if (!Array.isArray(list) || list.length === 0) return { rows: [], problems: [...problems, 'rows must list at least one cell'] };
  const rows = [];
  const seen = new Set();
  list.forEach((row, i) => {
    const label = `row ${i + 1}`;
    const before = problems.length;
    for (const field of ['role', 'level', 'action']) if (typeof row?.[field] !== 'string' || row[field] === '') problems.push(`${label}: needs a ${field}`);
    if (!SUBJECTS.has(row?.subject)) problems.push(`${label}: subject must be own, other-user or other-tenant`);
    if (!CHANNELS.has(row?.channel)) problems.push(`${label}: channel must be ui or server`);
    if (!EXPECTS.has(row?.expect)) problems.push(`${label}: expect must be allowed or refused`);
    const proofOk = typeof row?.proof === 'string' && (SPEC_PROOF.test(row.proof) || EXTERNAL_PROOF.test(row.proof));
    if (!proofOk && !(row?.proof == null && typeof row?.flag === 'string' && row.flag !== '')) {
      problems.push(`${label}: proof must be <spec>#<id> or external:<suite>:<name>, or the row carries a flag instead`);
    }
    if (problems.length > before) return;
    const key = keyOf(row);
    if (seen.has(key)) problems.push(`${label}: ${key} is in the matrix twice`);
    seen.add(key);
    rows.push(row);
  });
  return { rows, problems };
}

/** The discovered actions no row names: a new protected page, control or server call the matrix doesn't cover yet. */
export function missingActions(rows, discovered) {
  const named = new Set(rows.map((row) => row.action));
  return [...new Set(discovered)].filter((action) => !named.has(action)).sort();
}

/**
 * Every problem with the rows' proofs: a spec proof whose id isn't in that spec, an external proof the suite doesn't
 * hold. `readSpec(path)` gives a spec's text or null; `hasExternal(suite, name)` whether that suite has the check.
 */
export function proofProblems(rows, { readSpec, hasExternal }) {
  const problems = [];
  for (const row of rows) {
    if (row.proof == null) continue;
    const spec = SPEC_PROOF.exec(row.proof);
    if (spec) {
      const source = readSpec(spec[1]);
      if (source === null) problems.push(`${keyOf(row)}: ${spec[1]} doesn't exist`);
      else if (!new RegExp(`//\\s*proof:\\s*${spec[2]}\\b`).test(source)) problems.push(`${keyOf(row)}: proof id "${spec[2]}" isn't in ${spec[1]}`);
      continue;
    }
    const [, suite, name] = EXTERNAL_PROOF.exec(row.proof);
    if (!hasExternal(suite, name)) problems.push(`${keyOf(row)}: ${suite} has no check named "${name}"`);
  }
  return problems;
}

/** The matrix as a Markdown table for a job summary: each cell, what it expects, and what proves it. */
export function matrixMarkdown(title, rows) {
  const lines = [`### ${title}`, '', '| Role | Level | Subject | Action | Channel | Expect | Proven by |', '|---|---|---|---|---|---|---|'];
  for (const row of rows) {
    const proof = row.proof ?? `flagged: ${row.flag}`;
    lines.push(`| ${row.role} | ${row.level} | ${row.subject} | ${row.action} | ${row.channel} | ${row.expect} | ${proof} |`);
  }
  return `${lines.join('\n')}\n`;
}
