# testkit: end-to-end checks that need no AI

Reusable parts for end-to-end testing, kept apart from any one app: no app name, backend name or role name appears in this folder (a unit test outside it holds that). Everything app-specific lives in the app's **adapter** and data files. The formats below are **v0**: they change until a second app has used them.

What's here now:

| File | What it does |
|---|---|
| `judge.mjs` | Judges red before green: was a test red, at the right line, under a saved mutation? Pure functions. |
| `red-green.mjs` | Runs the saved mutations of the specs you name, and prints the verdict per proof. |
| `checks.mjs` | Checks at rest: saved mutation files still fit the code, and every skip is on the allow-list. |
| `network-guard.mjs` | Stops any request to a host outside the test setup, and fails the test that made it. |
| `tree-check.mjs` | A Playwright `globalSetup`: the run fails when a test wrote a file into the repo. |
| `result-kinds.mjs`, `result-kinds-reporter.mjs` | Sorts each test into a result kind, writes the summary, and fails a run that isn't all verified. |

The other parts the plan names (the role-matrix runner, the walker for the random clicker) join when a phase uses them.

## Network guard

`guardContext(context, allowed)` puts a browser context behind the guard. `allowed` lists origins (`http://localhost:3210`) or hosts with their port (`127.0.0.1:54321`), from the adapter. Schemes that need no network (`data:`, `blob:`) always pass.

- **The guard is the last route in line.** A host the test mocks with `page.route` never reaches it, and a test's own route can still `fallback()` to it.
- **A request to any other host is aborted.** After the test, `assertClean()` fails it, naming each host once and never a path or query.
- **One per context.** A suite's automatic fixture guards the test's context. A test that opens another context, a second phone say, guards that one too.
- **Requests through Playwright's `request` fixture aren't routed,** so the adapter guards those itself (its environment guard).

## Tree check

`tree-check.mjs` is a `globalSetup`. It records `git status` before the run, and the teardown it returns fails the run when that changed, naming the files. Git-ignored output, such as test results, the build and saved sign-ins, isn't counted.

## Mutations (format 0)

A saved mutation breaks the app on purpose, so a test proves it can fail. One JSON file per spec, in the app's mutations folder:

```json
{
  "format": 0,
  "mutations": [
    {
      "name": "pages may be framed",
      "file": "src/lib/headers.ts",
      "find": "{ key: 'X-Frame-Options', value: 'DENY' }",
      "replace": "{ key: 'X-Frame-Options', value: 'SAMEORIGIN' }",
      "expect": { "e2e/headers.spec.ts": ["frame-deny"] }
    }
  ]
}
```

- **`find`** must occur exactly once in `file`. `replace` is put there.
- **`expect`** maps a spec to its **proof ids**. A proof id marks one assertion in the spec, as a comment on the line with the matcher:

  ```ts
  expect(headers['x-frame-options'], path).toBe('DENY'); // proof: frame-deny
  ```

- **The tests that own the line** are those that start last at or above it, in every project and every variant (tests made in a loop share one line).

### How a proof is judged

1. **Green first:** the spec runs unchanged. Every owning test must pass, or the proof is *inconclusive*.
2. **Then red:** the mutation is applied, the spec runs again, and the file is put back.
3. **The verdict:**

| Verdict | When |
|---|---|
| ✓ proven | every owning test failed with an `expect` error on the proof line |
| ✗ not proven | an owning test stayed green, or failed somewhere else (another line, or not an `expect` error) |
| stale | `find` no longer matches, or the proof id is gone, or it's on more than one line |
| known bug | the test is `test.fail()`: not judged |
| ? inconclusive | it timed out, was skipped, didn't run, or wasn't green before |

The proof id is found by text each time, so editing above a test never breaks its proof. Renaming the id, or changing the code `find` names, makes it stale, and `checkMutationFile` fails the unit tests in the same pull request.

### Page proof and value proof

- **In a test that uses `page`,** the proof must be a page matcher (`toBeVisible`, `toHaveText`, `toBeHidden`, …). A value read from storage may stay in the test as an extra check, never as the proof.
- **In a request-only test** (no `page`), a value matcher may prove: a status, an error code, a response's body, or a value read back from the backend.

### Running

```sh
node testkit/red-green.mjs --mutations <dir> [--config <file>] [--project <name>] [--adapter <module>] <spec>…
```

- Every Playwright run gets a free port of its own for the app (`E2E_PORT`), so no run reuses a server that's already running (an unmutated app), and the config's web server builds the mutated app.
- An assertion with its own message (`expect(value, 'message')`) counts: Playwright puts the message first and `expect(…)` on the next line.
- A run that writes no report is tried once more, and the log says how the process ended.
- **The mutated file is put back** right after its run. `.red-green/pending.json` (git-ignored) holds the original until then, and the next run puts it back first if a run was killed.
- **The tree must be unchanged at the end** (`git status`), or the run fails (exit 3).
- **An adapter may export `applyStep(file)`:** the commands that bring a running backend in line with a changed file (a database reset after a schema file, say). They run after the mutation and again after the restore.
- **Exit codes:** 0 every proof holds; 1 a proof is not proven, stale or inconclusive; 2 the run couldn't start; 3 the tree changed. Results go to `.red-green/summary.json`.

