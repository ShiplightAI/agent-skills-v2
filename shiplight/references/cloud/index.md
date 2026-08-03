# cloud — Read Shiplight Cloud (Nova) test results

Read-only access to test results on Shiplight Cloud (Nova, `nova-api.shiplight.ai`)
uploaded by the Shiplight CLI / CI runner: list runs, fetch run details, list
failing/flaky tests, download artifacts, and read aggregate analytics (summary,
trends, test rankings, failure attribution). The `/v1` segment is the API contract
version. Do not publish runs through this subcommand.

> **Scope:** this subcommand targets **Nova (Cloud v2)** only — the forward
> platform. Legacy Cloud v1 (`api.shiplight.ai`, full push/pull/run/manage) is being
> deprecated and is **not** in this router; existing customers use the standalone
> `/cloud` skill until v1 is replaced by v2. Write capabilities land here as Nova
> gains them.

## Read first

- `_shared/secrets.md` — the `SHIPLIGHT_API_TOKEN` belongs in `.env`, never committed.

## Setup

```bash
export SHIPLIGHT_API_URL=https://nova-api.shiplight.ai
```

All API calls require:

```text
Authorization: Bearer $SHIPLIGHT_API_TOKEN
```

If the user provides a token, **ask before writing `.env`** (the edit contract bars editing `.env` unless the user asks); with their OK, add `SHIPLIGHT_API_TOKEN=<token>` and remind them to keep `.env` out of git.

## CI Integration

The runs this skill reads are produced in CI by the `shiplight report` CLI, which uploads each test run's artifacts to Shiplight Cloud.

To set up a GitHub Actions workflow (default or Shiplight-hosted runners, tokens, and `shiplight report` wiring), see the `ci` subcommand.

## Error Handling

| Status | Action |
|--------|--------|
| 400 | Fix the request, IDs, or query parameters. All validation errors return 400. |
| 401 | Token is missing, invalid, expired, or for the wrong Nova environment. |
| 403 | Token lacks permission; or the S3 URI points at a non-test-results bucket; or the URI key's first segment is not your organization ID. |
| 404 | Run, result, or artifact not found for this organization. |
| 500 | Retry only if idempotent. |

## REST API

Base URL: `$SHIPLIGHT_API_URL`

### List Test Runs

```bash
curl -H "Authorization: Bearer $SHIPLIGHT_API_TOKEN" \
  "$SHIPLIGHT_API_URL/v1/test-runs?pageSize=10"
```

Ordered by `createdAt` descending.

| Param | Type | Description |
|-------|------|-------------|
| `result` | string | Exact match on overall run result: `passed`, `failed`, `pending` |
| `repo` | string | Exact match on `org/repo` |
| `branch` | string | Exact match on branch |
| `from` | string | ISO timestamp lower bound (inclusive) on `createdAt` |
| `to` | string | ISO timestamp upper bound (inclusive) on `createdAt` |
| `page` | number | Default `1` |
| `pageSize` | number | Default `20` |

**Response:** array of `{ id, status, result, branch, commitSha, repo, target, startTime, endTime, totalTestCount, passedCount, flakyCount, failedCount, skippedCount, metadata, ... }`.

Run outcome counts are mutually exclusive: `passedCount` is strict passed,
`flakyCount` is retry-passed, `failedCount` includes `timedout`, and
`skippedCount` is skipped. Therefore
`totalTestCount = passedCount + flakyCount + failedCount + skippedCount`. A
flaky test does not fail the run; the run result is `failed` only when
`failedCount > 0`.

### Get Test Run

```bash
curl -H "Authorization: Bearer $SHIPLIGHT_API_TOKEN" \
  "$SHIPLIGHT_API_URL/v1/test-runs/42"
```

Returns the run (`testRun`) plus every `testCaseResult` row, unpaginated.

```json
{
  "testRun": {
    "id": 42,
    "status": "finished",
    "result": "passed",
    "branch": "main",
    "totalTestCount": 1,
    "passedCount": 1,
    "failedCount": 0
  },
  "testCaseResults": [
    {
      "id": 101,
      "testRunId": 42,
      "result": "passed",
      "reportS3Uri": "s3://shipyard-test-results/org-1/tests/_local/test-results/101/report.json",
      "videoS3Uri": "s3://...",
      "traceS3Uri": "s3://..."
    }
  ]
}
```

### List Test Results by File

```bash
curl -H "Authorization: Bearer $SHIPLIGHT_API_TOKEN" \
  "$SHIPLIGHT_API_URL/v1/test-results?repo=org/repo&file=tests/checkout.spec.ts&pageSize=10"
```

Results for one file across runs, newest first.

