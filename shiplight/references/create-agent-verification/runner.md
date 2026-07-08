# Runner — run-agent-verification.ts

Reference for `run-agent-verification.ts`, the orchestrator that executes agent
verification cases and enforces the status contract. `index.md` covers when and
how to author cases; this file covers running them.

## Scaffolded files

When a project adopts agent verification, copy these starters from this slice's
bundle (`references/create-agent-verification/assets/`) into the repo:

- `tests/agent/agent-test-template.md` — case authoring template
- `tests/agent/agent-test-suites.example.json` — manifest example
- `tests/agent/run-agent-verification.ts` — local runner/orchestrator

Each project owns its real `tests/agent/agent-test-suites.json`, case files,
fixtures, secrets, session bootstrap, CI wiring, and mutation policy.

## Setup

```json
{ "scripts": { "agent:verify": "tsx tests/agent/run-agent-verification.ts" } }
```

```bash
cp tests/agent/agent-test-suites.example.json tests/agent/agent-test-suites.json
pnpm agent:verify --target local --suite smoke --project-name "<project name>"
pnpm agent:verify --target local --case tests/agent/example/browser-smoke.md
```

## Configuration

Defaults: manifest `tests/agent/agent-test-suites.json`; reports
`agent-test-reports`; allowed targets `local,staging,production`; engine `codex`.

| Flag | Environment variable |
| --- | --- |
| `--target` | `AGENT_VERIFICATION_TARGET` |
| `--engine` | `AGENT_VERIFICATION_ENGINE` |
| `--manifest` | `AGENT_VERIFICATION_MANIFEST_PATH` |
| `--report-dir` | `AGENT_VERIFICATION_REPORT_DIR` |
| `--allowed-targets` | `AGENT_VERIFICATION_ALLOWED_TARGETS` |
| `--project-name` | `AGENT_VERIFICATION_PROJECT_NAME` |
| `--claude-mcp-config` | `AGENT_VERIFICATION_CLAUDE_MCP_CONFIG` |

For full, current flags and defaults, prefer the runner's own `--help` over this
table.

## Status contract

The runner accepts final statuses `PASS`, `FAIL`, `BLOCKED`, `ABORTED`, and the
final non-empty line of each report must be exactly one `Status:` line. See the
**canonical contract in `index.md`** for the semantics (this file does not
restate them). Required cases fail the runner unless they return `PASS`; `ABORTED`
is reserved for orchestration interruptions and is rerun, not treated as product
evidence.

## Evidence

Browser-driven cases must produce auditable evidence (HTML report, screenshot
set, video, trace, or project-standard equivalent). Text-only browser claims are
not sufficient. See `_shared/evidence-and-report.md`.
