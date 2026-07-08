# help — List subcommands, or explain one (does not execute)

`help` is **informational**. It never runs a subcommand's workflow.

## `/shiplight help` (or bare `help`)

Render the grouped subcommand menu from this skill's SKILL.md "Subcommands"
section, then explain how to invoke:

- `/shiplight <subcommand> [context]` runs a subcommand.
- Subcommands also match natural phrasing (e.g. "screenshot the change" →
  `verify`); see the dispatch table's synonym column.
- `/shiplight help <subcommand>` shows details for one **without running it**.

Do **not** ask a clarifying question and do **not** execute anything here — this
is a reference listing. (That is the difference from bare `/shiplight`, which
assumes the user wants to act and asks one clarifying question.)

## `/shiplight help <subcommand>`

Resolve `<subcommand>` via the dispatch table, then read the **header** of its
reference (`references/<sub>.md` or `references/<sub>/index.md`) and give a short
summary: what it does, when to use it, and its internal modes / sub-verbs if any
(e.g. `cloud` → runs, failing/flaky tests, artifacts; `review` → its
domains). End with the exact invocation (`/shiplight <sub> ...`). Do **not** run
the subcommand.

If `<subcommand>` doesn't resolve, show the menu and the closest matches.