| Param | Type | Description |
|-------|------|-------------|
| `repo` | string | **Required.** Exact match on `org/repo`. |
| `file` | string | **Required.** Exact match on the test file path. |
| `result` | string | Per-row result: `passed`, `failed`, `timedout`, `flaky`, `skipped`, `pending` |
| `branch` | string | Exact match on branch |
| `from` | string | ISO timestamp lower bound (inclusive) on result `createdAt` |
| `to` | string | ISO timestamp upper bound (inclusive) on result `createdAt` |
| `page` | number | Default `1` |
| `pageSize` | number | Default `20` |

```json
[
  {
    "id": 101,
    "testRunId": 42,
    "file": "tests/checkout.spec.ts",
    "testName": "checkout succeeds",
    "status": "finished",
    "result": "passed",
    "startTime": "2026-05-27T10:00:01.000Z",
    "endTime": "2026-05-27T10:00:10.000Z",
    "errorMessage": null,
    "reportS3Uri": "s3://shipyard-test-results/org-1/tests/_local/test-results/101/report.json",
    "videoS3Uri": "s3://...",
    "traceS3Uri": "s3://...",
    "createdAt": "2026-05-27T10:00:11.000Z"
  }
]
```

### List Failing Tests

```bash
curl -H "Authorization: Bearer $SHIPLIGHT_API_TOKEN" \
  "$SHIPLIGHT_API_URL/v1/failing-tests?repo=org/repo"
```

For each unique `(file, testName)` in the window, returns its latest row when the
result is `failed` or `timedout`. A later `passed` or `flaky` result removes an
earlier failure from this current-state list. Rows are ordered by `file`, then
`testName`, ascending.

| Param | Type | Description |
|-------|------|-------------|
| `repo` | string | **Required.** Exact match on `org/repo` |
| `branch` | string | Exact match on branch |
| `from` | string | ISO timestamp lower bound (inclusive) on run `createdAt`. Defaults to `now - 7 days` |
| `to` | string | ISO timestamp upper bound (inclusive) on run `createdAt`. Defaults to `now` |
| `page` | number | Default `1` |
| `pageSize` | number | Default `20` |

```json
[
  {
    "id": 101,
    "testRunId": 42,
    "file": "tests/checkout.spec.ts",
    "testName": "checkout succeeds",
    "status": "finished",
    "result": "failed",
    "startTime": "2026-05-27T10:00:01.000Z",
    "endTime": "2026-05-27T10:00:10.000Z",
    "errorMessage": "Expected status 200, got 500",
    "reportS3Uri": "s3://shipyard-test-results/org-1/tests/_local/test-results/101/report.json",
    "videoS3Uri": "s3://...",
    "traceS3Uri": "s3://...",
    "createdAt": "2026-05-27T10:00:11.000Z"
  }
]
```

### List Flaky Tests

```bash
curl -H "Authorization: Bearer $SHIPLIGHT_API_TOKEN" \
  "$SHIPLIGHT_API_URL/v1/flaky-tests?repo=org/repo"
```

For each unique `(file, testName)` in the window, returns its latest row when the
result is `flaky` (failed an earlier attempt, then passed on retry). A later
`passed`, `failed`, or `timedout` result removes the earlier flaky result from
this current-state list. Rows are ordered by `file`, then `testName`, ascending.

| Param | Type | Description |
|-------|------|-------------|
| `repo` | string | **Required.** Exact match on `org/repo` |
| `branch` | string | Exact match on branch |
| `from` | string | ISO timestamp lower bound (inclusive) on run `createdAt`. Defaults to `now - 7 days` |
| `to` | string | ISO timestamp upper bound (inclusive) on run `createdAt`. Defaults to `now` |
| `page` | number | Default `1` |
| `pageSize` | number | Default `20` |

```json
[
  {
    "id": 207,
    "testRunId": 42,
    "file": "tests/checkout.spec.ts",
    "testName": "applies promo code",
    "status": "finished",
    "result": "flaky",
    "startTime": "2026-05-27T10:00:20.000Z",
    "endTime": "2026-05-27T10:00:35.000Z",
    "errorMessage": "TimeoutError: locator.click — first attempt timed out after 5000ms",
    "reportS3Uri": "s3://shipyard-test-results/org-1/tests/_local/test-results/207/report.json",
    "videoS3Uri": "s3://...",
    "traceS3Uri": "s3://...",
    "createdAt": "2026-05-27T10:00:36.000Z"
  }
]
```

When present, `errorMessage` carries the first-attempt failure that triggered the retry.

### Download S3 File

```bash
curl -H "Authorization: Bearer $SHIPLIGHT_API_TOKEN" \
  "$SHIPLIGHT_API_URL/v1/s3/file?uri=s3://shipyard-test-results/<org-id>/tests/_local/test-results/<id>/report.json"
```

