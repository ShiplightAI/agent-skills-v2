# cloud — Read Shiplight Cloud (Nova) test results

Read-only access to test results on Shiplight Cloud (Nova, `nova-api.shiplight.ai`)
uploaded by the Shiplight CLI / CI runner: list runs, fetch run details, list
failing/flaky tests, and download artifacts. The `/v1` segment is the API contract
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

`passedCount` includes `flakyCount` (use `passedCount - flakyCount` for strict passes); `failedCount` includes `timedout`. Sum = `totalTestCount`.

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

For each unique `(file, testName)` in the window, returns its latest row when the result is `failed` or `timedout`.

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

For each unique `(file, testName)` in the window, returns its latest row when the result is `flaky` (passed only after retry).

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

## Workflows

### Inspect a Run's Results

1. `GET /v1/test-runs?pageSize=10&result=failed` (or other filters) to find recent failures.
2. `GET /v1/test-runs/{testRunId}` to load `testRun` + `testCaseResults`.
3. For each failed `testCaseResult`, `GET /v1/s3/file?uri=<reportS3Uri>` to fetch the report JSON.
4. Parse the report and stream any nested `s3://` URIs via `GET /v1/s3/file?uri=…`. Report schema is reporter-defined; expect arbitrary fields containing `s3://` values.

### Triage Failures or Flaky Tests

1. `GET /v1/failing-tests?repo=org/repo` (or `/v1/flaky-tests`) — defaults to the last 7 days on any branch. Add `branch=` to scope, `from`/`to` to widen or shift the window.
2. For each row, `GET /v1/s3/file?uri=<reportS3Uri>` to fetch the report JSON.
3. Parse the report and stream any nested `s3://` URIs via `GET /v1/s3/file?uri=…`.
