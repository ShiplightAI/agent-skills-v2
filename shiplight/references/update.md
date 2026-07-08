# update — Refresh installed Shiplight skills

Explicit, user-requested skill refresh. Unlike the automatic daily check in
`_shared/update-check.md`, this **always** runs the update regardless of the
timestamp:

1. Run `npx -y skills@latest update -y`.
2. Update the `.shiplight-agent-skills-last-update` timestamp (even on failure).
3. Report what changed, or the failure, briefly.
