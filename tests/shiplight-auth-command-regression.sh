#!/usr/bin/env bash
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
skill="$repo_root/shiplight/SKILL.md"
test_auth="$repo_root/shiplight/references/setup-test-auth.md"

test -f "$test_auth" || {
  echo "FAIL: setup-test-auth reference is missing" >&2
  exit 1
}

grep -Fq '| `setup-test-auth` |' "$skill" || {
  echo "FAIL: setup-test-auth is not a canonical routed subcommand" >&2
  exit 1
}

if grep -Fq '| `auth` |' "$skill"; then
  echo "FAIL: ambiguous auth subcommand is still canonical" >&2
  exit 1
fi

grep -Fq 'application under test' "$test_auth" || {
  echo "FAIL: setup-test-auth does not identify the authentication target" >&2
  exit 1
}

grep -Fq 'does not create or configure a Shiplight API token' "$test_auth" || {
  echo "FAIL: setup-test-auth does not exclude Shiplight API-token setup" >&2
  exit 1
}

grep -Fq 'npx shiplight setup-api-token' "$repo_root/shiplight/references/init.md" || {
  echo "FAIL: init does not use the canonical API-token command" >&2
  exit 1
}

grep -Eq 'device-auth session (is|is not|does not remain).*not persisted|does not persist.*device-auth session' \
  "$repo_root/shiplight/references/init.md" || {
  echo "FAIL: init does not explain that the device-auth session is not persisted" >&2
  exit 1
}

grep -Fq 'remove `SHIPLIGHT_API_TOKEN` from `.env`' \
  "$repo_root/shiplight/references/cloud/index.md" || {
  echo "FAIL: cloud does not explain how to stop using a token locally" >&2
  exit 1
}

# Scan every Nova-shaped host rather than only the two former production names.
# The two staging hosts remain the active staging targets; reject any other Nova
# host as well as the retired commands.
if grep -rEoh 'nova[[:alnum:]-]*\.shiplight\.ai|shiplight login|/shiplight auth|shiplight logout|session\.json' \
  "$repo_root/shiplight" "$repo_root/README.md" \
  | grep -Ev '^(nova-staging\.shiplight\.ai|nova-admin-staging\.shiplight\.ai)$' >/dev/null; then
  echo "FAIL: stale host, command, or persisted-session reference remains" >&2
  exit 1
fi

echo "PASS: Shiplight test-auth and API-token commands are distinct"
