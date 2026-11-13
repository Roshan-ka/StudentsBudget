import { describe, expect, it } from 'vitest';
import { matrixMarkdown, missingActions, parseMatrix, proofProblems } from './role-matrix.mjs';

const row = (more = {}) => ({
  role: 'viewer',
  level: 'one-factor',
  subject: 'own',
  action: 'page:/admin',
  channel: 'ui',
  expect: 'refused',
  proof: 'e2e/roles.spec.ts#viewer-page',
  ...more,
});

describe('parseMatrix', () => {
  it('takes valid rows, with spec, external or flagged proofs', () => {
    const rows = [row(), row({ channel: 'server', proof: 'external:dbtest:the viewer gets no queue' }), row({ action: 'rpc:limit', proof: null, flag: 'intended?' })];
    expect(parseMatrix({ format: 0, rows })).toEqual({ rows, problems: [] });
  });

  it('names every problem: a bad field, a missing proof, a cell twice', () => {
    const { problems } = parseMatrix({
      format: 0,
      rows: [row(), row(), row({ subject: 'theirs', channel: 'api', expect: 'maybe' }), row({ action: 'x', proof: 'roles.spec.ts' })],
    });
    expect(problems).toEqual([
      'row 2: viewer · one-factor · own · page:/admin · ui is in the matrix twice',
      'row 3: subject must be own, other-user or other-tenant',
      'row 3: channel must be ui or server',
      'row 3: expect must be allowed or refused',
      'row 4: proof must be <spec>#<id> or external:<suite>:<name>, or the row carries a flag instead',
    ]);
    expect(parseMatrix({ format: 1, rows: [] }).problems).toEqual(['format must be 0', 'rows must list at least one cell']);
  });
});

describe('missingActions', () => {
  it('names each discovered action no row covers, once', () => {
    expect(missingActions([row(), row({ action: 'rpc:queue' })], ['rpc:queue', 'rpc:decide', 'rpc:decide'])).toEqual(['rpc:decide']);
  });
});

describe('proofProblems', () => {
  const specs = { 'e2e/roles.spec.ts': 'await expect(x).toBeHidden(); // proof: viewer-page\n' };
  const context = { readSpec: (p) => specs[p] ?? null, hasExternal: (suite, name) => suite === 'dbtest' && name === 'present' };

  it('passes proofs that exist, and names those that do not', () => {
    expect(proofProblems([row(), row({ proof: 'external:dbtest:present' }), row({ proof: null, flag: 'later' })], context)).toEqual([]);
    expect(proofProblems([row({ proof: 'e2e/roles.spec.ts#gone' }), row({ proof: 'e2e/x.spec.ts#a' }), row({ proof: 'external:dbtest:absent' })], context)).toEqual([
      'viewer · one-factor · own · page:/admin · ui: proof id "gone" isn\'t in e2e/roles.spec.ts',
      "viewer · one-factor · own · page:/admin · ui: e2e/x.spec.ts doesn't exist",
      'viewer · one-factor · own · page:/admin · ui: dbtest has no check named "absent"',
    ]);
  });
});

describe('matrixMarkdown', () => {
  it('lists each cell with what proves it, and a flag where no proof is yet', () => {
    const text = matrixMarkdown('Roles', [row(), row({ action: 'rpc:limit', proof: null, flag: 'intended?' })]);
    expect(text).toContain('| viewer | one-factor | own | page:/admin | ui | refused | e2e/roles.spec.ts#viewer-page |');
    expect(text).toContain('| flagged: intended? |');
  });
});
