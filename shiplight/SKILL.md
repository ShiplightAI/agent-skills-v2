---
name: shiplight
description: "Shiplight QA toolkit — the single entry point for all Shiplight test/QA work. Use ONLY when the user explicitly says 'shiplight' (e.g. 'write a shiplight test', 'use shiplight to verify X', 'shiplight cover') or invokes /shiplight. Routes to subcommands: init, auth, update, create-yaml-tests, create-agent-verification, cover, fix, verify, review, ci, cloud, help."
---

# Shiplight

The single entry point for Shiplight QA work. This skill takes a **subcommand**
and routes it to the right workflow. Everything Shiplight-branded comes through
here; the description above is deliberately gated so this skill fires only when
the user names "shiplight" or types `/shiplight` — never on a generic "write a
test".

## Routing contract

1. **Identify the subcommand.** Match the argument against the dispatch table —
   do **not** rely on the first token alone, because synonyms are often multi-word
   (`yaml test`, `set up tests for my app`) and intents may lead with a non-token
   word (`create yaml test`, `show failing tests`). In order: (a) an exact
   canonical token as the leading word; (b) the longest canonical-token or synonym
   **phrase** the argument contains; (c) overall intent against the synonym/intent
   column. Pick the single best-matching subcommand.
2. **Pass-through context.** Forward whatever the selector didn't consume to the
   subcommand as context. **Natural phrasing is expected — users won't type the
   exact hyphenated token; match the intent and treat the rest as the target.**
   Examples:
   - `/shiplight cover checkout flow` → `cover` + context `checkout flow`
   - `/shiplight create a yaml test for login` → `create-yaml-tests` (matched on
     "yaml test") + context `for login`
   - `/shiplight create agent verification for the signup flow` →
     `create-agent-verification` (matched on "agent verification") + context
     `for the signup flow`
3. **Dispatch.** Read the matching `references/<subcommand>.md` (or
   `references/<subcommand>/index.md` for nested subcommands) and follow it,
   carrying the context forward.
4. **Clarify, don't guess.** If the selector is empty (`/shiplight` alone) or
   ambiguous (see Ambiguity notes), show the menu and ask **one** clarifying
   question — the user wants to *act* but didn't say how. This differs from
   `help`, which is informational: `help` lists/explains subcommands and **never
   executes** (see `references/help.md`).
5. **Confirm destructive actions.** Never auto-run `init` against a non-empty
   project — confirm first.

## Shared layer

- On every subcommand invocation (skip for `help`), run `references/_shared/update-check.md` once (daily
  skill refresh), then identify the test project root.
- Each subcommand names the `references/_shared/` modules it needs (auth, mcp,
  evidence-and-report, project-layout, ground-truth, knowledge, secrets,
  vocabularies, test-spec-template). Read those before acting — they are the
  single source of truth, not restated per subcommand.

## Subcommands (menu)

Show this grouped menu when invoked bare or when clarifying.

**Setup**
- `init` — scaffold a Shiplight test project + write `specs/context.md`
- `auth` — set up / repair login and saved storage state
- `update` — refresh installed Shiplight skills

**Author**
- `create-yaml-tests` — implement deterministic YAML E2E tests from a spec
- `create-agent-verification` — create a reusable agent-run verification script
- `cover` — decide test format + effort, plan, drive the producers, report

**Maintain**
- `fix` — reproduce and repair failing or drifted tests

**Check**
- `verify` — verify UI changes in the browser during local development

**Review**
- `review` — app-quality review (security, privacy, design, performance, …)

**Ship**
- `ci` — wire CI workflows + failure-triage pipeline
- `cloud` — read Shiplight Cloud (Nova) test results (runs, failing/flaky tests, artifacts) and analytics (health summary, pass-rate/run trends, slowest/flaky rankings, failure attribution)

**Help**
- `help` — list subcommands, or `help <subcommand>` for details (does not execute)

## Dispatch table

| Canonical | Synonyms / intents | Reference |
|-----------|--------------------|-----------|
| `init` | set up shiplight, new test project, scaffold | `references/init.md` |
| `auth` | log in, save session, storage state, authentication | `references/auth.md` |
| `update` | self-update, upgrade skills, refresh skills | `references/update.md` |
| `create-yaml-tests` | yaml test(s), create a yaml test, write a yaml/e2e test, deterministic test, e2e test, write a test | `references/create-yaml-tests/index.md` |
| `create-agent-verification` | agent verification, create agent verification, verification script, repeatable agent check, live-env verification | `references/create-agent-verification/index.md` |
| `cover` | coverage, test coverage, what's untested, coverage gaps, testing strategy, plan tests, write a spec, test plan, set up tests for my app, build tests, test this feature | `references/cover/index.md` |
| `fix` | failing test, triage, repair test, update test for product change | `references/fix.md` |
| `verify` | screenshot, verify the change, check the UI, visual check | `references/verify.md` |
| `review` | security review, review my app, accessibility, privacy, performance, seo | `references/review/index.md` |
| `ci` | github actions, ci setup, pipeline | `references/ci.md` |
| `cloud` | cloud results, test run results, failing tests, flaky tests, ci results, download artifacts, test health, pass rate, pass-rate/run trend, slowest tests, flakiest tests, failure attribution, failure breakdown, analytics | `references/cloud/index.md` |
| `help` | what can shiplight do, list commands, usage, `?` | `references/help.md` |

## Ambiguity notes

- **"test" / "write a test"** → could be `create-yaml-tests` (deterministic) or
  `create-agent-verification` (agent judgment). Default to `create-yaml-tests`
  unless the user signals exploratory / judgment / live-env, but if unclear,
  ask.
- **"verify" / "verification"** → the *verb* (check a change now) is `verify`;
  *creating a reusable verification script* is `create-agent-verification`. The
  `create-` framing is the tell. Ask if the user's phrasing doesn't disambiguate.
- **"triage"** → in Shiplight this means `fix` (repair failing tests). Do not
  confuse with `review`'s internal triage/plan step.
- **"failing tests" / "flaky tests"** → *reading* them from CI ("in the cloud",
  "from the last run", plural reporting) is `cloud` (Nova results); *repairing* a
  broken test ("my test is failing", "fix this") is `fix`. Ask if the phrasing
  doesn't say which.