**Query:** `uri` (string, required) — an `s3://` URI from a result row (`reportS3Uri`, `videoS3Uri`, `traceS3Uri`).

**Response:** raw file bytes; save with `curl -o <file>`.

### Analytics (aggregate metrics)

`/v1/analytics/*` returns **computed** metrics, not raw rows. Requires a full-inherit or `analytics:read` token (otherwise `403`). All validation errors are `400`; a valid query that matches no data returns `[]` or a zeroed object, not an error.

```bash
curl -H "Authorization: Bearer $SHIPLIGHT_API_TOKEN" \
  "$SHIPLIGHT_API_URL/v1/analytics/tests/failing?repo=org/repo&limit=10"
```

Shared query params (each endpoint uses the subset it needs):

| Param | Type | Description |
|-------|------|-------------|
| `repo` | string | Exact match on `org/repo`. Omit for org-wide. |
| `branch` | string | Exact match on branch |
| `from` | string | ISO timestamp, inclusive. Defaults to `now - 7 days` |
| `to` | string | ISO timestamp, exclusive. Defaults to `now`. Must be ≥ `from`, and `to - from` must not exceed **366 days** — both are `400`, not a clamp |
| `bucket` | string | `day` \| `week` \| `month` — summary + trends. Default `day` |
| `limit` | number | `1`–`500` — rankings. Default `20` |
| `minExecutions` | number | Min executions to include — failing/flaky. Default `5` |
| `sortBy` | string | `p50` \| `p95` \| `executions` — slowest. Default `p50` |
| `sortOrder` | string | `asc` \| `desc` — slowest + costliest. Default `desc` |

**Choose the right reliability surface.** These endpoints answer different
questions; do not substitute one for another:

| Surface | Question | Selection and ordering |
|---------|----------|------------------------|
| `GET /v1/test-results` | What result rows exist for this file? | Raw history, newest first. Requires `repo` + `file`; optional exact `result` filter. |
| `GET /v1/failing-tests`, `/v1/flaky-tests` | What is each test's current state inside this window? | Keep the latest row per `(file, testName)`, then filter by outcome. Ordered by `file`, then `testName`, ascending. |
| `GET /v1/analytics/tests/failing`, `/flaky` | Which tests accumulated the most failing or retry-passed executions? | Aggregate every terminal execution in `[from,to)`. Ordered by count first, then the corresponding rate, descending. |

**Units.** This surface carries two rate scales and two money units. Reading a
field against the wrong one is the easiest way to be wrong by 100x or 1,000,000x:

- **Percentages, `0`–`100`, one decimal.** `runPassRate` / `testPassRate` on
  `summary`; `passRate` on trends; and `passRate` / `flakyRate` on
  `tests/failing` and `tests/flaky`. `80` means 80%.
- **Fractions, `0`–`1`.** `cacheHitRate` / `healRate` on `usage` and
  `runs/{runId}/usage`, and every ratio under `compute.ratios`. `0.12` means 12%.
- **Microcents as strings** (`100_000` = $1.00; they exceed a JS number). Every
  `*Microcents` field.
- **Formatted USD strings.** `runs/{runId}/results/{resultId}/usage` alone prices
  in `estimatedCostUsd` (e.g. `"0.0042"`) — dollars, not microcents. It pairs with
  `isPartialCost`, true when that figure covers only part of `totalTokens`.

All money is the **customer price** — never a provider or internal rate. Token and
call counts are plain numbers.

