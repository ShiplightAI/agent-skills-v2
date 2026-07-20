# Default Testing Strategy (Guideline)

> This is the baked-in default testing strategy for `cover`.
> It encodes expert judgment, not hard rules. Projects can override it with a
> checked-in `TESTING.md` when they need a different proof posture.
> Treat it as guidance for *how to allocate testing effort*, not a checklist to
> satisfy.

## North Star

Quality evidence is not test count. **Optimize for justified confidence per unit
of cost** (author + run + maintain), stability, latency, diagnostic value, and
maintenance. Testing is always a balance against budget — the goal is the most
effective strategy the budget allows, not the most tests.

## Modality Economics

Cheap tests are narrow; expensive tests are thorough. Use this trade-off
deliberately.

| Modality | Cost | Reach / thoroughness | Strategic role |
| --- | --- | --- | --- |
| **unit** | very low | narrow; one unit, no integration realism | **Maximize.** Cheap, so aim for very good coverage on logic and edge cases. No excuse to skip. |
| **contract / api** | low–med | proves the public boundary (route, server action, authz, schema) | Apply to every boundary that matters. |
| **integration** | med | cross-module + real side effects (DB, transactions, jobs, migrations, audit rows) | Prove state and invariant correctness wherever cheaper tests can't. |
| **e2e (codified)** | med–high | full stack through the UI; deterministic; CI-gateable | **Ration.** Gate critical user journeys. |
| **agent** | high | most thorough short of a human — judgment across layers: runs the case's codified UI segments and cross-checks API, DB, logs, and telemetry | **Ration hardest.** Use as key release gates, for behavior-only / live checks, and for exploration. |
| **manual** | highest (human) | unlimited judgment | Last resort / un-automatable only. |

Behavioral proof hardens along a ladder of rising determinism:
`manual → agent test → codified e2e`. Promotion = walking right along it.

## Decision Principle

For each quality check:

> Among the modalities **capable** of proving it, buy sufficient confidence at
> the **lowest cost** — spending the scarce expensive-test budget (e2e, agent)
> where **priority is highest** and cheaper proofs structurally can't reach.

Three guardrails keep this honest:

1. **Capability before cost.** "Cheapest" means cheapest *among modalities that
   can actually prove this check*. A unit test cannot prove an OAuth callback or
   a real-browser flow, so it is not in the feasible set there. Check nature
   picks the feasible set; cost picks within it.
2. **Priority sets a floor; budget flexes only the ceiling.** The declared
   priority (P0–P3) decides the floor; budget decides how far *up* the ladder
   you climb and how much redundancy you add. Budget can never take you below
   the floor. "Budget didn't allow it" is not a valid reason to skip a floor
   item.
3. **Defense-in-depth at the top.** For the highest-priority (P0) checks,
   deliberately stack layers (unit + integration + an agent/e2e gate) rather
   than picking the single cheapest sufficient proof — the cost of being wrong
   dwarfs the test cost.

## Non-Negotiable Floors

Budget can never undercut these:

- **Unit coverage on core and changed logic.** It's cheap; high coverage is
  expected.
- **At least one gate on every P0 check.** Release-critical behavior always has
  *some* proof.

Everything above the floors is budget-optimized by the decision principle.

## Reporting Obligation

When budget forces a check to stop short of its ideal proof, **state the
allocation chosen and the residual proof gap knowingly accepted** in the
test-spec's Residual Risk column and the test report. Honest "here's what we
didn't buy and why" is the signal stakeholders need — silent under-testing is
not.

## Priority → Effort (rough default, revisit)

`priority` (P0–P3) is a **declared fact** read from a dev artifact (PRD,
feature-breakdown, spec, or per-behavior in `test-spec.md`), not a judgment
invented while authoring the test-spec. It is the effort lever. There is no
separate authored risk weight, and evidence rows carry no authored
`depth`/`reliability`: the strength of a proof is read from its `type` plus
runtime observations.

| Priority | Meaning | Default posture |
| --- | --- | --- |
| P0 | release-critical | a dedicated automated proof at a modality matching the check's nature + a gate; consider defense-in-depth |
| P1 | high | at least one dedicated automated proof |
| P2 | important | a dedicated or strong workflow-level proof |
| P3 | low | indirect/static acceptable; absence is a noted gap, not a push target |
