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

# Scan every Nova-shaped host rather than only the two former production names.
# The two staging hosts remain the active staging targets; reject any other Nova
# host as well as the retired commands.
if grep -rEoh 'nova[[:alnum:]-]*\.shiplight\.ai|npx shiplight login|/shiplight auth' \
  "$repo_root/shiplight" "$repo_root/README.md" \
  | grep -Ev '^(nova-staging\.shiplight\.ai|nova-admin-staging\.shiplight\.ai)$' >/dev/null; then
  echo "FAIL: stale Nova host or ambiguous auth/login command remains" >&2
  exit 1
fi

echo "PASS: Shiplight test-auth and API-token commands are distinct"