| Endpoint | Description | Returns |
|----------|-------------|---------|
| `GET /v1/analytics/summary` | Headline run + test pass rates and totals for the window | `{ runPassRate, testPassRate, totalRuns, decidedRuns, totalTestExecutions, decidedTestExecutions }` |
| `GET /v1/analytics/trends/pass-rate` | Run pass rate over time | `[{ date, passRate, totalRuns, passedRuns, failedRuns }]` |
| `GET /v1/analytics/trends/run-status` | Passed vs failed run counts over time | `[{ date, passedRuns, failedRuns, totalRuns, passRate }]` |
| `GET /v1/analytics/trends/test-results` | Test-result counts (passed/flaky/failed/skipped) over time | `[{ date, passed, flaky, failed, skipped, total, passRate }]` |
| `GET /v1/analytics/trends/run-duration` | Run-duration percentiles over time | `[{ date, totalRuns, avgDurationSec, p50DurationSec, p95DurationSec, minDurationSec, maxDurationSec }]` |
| `GET /v1/analytics/tests/failing` | Tests with at least one failed/timed-out execution, ordered by `failedCount`, then derived failure rate, descending | `[{ file, testName, passedCount, flakyCount, failedCount, passRate, flakyRate, flakeRate, totalExecutions }]` |
| `GET /v1/analytics/tests/flaky` | Tests with at least one retry-passed execution, ordered by `flakyCount`, then `flakyRate`, descending | same shape as `tests/failing` |
| `GET /v1/analytics/tests/slowest` | Tests ranked by duration (p50/p95) | `[{ file, testName, p50Ms, p95Ms, executionCount }]` |
| `GET /v1/analytics/tests/costliest` | Tests ranked by LLM usage — which tests drive token spend. `sortBy` is `tokens` \| `calls` \| `avgTokens` (default `tokens`); the duration route's `sortBy` values are rejected here. | `[{ file, testName, executionCount, reportedExecutions, reportedTokenExecutions, reportedCallExecutions, totalTokens, totalCalls, avgTokens, avgCalls }]` — see the coverage note below |
| `GET /v1/analytics/attribution/summary` | Failure counts by cause category | `{ classifiedFailures, byCategory: {…}, everIngested }` — see the attribution note below |
| `GET /v1/analytics/attribution/trend` | Failure category counts over time | `[{ date, app_regression, spec_issue, test_data, infra_flake, unknown }]` |
| `GET /v1/analytics/attribution/repos` | Repos that have classification data | `["org/repo", …]` |
| `GET /v1/analytics/attribution/branches` | Branches that have classification data (accepts `repo` to scope) | `["main", …]` |
| `GET /v1/analytics/usage` | LLM + compute usage and cost for the window, with optimization hints. Org-wide only — **`repo`/`branch` are rejected with `400`**, because billed cost carries no repo dimension and org-wide totals under a repo filter would misattribute spend. | `{ window: { from, to }, testRuns, testCount, tokensTotal, billedMicrocents, computeBilledMicrocents, tokensPerTest, llmCallsPerTest, avgRunDurationSec, avgTestDurationSec, cacheHitRate, healRate, byOperation[], hints[], compute, byModel[], byModelTier[], windowPrecision }` — see notes below |
| `GET /v1/analytics/runs/{runId}/usage` | LLM usage + estimated cost for ONE run, with the per-operation breakdown. Database-backed, so it outlives the run's artifacts. | `{ runId, llmCalls, tokensTotal, estimatedCostMicrocents, cacheHitRate, healRate, cache, byOperation[], hints[] }` |
| `GET /v1/analytics/runs/{runId}/results/{resultId}/usage` | LLM usage + priced cost for ONE test result, per attempt and per step. | `{ testResultId, source, reported, segments: [{ attempt, outcome, total, steps[], byOperation[] }], byOperation[], total }` — `source` is `artifact` \| `totals-only` \| `none`; see the note below. `413` when the artifact is too large to parse |
| `GET /v1/analytics/compute/jobs` | Per-job runner rows keyed by GitHub `workflowJobId`. Add `includeTests=1` for per-job test attribution, so setup-vs-test share needs no GitHub call. Honors `repo`/`branch`; paginated via `limit` (default `50`, max `200`) + `cursor`. | `{ jobs: [{ workflowRunId, workflowJobId, workflowRunAttempt, repo, headSha, headRef, runnerLabel, vcpus, vmMinutes, startedAt, completedAt, billed, testCount, testExecutionMinutes }], nextCursor }` — `testCount`/`testExecutionMinutes` are `null` unless `includeTests=1` |

Example — `GET /v1/analytics/tests/failing`:

```json
[
  {
    "file": "tests/checkout.spec.ts",
    "testName": "checkout succeeds",
    "passedCount": 40,
    "flakyCount": 2,
    "failedCount": 8,
    "passRate": 80,
    "flakyRate": 4,
    "flakeRate": 4,
    "totalExecutions": 50
  }
]
```

For both reliability rankings:

```text
totalExecutions = passedCount + flakyCount + failedCount
passRate         = passedCount / totalExecutions × 100
flakyRate        = flakyCount  / totalExecutions × 100
```

`passRate` is strict: a retry-passed (`flaky`) execution is not in its numerator.
`failedCount` folds in `timedout`. A `flaky` execution means the same execution
failed an earlier attempt and passed on retry; cross-run pass/fail transitions do
not create flaky outcomes. `flakeRate` is a deprecated compatibility alias equal
to `flakyRate`; read `flakyRate`. There is no `failureRate` field — derive it as
`failedCount / totalExecutions × 100` when needed. When both documented sort
keys tie, relative order is unspecified; do not rely on an identity tie-breaker.

#### `windowPrecision`

Always `"exact"` on this API: `tokensTotal`, `billedMicrocents` and
`computeBilledMicrocents` cover your precise `[from, to)`. The web Usage page reads a
`"daily"` rollup instead — it credits a day the window merely clips, drops the
in-progress day, and returns **zero** for a window spanning no midnight — so figures
quoted from the two surfaces will not match.

