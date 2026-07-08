# auth — Set up / repair auth

On-demand entry point for authentication setup and repair. The full auth module is
`_shared/auth.md` — follow it; this subcommand is the place a user lands when the
task is specifically "set up login" or "fix expired auth".

Scope:

- **Browser-session auth** (for `verify` / app-walking) — capture login once via
  `save_storage_state`, reuse through `storage_state_path`, re-save when expired.
- **Authored-test auth** (for `create-yaml-tests` / `fix`) — choose shared-account
  vs per-test, wire the Playwright setup, document roles + env var names.

See `_shared/auth.md` for the patterns, code examples, agent login helpers, file
placement, and the secrets policy (`_shared/secrets.md`).
