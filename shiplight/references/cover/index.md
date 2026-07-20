# cover — Decide test format + effort, plan, drive producers, report

The **single executable orchestrator** for the create-flow and a **decision
engine**. For one feature, spec, module, PR, or ticket: decide what must be
tested, pick the testing strategy at the lowest sufficient cost, plan it, drive
the producers to author the tests, run them, and record the session. Produces
human-readable Markdown (`test-spec.md`, `test-report.md`) plus test code via the
producers. The report records **facts** — what was tested, by what test type, what
passed — not a graded confidence verdict.

Cross-repo building block: invoked as `/shiplight cover`, or — once inside `/shiplight` — routed here by build-synonyms ("set up
tests for my app", "build tests", "plan tests", "test this feature"), and by
sibling skills (e.g. speckit-project) as `/shiplight cover`.

## What this owns

- `specs/<feature>/test-spec.md` — the durable "testing what" contract: behaviors,
  invariants, risks, and the declared priority of each. **Format-agnostic** — there
  is no separate `spec` subcommand; `cover` owns the plan.
- `specs/<feature>/test-report.md` — the session record: what was tested, by what
  test **type**, what ran, and what passed/failed/blocked.
- Repo-root `TESTING.md` (optional) — project testing-strategy notes. Standalone-safe:
  the baked-in default applies when absent.

## Read first

- `_shared/vocabularies.md` (test type / result / coverage status enums) and
  `_shared/secrets.md`.
- `default-testing-strategy.md` — the baked-in strategy policy (economics,
  guardrails, floors).
- Templates in `assets/`: `test-spec-template.md`, `test-report-template.md`,
  `TESTING.template.md`.
- The producers it drives: `create-yaml-tests` and `create-agent-verification`.

## Two layers

1. **Testing what** — the behaviors, properties, requirements, and invariants that
   must be verified to trust the feature, each carrying a declared **priority**
   (P0–P3).
2. **Testing how** — the evidence used to verify them: unit, contract, integration,
   e2e, agent, manual, telemetry, static, smoke, script.

Comprehensive testing is not test count. Optimize for justified confidence per unit
of cost (author + run + maintain), stability, latency, and diagnostic value. Buy
sufficient confidence at the lowest cost, spending the scarce expensive-test budget
(e2e, agent) where **priority is highest**.

## Priority is a declared fact

Each testing-what item carries a `priority` (P0–P3) read from an upstream artifact
(PRD, feature breakdown, spec) — never invented here. Priority is the effort lever:
P0 gets the strongest posture, P3 the lightest. Per-behavior priority defaults to
the feature's declared P-level; record a finer level only when the spec or owner
declares one. If nothing upstream declares a priority, mark it `UNKNOWN` and surface
it rather than guessing. There is no separate 1–5 risk weight.

## Test type is a fact, recorded here

When you create or identify a test, its **type** (`unit`, `contract`,
`integration`, `e2e`, `agent`, `manual`, `telemetry`, `static`, `smoke`, `script`)
is a fact about the artifact — the producer fixes it. Record the type per behavior
in `test-report.md`. Do **not** author a strength label (`depth`, `reliability`) or
a `HIGH/MEDIUM/LOW` verdict — record facts, not a graded verdict (`_shared/vocabularies.md`).

## Testing strategy & budget policy

Resolve each behavior's posture, first match wins:

1. A per-behavior note in `test-spec.md` (one-off tuning).
2. Repo-root `TESTING.md`, if present (project-wide posture).
3. The baked-in default in `default-testing-strategy.md`.

Standalone-safe: never require `TESTING.md`; fall back to the default. `TESTING.md`
is prose the agent reads, not a schema'd config; confirm a `TESTING.md` change with
the user since it shifts every feature's posture.

## Capability map — which modality proves which check

Capability before cost: "cheapest" means cheapest *among modalities that can
actually prove the check*. A unit test cannot prove a real-browser flow.

- Deterministic pure logic → **unit**.
- Public boundaries, server actions, route handlers, authz, schema validation →
  **contract**.
- DB state, transactions, audit rows, migrations, jobs, cross-module invariants →
  **integration**.
- Browser-rendered behavior, routing, session/role-gated UI, rendered regressions →
  project-standard **e2e**, **agent**, or **manual** browser checks.
- Third-party callbacks, staging-only auth, production SLOs, live signals → **agent**,
  **manual**, or **telemetry**.

## Drive the producers (specialized authoring)

`cover` decides strategy and drives creation; it delegates authoring, then records
what was made. The two Shiplight producers are **two targets among several**:

- `/shiplight create-yaml-tests` — deterministic Shiplight YAML E2E tests.
- `/shiplight create-agent-verification` — coding-agent-driven verification for
  live-environment checks (codified UI segments, API, DB, logs, cloud, telemetry).
- The project's own unit / contract / integration / browser / mobile / load /
  migration / telemetry workflow for other kinds. For code-tied tests, author them
  inline or drive the base coding agent toward deep coverage on the highest-priority
  gaps. Keep edits scoped to tests, fixtures, and minimal testability support code.

**Setup is a conditional branch.** When the chosen format is a Shiplight E2E/agent
test and the project isn't set up, run setup step-0 first: `/shiplight init` (scaffold
+ context) and `/shiplight auth` (login) as needed. These are idempotent — a no-op on
already-set-up projects (so callers like speckit invoking coverage on
existing projects are unaffected). Non-Shiplight formats skip this entirely.