Exact does not mean every column agrees: money is windowed on the ledger's
`usage_at`, runner jobs on dispatch `created_at`, tests on `start_time`. A run at a
window edge lands in one aggregate and not another. Prefer a week or more when a
ratio has to be right.

#### Per-result usage degrades as artifacts age

`runs/{runId}/results/{resultId}/usage` reports `source`:

- `artifact` — full per-attempt, per-step detail.
- `totals-only` — the artifact is gone (or was never uploaded); `total` still comes
  from the durable per-test columns, `segments` and `byOperation` are empty.
- `none` — nothing was ever recorded.

The response **shape is identical in all three**, so read `total` and map
`byOperation` without branching first. `total` is a zeroed object, never null.

#### Attribution is customer-fed, not computed

`/v1/analytics/attribution/*` reads classifications **you ingest** via
`POST /v1/test-classifications`; nothing in the product produces them. So all-zero
counts are ambiguous — read `everIngested`: `false` means this org has never ingested
one (go wire it up), `true` means the window genuinely had no classified failures.

`infra_flake` is a failure-attribution category, not the `flaky` terminal outcome.
It says a failed execution was classified as infrastructure-related; it does not
increment `flakyCount` or imply that the execution passed on retry.

#### Coverage on `/tests/costliest`

`executionCount` is every execution in the window; `reportedExecutions` is those that
reported usage — a large gap means the ranking rests on a thin sample. Each average
divides by its own metric's count (`reportedTokenExecutions` /
`reportedCallExecutions`), because calls and tokens are reported independently and a
result can carry one without the other. Tests reporting neither are omitted rather
than shown at zero, which would read as "free" instead of "unknown".

#### Reconciling job counts

`compute.measurements.jobs` on `/analytics/usage` and the row count from
`/compute/jobs` legitimately differ. The former counts only **billed** jobs and
windows on the billing ledger's `usage_at`; the latter returns **every** dispatch
and windows on `gha_runner_dispatches.created_at`. Filter to `billed: true` to
close most of the gap; the remainder is the window-column difference at the edges.

`vmMinutes` is `null`, never `0`, for a dispatch with no linked run — treat it as
unknown rather than free, or a reconstructed total will under-count. There is no
per-job cost field, because the billing ledger prices compute per tier rather than
per workflow job. Derive it: `/analytics/usage` gives `vmMinutes` and
`billedMicrocents` per runner tier under `compute.measurements.byRunner[]`, so a
tier's effective price per minute is that quotient, and a job's cost is its
`vmMinutes` times the rate for its `runnerLabel`.

#### `GET /v1/analytics/usage` — usage, cost, and optimization levers

The one endpoint that surfaces **what your testing costs and how to cut it**.
Money and rates follow the units above. Nested breakdowns to reason over:

- **`byOperation[]`** — `{ operation, calls, inputTokens, outputTokens, thinkingTokens, cacheReadTokens, totalTokens }`. Usage per step type (`action`, `verify_ai`, `evaluate_if` / `evaluate_while` / `evaluate_wait_until`, …). The lever: if `evaluate_wait_until` dominates, that AI-polling step is your token sink — convert it to a deterministic wait or a tighter condition.
- **`byModel[]`** — usage per `{ provider, model, routing }`: `{ …, pricingTier, calls, …tokenCounts }`. Covers **both** proxied and BYOK traffic. `pricingTier` (`lite`/`standard`/`pro`) is set only on `routing: "proxy"` rows and is `null` for `byok` / `custom_endpoint`. **No cost field** — this is the usage view. The lever: if an expensive model carries most tokens, move that operation to a cheaper one.
- **`byModelTier[]`** — `{ tier, billedTokens, billedMicrocents }`, **proxy billing only**; empty for a pure-BYOK org. The lever: shows whether spend concentrates in the expensive tier. Rates are per-org and live in the price card, not in this payload — divide a row's `billedMicrocents` by its `billedTokens` to get what that tier actually costs you per token, then compare rows before deciding a move is worth it. Read live from the billing ledger on your exact window — on this API the headline `billedMicrocents` *is* the sum of these rows, so the two reconcile exactly.
- **`compute`** — the machine plane: `{ measurements, ratios, hints }` covering runner VM minutes and cost, tests-per-job, and achieved concurrency. `null` for orgs not on hosted runners. Its hints are richer than the top-level ones — `{ code, severity, message, evidence, knobs[], estimatedImpact, confidence }` — under two codes: `oversized_runner` (runners wider than the parallelism achieved) and `over_sharded` (too few tests per job to amortize setup). `estimatedImpact` always names the `assumption` it holds under, and `autoApply` is always `false`: we cannot see whether a job also builds or bundles, which may justify a wide runner the test phase does not use.
- **`hints[]`** — `{ code, message }` optimization suggestions computed from the same numbers in the response. Current codes: `dominant_action_tokens` (AI actions are the majority of your TOKENS — the page context sent per call is the lever), `dominant_ai_conditions` (IF/WHILE/WAIT_UNTIL are the majority of your CALLS — deterministic waits remove them), `low_cache_hit_rate`. Ratio hints are suppressed below a floor of ~50 calls, so a short window can legitimately return `[]`; widen it before concluding there is nothing to optimize.

