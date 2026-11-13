// A Playwright reporter that sorts every test into a result kind (result-kinds.mjs) and writes the summary as Markdown
// to `outputFile` (and prints it), for a CI job summary. A run whose tests didn't all hold (failed, inconclusive or not
// run) ends as failed, even when Playwright alone would call it passed: an environment skip is not a green run.
//
//   reporter: [['list'], ['../testkit/result-kinds-reporter.mjs', { title, allowList, outputFile }]]
//
// `allowList` and `outputFile` are paths from the directory Playwright runs in.

import fs from 'node:fs';
import path from 'node:path';
import { kindOf, summaryMarkdown, tally } from './result-kinds.mjs';

export default class ResultKindsReporter {
  constructor({ title = 'Result kinds', allowList, outputFile } = {}) {
    this.title = title;
    this.allowList = allowList && fs.existsSync(allowList) ? JSON.parse(fs.readFileSync(allowList, 'utf8')) : [];
    this.outputFile = outputFile;
    this.rows = [];
  }

  onBegin(config, suite) {
    this.root = config.rootDir;
    this.suite = suite;
  }

  onEnd(result) {
    const repo = process.cwd();
    for (const test of this.suite.allTests()) {
      const results = test.results;
      const last = results.at(-1);
      const flaky = results.length > 1 && last?.status === 'passed';
      const file = path.relative(repo, test.location.file).replace(/\\/g, '/');
      const kind = kindOf({ file, tags: test.tags, expectedStatus: test.expectedStatus, annotations: test.annotations }, last, { flaky, allowList: this.allowList });
      this.rows.push({
        title: test.titlePath().slice(3).join(' › ') || test.title,
        project: test.parent.project()?.name ?? '',
        ...kind,
        // For the duration flag: what the last run took, against the test's own timeout.
        ...(last?.status === 'passed' ? { duration: last.duration, timeout: test.timeout } : {}),
      });
    }
    const markdown = summaryMarkdown(this.title, this.rows);
    if (this.outputFile) {
      fs.mkdirSync(path.dirname(path.resolve(this.outputFile)), { recursive: true });
      fs.writeFileSync(this.outputFile, `${markdown}\n`);
    }
    process.stdout.write(`\n${markdown}\n`);
    if (result.status === 'passed' && !tally(this.rows).ok) return { status: 'failed' };
    return undefined;
  }

  printsToStdio() {
    return false;
  }
}
