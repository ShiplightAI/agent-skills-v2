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
| `to` | string | ISO timestamp, exclusive. Defaults to `now` |
| `bucket` | string | `day` \| `week` \| `month` — summary + trends. Default `day` |
| `limit` | number | `1`–`500` — rankings. Default `20` |
| `minExecutions` | number | Min executions to include — failing/flaky. Default `5` |
| `sortBy` | string | `p50` \| `p95` \| `executions` — slowest. Default `p50` |
| `sortOrder` | string | `asc` \| `desc` — slowest. Default `desc` |

| Endpoint | Description | Returns |
|----------|-------------|---------|
| `GET /v1/analytics/summary` | Headline run + test pass rates and totals for the window | `{ runPassRate, testPassRate, totalRuns, decidedRuns, totalTestExecutions, decidedTestExecutions }` (rates 0–1) |
| `GET /v1/analytics/trends/pass-rate` | Run pass rate over time | `[{ date, passRate, totalRuns, passedRuns, failedRuns }]` |
| `GET /v1/analytics/trends/run-status` | Passed vs failed run counts over time | `[{ date, passedRuns, failedRuns, totalRuns, passRate }]` |
| `GET /v1/analytics/trends/test-results` | Test-result counts (passed/flaky/failed/skipped) over time | `[{ date, passed, flaky, failed, skipped, total, passRate }]` |
| `GET /v1/analytics/trends/run-duration` | Run-duration percentiles over time | `[{ date, totalRuns, avgDurationSec, p50DurationSec, p95DurationSec, minDurationSec, maxDurationSec }]` |
| `GET /v1/analytics/tests/failing` | Tests ranked by failure rate | `[{ file, testName, passedCount, flakyCount, failedCount, passRate, flakeRate, totalExecutions }]` |
| `GET /v1/analytics/tests/flaky` | Tests ranked by flakiness | same shape as `tests/failing` |
| `GET /v1/analytics/tests/slowest` | Tests ranked by duration (p50/p95) | `[{ file, testName, p50Ms, p95Ms, executionCount }]` |
| `GET /v1/analytics/attribution/summary` | Failure counts by cause category | `{ classifiedFailures, byCategory: { app_regression, spec_issue, test_data, infra_flake, unknown } }` (counts; shares = `byCategory[c]/classifiedFailures`) |
| `GET /v1/analytics/attribution/trend` | Failure category counts over time | `[{ date, app_regression, spec_issue, test_data, infra_flake, unknown }]` |
| `GET /v1/analytics/attribution/repos` | Repos that have classification data | `["org/repo", …]` |
| `GET /v1/analytics/attribution/branches` | Branches that have classification data (accepts `repo` to scope) | `["main", …]` |

Example — `GET /v1/analytics/tests/failing`:

```json
[
  {
    "file": "tests/checkout.spec.ts",
    "testName": "checkout succeeds",
    "passedCount": 40,
    "flakyCount": 2,
    "failedCount": 8,
    "passRate": 0.8,
    "flakeRate": 0.04,
    "totalExecutions": 50
  }
]
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

1. `GET /v1/failing-tests?repo=org/repo` (or `/v1/flaky-tests`) — defaults to the last 7 days on any branch. Add `branch=` to scope, `from`/`to` to widen or shift the window.
2. For each row, `GET /v1/s3/file?uri=<reportS3Uri>` to fetch the report JSON.
3. Parse the report and stream any nested `s3://` URIs via `GET /v1/s3/file?uri=…`.

### Assess Repo Health, Then Triage by Attribution

1. `GET /v1/analytics/summary?repo=org/repo` — overall run/test pass rates for the repo.
2. `GET /v1/analytics/attribution/summary?repo=org/repo` — of the classified failures, what share are `app_regression` (real bugs to fix) vs `infra_flake` (noise to ignore).
3. `GET /v1/analytics/tests/failing?repo=org/repo&limit=10` — the ranked worklist; `GET /v1/analytics/tests/flaky` for retry-maskers, `GET /v1/analytics/tests/slowest` for perf.
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
