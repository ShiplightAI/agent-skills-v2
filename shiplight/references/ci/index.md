# ci — Wire CI workflows + failure triage

Run Shiplight tests in GitHub Actions, upload every result to Shiplight Cloud,
and optionally add automated failure triage. Keep one user-facing command, but
load only the runner or optional integration reference needed for this request.

## Read first

- `../_shared/project-layout.md` — identify the test-project root and editable
  files before inspecting or changing workflows.
- `../_shared/secrets.md` — CI files contain secret names and references only,
  never secret values.

## Invariants

- `shiplight test` runs tests but does not upload them.
- `shiplight report` discovers `shiplight-report/`, uploads the report and its
  artifacts, and completes the cloud run.
- Run `shiplight report` under `if: always()` so failed tests still produce a
  cloud report.
- CI is meaningful only after Shiplight tests exist.

## Workflow

### 1. Inspect before editing

Identify both the repository root and the test-project root. Inspect project
files relative to the test-project root, but inspect `.github/workflows/`
relative to the repository root:

1. Confirm at least one `tests/**/*.test.yaml` exists. If none exists, stop and
   report that `/shiplight cover` is the precondition.
2. Inspect `package.json`, the lockfile, Playwright configuration, auth setup,
   and the environment-variable names used by tests.
3. From the repository root, inspect existing `.github/workflows/*.yml` and
   `.yaml` files, including their triggers, runner labels, working directories,
   permissions, concurrency, and test commands.
4. Determine whether the test project is at repository root or in a
   subdirectory.

Preserve existing workflows. If a suitable E2E workflow exists, merge the
missing Shiplight steps into it; do not replace its unrelated triggers,
permissions, environment, caching, or test setup. If another workflow already
runs the same tests, extend it instead of creating a duplicate run.

### 2. Select one runner path

- Read `github-hosted.md` for a stock `ubuntu-latest` runner. This is the default
  when the repository has no configured Shiplight runner.
- Read `shiplight-hosted.md` when the user requests a Shiplight runner or an
  existing workflow already uses one.

Each runner reference points to a complete workflow asset. Adapt the asset to
the repository rather than copying it over an existing workflow unchanged.

### 3. Wire test credentials

Map every environment-variable name required by the existing tests to GitHub
Actions secrets or variables at the narrowest useful scope. Keep values out of
the workflow. Preserve an existing credential mapping when it already works.

### 4. Add optional failure triage only when requested

Read `triage.md` only when the user asks for automated diagnosis/autofix, or when
the request explicitly targets an existing failure-triage workflow. A base test
workflow must exist first.

Read `notifications.md` only when the user also asks to publish triage outcomes
to Slack, Linear, Jira, or another incident system.

### 5. Validate

Validate every changed workflow with the repository's existing workflow linter.
If none is configured and `actionlint` is installed, run:

```sh
actionlint .github/workflows/<changed-workflow>.yml
```

Then inspect the final diff for duplicated test runs, missing secret mappings,
incorrect workflow names, and subdirectory paths. Do not claim the workflow ran
successfully until GitHub Actions has executed it.

## Final report

Report: workflows created or changed; runner selected; test command and report
upload wired; secrets/variables the user must configure; validation commands and
results; optional triage/notification wiring; and anything that still requires a
push or GitHub-side setup.
