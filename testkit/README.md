# testkit: end-to-end checks that need no AI

Reusable parts for end-to-end testing, kept apart from any one app: no app name, backend name or role name appears in this folder (a unit test outside it holds that). Everything app-specific lives in the app's **adapter** and data files. The formats below are **v0**: they change until a second app has used them.

What's here now:

| File | What it does |
|---|---|
| `judge.mjs` | Judges red before green: was a test red, at the right line, under a saved mutation? Pure functions. |
| `red-green.mjs` | Runs the saved mutations of the specs you name, and prints the verdict per proof. |
| `checks.mjs` | Checks at rest: saved mutation files still fit the code, and every skip is on the allow-list. |

The other parts the plan names (the result-kind reporter, the network guard, the tree check, the role-matrix runner, the walker for the random clicker) join when a phase uses them.

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

- It picks a free port for the app (`E2E_PORT`), so a server that's already running is never reused, and the config's web server builds the mutated app.
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
- `kind`:
  - `by-design`: a browser or option that can't run the test. Reported as "skipped by design".
  - `environment`: a setup problem. Reported as "not run".
- `count` is how many skips in that file carry it (1 by default).

`checkSkips` fails on a skip that isn't listed, and on an entry that no longer matches.

## Role matrix (format 0, used from the roles phase)

One row per cell: `role × level × subject × action × channel → allowed | refused`, and where it's checked.

| Field | Values |
|---|---|
| `role` | the adapter's role names (any number) |
| `level` | the sign-in level the session has, in the adapter's names (one factor, two factors) |
| `subject` | `own`, `other-user` or `other-tenant`: whose data the action touches |
| `action` | a page, a control or a server call, from the adapter's `discoverActions()` and the app's page list |
| `channel` | `ui` (what the person sees) or `server` (a direct call with that session) |
| `expect` | `allowed` or `refused` |
| `proof` | an e2e proof id, or `external:<name>` for a cell another suite proves (shown as "proven elsewhere, not mutated", never ✓) |

The spec holds every `expect`. The kit only supplies rows and helpers that return values, because an assertion inside the kit would always count as "red elsewhere".

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

Every run's summary sorts each test into one of these. A run is never "all green" while anything is inconclusive or not run.

- verified
- inconclusive
- not run
- skipped by design (only skips on the allow-list)
- quarantined
- known bug (listed apart)
