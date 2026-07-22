# create-agent-verification — Create a reusable agent-run verification

Producer that **authors and runs** agent-driven verifications: a coding agent
executes a Markdown case file against a live environment — running the case's
**codified UI as Shiplight YAML subprocesses** and performing API, DB, log, cloud,
and telemetry checks directly — and returns an auditable report. It does **not**
drive the UI with an MCP browser. The verification *is* the executing agent's
judgment plus the evidence it collects — not fixed deterministic assertions. The
output is a report path, a final `PASS`/`FAIL`/`BLOCKED`/`ABORTED` status, and the
evidence artifacts, for whatever invoked it to consume.

**The power is coverage, not flexibility.** This is the only format that drives the
UI *and* judges the state behind it — across whatever tools the evidence needs,
in one artifact. A journey that renders "Order confirmed" while the order row,
the payment webhook, and the audit entry disagree with each other is caught by
weighing them together; no single fixed assertion frames that question. That
makes it the right format for smoke-testing core user journeys before a release.

Contrast with the siblings:
- `verify` is the dev-time **act** (check a change now, ephemeral, the main agent
  drives the browser).
- `create-agent-verification` produces a **durable, re-runnable artifact** — the
  `create-` is the tell.
- `create-yaml-tests` produces **deterministic** codified assertions with fixed
  conditions; this produces **judgment-based** verification spanning UI and backend.

> **Naming note.** The skill is "verification" (outcome-oriented), but the
> on-disk conventions — `tests/agent/`, `agent-test-suites.json`,
> `agent-test-reports/`, `run-agent-verification.ts` — are **preserved as-is**:
> they are project-owned and already wired into adopting repos' layout, CI, and
> package scripts. Do not rename them.

## Read first (shared modules)

- `_shared/vocabularies.md` — records this artifact's test `type` as the short
  label `agent`.
- `_shared/evidence-and-report.md` — the auditable-evidence principle (the
  executing engine produces the evidence; text-only UI claims are insufficient).
  Here the engine for UI is the codified YAML run, not an agent-driven browser.

## When to use

**Primary — cross-layer proof.** Reach for this whenever confidence requires the
UI outcome *and* the state it should have changed:

- Core user journeys that must not ship broken — signup, login, checkout,
  payment, provisioning, anything touching money or data integrity. Smoke these
  before a release and after a deploy to staging or production.
