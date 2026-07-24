# support — Get human help (file and track a support ticket)

Escalate to Shiplight's human support without leaving the agent: draft a
diagnostic ticket from what this session already knows, get the user's approval,
submit it, and read replies later. Support replies also arrive by email; this
subcommand is how the user files and checks from here.

Sub-verbs (match from context; default is filing):

- *(default)* — file a ticket
- `status [SUP-…]` — list the caller's accessible tickets, or show one ticket's thread
- `reply SUP-… <message>` — answer support on an open ticket
- `close SUP-…` — close a ticket

## Read first

- `_shared/secrets.md` — a ticket is outbound content; no raw secrets in it, ever.

## Setup

Same API and token as `cloud`:

```bash
export SHIPLIGHT_API_URL=https://nova-api.shiplight.ai
```

All calls send `Authorization: Bearer $SHIPLIGHT_API_TOKEN`. If no token is
available, ask the user for their Shiplight API token; **ask before writing
`.env`**, then add `SHIPLIGHT_API_TOKEN=<token>` there.

## Filing flow (default)

1. **Self-triage.** Check the stuck state against known failure modes before
   escalating — many "stuck" cases have an in-skill fix:

   | Symptom | Known fix |
   |---------|-----------|
   | `node_modules/shiplightai` missing | `npm install` in the project root |
   | installed CLI behind latest | `/shiplight update` |
   | login redirect / expired session in a test or verify run | `/shiplight auth` |

   Offer the fix if one matches. If the user still wants a human — or nothing
   matches — continue to filing; self-triage never blocks escalation. Record
   what was checked as `doctorChecks` in the diagnostics.

2. **Gather diagnostics** from evidence already in the session plus these cheap
   reads (do not launch new analysis — no fresh browser sessions or test runs):

   - `subcommand` — the `/shiplight` command that was running, if any
   - `errorOutput` — the exact failing output, trimmed to the relevant tail
   - `cliVersion` / `latestCliVersion` —
     `node -p "require('./node_modules/shiplightai/package.json').version"` and
     `npm view shiplightai version` (collect only; a stale CLI never blocks
     filing)
   - `skillTimestamp` — contents of `.shiplight-agent-skills-last-update`
   - `os` (`uname -sr`), `nodeVersion` (`node -v`)
   - `doctorChecks` — the self-triage results from step 1

3. **Draft the ticket.**

   - `subject` — one line, ≤ 200 chars
   - `body` — markdown: what the user was doing, what happened, what was
     already tried. Written for a human who has not seen this session.
   - `category` — `bug` (Shiplight misbehaved) · `question` (how do I…) ·
     `feature_request` · `billing` · `other`
   - `severity` — `blocking` (Shiplight work cannot proceed) · `degraded`
     (workaround exists) · `minor` (default)
   - `source` — always `skill`

   Scrub the body and diagnostics before showing them: replace anything
   secret-shaped (bearer strings, `sk-`/`ghp_` tokens, AWS keys, values known
   to come from `.env`) with `[redacted]`.

4. **Get approval.** Show the full draft — subject, body, category, severity,
   and the diagnostics verbatim — and state that everything shown goes to
   Shiplight support. Submit only on an explicit yes; apply any edits the user
   asks for first. Never auto-submit.

5. **Submit.**

   ```bash
   curl -X POST -H "Authorization: Bearer $SHIPLIGHT_API_TOKEN" \
     -H "Content-Type: application/json" \
     -d @ticket.json "$SHIPLIGHT_API_URL/v1/support-tickets"
   ```

   Body: `{ subject, body, category, severity, source, diagnostics }`
   (plus `contactEmail` when the API asks for it — see errors). Size caps:
   `body` ≤ 64 KB, `diagnostics` ≤ 128 KB.

   Response `201`: `{ id, ticketNumber, status, createdAt, redactions }`.

6. **Report.** Give the ticket number, note that an acknowledgment email went
   to the user's account address and replies arrive by email, and that
   `/shiplight support status SUP-…` checks from here. If `redactions > 0`,
   say the server scrubbed additional secret-shaped content.

## Status / reply / close

```bash
# List tickets (filter: ?status=open|waiting_on_user|resolved|closed)
# Access is per-caller: a ticket's designated contacts (active org members), or
# the filing token for token-only callers — not the whole org.
curl -H "Authorization: Bearer $SHIPLIGHT_API_TOKEN" \
  "$SHIPLIGHT_API_URL/v1/support-tickets"

# One ticket with its full message thread
curl -H "Authorization: Bearer $SHIPLIGHT_API_TOKEN" \
  "$SHIPLIGHT_API_URL/v1/support-tickets/<id>"

# Reply (also moves the ticket back to support's queue)
curl -X POST -H "Authorization: Bearer $SHIPLIGHT_API_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"body": "<message>"}' "$SHIPLIGHT_API_URL/v1/support-tickets/<id>/messages"

# Close
curl -X PATCH -H "Authorization: Bearer $SHIPLIGHT_API_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"status": "closed"}' "$SHIPLIGHT_API_URL/v1/support-tickets/<id>"
```

`status` with no ticket number: list, newest first, as
`SUP-… · status · subject · last activity`. With a number: show the thread and
whether the ball is with support (`open`) or the user (`waiting_on_user`).
Replies go through the same approval rule as filing: show the message, send on
yes.

Statuses: `open` (support's court) → `waiting_on_user` → `resolved` → `closed`.

## Error handling

| Status | Action |
|--------|--------|
| 400 mentioning `contactEmail` | The token has no account attached — ask the user for a contact email, add `contactEmail`, resubmit. |
| 401 | Token missing/invalid — fix Setup, retry. If the token itself is what's broken, fall back to emailing support directly and say so. |
| 413 | Payload over the cap — trim `errorOutput`/`diagnostics` deliberately (keep the failure tail), resubmit. Never silently drop the body text. |
| 429 | Daily ticket limit reached — relay the API's message; the existing ticket thread (`reply`) is not rate-limited the same way, so add to it instead of filing duplicates. |
