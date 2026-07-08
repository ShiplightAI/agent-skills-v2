# Shared: Vocabularies

Status vocabularies authored into Shiplight test artifacts. Each belongs to one
artifact; do not mix them. These record what was tested and what happened — not a
graded confidence verdict. Consumed by `cover`, `create-yaml-tests`,
`create-agent-verification`, `fix`.

## Test type — a fact recorded per behavior in `test-report.md`

`unit` | `contract` | `integration` | `e2e` | `agent` | `manual` | `telemetry`
| `static` | `smoke` | `script` | `other`.

The test type is a **fact** about the artifact — the producer that created it
fixes the type (a Shiplight YAML is `e2e`, a `create-agent-verification` Markdown
case is `agent`, a `*.test.ts` with no browser is `unit`). It is not a strength
judgment; never author a `depth` or `reliability` label here. (The skill is named
`create-agent-verification`; the recorded type label stays the short `agent`.)

## Result status — `test-report.md` command and test outcomes

`PASS`, `FAIL`, `PARTIAL`, `BLOCKED`, `SKIPPED`, `NOT RUN`, `DEFERRED`,
`ABORTED`, or `UNKNOWN`.

Treat `ABORTED` as an orchestration interruption to rerun, not as product
evidence.

## Coverage status — `test-report.md` coverage matrix

`COVERED`, `PARTIAL`, `IMPLICIT`, `NOT COVERED`, `NOT MEASURED`, `MANUAL`,
`BLOCKED`, or `DEFERRED`.

There is no hand-authored `HIGH/MEDIUM/LOW` overall-confidence verdict. The
report records facts — priority, test type, coverage status, and run result —
not a graded judgment.