**Which totals are complete.** `billedMicrocents` is `null` for a BYOK-only org and
for an empty window. `byModel` and `compute` are runner-reported and can under-count
when a run never uploaded its usage summary; `byModelTier` (the billing ledger) is
always complete. `cacheHitRate` and `healRate` are `null` when no run reported a
cache summary — that is "not reported", NOT a 0% hit rate, and `low_cache_hit_rate`
cannot fire while they are null.

**`tokensTotal` is billed tokens, not all tokens.** It is the sum of
`byModelTier[].billedTokens`, and that ledger is proxy-only by construction: BYOK and
custom-endpoint calls never reach the proxy, so they are billed nothing and appear
nowhere in it. A BYOK org therefore reads `tokensTotal: 0` beside a populated
`byOperation` and a non-zero `tokensPerTest` — those come from the runner-reported
analytics plane, which does cover BYOK. Read `byOperation` for "how many tokens did
we spend", `tokensTotal` for "how many were we billed for".

**Two compute cost figures, deliberately different.** `computeBilledMicrocents`
covers every billed compute meter — CI runners **plus hosted workspaces**.
`compute.measurements.billedMicrocents` covers CI runners only. Expect the first to
be the larger of the two; the gap is workspace compute, not an error in either.

**Setup vs. test time.** Page `GET /v1/analytics/compute/jobs?includeTests=1`: each
row then carries `testCount` and `testExecutionMinutes` alongside
`startedAt`/`completedAt`, so

    concurrency  = testExecutionMinutes / wallClockMinutes
    setupMinutes = wallClockMinutes - testExecutionMinutes

The subtraction only holds when concurrency is at or below ~1 — tests run in
parallel inside a job, so `testExecutionMinutes` can exceed wall clock and the
difference then means nothing. Check the ratio first. For the finer breakdown
(checkout vs install vs browser download) join `workflowJobId` against
`GET /repos/{owner}/{repo}/actions/jobs/{job_id}` on GitHub, which is the only
source of per-STEP timings.

```bash
curl -H "Authorization: Bearer $SHIPLIGHT_API_TOKEN" \
  "$SHIPLIGHT_API_URL/v1/analytics/usage?from=2026-06-01T00:00:00Z&to=2026-07-01T00:00:00Z"
```

`byOperation` and `byModel` are truncated to one row here; a real response carries
one per operation and per model. Note that `byModelTier` sums to both `tokensTotal`
and `billedMicrocents`, and that `computeBilledMicrocents` exceeds
`compute.measurements.billedMicrocents` by the workspace compute the latter omits.

```json
{
  "window": { "from": "2026-06-01T00:00:00.000Z", "to": "2026-07-01T00:00:00.000Z" },
  "windowPrecision": "exact",
  "testRuns": 100,
  "testCount": 5000,
  "tokensTotal": 50000000,
  "billedMicrocents": "1200000000",
  "computeBilledMicrocents": "300000000",
  "tokensPerTest": 10000,
  "llmCallsPerTest": 5,
  "avgRunDurationSec": 412.5,
  "avgTestDurationSec": 38.2,
  "cacheHitRate": null,
  "healRate": null,
  "byOperation": [
    { "operation": "evaluate_wait_until", "calls": 1500, "totalTokens": 12000000 }
  ],
  "byModel": [
    { "provider": "anthropic", "model": "claude-sonnet-5", "routing": "proxy", "pricingTier": "standard", "calls": 800, "totalTokens": 6000000 }
  ],
  "byModelTier": [
    { "tier": "standard", "billedTokens": 40000000, "billedMicrocents": "400000000" },
    { "tier": "pro", "billedTokens": 10000000, "billedMicrocents": "800000000" }
  ],
  "compute": {
    "measurements": { "billedMicrocents": "280000000", "vmMinutes": 4200, "jobs": 310, "tests": 5000 },
    "ratios": { "concurrentTestsPerVmMinute": 1.6, "coreUtilization": 0.12 },
    "hints": [
      { "code": "oversized_runner", "severity": "medium", "confidence": "medium", "message": "Runners average 16 vCPUs but run ~1.6 tests at a time.", "autoApply": false }
    ]
  },
  "hints": []
}
```

