# Agent Test: <Short Name>

<!-- Authoring note (delete when filling in): for a backend-only case, remove
every UI-specific piece — the "UI is codified…" paragraph below, the "UI YAML
evidence path" report bullet, the "UI (deterministic YAML)" section, and Task
step 1. -->

## Instructions

You are a testing agent for `<project/product name>`. Execute this case against
the target environment using terminal commands, database queries, logs, cloud
APIs, telemetry, and repo context. When the case has deterministic UI, run the
feature group's UI YAML (`tests/agent/<feature>/ui/`) instead of driving the
browser yourself.

Do not mark PASS without concrete evidence. Do not use production customer data
unless this case explicitly says production synthetic data is allowed.

This case has two phases:

1. Environment preflight: confirm the selected environment can actually execute
   this case — including that the route, table, and component this case targets
   still exist (a renamed or removed surface is a `BLOCKED`, not a fabricated fixture).
2. Product verification: execute the feature checks and return PASS or FAIL.

If environment preflight fails, do not run product verification. Report
`Status: BLOCKED` with the concrete blocker, such as missing database access,
missing log access, unavailable login/session bootstrap, unavailable fixture
setup, a superseded/removed target surface, missing production synthetic approval,
app startup failure, or target URL unreachable. Once environment preflight is
ready, product verification must return exactly PASS or FAIL. Do not return SKIPPED.

Do not classify an external timeout, cancellation, or instruction to stop as a
product result. If the orchestrator interrupts execution before this case has
enough evidence for PASS, FAIL, or an environment/setup BLOCKED result, write
`Status: BLOCKED` only if the interruption exposed a concrete environment or
setup blocker named by this case. Otherwise write `Status: ABORTED` in the
report body, explain the orchestration interruption, and do not end the report
with PASS, FAIL, or BLOCKED. Release gates should ignore ABORTED reports and
rerun the case.

UI is codified as Shiplight YAML in `./ui/` and run as a subprocess (see the UI
section). Its Shiplight report, trace, and screenshots are the UI evidence —
reference them; do not drive the browser to collect them.

When the orchestrator provides `AGENT_VERIFICATION_REPORT_PATH`, write the
report to that exact path. Otherwise, write the report to a timestamped path:

`agent-test-reports/<feature>-<case-id>-<YYYYMMDD-HHMMSS>.md`

The report must include:

- Status: PASS / FAIL / BLOCKED, or ABORTED only for orchestration interruption
- Target environment and URLs used
- Fixture setup performed
- Evidence collected
- Findings
- Commands, queries, pages, dashboards, or logs inspected
- UI YAML evidence path (Shiplight report, trace, or screenshots) for the UI segments run
- Cleanup performed
- Follow-up required

End the report with one exact line:

`Status: PASS`

or:

`Status: FAIL`

or:

`Status: BLOCKED`

For orchestration interruption only, end with:

`Status: ABORTED`

## Requirements

- <Requirement, risk, invariant, user story, FR/SC id, ticket id, or short
  behavior description>

Sources:

- `<path-to-test-spec.md>`
- `<path-to-product-or-system-doc.md>`

## Project Context

- Product/project name: `<project/product name>`
- Local URLs: `<local web/admin/api URLs>`
- Staging URLs: `<staging web/admin/api URLs>`
- Production URLs: `<production web/admin/api URLs>`
- Fixture setup and mutation policy: `<who/what may create, repair, mutate, or delete data>`
- Required accounts and organizations: `<exact emails, slugs, ids, or creation pattern>`
- Database/log/cloud access: `<required access, commands, dashboards, or blockers>`
- Production synthetic data policy: `<read-only or exact approved synthetic fixtures>`
- Cleanup ownership: `<agent, test owner, janitor job, or manual follow-up owner>`

## Testing Environments

The orchestrator or tester must specify one listed target environment before
execution, for example through `AGENT_VERIFICATION_TARGET=local` or an equivalent
parameter. If no target environment is specified, stop before preflight and
report `Status: BLOCKED` with blocker `target_environment_missing`. Record the
selected target in the report. A PASS is valid only for the selected target
environment.

### Local Development

- Web URL: `<local-web-url>`
- Admin URL: `<local-admin-url>`
- API URL: `<local-api-url>`
- Backend setup:
  - <migrate/seed command>
  - <server start command>