- Flows whose confidence requires judgment across layers: UI outcomes (proven by
  the case's codified YAML segments) cross-checked against API, DB, audit, and
  log state. For purely-UI evidence with no cross-layer judgment, prefer
  `create-yaml-tests` alone.
- API/DB workflows where confidence requires live requests plus persisted-state
  inspection.
- Full-stack flows crossing frontend, backend, storage, jobs, external mocks,
  and cleanup.

**Secondary — surfaces that move too fast to codify.** Also legitimate when a
deterministic test would be premature, brittle, or too narrow, because the surface
still changes often enough that codified assertions would need constant repair.

## When NOT to use

- When the evidence is purely UI and the path is stable — a YAML E2E test is
  cheaper, faster, and belongs on every PR. Same for logic provable by a unit,
  contract, or integration test.
- When no live environment, access, or fixtures are available — record the
  blocker rather than authoring an unrunnable case.

**Do not migrate a case to a deterministic test merely because its path
stabilized.** A stable checkout is precisely what should stay covered end to end
before a release. Convert only when the proof reduces to fixed conditions a YAML
test can assert — not when its worth is the judgment across evidence.

## Project layout

Agent verifications live under `tests/agent/` in the target repo:

```text
tests/agent/agent-test-suites.json     suite manifest (project-owned)
tests/agent/<feature>/<case>.md         case files, one logical journey each
tests/agent/<feature>/ui/               embedded Shiplight project: the group's codified UI segments
tests/agent/<feature>/.runtime/         storageState(s) + evidence.json, written per run
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
- `assets/agent-verification-types.ts` → `tests/agent/agent-verification-types.ts`
  (imported by the runner — omit it and typecheck fails with TS2307)

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
- **Preflight the surface, not just access.** Before building fixtures, confirm the
  route, table, and component the case targets still exist (walk the route, grep the
  repo, `to_regclass` the table) — case files drift as routes and schemas evolve. A
  case written against a renamed or removed surface must `BLOCK` with a precise
  reason; never fabricate a fixture for a table or route that no longer exists. When
  a UI surface is gated behind a feature flag, the fixture must enable it — otherwise
  the page 404s or hides the surface and every UI check downstream fails misleadingly.
- List concrete checks: UI states asserted by the `./ui/` YAML segments, API
  routes and status codes, DB tables/rows, audit events, log filters, telemetry
  queries, timing.
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

### Codify UI as YAML; the agent never drives the browser

- Author every deterministic UI flow as a Shiplight YAML test with
  `create-yaml-tests`; the executing agent runs these as subprocesses. Do not write
  browser-automation steps in the md or drive the UI with an MCP browser.
- **UI is optional.** A case with no UI is a backend-only md — do not invent UI for
  it. The md always contains: environment preflight, fixture setup, the backend
  checks (API, DB, audit, logs), investigation, and the verdict; plus running the
  UI YAML when the case has UI.
- **Environment-portable, never local-only.** A case runs on whatever `--target` it is
  given — never hardcode a host (`localhost`), a local token, or `Target: local`. Read
  the target's URLs, credentials, database, and **evidence sources** from what the
  harness provides for that target, because a check that only works locally has no
  equivalent on a deployed one and will falsely block/fail there — e.g. tailing a local
  dev-server log (a deployed target has a hosted log system instead), or a fixture that
  writes through the checkout's own schema (a deployed target's DB may be on an older
  migration). *How* the target's values reach the case and *how* a deployed target
  exposes URLs/logs/DB are per-project specifics to work out — the rule here is only
  that the case must not assume local.

**Layout — one embedded UI project per feature group.** Cases that share a UI
surface live in one directory and share its embedded project; a standalone case
owns its own. Never touch the project e2e suite or another group's project:

```text
tests/agent/<feature>/
  ui/                     # ONE embedded Shiplight project (shiplight create) for the group
    tests/<segment>.test.yaml
    templates/<shared>.yaml
  <case-a>.md             # multiple cases reuse ../ui and its evidence
  <case-b>.md
  .runtime/               # storageState(s) + evidence.json, written per run
```

Reuse UI across cases in the group with YAML `template:` files — do not duplicate
statements per case.

- **Fixtures/auth (two parts).** Setup = (1) run the case's fixture mechanism — the
  E2E broker for simple identities, or a **bespoke fixture script** for complex data
  (multi-org, seeded records, workspaces); then (2) bootstrap a session and write its
  `storageState` to `.runtime/`, where the YAML's `use.storageState` points. The same
  fixtures back the agent's backend queries. Record any server-side env the fixture
  step needs. Session bootstrap URLs are **single-use** — re-mint one per run.
- **Co-locate backend helpers in the feature dir.** Complex fixtures and state changes
  go in small scripts beside the cases (`seed-*.ts`, a phase-mutator, a convert helper)
  that take one action and print JSON. Hand the agent single-command mutations, not
  ad-hoc SQL — the same helper backs your authoring and the agent's run.
- **What the YAML asserts.** Assert **structural UI invariants** (a control is
  present, a known fixture row is visible, a state changed) and **capture values**
  (ids, tokens) the backend needs. Leave **data-specific judgment** (exact counts,
  pass rates, row contents) to the agent's DB queries — do not bind the YAML to
  seed data it would break on. Scope role/text queries to their container
  (`getByRole('listbox').getByRole('option', …)`, `getByRole('dialog').getByText(…)`) —
  e.g. a native `<select>`'s options and a component-library picker's options can
  both match a bare `getByRole('option')` and trip strict mode.
- **Non-click UI.** Session/cookie/state manipulation (set an active-org cookie,
  seed local storage) uses a `description:+js:` step, not `action:+locator:`.
- **Values in `js`.** `{{var}}` interpolates into `action`/`text` fields and
  `VERIFY:` text — **not** into a `js:` body. Inside `js` (assertions or code), read
  fixture/captured values with `testContext.get('name')` and set them with
  `testContext.set('name', v)` in an earlier `description:+js:` step.
- **Interleaved state → one reusable probe.** When UI state depends on backend state
  that changes between checks, do not write a YAML per checkpoint. Author **one**
  parameterized *probe* YAML that reads the current UI state and asserts it against
  per-phase expectations the md writes to `.runtime/` (e.g. `probe-expect.json`); it
  writes what it observed to `.runtime/probe-result.json`. The md then loops each
  phase: mutate DB (via a co-located helper) → re-mint a fresh session → run the probe
  → assert its result. One probe, many phases.
- **Handoff.** Each UI YAML merges its captured values plus a `ui_checks` object
  into `.runtime/evidence.json` with a `description:+js:` step — read-modify-write,
  never overwrite the whole file, or a later test clobbers what an earlier one
  captured. The md reads it. Chain multiple UI tests through the same file (a
  create test writes a record's `prefix`; a revoke test reads it to target that
  record).
- **Run a UI segment** from the md:
  `cd tests/agent/<feature>/ui && npx shiplight test tests/<segment>.test.yaml`.
  Never fall back to driving the browser. Classify a failure by where it broke:
  if the segment could not execute (unreachable URL, invalid or expired
  `storageState`, missing fixture), report `Status: BLOCKED`; if it ran and a UI
  assertion failed on the target surface, that is product evidence — investigate
  and weigh it toward `FAIL`.
- **Drift.** When an assertion failure traces to an intentional UI change rather
  than a regression, repair the YAML with `fix`. Never "repair" away a failure
  that is the bug the case exists to catch — confirm the change was intentional
  first.

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
  A UI YAML assertion failing on the target surface is product evidence toward
  `FAIL`, not a blocker.
- `BLOCKED` — environment/setup could not execute the case (missing DB/log
  access, unreachable URL, failed login/session bootstrap, missing fixtures or
  approval, a removed/renamed target surface, or a UI YAML segment that could
  not execute). Do **not** report `FAIL` for an environment blocker — and do
  **not** report `BLOCKED` for a UI assertion that ran and failed.
- `ABORTED` — orchestration interruption only. Release gates ignore `ABORTED` and
  rerun the case; never end with PASS/FAIL/BLOCKED for an interruption.

Required cases fail the runner unless they return `PASS`. UI evidence is produced
by the codified YAML run (its Shiplight report, trace, and screenshots); reference
those artifacts in the report — the agent does not drive the browser to collect
them.

## Output

A run leaves an auditable report at its report path, ending with exactly one
`Status:` line, plus collected evidence artifacts. That report and its evidence
are the deliverable — whatever invoked this subcommand (a user, `cover`, or a
sibling repo via `/shiplight create-agent-verification`) consumes them.