### Recorder Sessions (browser screen recordings)

Recorded browser sessions captured by the Shiplight screen-recorder extension: an
interaction/network/console/navigation **event timeline**, a manifest (user agent,
viewport, codecs), reviewer comments, and — behind an explicit opt-in — the raw
screen/audio recordings. This is a **different data source** from the test-run
`videoS3Uri` artifacts above (those are Playwright captures of CI test runs).

> **Scope:** the token must carry the `recordings:read` scope (a full-inherit token —
> one created with no scope restrictions — also works). All access is org-scoped: a
> session belonging to another org returns `404`, never another org's data.

Use these to **author tests from a real user session** — the `interaction` events carry
stable element selectors (`testId`, `role`, `name`), and `network` events carry the API
calls each interaction triggered.

#### List Recorder Sessions

```bash
curl -H "Authorization: Bearer $SHIPLIGHT_API_TOKEN" \
  "$SHIPLIGHT_API_URL/v1/recorder-sessions?pageSize=20"
```

Metadata only (no event timeline, no recordings), newest first.

| Param | Type | Description |
|-------|------|-------------|
| `page` | number | Default `1` |
| `pageSize` | number | Default `20`, max `100` |

**Response:** `{ sessions, total, page, pageSize }`, where each session is
`{ sessionId, title, scope, startedAt, durationMs, eventCounts, hasStreamFailure, streamFailures, transcriptionStatus, createdByEmail, createdByDisplayName, createdAt }`. `sessionId` is a UUID; `scope` is `tab` or `desktop`; `eventCounts` is a per-kind tally; `title` is auto-derived from the transcript when one is available, else a formatted timestamp; `transcriptionStatus` is one of `pending` \| `processing` \| `succeeded` \| `failed` \| `skipped` (`skipped` = no audio was captured, so there is nothing to transcribe).

#### Get Recorder Session

```bash
curl -H "Authorization: Bearer $SHIPLIGHT_API_TOKEN" \
  "$SHIPLIGHT_API_URL/v1/recorder-sessions/<sessionId>"
```

Returns the full session: metadata, manifest, the **inlined event timeline**, the
voice-narration **transcript**, and comments. By **default the response does not include the
video/audio recordings** — they're large binaries, so they're strictly opt-in via `include`.

| Param | Type | Description |
|-------|------|-------------|
| `include` | string | Comma-separated opt-ins for the heavy binaries: `video`, `audio`, or `all`. Default: none — no recordings, only the (non-binary) event data. |
| `eventKinds` | string | Comma-separated filter for the timeline: any of `interaction`, `navigation`, `network`, `console`, `dom`, `metadata`. Default: all kinds. Pass e.g. `eventKinds=interaction,navigation,network,console` to drop the large `dom` (rrweb) replay stream you don't need for authoring. |

```json
{
  "session": {
    "sessionId": "8f3b…", "title": "Checkout flow", "scope": "tab",
    "startedAt": "2026-07-14T10:00:00.000Z", "durationMs": 48213,
    "eventCounts": { "interaction": 12, "navigation": 3, "network": 20, "console": 1, "dom": 40, "metadata": 1 },
    "hasStreamFailure": false, "streamFailures": [], "transcriptionStatus": "succeeded",
    "createdByEmail": "user@acme.com", "createdByDisplayName": "Sam", "createdAt": "2026-07-14T10:00:52.000Z"
  },
  "manifest": { "userAgent": "Mozilla/5.0…", "platform": "macOS", "maskInputs": true, "videoMimeType": "video/webm", "audioMimeType": null, "pauseCount": 0 },
  "events": [
    { "t": 1200, "seq": 4, "kind": "interaction", "type": "click",
      "target": { "selector": "[data-testid='checkout']", "strategy": "testid", "role": "button", "name": "Checkout", "testId": "checkout", "tag": "button" } },
    { "t": 1260, "seq": 5, "kind": "network", "api": "fetch", "method": "POST", "url": "/api/cart/checkout", "status": 200, "startT": 1260, "endT": 1440 },
    { "t": 1500, "seq": 6, "kind": "navigation", "navType": "pushState", "url": "/checkout/payment", "fromUrl": "/cart" }
  ],
  "eventsUrl": null,
  "comments": [
    { "id": "c1", "videoPositionMs": 1200, "body": "bug repro starts here", "authorEmail": "user@acme.com", "authorDisplayName": "Sam", "createdAt": "…", "updatedAt": "…" }
  ],
  "transcript": {
    "text": "Okay, I'm clicking the checkout button, and now the payment page loads.",
    "segments": [
      { "text": "Okay, I'm clicking the checkout button,", "startMs": 1100, "endMs": 2600, "confidence": 0.98 },
      { "text": "and now the payment page loads.", "startMs": 2600, "endMs": 3900 }
    ],
    "provider": "deepgram", "language": "en"
  },
  "media": null
}
```

