# Shared: Browser evidence & HTML reports

Shared by `verify` and `review` (and any subcommand that records browser
evidence). The protocol: record during the session, then generate — and
optionally upload — an HTML report.

## Protocol

1. Start the session with evidence on: `new_session({ ..., record_evidence: true })`.
2. Do the work (`inspect_page`, `act`, `get_browser_console_logs`).
3. `close_session()` → keep the returned `local_video_path` and
   `local_trace_path`.
4. **Generate the report** with `generate_html_report`:

   ```json
   {
     "session_id": "<session_id>",
     "local_video_path": "<local_video_path from close_session>",
     "local_trace_path": "<local_trace_path from close_session>",
     "title": "...",
     "summary": "...",
     "checks": [...]
   }
   ```

   Show the returned `file_path` to the user so they can open it.
5. **Upload for sharing** (when the user wants a shareable link, e.g. for a PR,
   and `upload_html_report` is available):

   ```json
   {
     "report_path": "<file_path from generate_html_report>",
     "local_video_path": "<local_video_path from close_session>",
     "local_trace_path": "<local_trace_path from close_session>"
   }
   ```

   This uploads the video, trace, and report HTML to Shiplight cloud, patches the
   HTML with cloud URLs, and returns a permanent shareable `report_url`.

Only generate a report when the session was started with `record_evidence: true`.
