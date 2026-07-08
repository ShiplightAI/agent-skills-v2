# Shared: Shiplight MCP — browser tools & connection

All browser-driven subcommands (`verify`, `review`, parts of `create-yaml-tests`
and `fix`) use the Shiplight MCP server. This module is the single description of
the toolset and the connection check.

## Connection check

The Shiplight MCP browser tools (e.g. `new_session`, `inspect_page`, `act`) must
be available. If they are not, the server is not connected — tell the user to
install/enable it (see the repo README) and reconnect (`/mcp`), then stop.

## Core browser tools

- `new_session({ starting_url, record_evidence?, storage_state_path? })` — open a
  browser session. Set `record_evidence: true` when you intend to produce an HTML
  report. Multiple concurrent sessions are supported.
- `inspect_page()` — returns the DOM tree (with element indices) and a screenshot.
  **Always read the DOM file first** — it carries the element indices needed for
  `act` and costs far fewer tokens. Only view the screenshot when you need visual
  information (layout, colors, images).
- `act(...)` — simulate user actions by element index; also supports verify
  actions to assert UI state (text visible, element exists).
- `get_browser_console_logs()` — fetch JS console output to check for errors.
- `close_session()` — closes the session; returns `local_video_path` and
  `local_trace_path` (used for reporting).
- `save_storage_state(...)` / `storage_state_path` — capture and reuse auth; see
  `_shared/auth.md`.
- `generate_html_report(...)` / `upload_html_report(...)` — see
  `_shared/evidence-and-report.md`.

## Resources

When writing or repairing YAML, read the MCP resources before generating any
YAML: `shiplight://yaml-test-spec` and `shiplight://schemas/action-entity`.
