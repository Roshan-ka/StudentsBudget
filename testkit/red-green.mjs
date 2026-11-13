#!/usr/bin/env node
// Red before green for saved mutations, without AI (testkit/README.md, "Mutations"):
//
//   node testkit/red-green.mjs --mutations <dir> [--config <file>] [--project <name>]… [--adapter <module>] <spec>…
//
// 1. The specs run once as they are: every test a proof id names must pass (green).
// 2. Each saved mutation that names one of the specs is applied in place, the specs run again, and the file is put back
//    straight after, whatever happens. `.red-green/pending.json` holds the original until then, so a run that was
//    killed is repaired by the next one before it starts.
// 3. testkit/judge.mjs judges each proof id: proven only when its tests fail with an expect error on its line.
// 4. The tree must be as it was (`git status`), or the run fails and names what changed.
//
// The run is local to this checkout: a free port is chosen for the app (E2E_PORT), so a server already running is never
// reused, and the config's web server builds the mutated app. An adapter module may export `applyStep(file)`, the
// commands (each an array) that bring a running backend in line with a changed file, such as a database reset after a
// migration; they run after the mutation and again after the restore. Exit codes: 0 every proof holds, 1 a proof doesn't
// (not proven, stale or inconclusive), 2 the run couldn't start, 3 the tree changed.

import fs from 'node:fs';
import net from 'node:net';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import { applyEdits, flattenReport, judgeProof, parseMutations, proofLines, summarize } from './judge.mjs';

const MARK = { proven: '✓', 'not-proven': '✗', stale: 'stale', inconclusive: '?', 'known-bug': 'known bug' };

function fail(code, text) {
  console.error(`red-green: ${text}`);
  process.exit(code);
}

function parseArgs(argv) {
  const options = { config: 'playwright.config.ts', mutations: null, projects: [], adapter: null, specs: [] };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    const value = () => {
      const v = argv[i + 1];
      if (v === undefined || v.startsWith('--')) fail(2, `${arg} needs a value`);
      i += 1;
      return v;
    };
    if (arg === '--config') options.config = value();
    else if (arg === '--mutations') options.mutations = value();
    else if (arg === '--project') options.projects.push(value());
    else if (arg === '--adapter') options.adapter = value();
    else if (arg.startsWith('--')) fail(2, `unknown option ${arg}`);
    else options.specs.push(path.posix.normalize(arg.replace(/\\/g, '/')));
  }
  if (!options.mutations) fail(2, '--mutations <dir> is required');
  if (options.specs.length === 0) fail(2, 'name at least one spec');
  return options;
}

const git = (root, args) => spawnSync('git', ['-C', root, ...args], { encoding: 'utf8' });

function freePort() {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const { port } = server.address();
      server.close(() => resolve(port));
    });
  });
}

