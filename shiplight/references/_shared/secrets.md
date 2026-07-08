# Shared: Secrets policy

The single statement of secret handling across specs, YAML, auth setup, fixtures,
notes, and reports. Consumed by `auth`, `create-yaml-tests`, `cover`,
`fix`.

- **Never commit raw secrets** — no real passwords, API keys, tokens, cookies, or
  one-time codes in specs, tests, fixtures, config, notes, or docs.
- Credentials belong in `.env` (or CI secrets). Specs, notes, config, and YAML may
  reference **env var names** or **templated placeholders**
  (e.g. `password: "{{ADMIN_PASSWORD}}"`), never the literal value.
- Commit only variable names, roles, access patterns, and setup instructions.
- Shared-account setup reads secrets from `process.env`; per-test auth receives
  them via the `args` object — in both cases the value resolves from the
  environment, not the YAML. See `_shared/auth.md`.