- Fixture setup authority: <what the tester may create/repair/mutate>
- Required accounts: <exact emails or creation pattern>
- Required organizations/data: <exact slugs/ids or creation pattern>
- Required logs: <local terminal/app logs>
- Mutation policy: test-owned records only unless explicitly stated.

### Staging

- Web URL: `<staging-web-url>`
- Admin URL: `<staging-admin-url>`
- API URL: `<staging-api-url>`
- Environment preflight command: `<command that proves DB/log/session/fixture access>`
- Fixture setup command: `<command that verifies or repairs fixtures>`
- Required accounts: <exact emails>
- Required organizations/data: <exact slugs/ids>
- Required logs: <log source/filter>
- Mutation policy: seeded fixtures or clearly test-owned records only.

### Production

- Web URL: `<production-web-url>`
- Admin URL: `<production-admin-url>`
- API URL: `<production-api-url>`
- Production policy: read-only unless this case lists exact synthetic fixtures
  and explicit mutation approval.

## Environment Preflight

Before product verification, prove the selected environment is ready:

1. Confirm the target URLs are reachable.
2. Confirm the route, table, and component this case targets still exist (walk
   the route, grep the repo, check the schema). A renamed or removed surface is
   `BLOCKED`, not a fabricated fixture.
3. Confirm backend/database access works when required.
4. Confirm log access works when logs are required evidence.
5. Confirm login/session bootstrap works for required accounts (for UI cases,
   the minted `storageState`).
6. Run the fixture setup command for the selected environment.
7. Confirm required fixtures exist and are safe to mutate.

If any item fails, stop before product verification and write a report ending
with `Status: BLOCKED`. The report must name the specific blocker.

## Fixture Preparation

After environment preflight completes, prepare case-specific data:

- <create/repair exact account or data fixture>
- <create/repair exact organization or membership>
- <clear stale test-owned records>

Use this prefix for newly created records unless the environment section says
otherwise:

`agent-<feature>-<case>-<timestamp>`

State cleanup expectations for every mutable fixture.

## UI (deterministic YAML)

Deterministic UI is codified in the feature group's shared embedded project
`tests/agent/<feature>/ui/`. Do not drive the browser. Omit this section for
backend-only cases.

- Setup writes each role's `storageState` to `tests/agent/<feature>/.runtime/`
  (Fixture Preparation), where the YAML's `use.storageState` points.
- Run a segment: `cd tests/agent/<feature>/ui && npx shiplight test tests/<segment>.test.yaml`.
  Never drive the browser as a fallback. If the segment could not execute
  (unreachable URL, invalid or expired `storageState`, missing fixture), report
  `Status: BLOCKED`. If it ran and a UI assertion failed on the target surface,
  treat that as product evidence — investigate and weigh it toward `FAIL`.
- Read `tests/agent/<feature>/.runtime/evidence.json` (`{ <captured values>, ui_checks: {...} }`).
  The YAML asserts only structural UI invariants — judge data-specific values
  (counts, contents) from the DB yourself. Use captured values for backend checks;
  refer to secrets by prefix/id, never raw.

## Task

Execute the verification steps:

1. Run setup (fixture mechanism + `storageState`), then the UI YAML segment(s) under
   `tests/agent/<feature>/ui/tests/`; read `tests/agent/<feature>/.runtime/evidence.json`.
   Skip this step for backend-only cases.
2. <backend step — API/DB/audit/log check the agent performs>
3. <backend step …>
4. Cleanup.

## Suggested Checks

Include concrete checks that make the agent less likely to guess:

- UI states asserted by the `./ui/` YAML segments (not driven by the agent).
- API routes and expected status codes.
- Database tables/rows to query.
- Audit events to query.
- Log filters or Cloud Run services to inspect.
- Telemetry queries or dashboard panels to inspect.
- Timing measurements to record.

## Expected Evidence

Collect evidence for each required behavior:

- <evidence item>
- <evidence item>
- <evidence item>

## Pass Criteria

PASS only if all required behaviors and evidence are present.

FAIL only if environment preflight completed and any required behavior is broken
or required evidence is missing.

If backend access, secrets, URL reachability, login/session bootstrap, fixture
repair, app startup, or other required environment capability is unavailable,
stop before product verification and end the report with `Status: BLOCKED`
instead of `Status: FAIL`.

## Cleanup

Describe cleanup for all records, sessions, tokens, workspaces, cloud resources,
and third-party objects created by the case. If cleanup is not safe, leave
records clearly named with the agent test id and note them in the report.
