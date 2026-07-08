# Shared Review Conventions

Conventions every domain review follows. Each `<domain>.md` defines the
domain-specific checks; this file defines the cross-cutting rules they share, so
the orchestrator can merge their output into one consistent report.

## The five-phase model

Every domain review runs the same shape:

```
Phase 1: EDUCATE   → why this domain matters + what we check
Phase 2: SCOPE     → auto-detect from the codebase, confirm with the user, map surface
Phase 3: ANALYZE   → browser-based checks against the domain's categories
Phase 4: REPORT    → findings with evidence, scores, and confidence
Phase 5: REMEDIATE → fix guidance + regression tests (authored via `create-yaml-tests`)
```

## Browser evidence

Domain analysis runs against a live target through the Shiplight MCP. Open the
session with `new_session` using `record_evidence: true`, close it with
`close_session`, and use `generate_html_report` for an auditable artifact. Findings
that claim runtime behavior need browser evidence, not code-reading alone. The full
protocol is `_shared/evidence-and-report.md` (shared with `verify`).

## Scoring and confidence

- **Score**: each review reports an overall `{X}/10` plus a per-category
  breakdown. The orchestrator's unified report carries each domain's score.
- **Confidence** (per finding):
  - **90–100%** — browser-validated; the issue was observed at runtime.
  - **70–89%** — strong evidence from inspection (headers, storage, DOM).
  - **50–69%** — code-level pattern; may not manifest at runtime.
  - **Below 50%** — do not report; too speculative.

Each domain tailors the *examples* for these bands; the bands themselves are
uniform.

## Severity

Order findings by severity: `CRITICAL` → `HIGH` → `MEDIUM` → `LOW` / `INFO`.
The orchestrator surfaces the top findings across all domains by this ordering.

## Output paths

- Per-domain report: `shiplight/reports/<domain>-review-{date}.md`
- Unified report (orchestrator): `shiplight/reports/review-{date}.md`

## Regression tests — author via `create-yaml-tests`

A review's findings become durable checks by being turned into **real Shiplight
YAML tests**, not a review-specific format. Hand each behavior worth locking in to
`create-yaml-tests`, which authors canonical YAML (`goal` / `base_url` /
`statements`) under the canonical `tests/` location (see
`_shared/project-layout.md`). Do **not** invent a separate YAML shape or write to
`shiplight/tests/`. The `yaml` blocks in the domain files
(`name`/`severity`/`standard`/`steps`) are **illustrative of the check** to encode,
not literal Shiplight YAML.