## Skip allow-list

Every skip in the specs is listed with its kind, so a skip can't hide a test that should have run:

```json
[{ "file": "e2e/map.spec.ts", "reason": "needs WebGL 2", "kind": "by-design", "count": 2 }]
```

- `reason` is text found in the skip call: its message, or the constant holding it.
- `message` (optional) is text of the message the run reports, for a call that holds only a constant. The result-kind reporter matches skips by it (or by `reason`).
- `kind`:
  - `by-design`: a browser or option that can't run the test. Reported as "skipped by design".
  - `environment`: a setup problem. Reported as "not run".
- `count` is how many skips in that file carry it (1 by default).

`checkSkips` fails on a skip that isn't listed, and on an entry that no longer matches.

## Role matrix (format 0, `role-matrix.mjs`)

One row per cell: `role × level × subject × action × channel → allowed | refused`, and where it's checked. A file is `{ "format": 0, "rows": [ … ] }`.

| Field | Values |
|---|---|
| `role` | the adapter's role names (any number) |
| `level` | the sign-in level the session has, in the adapter's names (one factor, two factors) |
| `subject` | `own`, `other-user` or `other-tenant`: whose data the action touches |
| `action` | a page, a control or a server call, from the adapter's `discoverActions()` and the app's page list |
| `channel` | `ui` (what the person sees) or `server` (a direct call with that session) |
| `expect` | `allowed` or `refused` |
| `proof` | `<spec>#<proof id>` (an e2e assertion, proven by red before green), or `external:<suite>:<name>` for a cell another suite proves, a database test say (shown as "proven elsewhere, not mutated", never ✓) |
| `flag` | instead of a proof: a question for a person about a cell, until it is answered |

- **The spec holds every `expect`.** The kit only supplies rows and helpers that return values, because an assertion inside the kit would always count as "red elsewhere".
- **One proof per test for a mutation.** A test stops at its first failure, so a mutation that should turn several assertions red needs a test for each.
- **Checks in `role-matrix.mjs`:**
  - `parseMatrix`: the fields, and no cell twice
  - `missingActions(rows, discovered)`: every action the adapter's `discoverActions()` finds has a row
  - `proofProblems`: every proof the matrix cites exists
  - `matrixMarkdown`: the table for a job summary
- **What needs the backend itself runs before the tests start,** on the machine that runs the backend. Discovering actions and granting a role are examples. A test's browser image may have no access to it.

## Adapter (v0)

The one app-specific module the kit talks to:

| Hook | What it gives |
|---|---|
| `createUser({ role, secondFactor })` | a throwaway user, deleted after its test |
| `grantRole(user, role)` | the role, set through the backend directly, never through an app function |
| `accountPool()` (optional) | named accounts, one per worker, where users can't be created (a hosted test site, sign-in through SSO) |
| `sessionFor(user, level)` | a session at that sign-in level |
| `readBack(query)` | the data as stored, to check that a refused write changed nothing |
| `readEmailCode(address)` | the newest emailed code |
| `totp(secret)` | the current authenticator code |
| `refusal(channel, response)` | whether a response is a refusal on that channel (an error code, a status, or an empty answer) |
| `discoverActions()` | every protected server action, read from the running backend |
| `applyStep(file)` | commands that bring the backend in line with a changed file |
| `appEnv`, `allowedHosts`, `readySignal` | how the app is built and reached, and when it's ready |
| `neverClick`, `consoleAllow` | for the random clicker: what it must not press, and console messages that aren't errors |

## Result kinds

Every run's summary sorts each test into one of these. A run is never "all green" while anything failed, is inconclusive or didn't run.

| Kind | When |
|---|---|
| verified | it passed, first time |
| failed | it failed or timed out, or a known bug passed |
| inconclusive | it passed only on a retry |
| not run | interrupted, never ran, or skipped for a reason that isn't on the allow-list as `by-design` (an `environment` skip included) |
| skipped by design | skipped for a reason the allow-list holds as `by-design` |
| quarantined | tagged `@quarantine`; its `quarantine` annotation names the owner and the fix-by date |
| known bug | `test.fail()` that failed, listed apart with its `issue` annotation |

Add the reporter to a config:

```ts
reporter: [['list'], ['../testkit/result-kinds-reporter.mjs', { title, allowList: 'e2e/skip-allow-list.json', outputFile: 'result-kinds.md' }]]
```

- It writes the summary to `outputFile` (for a CI job summary) and prints it.
- It turns a run Playwright would pass into a failed one when anything failed, is inconclusive or didn't run.
