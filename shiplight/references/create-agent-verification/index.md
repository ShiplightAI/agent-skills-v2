# create-agent-verification — Create a reusable agent-run verification

Producer that **authors and runs** agent-driven verifications: a coding agent
executes a Markdown case file against a live environment (browser, API, DB, logs,
cloud, telemetry) and returns an auditable report. The verification *is* the
executing agent's judgment plus the evidence it collects — not fixed
deterministic assertions. The output is a report path, a final
`PASS`/`FAIL`/`BLOCKED`/`ABORTED` status, and the evidence artifacts, for whatever
invoked it to consume.

Contrast with the siblings:
- `verify` is the dev-time **act** (check a change now, ephemeral, the main agent
  drives the browser).
- `create-agent-verification` produces a **durable, re-runnable artifact** — the
  `create-` is the tell.
- `create-yaml-tests` produces **deterministic** codified assertions; this
  produces **judgment-based** verification.

> **Naming note.** The skill is "verification" (outcome-oriented), but the
> on-disk conventions — `tests/agent/`, `agent-test-suites.json`,
> `agent-test-reports/`, `run-agent-verification.ts` — are **preserved as-is**:
> they are project-owned and already wired into adopting repos' layout, CI, and
> package scripts. Do not rename them.

## Read first (shared modules)

- `_shared/vocabularies.md` — records this artifact's test `type` as the short
  label `agent`.
- `_shared/evidence-and-report.md` — the auditable-evidence principle for
  browser-driven work (the executing engine produces the evidence; text-only
  browser claims are insufficient).

## When to use

When verification needs flexible, tool-driven judgment across UI, API, database,
logs, files, network, or live-environment state, and a deterministic test would
be premature, brittle, too expensive, or too narrow. Especially:

- UI changes needing visual, interactive, console, network, or trace evidence.
- API/DB workflows where confidence requires live requests plus persisted-state
  inspection.
- Full-stack flows crossing frontend, backend, storage, jobs, external mocks,
  and cleanup.
- Exploratory regression checks before a stable path is converted into a
  deterministic test.

## When NOT to use

- When a deterministic unit, contract, integration, or YAML E2E test is the
  cheaper, more durable proof — use `create-yaml-tests` or the standard format.
  Prefer converting high-value stable agent flows into deterministic tests once
  the path stabilizes.
- When no live environment, access, or fixtures are available — record the
  blocker rather than authoring an unrunnable case.

## Project layout

Agent verifications live under `tests/agent/` in the target repo:

```text
tests/agent/agent-test-suites.json     suite manifest (project-owned)
tests/agent/<feature>/<case>.md         case files, one logical journey each
tests/agent/run-agent-verification.ts   runner/orchestrator
agent-test-reports/                      generated reports; do not hand-edit
```

The repo owns its real manifest, case files, fixture setup, auth/session
bootstrap, CI wiring, engine secrets and MCP config, staging/production mutation
policies, and cleanup ownership.

## Mode: scaffold (use the local convention first)

Before authoring, check for `tests/agent/agent-test-template.md`. If it exists,
treat it as the authoritative local convention — do not rediscover or replace it
unless the user explicitly asks to update the convention.

If no local harness exists and an agent verification is the cheapest sufficient
proof, scaffold on demand by copying this slice's bundled starters
(`references/create-agent-verification/assets/`) into the repo:

- `assets/agent-test-template.md` → `tests/agent/agent-test-template.md`
- `assets/agent-test-suites.example.json` → `tests/agent/agent-test-suites.example.json`
- `assets/run-agent-verification.ts` → `tests/agent/run-agent-verification.ts`

Copy only when a project actually adopts agent verification; do not pre-seed repos
that have none. Then create a real manifest from the example:

```bash
cp tests/agent/agent-test-suites.example.json tests/agent/agent-test-suites.json
```

## Mode: author a case

Write each case from the template (local or bundled). A good case makes the
executing agent unlikely to guess:

- State the requirement, risk, or behavior under test and link its sources.
- Fill real project context: URLs per environment, accounts/orgs, fixture and
  mutation policy, DB/log/cloud access, production synthetic-data policy, and
  cleanup ownership.
- Separate **environment preflight** (prove the target can execute the case) from
  **product verification** (run the checks).
- List concrete checks: browser pages/states, API routes and status codes, DB
  tables/rows, audit events, log filters, telemetry queries, timing.
- Make each assertion **unconditional** for state the case itself creates. A check
  gated on an optional affordance ("if the UI offers X, verify Y") lets the agent
  skip Y and still PASS whenever X isn't found — silently dropping the coverage
  the case exists to provide. For fixtures you control, require the affordance and
  assert on it directly; reserve conditional wording for genuinely
  environment-dependent surfaces.
- Name the exact evidence each behavior requires.
- Keep cases portable; bind environment specifics under the testing-environments
  section, not in the steps.
- Never store raw secrets — record variable names, roles, and access patterns
  only.

## Mode: run

Add a package script in the target repo, adjusted for its package manager:

```json
{ "scripts": { "agent:verify": "tsx tests/agent/run-agent-verification.ts" } }
```

Run a suite or a single case:

```bash
pnpm agent:verify --target local --suite smoke --project-name "<project name>"
pnpm agent:verify --target local --case tests/agent/<feature>/<case>.md
```

`runner.md` documents the runner defaults, flags, matching environment variables,
and engine selection in full.

## Report status contract (canonical)

This is the single source for the status contract. `runner.md` references it; the
bundled template and runner enforce it at run time (their embedded copies are
necessary because they execute standalone inside the target repo).

Every case report must end with exactly one line:

```text
Status: PASS
Status: FAIL
Status: BLOCKED
Status: ABORTED
```

- `PASS` / `FAIL` — environment preflight completed and product verification ran.
- `BLOCKED` — environment/setup could not execute the case (missing DB/log
  access, unreachable URL, failed login/session bootstrap, missing fixtures or
  approval). Do **not** report `FAIL` for an environment blocker.
- `ABORTED` — orchestration interruption only. Release gates ignore `ABORTED` and
  rerun the case; never end with PASS/FAIL/BLOCKED for an interruption.

Required cases fail the runner unless they return `PASS`. When a case drives a
browser, collect auditable evidence (HTML report, screenshot set, video, trace,
or project-standard equivalent) — text-only browser claims are not sufficient.

## Output

A run leaves an auditable report at its report path, ending with exactly one
`Status:` line, plus collected evidence artifacts. That report and its evidence
are the deliverable — whatever invoked this subcommand (a user, `cover`, or a
sibling repo via `/shiplight create-agent-verification`) consumes them.
