# Test Spec: <Target>

**Scope**: <feature | module | PR | ticket>
**Source material**: <paths, prompt, issue, PRD, ticket, or "inferred">
**Testing posture**: repo-root `TESTING.md` if present, else the baked-in default
**Test report**: [test-report.md](./test-report.md)

This file defines the durable testing contract for this target: what needs
confidence and which evidence strategies are acceptable. Automated tests are one
implementation of the contract, not the contract itself.

This template is Speckit-aware but not Speckit-dependent. When a numbered spec
exists, link it under **Source material** and reuse its requirement ids; when it
does not, describe the target from docs, code, tickets, or user input and mark
inferred expectations accordingly.

## Testing What

Testing what is broader than product requirements. Include product behavior,
implementation/system invariants, operational behavior, risk areas, and
stakeholder confidence goals that matter for trusting this target.

### Product Behaviors

- <User-visible behavior, workflow, or product promise to verify.>

### Implementation / System Invariants

- <Important API, schema, transaction, audit, permission, data ownership,
  cleanup, idempotency, routing, or architecture invariant.>

### Risk-Based Behaviors

- <Security, privacy, billing, data integrity, regression, or high-blast-radius
  behavior.>

### Operational / Release Behaviors

- <Migration, job, telemetry, rollout, rollback, live-env, performance, or
  release-gate behavior.>

### Stakeholder Confidence Goals

- <What product, support, compliance, release, or customer stakeholders need to
  trust if this passes.>

## Evidence Strategy

`Priority` is the declared P0–P3 importance carried from the PRD, feature
breakdown, or spec — a fact, not a judgment invented here. It drives how hard to
test (P0 = strongest posture). If no upstream artifact declares a behavior's
priority, mark it `UNKNOWN` and flag it for the owner rather than guessing.

| What | Priority | Viable How | Selected How | Why | Residual Risk |
| --- | --- | --- | --- | --- | --- |
| <behavior/invariant> | <P0-P3 from PRD/spec, or UNKNOWN> | <unit, contract, integration, e2e, agent, manual, telemetry> | <chosen proof> | <confidence/cost/stability rationale> | <remaining gap> |

Out of scope:

- <Behaviors, environments, or risks this target intentionally does not cover.>

## Test Cases

### <TARGET>-T01 <Capability / Behavior Name>

- Testing what:
- Source refs:
- Preconditions:
  - Required account / role:
  - Required data:
  - Required external services:
- Automated checks:
  ```bash
  # Add focused unit, contract, integration, e2e, script, typecheck, or lint
  # commands that are useful diagnostics for this test case.
  # Include the full reproducible command chain when later checks depend on a
  # prerequisite or artifact-producing step.
  ```
- Steps:
  1. <Action the executor performs through API, DB, UI, browser, logs, script,
     telemetry, or manual observation.>
  2. <Next action.>
- Optional stronger evidence:
  - DB:
  - API:
  - Logs:
  - Browser / UI automation:
  - Agent test:
  - External dashboard / telemetry:
- Pass criteria:
  - <Observable result that proves the requirement or invariant.>
- Cleanup:
  - <Rows, accounts, external resources, sessions, or files to remove.>
- If not executable:
  - Mark `SKIPPED` when the environment lacks required fixtures or access.
  - Mark `BLOCKED` when no available agent/tool can verify it and a human is
    required.
  - Mark `DEFERRED` when the proof belongs to a later release/live-env sweep.

### <TARGET>-T02 <Next Capability / Behavior Name>

- Testing what:
- Source refs:
- Preconditions:
- Automated checks:

  ```bash

  ```

- Steps:
  1. <Action.>
- Optional stronger evidence:
- Pass criteria:
- Cleanup:
- If not executable:

## Fixtures And Environments

Fixtures describe how to bind the portable test cases to concrete environments.
Do not put secrets in this file. Describe secret availability without printing
values.

### Local Development

- Web URL:
- Admin URL:
- API URL:
- Accounts / roles:
- Data fixtures:
- External service fixtures:
- Environment setup:
- Mutation policy: `seeded_fixtures_only` unless explicitly allowed.
- Known local limitations:

### Dev

- Web URL:
- Admin URL:
- API URL:
- Accounts / roles:
- Data fixtures:
- External service fixtures:
- Mutation policy:
- Known limitations:

### Staging

- Web URL:
- Admin URL:
- API URL:
- Accounts / roles:
- Data fixtures:
- External service fixtures:
- Mutation policy:
- Known limitations:

### Production

- Web URL:
- Admin URL:
- API URL:
- Accounts / roles:
- Data fixtures:
- External service fixtures:
- Mutation policy: `read_only` by default.
- Known limitations:

## Report Expectations

- Stable report path: use the report location defined by the active testing
  workflow or skill.
- Report every test case with a consistent result status: `PASS`, `FAIL`,
  `PARTIAL`, `BLOCKED`, `SKIPPED`, `NOT RUN`, `DEFERRED`, `ABORTED`, or
  `UNKNOWN`.
- Put blocking failures first in `## Findings` or `## Deferred / Residual Risk`.
- Record commands run, evidence collected, cleanup performed, and resources
  intentionally left behind.
- If a test case depends on a prerequisite or artifact-producing step, include
  that command in the automated check list instead of only mentioning it as a
  precondition.
- Never include passwords, API keys, cookies, tokens, database URLs, or raw
  secret fixture payloads.

## Coverage Notes

- Map every important testing what to at least one selected evidence strategy.
- If an automated test already covers a case, include the exact command to run
  it and the expected pass signal.
- If later evidence relies on a prerequisite or prepared state, include the full
  command chain needed to reproduce it from a clean checkout.
- If a case cannot be automated, specify how an agent, human, telemetry query,
  or live-env check can verify it.
- If a case depends on environment capabilities, keep the test case portable and
  document the environment-specific binding under `## Fixtures And Environments`.
