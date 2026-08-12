#!/usr/bin/env bash
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ci_root="$repo_root/shiplight/references/ci"

fail() {
  echo "FAIL: $*" >&2
  exit 1
}

# shellcheck disable=SC2016 # Markdown backticks are intentional literals.
grep -Fq '`references/ci/index.md`' "$repo_root/shiplight/SKILL.md" \
  || fail "Shiplight must route ci to references/ci/index.md"

for file in index.md github-hosted.md shiplight-hosted.md triage.md notifications.md; do
  test -f "$ci_root/$file" || fail "missing ci reference: $file"
done

index_lines="$(wc -l < "$ci_root/index.md")"
test "$index_lines" -le 120 \
  || fail "ci/index.md must stay at or below 120 lines (found $index_lines)"

grep -Fq '_shared/project-layout.md' "$ci_root/index.md" \
  || fail "ci/index.md must load the shared project layout"
grep -Fq '_shared/secrets.md' "$ci_root/index.md" \
  || fail "ci/index.md must load the shared secrets policy"
grep -Eiq 'inspect.*existing.*workflow|existing.*workflow.*inspect' "$ci_root/index.md" \
  || fail "ci/index.md must require inspection of existing workflows"
grep -Eq 'merge|preserve' "$ci_root/index.md" \
  || fail "ci/index.md must tell agents to preserve or merge existing workflows"
grep -Fq '## Final report' "$ci_root/index.md" \
  || fail "ci/index.md must define a final report"
grep -Fq 'repository root' "$ci_root/index.md" \
  || fail "ci/index.md must locate GitHub workflows from the repository root"
grep -Fq '.github/workflows/' "$repo_root/shiplight/references/_shared/project-layout.md" \
  || fail "the shared edit contract must permit CI workflow edits"
grep -Fq 'repository-root-relative' "$repo_root/shiplight/references/_shared/project-layout.md" \
  || fail "the shared layout must distinguish repository-root CI paths"
# shellcheck disable=SC2016 # Markdown backticks are intentional literals.
if grep -Fq 'per `ci.md`' "$repo_root/shiplight/SKILL.md"; then
  fail "Shiplight must not retain the old ci.md reference"
fi

grep -Fq 'report-dir:' "$ci_root/triage.md" \
  || fail "triage guidance must configure report-dir for subdirectory projects"
grep -Fq '<project-dir>/shiplight-report' "$ci_root/triage.md" \
  || fail "triage guidance must show the project-relative report upload path"

if grep -Fq 'Wiring it up is two steps' "$ci_root/triage.md"; then
  fail "triage guidance must not claim two steps while documenting three"
fi
grep -Fq '.github/workflows/ci-failure-triage.yml' "$ci_root/triage.md" \
  || fail "triage guidance must name the repository-root caller destination"
# shellcheck disable=SC2016 # Markdown backticks are intentional literals.
grep -Fq 'plain `ubuntu-latest`' "$ci_root/triage.md" \
  || fail "triage guidance must state the stock autofix-runner limitation"
grep -Eiq 'verify.*runner|runner.*verify' "$ci_root/triage.md" \
  || fail "triage guidance must verify an eligible autofix runner"
grep -Eiq 'confirm.*autofix|autofix.*confirm' "$ci_root/triage.md" \
  || fail "triage guidance must confirm autofix when the request says only triage"

command -v actionlint >/dev/null 2>&1 \
  || fail "actionlint is required to validate CI workflow assets"

asset_count=0
while IFS= read -r workflow; do
  actionlint -config-file "$repo_root/.github/actionlint.yaml" "$workflow"
  asset_count=$((asset_count + 1))
done < <(find "$ci_root/assets" -type f \( -name '*.yml' -o -name '*.yaml' \) | sort)

test "$asset_count" -ge 3 \
  || fail "expected at least three complete CI workflow assets"

echo "PASS: Shiplight CI references and workflow assets"
