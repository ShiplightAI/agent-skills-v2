# update — Refresh installed Shiplight skills and the `shiplightai` CLI

Explicit, user-requested refresh. Unlike the automatic check in
`_shared/update-check.md`, this **always** runs regardless of the timestamp — and
it is the **only** path allowed to modify the project's `package.json` /
`package-lock.json`.

## 1. Skills

1. Run `npx -y skills@latest update -y`.
2. Update the `.shiplight-agent-skills-last-update` timestamp (even on failure).

## 2. CLI

Record the version before and after, so the report can name the delta:

    node -p "require('./node_modules/shiplightai/package.json').version"

(This section is also what `_shared/update-check.md` runs when the user accepts
the upgrade offered at its version gate.)

1. Run `npm install shiplightai@latest` in the test project root.
   - Plain `npm install` will **not** bump it. A `latest` or `^0.1.x` spec in
     `package.json` is already satisfied by the version pinned in
     `package-lock.json`, so npm considers the tree up to date and does nothing.
     Only an explicit `@latest` re-resolves the dist-tag and rewrites the lock.
     `npm ci` — what CI runs — is stricter still: pure lockfile, no resolution.
   - The dep lives in `dependencies`, so no `--save-dev`.
2. Re-read the version to confirm the bump actually landed.

## 3. Report

Briefly: the skill-update result, and the CLI version delta (`0.1.84 → 0.1.93`,
or "already current"). Name failures rather than swallowing them.

When the CLI version changed, say so explicitly: **`package.json` and
`package-lock.json` are now modified and need to be committed.** CI installs
straight from the lockfile, so an uncommitted bump leaves every CI run on the old
CLI — the exact drift this subcommand exists to close.
