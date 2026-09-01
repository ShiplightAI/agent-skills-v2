# setup-test-auth — Configure authentication for the application under test

Set up or repair reusable authentication for the application under test. The
full test-auth module is `_shared/auth.md` — follow it when a test or browser
verification needs to run as an authenticated application user.

This command does not create or configure a Shiplight API token and does not
authenticate the user with the Shiplight platform. For that separate setup,
run `npx shiplight setup-api-token` in the test project root.

Scope:

- **Browser-session auth** (for `verify` / app-walking) — capture login once via
  `save_storage_state`, reuse through `storage_state_path`, re-save when expired.
- **Authored-test auth** (for `create-yaml-tests` / `fix`) — choose shared-account
  vs per-test, wire the Playwright setup, document roles + env var names.

See `_shared/auth.md` for the patterns, code examples, agent login helpers, file
placement, and the secrets policy (`_shared/secrets.md`).
