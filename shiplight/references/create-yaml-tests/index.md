# create-yaml-tests — Implement deterministic YAML E2E tests

Producer that implements focused, deterministic Shiplight YAML tests from a
**Ready** spec: walk the app, capture real locators, write and validate YAML, run
it. This is the *implement* step — its siblings own the rest of the lifecycle:

- `init` — scaffold the project + write `specs/context.md`
- `auth` — set up/repair login
- `fix` — repair failing or drifted tests
- `cover` — decides what to test, plans the spec, and drives this producer

Cross-repo building block: invoked by `cover` and by sibling repos as
`/shiplight create-yaml-tests`.

## Read first

- `_shared/project-layout.md`, `_shared/ground-truth.md`, `_shared/knowledge.md`,
  `_shared/auth.md`, `_shared/secrets.md`
- `_shared/mcp.md`, and **before writing any YAML**: `npx shiplight spec yaml`
  (the YAML language spec), `npx shiplight spec actions` (YAML action
  parameters), and the MCP resource `shiplight://schemas/action-entity` (the
  actions `act` can perform in a live session)
- This slice's guides: `test-design-guide.md` (what to test / structure) and
  `test-implementation-guide.md` (YAML syntax & actions)
- Check `knowledge/` for notes relevant to the app area, target, auth, data, or
  tooling you're about to touch.

## Core rules

- Keep YAML tests focused — one test verifies one logical journey or variant.
- **Do not write YAML from imagination.** Walk the app in a browser first and
  capture real locators.
- Validate YAML with `npx shiplight transpile --strict tests/<file>.test.yaml`
  after writing it — pass the file(s) you wrote. Bare `--strict` gates every
  test in the project.
- A spec may map to many smaller YAML tests; specs describe feature/journey-group
  confidence, YAML files are executable coverage.
- Never store raw secrets (`_shared/secrets.md`).
- Reflect before finishing (`_shared/knowledge.md`).

## Workflow

### 1. Determine the target URL

Every test targets a specific deployment/base URL. Reuse a URL already documented
in nearby tests, `specs/context.md`, or `knowledge/`; otherwise record it in the
relevant spec or `specs/context.md` before writing YAML. The confirmed URL becomes
the YAML `base_url`. If the target is ambiguous, ask — do not silently switch URLs
to make a test pass.

### 2. Determine auth

Decide whether the test needs authentication before writing steps (see
`_shared/auth.md`: does-a-test-need-auth, shared vs per-test). List available
roles/accounts/env vars from `specs/context.md`, `knowledge/`, relevant specs, or
existing auth files; reuse an existing Playwright-native setup when it matches.
Record the username/role + env var names — never the password value.

### 3. Ensure a Ready spec

This subcommand implements deterministic YAML from an **E2E spec under
`specs/tests/`** — a different artifact from `cover`'s `specs/<feature>/test-spec.md`
(the format-agnostic testing-what contract). When driven by `cover`, read its
`specs/<feature>/test-spec.md` to scope *what to prove*, then author/update the
matching E2E spec under `specs/tests/` and implement it. For a
direct narrow request with no spec, author/update one inline using this slice's
`test-spec-template.md` — it must include goal, roles, base URL, auth,
journeys/variants, expected results, assertions, test data, cleanup, and
implementation plan. Do not proceed to implementation while
the spec is `Draft`, unless the user explicitly asks to skip specs (narrow "add
this one test" requests may inline a minimal spec).

### 4. Walk the app and write YAML

Once the spec is Ready:

1. Open a Shiplight MCP browser session at the target URL.
2. Walk through the exact flow described in the spec.
3. Capture locators for interactive elements.
4. Create focused YAML tests under `tests/`, following `test-implementation-guide.md`.

```yaml
# Spec: specs/tests/login.md
goal: Existing user can sign in with a valid password
base_url: https://staging.example.com

statements:
  - URL: /login
```

If the project uses shared auth, tests usually need no auth block. For per-test
auth, add `use.account.auth` and optional `args`. If another Playwright-native
auth pattern is already wired through config or `storageState`, follow it. Do not
write statements from memory — always walk the app first.

### 5. Validate and run

1. Validate with `npx shiplight transpile --strict tests/<file>.test.yaml` (the
   file(s) from step 4).
2. Run the narrowest relevant command (usually one test file).
3. If validation rejects too many draft statements, return to the browser and
   capture more locators.
4. If the test fails because implementation violates the spec, fix the test.
5. If app behavior differs from the spec, **report the mismatch** (`_shared/ground-truth.md`).

### 6. Update the spec & reflect

Mark implemented coverage in the relevant spec; add/update the YAML test paths;
document skipped journeys, known gaps, and product/spec mismatches. Then run the
session-close reflection from `_shared/knowledge.md`.

## User checkpoints

For broad test creation, confirm planned outcomes before implementing:

> Do these outcomes match the confidence you need from this test project? Any
> business-critical outcome missing or incorrectly out of scope?

For narrow requests ("fix this failing test", "add this one test"), proceed
without a broad checkpoint unless the spec is ambiguous or conflicts with app
behavior.

## Final report

Report: files created/changed; behavior covered; commands run and pass/fail;
knowledge or context updated (including stale notes corrected); any product/spec
mismatch or unresolved blocker.