function runSteps(root, steps, when) {
  for (const step of steps) {
    const [command, ...args] = step;
    const done = spawnSync(command, args, { cwd: root, stdio: 'inherit', shell: process.platform === 'win32' });
    if (done.status !== 0) return `${when}: \`${step.join(' ')}\` exited ${done.status}`;
  }
  return null;
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const top = git(process.cwd(), ['rev-parse', '--show-toplevel']);
  if (top.status !== 0) fail(2, 'run it inside a git checkout');
  const root = path.resolve(top.stdout.trim());
  const work = path.join(root, '.red-green');
  const pendingFile = path.join(work, 'pending.json');
  fs.mkdirSync(work, { recursive: true });

  // A run that was killed while a mutation was applied left the originals here: put them back first.
  const putBack = () => {
    if (!fs.existsSync(pendingFile)) return null;
    const pending = JSON.parse(fs.readFileSync(pendingFile, 'utf8'));
    const originals = Array.isArray(pending) ? pending : [pending];
    for (const { file, original } of originals) fs.writeFileSync(path.join(root, file), Buffer.from(original, 'base64'));
    fs.rmSync(pendingFile);
    return originals.map((o) => o.file).join(', ');
  };
  const repaired = putBack();
  if (repaired) console.log(`red-green: put ${repaired} back from a run that was stopped`);
  for (const signal of ['SIGINT', 'SIGTERM']) {
    process.on(signal, () => {
      putBack();
      process.exit(130);
    });
  }

  const adapter = options.adapter ? await import(pathToFileURL(path.resolve(root, options.adapter)).href) : {};
  const stepsFor = (file) => (typeof adapter.applyStep === 'function' ? adapter.applyStep(file) ?? [] : []);

  // The saved mutations that name any of the specs asked for.
  const dir = path.resolve(root, options.mutations);
  if (!fs.existsSync(dir)) fail(2, `${options.mutations} doesn't exist`);
  const chosen = [];
  for (const name of fs.readdirSync(dir).filter((n) => n.endsWith('.json')).sort()) {
    const { mutations, problems } = parseMutations(JSON.parse(fs.readFileSync(path.join(dir, name), 'utf8')));
    if (problems.length) fail(2, `${name}:\n  ${problems.join('\n  ')}`);
    for (const m of mutations) {
      const specs = Object.keys(m.expect).filter((s) => options.specs.includes(s));
      if (specs.length) chosen.push({ ...m, specs });
    }
  }
  if (chosen.length === 0) fail(2, `no saved mutation in ${options.mutations} names ${options.specs.join(', ')}`);
  const specs = [...new Set(chosen.flatMap((m) => m.specs))];

  const cli = path.join(root, 'node_modules', '@playwright', 'test', 'cli.js');
  if (!fs.existsSync(cli)) fail(2, 'Playwright is not installed here (npm ci)');
  // Each run gets a port no server holds yet, so a run never reuses the server of the one before it (an unmutated app).
  const playwrightOnce = async (out, files) => {
    fs.rmSync(out, { force: true });
    const port = await freePort();
    // `--project=<name>`, joined: Playwright's --project takes several values, so a spec after `--project <name>` would
    // be read as a project name (seen in the 1c live check's demos, 2026-11-13).
    const args = [cli, 'test', '-c', options.config, '--reporter=line,json', '--retries=0', ...options.projects.map((p) => `--project=${p}`), ...files];
    const env = { ...process.env, E2E_PORT: String(port), PLAYWRIGHT_JSON_OUTPUT_FILE: out, PLAYWRIGHT_JSON_OUTPUT_NAME: out };
    const started = Date.now();
    const done = spawnSync(process.execPath, args, { cwd: root, stdio: ['ignore', 'inherit', 'inherit'], env });
    return `exit ${done.status ?? 'none'}${done.signal ? `, signal ${done.signal}` : ''}${done.error ? `, ${done.error.message}` : ''}, after ${Math.round((Date.now() - started) / 1000)} s`;
  };
  const runPlaywright = async (name, files) => {
    const out = path.join(work, `${name}.json`);
    let ended = await playwrightOnce(out, files);
    if (!fs.existsSync(out)) {
      // Seen once (2026-11-12, the live proof's run 3): Playwright printed nothing and wrote no report. Once more.
      console.error(`red-green: ${name} run wrote no report (${ended}); trying once more`);
      ended = await playwrightOnce(out, files);
      if (!fs.existsSync(out)) {
        console.error(`red-green: ${name} run wrote no report again (${ended})`);
        return null;
      }
    }
    const report = JSON.parse(fs.readFileSync(out, 'utf8'));
    // A web server that never started, say: the tests then have no result, and the verdict says "not green".
    for (const error of report.errors ?? []) console.error(`red-green: ${name} run: ${String(error.message ?? '').split(/\r?\n/)[0]}`);
    return flattenReport(report, root);
  };

  const before = git(root, ['status', '--porcelain=v1', '--untracked-files=all']).stdout;

  console.log(`red-green: green run of ${specs.join(', ')}`);
  const green = await runPlaywright('green', specs);
  if (!green) fail(2, 'the green run wrote no report');
  // A test that wasn't green leaves its proofs inconclusive: keep its traces and error context before the next run
  // clears test-results, so the cause can be read afterwards (CI uploads .red-green/).
  const failedGreen = green.filter((e) => e.status !== 'passed' && e.status !== 'skipped');
  const results = path.join(root, 'test-results');
  if (failedGreen.length && fs.existsSync(results)) {
    fs.cpSync(results, path.join(work, 'green-test-results'), { recursive: true });
    console.log(`red-green: ${failedGreen.length} test(s) not green; their traces are in .red-green/green-test-results`);
  }

  const rows = [];
  for (const [i, m] of chosen.entries()) {
    const sources = Object.fromEntries(m.specs.map((s) => [s, fs.existsSync(path.join(root, s)) ? fs.readFileSync(path.join(root, s), 'utf8') : '']));
    const ids = m.specs.flatMap((spec) => m.expect[spec].map((id) => ({ spec, id, lines: proofLines(sources[spec]).get(id) ?? [] })));
    const each = (verdict, reason) => ids.forEach(({ spec, id }) => rows.push({ mutation: m.name, spec, id, verdict, reason }));

    // Every edit at once (a mutation may break two guards together); each file's original kept to put back.
    const readText = (file) => (fs.existsSync(path.join(root, file)) ? fs.readFileSync(path.join(root, file), 'utf8') : null);
    const applied = applyEdits(m.edits, readText);
    if (!applied.ok) {
      each('stale', applied.reason);
      continue;
    }
    const files = [...applied.texts.keys()];
    const originals = files.map((file) => ({ file, original: fs.readFileSync(path.join(root, file)) }));
    // The steps every changed file needs (a database reset for a migration), each once.
    const steps = [...new Map(files.flatMap(stepsFor).map((step) => [JSON.stringify(step), step])).values()];

    console.log(`red-green: mutation ${i + 1}/${chosen.length} "${m.name}" in ${files.join(', ')}`);
    let red = null;
    let stepProblem = null;
    fs.writeFileSync(pendingFile, JSON.stringify(originals.map(({ file, original }) => ({ file, original: original.toString('base64') }))));
    try {
      for (const file of files) fs.writeFileSync(path.join(root, file), applied.texts.get(file));
      stepProblem = runSteps(root, steps, 'after the mutation');
      if (!stepProblem) red = await runPlaywright(`red-${i + 1}`, m.specs);
    } finally {
      for (const { file, original } of originals) fs.writeFileSync(path.join(root, file), original);
      fs.rmSync(pendingFile, { force: true });
    }
    const undo = runSteps(root, steps, 'after the restore');
    if (undo) fail(2, `${undo}: the backend may still hold the mutation`);
    if (stepProblem || !red) {
      each('inconclusive', stepProblem ?? 'the run under the mutation wrote no report');
      continue;
    }
    for (const { spec, id, lines } of ids) rows.push({ mutation: m.name, spec, id, ...judgeProof({ green, red, spec, lines }) });
  }

  const after = git(root, ['status', '--porcelain=v1', '--untracked-files=all']).stdout;
  console.log('\nred-green: results');
  for (const r of rows) console.log(`  ${MARK[r.verdict]}  ${r.spec} proof:${r.id}  ← "${r.mutation}"${r.reason ? `  (${r.reason})` : ''}`);
  const totals = summarize(rows);
  console.log(`  ${totals.proven} proven, ${totals.notProven} not proven, ${totals.stale} stale, ${totals.inconclusive} inconclusive, ${totals.knownBug} known bug`);
  fs.writeFileSync(path.join(work, 'summary.json'), `${JSON.stringify({ rows, totals }, null, 2)}\n`);
  // In CI, the same table in the job summary.
  if (process.env.GITHUB_STEP_SUMMARY) {
    const table = rows.map((r) => `| ${MARK[r.verdict]} | \`${r.spec}\` | ${r.id} | ${r.mutation} | ${r.reason ?? ''} |`);
    const head = `### Red before green\n\n${totals.proven} proven, ${totals.notProven} not proven, ${totals.stale} stale, ${totals.inconclusive} inconclusive, ${totals.knownBug} known bug\n\n`;
    fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, `${head}| | Spec | Proof | Mutation | Why |\n|---|---|---|---|---|\n${table.join('\n')}\n\n`);
  }
  if (after !== before) fail(3, `the tree changed during the run:\n${after}`);
  process.exit(totals.ok ? 0 : 1);
}

main().catch((error) => fail(2, error?.stack ?? String(error)));
