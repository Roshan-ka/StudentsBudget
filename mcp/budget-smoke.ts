// Runs the app's backup parser and budget maths in plain Node, the way the server will:
// `node mcp/budget-smoke.ts <backup.json> <YYYY-MM-DD>` prints this month's figures as JSON. mcp/budget.test.ts runs it.
import { readFileSync } from 'node:fs';
import { registerAppImports } from './app-imports.ts';

registerAppImports();
const { parseBackup } = await import('@/features/backup/backup');
const { budgetFigures } = await import('./budget.ts');

const [file, today] = process.argv.slice(2);
const parsed = parseBackup(readFileSync(file, 'utf8'));
if (!parsed.ok) {
  console.error(parsed.error);
  process.exit(1);
}
console.log(JSON.stringify(budgetFigures(parsed.data, today)));
