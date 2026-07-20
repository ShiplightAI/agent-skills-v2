# Test Report: <Target>

**Test spec**: [test-spec.md](./test-spec.md)
**Branch / commit**: <branch and commit if available>
**Last updated**: <YYYY-MM-DD>
**Tester**: <agent or person>

This report is the development session record: what was tested, by what test
**type** (a fact recorded here), what ran, and what failed or was blocked. It
records facts, not a graded confidence verdict — do not hand-author a
`HIGH/MEDIUM/LOW` verdict here.

## Summary

- Overall session status: `PASS` / `FAIL` / `PARTIAL` / `BLOCKED`
- What this session added or strengthened:
- Blocking findings:
- Known gaps left for follow-up:

## Source Material

- Source material used: <specs, PRDs, tickets, docs, code, user input>
- Source material not found or not available:

## Commands Run

| Command | Result | Notes |
| --- | --- | --- |
| `<command>` | `PASS` / `FAIL` / `BLOCKED` / `SKIPPED` / `NOT RUN` | <summary> |

Include any prerequisite or artifact-producing commands that later checks
relied on.

## Tests Added Or Updated

| Type | Files | Tests |
| --- | ---: | ---: |
| Unit | 0 | 0 |
| Contract | 0 | 0 |
| Integration | 0 | 0 |
| E2E | 0 | 0 |
| Agent | 0 | 0 |
| Script / static | 0 | 0 |
| **Total** | **0** | **0** |

### File List

- `<path>` (<count> tests)

## Coverage Matrix

One row per behavior from `test-spec.md`. Record the declared `priority` (a
fact carried from the spec, not invented here), the test **type** written for
it, and the session result. Do not record a risk weight or an evidence-depth
judgment — strength is derived downstream from the test type. Use coverage
statuses consistently: `COVERED`, `PARTIAL`, `IMPLICIT`, `NOT COVERED`,
`NOT MEASURED`, `MANUAL`, `BLOCKED`, or `DEFERRED`.

| Behavior (from test-spec) | Priority | Test type | Coverage | Session result | Notes / gap |
| --- | --- | --- | --- | --- | --- |
| <behavior / testing-what> | <P0-P3> | <unit/contract/integration/e2e/agent/manual/...> | <coverage status> | <PASS/FAIL/BLOCKED/...> | <remaining gap> |

When a numbered Speckit spec backs this target, you may add requirement- and
success-criteria-keyed sub-tables (FR-001, SC-001, ...) below this matrix. They
are optional and supplement, not replace, the behavior matrix above.

## Agent Test Evidence

- `<agent test path>` — Status: `<PASS/FAIL/BLOCKED/ABORTED>`. Evidence:
  `<report/screenshot/video/trace path or URL>`.

Text-only UI claims are not sufficient; for cases with UI, require the codified
YAML run artifacts (Shiplight report, trace, screenshots). Treat `ABORTED` as an
orchestration interruption to rerun, not as product evidence.

## Manual Verification Log

### <YYYY-MM-DD>

- Environment:
- Scenarios checked:
- Result:
- Anomalies:

## Findings

List blocking failures first.

- [ ] **<severity> <id/title>**: <finding>. Evidence: <path/link>. Follow-up:
  <owner/action>.

## Deferred / Residual Risk

- [ ] **<id/title>**: <what is not proven>. Retest: `<command or procedure>`.
  Pass criterion: <observable signal>.

## Cleanup

- Cleanup performed:
- Resources intentionally left behind:
- Follow-up cleanup required:

## Coverage Summary

- Total testing whats:
- COVERED:
- PARTIAL:
- IMPLICIT:
- NOT COVERED:
- NOT MEASURED:
- MANUAL:
- BLOCKED:
- DEFERRED:

Never include passwords, API keys, cookies, tokens, database URLs, or raw secret
fixture payloads in this report.
