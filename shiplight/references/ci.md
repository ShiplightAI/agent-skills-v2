# ci — Wire CI workflows + failure-triage pipeline

Wire a Shiplight test project into CI: run E2E tests in GitHub Actions, upload
results to Shiplight Cloud, and optionally auto-triage failures. Only meaningful
once tests exist. Related: the `cloud` subcommand reads the uploaded run results
(Nova backend); `fix` is the local equivalent of the auto-triage repair.

Run a Shiplight test project in CI and upload results to Shiplight Cloud, where they appear in the `cloud` subcommand's results (Nova backend) for trend tracking and flaky-test detection.

Use the Shiplight CLI, not the Cloud REST API, to publish runs:

- `shiplight test` runs the tests but does **not** upload on its own.
- `shiplight report` discovers the report in `./shiplight-report`, presigns and uploads every artifact (screenshots, videos, traces), and completes the run.

Always run `report` with `if: always()` so results upload even when tests fail — otherwise a red run produces no cloud report.

There are two ways to run E2E tests in GitHub Actions. Pick one.

## Option 1 — Default GitHub-hosted runner (easiest)

Runs on a stock `ubuntu-latest` runner. The only setup is an **org API token**: create one at <https://nova.shiplight.ai/api-tokens> and store it as a repository or organization secret named `SHIPLIGHT_API_TOKEN`. No GitHub App and no admin approval needed.

Set `SHIPLIGHT_API_TOKEN` at the job's `env` (global) scope — **every** `npx shiplight` command needs it, not just `report`. `shiplight report` additionally needs `SHIPLIGHT_REPORT_TO_CLOUD=1` to actually upload. Stock runners have no browser preinstalled, so install Chromium first.

Create `.github/workflows/e2e.yml`:

```yaml
name: E2E Tests

on:
  push:
    branches: [main]
  pull_request:

jobs:
  e2e:
    runs-on: ubuntu-latest
    timeout-minutes: 30
    env:
      SHIPLIGHT_API_TOKEN: ${{ secrets.SHIPLIGHT_API_TOKEN }}   # needed by every `npx shiplight` command
    steps:
      - uses: actions/checkout@v5

      - name: Set up Node.js
        uses: actions/setup-node@v6
        with:
          node-version: "22"

      - name: Install dependencies
        run: npm ci

      - name: Install Playwright browser
        run: npx playwright install --with-deps chromium

      - name: Run E2E tests
        run: npx shiplight test

      - name: Upload results to Shiplight
        if: always()                       # upload even when tests fail
        env:
          SHIPLIGHT_REPORT_TO_CLOUD: '1'   # required on non-Shiplight runners to enable upload
        run: npx shiplight report
```

## Option 2 — Shiplight-hosted runner

Runs on an ephemeral `shiplight-*` VM with Chromium + Playwright preinstalled and credentials provisioned per run — so **no `SHIPLIGHT_API_TOKEN`, no `SHIPLIGHT_REPORT_TO_CLOUD`, and no browser install step**. Do not run `npx playwright install`; the image already has it.

