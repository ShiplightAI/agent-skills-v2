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

First determine the CI provider. **GitHub Actions** → Options 1–2 below (plus optional auto-triage). **GitLab / Jenkins / CircleCI / any other Node pipeline** → jump to [Non-GitHub providers](#non-github-providers); Shiplight-hosted runners and auto-triage do not apply there.

On GitHub Actions there are two ways to run E2E tests. Pick one.

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

When a test workflow above goes red, you can have an AI agent diagnose the failure and, for fixable spec issues, repair it automatically. The shared pipeline lives in [ShiplightAI/ci-triage]; on a failed run it reads the run logs **and** the uploaded report artifacts (screenshots/traces), posts a diagnosis to Slack, and for failures it classifies as fixable spec issues applies the fix, re-runs the test, and opens a PR. It never auto-merges.

Wiring it up is two steps. Only offer this once a test workflow exists — triage triggers off that workflow's completion.

### Step 1 — upload the report artifact from the test workflow

Triage reads failure evidence from a GitHub artifact, not the cloud. Add this step to the test workflow (`e2e.yml` from Option 1/2 above), after the test step:

```yaml
      - name: Upload test report (for triage)
        if: ${{ !cancelled() }}
        uses: ShiplightAI/ci-triage/upload-report@v1
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
    uses: ShiplightAI/ci-triage/.github/workflows/triage.yml@v1   # pin to an immutable tag, not @main
    permissions:
      contents: write
      pull-requests: write
      actions: read
    with:
      triage-runner: ubuntu-latest      # read-only diagnosis job
      autofix-runner: shiplight-medium  # re-runs tests, so needs browsers/network
      node-version: "20"
      allowed-paths: "tests templates"  # top-level dirs the autofix agent may edit (hard guard)
      slack-channel: ${{ vars.SLACK_CHANNEL_ID || '' }}   # empty disables Slack
    secrets:
      claude_code_oauth_token: ${{ secrets.CLAUDE_CODE_OAUTH_TOKEN }}
      openai_api_key: ${{ secrets.OPENAI_API_KEY }}        # Codex fallback when Claude is unavailable
      autofix_github_token: ${{ secrets.AUTOFIX_GITHUB_TOKEN }}  # PAT/App token to open the PR; falls back to GITHUB_TOKEN
      slack_bot_token: ${{ secrets.SLACK_BOT_TOKEN }}
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
- Provide at least one model credential (`claude_code_oauth_token` or `anthropic_api_key`); `openai_api_key` enables the Codex fallback. `autofix_github_token` and `slack_bot_token` are optional.
- `autofix-runner` re-runs the failing test, so it needs browsers/network — use a Shiplight runner, or install Chromium in a stock runner the same way the test workflow does.
- This job runs privileged (`contents: write`, live credentials). Pin `uses:` to an immutable tag (`@v1.x.y`), not a branch.

## Non-GitHub providers

Shiplight-hosted runners (`runs-on: shiplight-*`) and the auto-triage pipeline are GitHub Actions only. On GitLab / Jenkins / CircleCI / any Node pipeline, run the same CLI. Contract for every non-GitHub provider:

- Expose `SHIPLIGHT_API_TOKEN` (org token from <https://nova.shiplight.ai/api-tokens>, stored as a masked secret) to **every** `npx shiplight` step, plus `SHIPLIGHT_REPORT_TO_CLOUD=1`.
- Install Chromium yourself (`npx playwright install --with-deps chromium`) — no stock image ships it.
- Run `report` in an always-run hook (`after_script` / `post { always }` / `when: always`) so a red run still uploads.
- Unavailable off GitHub Actions: auto-triage, self-healing action cache, automatic LLM credentials. If tests use AI actions, pass LLM creds as env.
- Templates assume the project at the repo root; otherwise `cd` into the subdir before each command.

### GitLab CI — `.gitlab-ci.yml`

```yaml
e2e:
  image: node:20
  variables:
    SHIPLIGHT_REPORT_TO_CLOUD: "1"
    # Add SHIPLIGHT_API_TOKEN as a masked CI/CD variable (auto-injected).
  script:
    - npm install
    - npx playwright install --with-deps chromium
    - npx shiplight test
  after_script:
    - npx shiplight report # after_script always runs, even on failure
```

### Jenkins — `Jenkinsfile`

```groovy
pipeline {
  agent { docker { image 'node:20' } }
  environment {
    SHIPLIGHT_REPORT_TO_CLOUD = '1'
    SHIPLIGHT_API_TOKEN = credentials('shiplight-api-token')
  }
  stages {
    stage('Install') {
      steps {
        sh 'npm install'
        sh 'npx playwright install --with-deps chromium'
      }
    }
    stage('E2E tests') {
      steps { sh 'npx shiplight test' }
      post { always { sh 'npx shiplight report' } }
    }
  }
}
```

### CircleCI — `.circleci/config.yml`

```yaml
version: 2.1
jobs:
  e2e:
    docker:
      - image: cimg/node:20.11-browsers # ships Chromium system libs
    environment:
      SHIPLIGHT_REPORT_TO_CLOUD: "1"
      # Add SHIPLIGHT_API_TOKEN as a project env var or context.
    steps:
      - checkout
      - run: npm install
      - run: npx playwright install chromium
      - run: npx shiplight test
      - run:
          name: Upload results to Shiplight
          command: npx shiplight report
          when: always
workflows:
  e2e:
    jobs:
      - e2e
```

## Notes

- These workflows assume the Shiplight project lives at the repository root (the canonical layout). If it lives in a subdirectory, add `working-directory: <path>` to each `run:` step (or a `defaults.run.working-directory` at the job level).
- For custom integrations the CLI doesn't cover (non-Shiplight test frameworks, bespoke pipelines), the raw publish REST calls live outside this skill; the `cloud` subcommand documents only the read side (Nova results).

[ShiplightAI/ci-triage]: https://github.com/ShiplightAI/ci-triage
