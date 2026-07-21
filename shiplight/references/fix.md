# fix — Reproduce and repair failing or drifted tests

Reproduce, diagnose, and repair existing Shiplight YAML tests — both **reactive**
(a run is failing) and **proactive** (the product drifted, a test is wrong, or a
journey needs extending). If the application is broken or current behavior
conflicts with the spec, **report the mismatch** instead of rewriting the test
around it.

Siblings: `create-yaml-tests` (author new tests), `cover` (decides what to test
and may drive this), `verify` (check a UI change with no failing test).

## Read first

- `_shared/ground-truth.md`, `_shared/project-layout.md`, `_shared/knowledge.md`,
  `_shared/mcp.md`, `_shared/secrets.md`
- `create-yaml-tests/test-implementation-guide.md` (YAML syntax & actions) and
  `create-yaml-tests/test-design-guide.md` (what to assert)
- The matching spec under `specs/tests/`; the YAML test `goal`, step `intent`s, and
  `VERIFY` assertions; related tests for the same page/feature (borrow working
  locators instead of guessing); `npx shiplight spec yaml`,
  `npx shiplight spec actions` (YAML action parameters), and
  `shiplight://schemas/action-entity` (live-session `act` payloads).
- `knowledge/` notes for the failing area, environment, auth, data, and tooling.

## When to use

- A Shiplight test run is failing.
- A deployment or UI change broke existing tests.
- Several tests may share one failure source.
- An existing test needs repair or extension (drift, test bug, coverage gap).
- CI needs a best-effort repair/report pass.

## When to skip

- Creating new tests from scratch → `create-yaml-tests`.
- Verifying a UI change with no failing test → `verify`.
- Tests pass and the task is only quality improvement.
- The product is being intentionally redesigned and tests need a planned rewrite →
  `cover` / `create-yaml-tests`.

## Diagnose the reason

Before editing, identify why the update is needed — it determines the fix:

- **Locator drift** — the UI changed but intended behavior did not.
- **Product change** — intended behavior changed intentionally.
- **Test bug** — the implementation was wrong.
- **Coverage gap** — new assertions or journeys are needed.

## Workflow

1. **Reproduce** — run the specified target, or the narrowest relevant suite if no
   target was given. If a failure looks transient, rerun the smallest affected
   target once before editing.
2. **Understand** — read the failure output, relevant YAML, matching spec, related
   tests, and shared templates/functions/hooks before opening a browser or changing
   files.
3. **Inspect when needed** — when logs and files aren't enough, inspect the live app
   in a browser (`_shared/mcp.md`). Use the evidence the failure needs: DOM,
   actions, locators, console logs, network logs, screenshots, recordings. Do not
   guess rendered UI when the failure depends on current browser behavior.
4. **Fix minimally** — change the smallest correct surface (YAML, template, helper,
   auth setup, environment data, or spec). Branch on the reason:
   - **Intended behavior unchanged** — update only the implementation (locators,
     waits, setup, assertions) needed to restore the spec'd behavior. Do **not**
     delete assertions, skip required steps, or reduce coverage to make a test pass.
   - **Intended behavior changed** — update the spec first, then the YAML to match,
     then mark the spec `Implemented` after verifying.
   Don't touch passing tests unless they share the same broken source. Keep ACTION
   locators and VERIFY `js:` caches current on edited steps, but don't churn
   unrelated caches.
5. **Validate and rerun** — validate edited YAML with `npx shiplight transpile --strict`, then
   rerun the narrowest changed target. After batch fixes, rerun the original target
   once.
6. **Reflect** — run the session-close reflection (`_shared/knowledge.md`); update
   specs, `specs/context.md`, or `knowledge/` when the session produced durable
   learning or corrected stale assumptions.

## Guardrails

- If the app is broken, report the app issue instead of masking it with test
  changes (`_shared/ground-truth.md`).
- If intended product behavior changed, update the matching spec before the YAML.
- Preserve user changes and unrelated work; prefer focused fixes over broad
  rewrites.
- Never edit generated/local-state files (`**/*.yaml.spec.ts`, `test-results/**`,
  `shiplight-report/**`, `.shiplight/**`) — useful for debugging, but never the
  source of test intent (`_shared/project-layout.md` edit contract).
- Prefer unique data per run; document required accounts/fixtures/records in the
  spec; don't depend on shared mutable state.
- In CI or non-interactive mode, do not block on user input — make conservative
  best-effort decisions and document uncertainty.

Common causes: stale locators, changed user flows, assertion drift, expired auth,
timing, shared templates/hooks, invalid parameter data, environment issues, and
real app bugs. Use evidence to decide the minimal correct fix.

## Reporting

After fixing, report:

- Target command(s) run and pass/fail result.
- Files changed.
- Tests repaired, skipped, still failing, or already passing.
- Behavior covered or restored.
- App/spec mismatches or unresolved blockers.
- Knowledge, context, or specs updated.
