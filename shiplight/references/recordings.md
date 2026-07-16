# recordings — Read Shiplight Screen Recorder sessions

Read-only access to product-session recordings captured by the Shiplight
Screen Recorder (browser extension) and uploaded to Shiplight Cloud (Nova,
`nova-api.shiplight.ai`): list recordings, fetch one recording's metadata,
comments, transcript, and presigned URLs to its raw artifacts (session
manifest, event timeline, video, audio).

A recording is a tester walking the real product while narrating and dropping
timestamped comments — the fastest way to learn what a feature is actually
supposed to do without reading code. This subcommand only reads and reports
that content; it does not decide what to do with it. Depending on what the
user asked for, that might mean summarizing the journey, writing a spec,
authoring a YAML test (`create-yaml-tests`), building an agent verification
(`create-agent-verification`), or feeding a coverage plan (`cover`) — pick
whichever fits, or just report back what the recording shows.

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

The token needs the `recordings:read` scope.

If the user provides a token, **ask before writing `.env`** (the edit contract bars editing `.env` unless the user asks); with their OK, add `SHIPLIGHT_API_TOKEN=<token>` and remind them to keep `.env` out of git.

## Error Handling

| Status | Action |
|--------|--------|
| 400 | Fix the request, session ID, or query parameters. All validation errors return 400. |
| 401 | Token is missing, invalid, expired, or for the wrong Nova environment. |
| 403 | Token lacks the `recordings:read` scope. |
| 404 | No recording for this `sessionId` in your organization. |
| 500 | Retry only if idempotent. |

## REST API

Base URL: `$SHIPLIGHT_API_URL`

### List Recordings

```bash
curl -H "Authorization: Bearer $SHIPLIGHT_API_TOKEN" \
  "$SHIPLIGHT_API_URL/v1/recorder-sessions?pageSize=10"
```

Ordered by `createdAt` descending.

| Param | Type | Description |
|-------|------|--------------|
| `page` | number | Default `1` |
| `pageSize` | number | Default `20` |

**Response:**

```json
{
  "sessions": [
    {
      "sessionId": "9f1c2b3a-...",
      "title": null,
      "scope": "tab",
      "startedAt": "2026-07-01T21:20:00.000Z",
      "durationMs": 48213,
      "eventCounts": { "interaction": 12, "navigation": 3, "dom": 240, "console": 5, "network": 18, "metadata": 4 },
      "hasStreamFailure": false,
      "createdAt": "2026-07-01T21:21:05.000Z",
      "createdByEmail": "user@example.com",
      "createdByDisplayName": "User Name"
    }
  ],
  "total": 1,
  "page": 1,
  "pageSize": 20
}
```

`eventCounts` is a cheap way to skim which recordings are worth opening before fetching detail — e.g. a high `network` count suggests a data-heavy flow, a nonzero `console` count is worth checking for errors.

### Get Recording

```bash
curl -H "Authorization: Bearer $SHIPLIGHT_API_TOKEN" \
  "$SHIPLIGHT_API_URL/v1/recorder-sessions/9f1c2b3a-..."
```

Returns the session's metadata, comments, and transcript inline, plus short-lived (1 hour) presigned **GET** URLs for its four artifacts (media/raw data needs a separate fetch — see below).

```json
{
  "session": {
    "sessionId": "9f1c2b3a-...",
    "title": null,
    "scope": "tab",
    "startedAt": "2026-07-01T21:20:00.000Z",
    "durationMs": 48213,
    "eventCounts": { "interaction": 12, "navigation": 3, "dom": 240, "console": 5, "network": 18, "metadata": 4 },
    "hasStreamFailure": false,
    "streamFailures": [],
    "createdAt": "2026-07-01T21:21:05.000Z",
    "createdByEmail": "user@example.com",
    "createdByDisplayName": "User Name"
  },
  "artifacts": {
    "session": { "url": "https://s3.../session.json?X-Amz-Signature=...", "expiresIn": 3600 },
    "events": { "url": "https://s3.../events.json?...", "expiresIn": 3600 },
    "video": { "url": "https://s3.../video.webm?...", "expiresIn": 3600 },
    "audio": { "url": "https://s3.../audio.webm?...", "expiresIn": 3600 }
  },
  "comments": [
    {
      "id": "c1...",
      "videoPositionMs": 15200,
      "body": "This is where the checkout button fails to respond.",
      "authorEmail": "user@example.com",
      "authorDisplayName": "User Name",
      "createdAt": "2026-07-01T21:25:00.000Z",
      "updatedAt": "2026-07-01T21:25:00.000Z"
    }
  ],
  "transcript": {
    "text": "Click the checkout button. Then confirm the order.",
    "segments": [
      { "text": "Click the checkout button.", "startMs": 80, "endMs": 1320, "confidence": 0.98 },
      { "text": "Then confirm the order.", "startMs": 1400, "endMs": 2600, "confidence": 0.95 }
    ],
    "provider": "deepgram",
    "language": "en",
    "createdAt": "2026-07-01T21:26:00.000Z",
    "updatedAt": "2026-07-01T21:26:00.000Z"
  }
}
```

### Reading the artifacts

Fetch each `artifacts.*.url` with a plain `curl -o <file> "<url>"` (or an HTTP GET if scripting) — no `Authorization` header needed, the presigned URL already carries the signature.

- **`artifacts.session.url` → `session.json`** — the recording's shape: `startedAtISO`, `durationMs`, `scope` (`tab`/`desktop`), `userAgent`, `platform`, per-artifact `media` info. Mostly redundant with `session` in the API response above; only fetch it if you need a field not already surfaced there.
- **`artifacts.events.url` → `events.json`** — the actual user journey as a flat, timestamp-ordered (`t`, `seq`) array. Each event has a `kind`: `interaction` (click/input/submit/scroll/keydown, with an element ref — selector, role, name, test id), `navigation` (URL changes), `console` (log/warn/error output), `network` (fetch/XHR calls with method/url/status), `metadata` (page/title/viewport snapshots). This is the closest thing to "steps" a recording has — reconstruct the flow by walking this array in order.
- **`comments`** — the tester's own narration anchored to `videoPositionMs`, usually the most direct signal of *intent* ("this is where X breaks", "this should show Y"). Cross-reference `videoPositionMs` against `events.json`'s `t` (both are ms from session start) to line up what the tester was doing when they said it.
- **`transcript`** — paragraph/utterance-level narration (not word-level) on the same shared clock as `events.json`; populated automatically by Deepgram shortly after upload, no submit/override endpoint exists. `null` means either transcription hasn't finished yet (re-check shortly) or the audio stream failed to capture (`session.hasStreamFailure`/`streamFailures` will say which). Cross-reference `segments[].startMs` against `events.json`'s `t` the same way you would `comments[].videoPositionMs`.
- **`artifacts.video.url` / `artifacts.audio.url` → `video.webm` / `audio.webm`** — visual and spoken context for when the structured event stream, comments, and transcript alone don't disambiguate what happened (e.g. a visual bug with no DOM/console signal).

## Workflows

### Get the gist of one recording

1. `GET /v1/recorder-sessions?pageSize=10` to find the session (or ask the user for a `sessionId` directly).
2. `GET /v1/recorder-sessions/{sessionId}` for metadata, comments, transcript, and artifact URLs.
3. Fetch `events.json`; walk it alongside the comments and transcript to reconstruct what the tester did and why.
4. Report back or hand the reconstructed journey to whichever subcommand fits what the user actually asked for.
