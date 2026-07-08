# Shared: Knowledge & session-close reflection

Knowledge is mutable project memory for Shiplight test agents. As you work, write
down durable facts future agents need and cannot easily derive from code, specs,
or guides — including facts learned from the user. Applies to every subcommand's
close-out, not a task of its own.

Examples: app quirks; reliable setup/cleanup patterns; known failure modes;
tooling gotchas; stable account roles or data constraints (without secrets);
corrections to older assumptions.

## Where to write

- `knowledge/` — operational notes discovered while working.
- `specs/context.md` — project-wide testing context: app profile, risk profile,
  target URLs/deployments, durable data strategy, broad scope decisions.
- `specs/tests/*.md` — feature intent, expected behavior, journeys, assertions,
  coverage decisions.

## How to write

Each note must stand alone — a future agent has no memory of the chat.

- State the fact or pattern directly; include enough context to act on it.
- Don't refer to "this task" or "what we just did".
- Don't duplicate facts already in specs, tests, code, or guides.
- Don't store raw secrets (see `_shared/secrets.md`).

## How to update

Knowledge is not append-only. When new input, app behavior, or test work proves a
note stale or incomplete: update the note when the topic is the same; merge
duplicates; remove obsolete guidance that would mislead; preserve historical
context only when it explains why the current rule exists. Prefer one clear
current fact over contradictory notes.

## When to read

Before starting a task, check `knowledge/` for files relevant to the app area,
target URL/deployment, auth, data, or tooling you're about to touch.

## Session-close reflection

Before ending an interactive session, ask:

- What did the user teach me that future agents shouldn't need to ask again?
- What product behavior, app quirk, auth/data pattern, or testing preference was
  clarified?
- Did any existing knowledge prove stale, incomplete, or wrong?
- Does the learning belong in `knowledge/`, `specs/context.md`, or a specific
  `specs/tests/*.md`?

Then update the right file before the final report.