When an agent verification produces a report, record its `PASS`/`FAIL`/`BLOCKED`/
`ABORTED` status and auditable artifacts in `test-report.md`. Text-only UI claims
are not sufficient; for cases with UI, require the codified YAML run artifacts
(Shiplight report, trace, screenshots).
Treat `ABORTED` as an orchestration interruption to rerun, not as product evidence.

## Workflow

1. **Resolve target and inputs** — identify the feature target (a `NNN-kebab-case`
   slug; reuse an existing `specs/NNN-*`). Read the PRD/feature breakdown/spec for
   declared priorities, the changed implementation and existing tests (branch merge
   base when available), and any prior `test-spec.md` / `test-report.md`.
2. **Define or refresh testing-what** — write `specs/<feature>/test-spec.md` from
   `assets/test-spec-template.md`. Capture product behaviors, system/API/schema/data
   invariants, risk-based behaviors, operational/release behaviors, and stakeholder
   confidence goals. Carry each behavior's declared `priority`. List out-of-scope
   behaviors explicitly.
3. **Resolve strategy & inventory existing evidence** — resolve each behavior's
   posture via the policy chain; inventory what already exists and which behaviors
   it covers.
4. **Analyze gaps & select proofs** — size each gap as *required posture minus
   existing evidence*; choose the cheapest modality **capable** of closing it. Spend
   the expensive-test budget on the highest-priority gaps. For P0, consider
   defense-in-depth (stacked layers) over a single cheapest proof.
5. **Drive creation** — drive the producers (or author code-tied tests inline) to
   close worthwhile gaps, honoring the non-negotiable floors regardless of budget.
   When budget forces a behavior short of its ideal proof, record the chosen
   allocation and the knowingly accepted gap — never under-test silently.
6. **Run verification** — targeted checks first, then broader suites when justified:
   new/changed tests, relevant existing tests, typecheck/lint/build, migration
   checks, and agent checks the spec requires. Record exact commands and outcomes.
   If a capability is missing, mark `BLOCKED` or `NOT MEASURED`; never claim it passed.
7. **Write or update the test report** — write `specs/<feature>/test-report.md` from
   `assets/test-report-template.md`. Record commands run, tests added/updated, and
   the coverage matrix (one row per behavior: priority, test type, session result).
   Blocking findings first. No confidence verdict, no strength label.

## Artifact skeletons

| Artifact | Template |
| --- | --- |
| `specs/<feature>/test-spec.md` | `assets/test-spec-template.md` |
| `specs/<feature>/test-report.md` | `assets/test-report-template.md` |
| repo-root `TESTING.md` (optional) | `assets/TESTING.template.md` |

## Operating rules

- May edit tests, fixtures, test scripts, `specs/<feature>/test-spec.md`,
  `specs/<feature>/test-report.md`, and repo-root `TESTING.md` (only with user
  confirmation — posture changes affect every feature).
- Never author `depth`, `reliability`, a 1–5 risk weight, or a `HIGH/MEDIUM/LOW`
  verdict. Record facts only.
- Avoid unrelated refactors and production-code changes.
- Never include secrets in specs, reports, logs, or artifacts (`_shared/secrets.md`).
- Never report pass/fail without command output or an auditable artifact.
- Standalone-safe: never require `TESTING.md`; fall back to the baked-in default.

## When not to use

- Project orchestration, a PRD, or a feature breakdown — project-level work outside
  this scope.
- A code review with no test creation — use `review`.
- Implementation doesn't exist and the user only wants planning.
