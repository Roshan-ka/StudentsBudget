import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { parseBackup } from '@/features/backup/backup';
import { budgetFigures, type BudgetFigures } from './budget.ts';

const DEMO = 'fixtures/manual-demo/valid/01-everyday-student.json';
const manifest = JSON.parse(readFileSync('fixtures/manual-demo/manifest.json', 'utf8')) as {
  generatedFor: string;
  month: string;
  cases: { path: string; expected?: { leftMinor?: number } }[];
};
const expected = manifest.cases.find((c) => c.path === 'valid/01-everyday-student.json')?.expected;

/** The figures as plain Node computes them: the app's modules loaded through mcp/app-imports.ts, not Vitest. */
function inNode(file: string, today: string): BudgetFigures | null {
  const out = execFileSync(process.execPath, ['mcp/budget-smoke.ts', file, today], { encoding: 'utf8' });
  return JSON.parse(out) as BudgetFigures | null;
}

function inVitest(file: string, today: string): BudgetFigures | null {
  const parsed = parseBackup(readFileSync(file, 'utf8'));
  if (!parsed.ok) throw new Error(parsed.error);
  return budgetFigures(parsed.data, today);
}

describe('the app’s budget maths in plain Node (M2.1)', () => {
  it('loads through the resolve hook and gives the demo month the pack documents', { timeout: 30_000 }, () => {
    const figures = inNode(DEMO, manifest.generatedFor);
    expect(figures?.month).toBe(manifest.month);
    expect(figures?.leftMinor).toBe(expected?.leftMinor);
    // The same answer as the app's code loaded the usual way, envelope by envelope and for the week.
    expect(figures).toEqual(inVitest(DEMO, manifest.generatedFor));
  });

  it('has nothing to say before a plan exists', { timeout: 30_000 }, () => {
    expect(inNode('fixtures/manual-demo/valid/14-fresh-setup.json', manifest.generatedFor)).toBeNull();
  });
});