Events are sorted by `(t, seq)`. **Large timelines are not inlined**: if `events.json`
exceeds ~5 MiB (long sessions with heavy `dom`/rrweb data), `events` is `null` and
`eventsUrl` holds a short-lived presigned GET for the raw `events.json` — fetch and parse
that yourself (`curl "$eventsUrl"`). `eventKinds` filtering applies only to inlined events, so
narrowing to `interaction,navigation,network,console` keeps most sessions inline. `media` is
`null` unless requested; with `?include=video,audio` it becomes
`{ "video": { "url", "expiresIn" }, "audio": {…} }` (short-lived presigned GET URLs). A
per-stream entry is `null` when that stream failed at capture time (see `streamFailures`).

`transcript` is the recorder's spoken narration (what the user said aloud while capturing) —
`{ text, segments, provider, language }`, or `null`. `text` is the full plain-text; `segments`
are pause-delimited chunks `{ text, startMs, endMs, confidence? }` whose `startMs`/`endMs` are on
the **same millisecond clock as each event's `t`**, so you can align spoken intent with the
interaction that triggered it. It's `null` until transcription finishes (`transcriptionStatus`
tells you which state: `pending`/`processing` = still coming, `succeeded` = present, `failed` =
won't appear without a re-run, `skipped` = no audio was captured). `segments` is `[]` when the
audio had no detectable speech.

## Workflows

### Inspect a Run's Results

1. `GET /v1/test-runs?pageSize=10&result=failed` (or other filters) to find recent failures.
2. `GET /v1/test-runs/{testRunId}` to load `testRun` + `testCaseResults`.
3. For each failed `testCaseResult`, `GET /v1/s3/file?uri=<reportS3Uri>` to fetch the report JSON.
4. Parse the report and stream any nested `s3://` URIs via `GET /v1/s3/file?uri=…`. Report schema is reporter-defined; expect arbitrary fields containing `s3://` values.

### Triage Failures or Flaky Tests

1. `GET /v1/failing-tests?repo=org/repo` (or `/v1/flaky-tests`) — defaults to the last 7 days on any branch. These are current-state lists: a later outcome replaces the earlier one for that test. Add `branch=` to scope, `from`/`to` to widen or shift the window.
2. For each row, `GET /v1/s3/file?uri=<reportS3Uri>` to fetch the report JSON.
3. Parse the report and stream any nested `s3://` URIs via `GET /v1/s3/file?uri=…`.

### Assess Repo Health, Then Triage by Attribution

1. `GET /v1/analytics/summary?repo=org/repo` — overall run/test pass rates for the repo.
2. `GET /v1/analytics/attribution/summary?repo=org/repo` — of the classified failures, what share are `app_regression` (application bugs) vs `infra_flake` (infrastructure-related failures to investigate separately; not retry-passed outcomes).
3. `GET /v1/analytics/tests/failing?repo=org/repo&limit=10` — the historical ranked worklist (failure count first); `GET /v1/analytics/tests/flaky` for retry-maskers (flaky count first), `GET /v1/analytics/tests/slowest` for perf, `GET /v1/analytics/tests/costliest` for token spend.
4. Drop to the raw endpoints above (`/v1/test-results?repo=&file=`, `/v1/s3/file`) to fetch a specific test's report/artifacts.
### Author a Test from a Recorded Session

1. `GET /v1/recorder-sessions?pageSize=20` to find a recent session (note its `sessionId`).
2. `GET /v1/recorder-sessions/<sessionId>?eventKinds=interaction,navigation,network,console`
   to pull the timeline **without** the large `dom` replay stream or any video.
3. Walk the `events` in `(t, seq)` order: each `interaction` gives you a stable locator
   (`target.testId` / `role` + `name`), and the `network` events immediately after it are
   the requests to assert on. `navigation` events mark page transitions.
4. Read the `transcript` (if `transcriptionStatus` is `succeeded`) for the user's spoken intent —
   *what* they were trying to do and *what they expected*, which the events alone don't tell you.
   Line up each `segment`'s `startMs`/`endMs` with the event `t` in that window to attach the
   narration ("now I click checkout and it should go to payment") to the exact interaction — this
   is the source of good assertion descriptions and the expected-outcome for each step.
5. Generate the test from that sequence. Only fetch `?include=video` if you actually need
   to watch the recording — it's a large binary and not needed for authoring.
