# Shared: Update check (skills + CLI)

Run this once per `/shiplight` invocation, after the test project root is known
and before the selected subcommand's work. It covers two things that drift apart
on their own: the installed **skills** (this repo's content, refreshed daily) and
the project's **`shiplightai` CLI**, which `package-lock.json` freezes at whatever
version was resolved on the day the project was scaffolded.

**Skip this entire module in CI / non-interactive mode.**

## 1. Skill refresh (daily, automatic)

1. Check the timestamp file `.shiplight-agent-skills-last-update` in the test
   project root.
2. If it is **missing**, create it with the current timestamp and continue
   **without** running an update (a freshly installed project should not pay for
   a second install). Treat the file as local cache — do not commit it.
3. If it **exists and is older than 24 hours**, run
   `npx -y skills@latest update -y`, then create/update the timestamp file even
   if the command fails.
4. If the update command fails, continue with the currently installed skill and
   mention the failure briefly.

## 2. CLI version gate (every invocation)

The skills always run at latest, so the CLI has to as well — anything else is the
drift this module exists to stop. Read both numbers:

    installed:  node -p "require('./node_modules/shiplightai/package.json').version"
    latest:     npm view shiplightai version

Use `npm view` — it reads registry metadata in ~0.3s. Do **not** use
`npx shiplightai@latest --version` to get the same string: on a cold cache it
installs the whole package tree first (~21s, ~640 MB) to run a binary that prints
a constant.

Then:

- **`node_modules/shiplightai` absent / the read fails** → dependencies aren't
  installed. Tell the user to run `npm install` in the test project root, and
  stop.
- **`npm view` fails** (registry blip) → say so in one line and continue. The gate
  exists to catch chronic drift; a transient outage shouldn't brick the run.
- **installed < latest** → **stop, before the subcommand does any work.** Compare
  as semver, not strings — a locally newer or prerelease build must not trip the
  gate. Report both versions and offer to upgrade now (see below).
- **installed >= latest** → continue. Say nothing.

There is deliberately **no soft-warning path**. An advisory line competing with a
subcommand's own output gets skimmed past and the project stays stale; the gate
either blocks or is silent.

### Upgrading from the block

Offer it, don't do it: `npm install shiplightai@latest` rewrites `package.json`
and `package-lock.json`, so it needs the user's explicit yes rather than arriving
as a surprise diff attached to an unrelated task.

On yes, run the CLI steps in `references/update.md`, then continue with the
subcommand the user originally asked for — the gate is a detour, not a dead end.
On no, stop; do not run the subcommand against a stale CLI.
