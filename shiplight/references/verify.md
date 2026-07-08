# verify — Verify UI changes in the browser

Verify that UI changes look and behave correctly in a real browser during local
development. This is the dev-time **act** of verification — ephemeral, this
session. To author a reusable verification that an agent re-runs later, use
`create-agent-verification` instead.

## Read first (shared modules)

- `_shared/mcp.md` — Shiplight MCP browser tools + connection check.
- `_shared/auth.md` — if the app requires login (saved storage state).
- `_shared/evidence-and-report.md` — only if producing or sharing an HTML report.

## When to use

After making UI changes, to confirm they render correctly:
- Checking layout, styling, or component changes visually
- Verifying interactive behavior (clicks, form inputs, navigation)
- Pre-commit sanity checks on UI work
- Debugging visual regressions

## When NOT to use

Skip when changes don't affect UI rendering:
- Backend-only changes (API logic, database, config)
- Dependency version bumps with no UI impact
- Documentation, comments, or test-only changes

## Steps

Adapt to the specific changes; this is a guideline.

1. **Understand what changed** — analyze the code changes and build a
   verification plan: which files/components changed, which pages and
   interactions to check, and the pass/fail criteria (what "correct" looks like).
   This is the most important step — it determines coverage. Balance thoroughness
   with cost.
2. **Start the dev server** (if not already running) — start it in the background
   (e.g. `npm run dev`, `yarn dev`) and wait a few seconds for it to be ready.
3. **Open a browser session** — `new_session` with `starting_url` pointing at the
   page to verify. Set `record_evidence: true` if you want an HTML report
   afterward. For authed apps, follow `_shared/auth.md` (reuse or capture storage
   state).
4. **Inspect the page** — `inspect_page`; read the DOM file first for element
   indices, view the screenshot only when you need visual detail.
5. **Interact and verify** — use `act` to drive user actions by element index,
   and `act` verify actions to assert expected UI state.
6. **Check for errors** — `get_browser_console_logs` for JS errors introduced by
   the change.
7. **Report findings** — summarize what was checked, whether the UI renders
   correctly, any console errors or visual issues, and screenshots of the
   verified state.
8. **Close the session** — `close_session` (returns `local_video_path` and
   `local_trace_path`).
9. **Generate / share the report** — only if started with `record_evidence: true`.
   Follow `_shared/evidence-and-report.md` to `generate_html_report` and, when the
   user wants a shareable link, `upload_html_report`.