Requires one-time setup: install the Shiplight GitHub App on the repo/org (**this may need your IT/admin's approval**), then have an org owner enable runners in Org Settings (<https://nova.shiplight.ai/org?tab=settings>).

Create `.github/workflows/e2e.yml`:

```yaml
name: E2E Tests

on:
  push:
    branches: [main]
  pull_request:

jobs:
  e2e:
    runs-on: shiplight-small     # ephemeral Shiplight runner; sizes below
    timeout-minutes: 30
    steps:
      - uses: actions/checkout@v5

      - name: Install dependencies
        run: npm ci

      - name: Run E2E tests
        run: npx shiplight test

      - name: Upload results to Shiplight
        if: always()
        run: npx shiplight report
```

Runner sizes: `shiplight-small` (4 vCPU / 16 GB), `shiplight-medium` (8 / 32), `shiplight-large` (16 / 64), `shiplight-xlarge` (32 / 128).

## Optional — auto-triage CI failures

When a test workflow above goes red, you can have an AI agent diagnose the failure and, for fixable spec issues, repair it automatically. The shared pipeline lives in [ShiplightAI/ci-triage]; on a failed run it reads the run logs **and** the uploaded report artifacts (screenshots/traces), classifies each failure, and for fixable spec issues applies the fix, re-runs the test, and opens a PR. It never auto-merges.

The shared workflow does **not** post to Slack, Linear, or any other customer system. It publishes versioned artifacts; the customer-owned caller workflow decides which results to notify or file, and uses its own credentials to do so.

Wiring it up is two steps. Only offer this once a test workflow exists — triage triggers off that workflow's completion.

### Step 1 — upload the report artifact from the test workflow

Triage reads failure evidence from a GitHub artifact, not the cloud. Add this step to the test workflow (`e2e.yml` from Option 1/2 above), after the test step:

```yaml
      - name: Upload test report (for triage)
        if: ${{ !cancelled() }}
        uses: ShiplightAI/ci-triage/upload-report@v1.2
        # sharded/matrix jobs: give each shard a unique name
        # with:
        #   name: test-report-shard-${{ matrix.shardIndex }}
        #   retention-days: "1"
```

The helper bakes in the `shiplight-report/` path and drops the heavy Playwright traces (`*.zip`) and videos (`*.webm`) the agent never reads (~80% of the size). This is separate from `npx shiplight report` — keep that step too; the cloud report still gets full traces/videos for humans.

### Step 2 — add the caller workflow

The `workflow_run` trigger and the per-repo credential mapping **must** stay in the consumer repo (a `workflow_run` trigger is illegal in a reusable workflow, and secret names differ per repo). Everything else lives in the reusable workflow. Create `.github/workflows/ci-failure-triage.yml`:

```yaml
name: CI Failure Triage

on:
  workflow_run:
    workflows: [E2E Tests]     # exact `name:` of each test workflow to watch
    types: [completed]

jobs:
  triage:
    uses: ShiplightAI/ci-triage/.github/workflows/triage.yml@v1.2 # pin to a release tag, not @main
    permissions:
      contents: write
      pull-requests: write
      actions: read
    with:
      triage-runner: ubuntu-latest      # read-only diagnosis job
      autofix-runner: shiplight-medium  # re-runs tests, so needs browsers/network
      node-version: "22"
      # working-directory: e2e            # only if the Shiplight project is NOT the repo root
      allowed-paths: "tests templates"  # dirs the autofix agent may edit, relative to
                                        # working-directory (hard guard)
    secrets:
      claude_code_oauth_token: ${{ secrets.CLAUDE_CODE_OAUTH_TOKEN }}
      openai_api_key: ${{ secrets.OPENAI_API_KEY }}        # Codex fallback when Claude is unavailable
      autofix_github_token: ${{ secrets.AUTOFIX_GITHUB_TOKEN }}  # PAT/App token to open the PR; falls back to GITHUB_TOKEN
      # Per-repo credential mapping → generic env for the autofix re-run.
      # One KEY=VALUE per line; values must be single-line.
      extra_env: |
        BASE_URL=${{ vars.BASE_URL || 'https://example.com' }}
        MY_TEST_USER_PASSWORD=${{ secrets.MY_TEST_USER_PASSWORD }}
        MY_TEST_USER_2FA_SECRET=${{ secrets.MY_TEST_USER_2FA_SECRET }}
```

Notes:

- `workflows:` must list the exact `name:` of each test workflow to watch. Never list the triage workflow itself there.
- `extra_env` maps this repo's secret names onto the generic env the autofix job uses so `npx shiplight test` and the MCP browser can authenticate. Mirror the `env:` block from the test workflow.
- Provide at least one model credential (`claude_code_oauth_token` or `anthropic_api_key`); `openai_api_key` enables the Codex fallback. `autofix_github_token` is optional.
- `autofix-runner` re-runs the failing test, so it needs browsers/network — use a Shiplight runner, or install Chromium in a stock runner the same way the test workflow does.
- Set `working-directory` only when the Shiplight project is not at the repo root (its `package.json`/`playwright.config.ts` live in a subdirectory). Everything then runs there, and both `allowed-paths` and the verdict's `target_file` are relative to it, not to the repo root. Leave it out for a root-level project.
- This job runs privileged (`contents: write`, live credentials). Pin `uses:` to the latest ci-triage release tag (`@v1.x.y`), not a branch. Release tags are immutable.

### Step 3 — integrate customer notifications or incident systems

Keep every provider integration in a normal caller-owned job after `triage`.
Download the `triage-context` artifact and read `verdict.json`; its `failures[]`
entries include the test, classification, confidence, `fixable`, and a stable
`dedup_key`. The `triage.md` artifact is the human-readable diagnosis.

```yaml
  publish-triage-incidents:
    needs: triage
    if: >-
      ${{ always() &&
          (github.event.workflow_run.conclusion == 'failure' ||
           github.event.workflow_run.conclusion == 'timed_out') }}
    continue-on-error: true
    runs-on: ubuntu-latest
    permissions:
      actions: read
    steps:
      - uses: actions/download-artifact@v4
        with:
          name: triage-context
          path: /tmp/triage-context
      - name: Publish to the customer's system
        env:
          # Keep provider credentials here, never in `extra_env`.
          SLACK_BOT_TOKEN: ${{ secrets.SLACK_BOT_TOKEN }}
          LINEAR_API_KEY: ${{ secrets.LINEAR_API_KEY }}
        run: |
          jq '.failures[]' /tmp/triage-context/verdict.json
          # Call the selected provider API with the fields the customer needs.
```

Choose the policy in the caller job: notify all failures, create incidents only
for `fixable == false`, or route by classification/priority. For an issue tracker,
use `dedup_key` (or an equivalent stable customer-visible title) to update an
existing incident instead of opening one on every retry. Do not put opaque
deduplication markers in user-visible issue descriptions.

The reusable workflow also uploads one `autofix-result-*` artifact for each
autofix matrix job. It contains `skipped`, `has_changes`, verification status,
PR URL, and target test. Download these artifacts in a later caller job when a
separate post-autofix notification is wanted; order that job after the triage
notification if message ordering matters.

## Notes

- These workflows assume the Shiplight project lives at the repository root (the canonical layout). If it lives in a subdirectory, add `working-directory: <path>` to each `run:` step (or a `defaults.run.working-directory` at the job level).
- For custom integrations the CLI doesn't cover (non-Shiplight test frameworks, bespoke pipelines), the raw publish REST calls live outside this skill; the `cloud` subcommand documents only the read side (Nova results).

[ShiplightAI/ci-triage]: https://github.com/ShiplightAI/ci-triage
