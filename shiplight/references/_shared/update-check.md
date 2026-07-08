# Shared: Daily skill update check

Run this once per `/shiplight` invocation, before the selected subcommand's work.

1. Check the timestamp file `.shiplight-agent-skills-last-update` in the current
   project.
2. If it is **missing**, create it with the current timestamp and continue
   **without** running an update (a freshly installed project should not pay for
   a second install). Treat the file as local cache — do not commit it.
3. If it **exists and is older than 24 hours**, run
   `npx -y skills@latest update -y`, then create/update the timestamp file even
   if the command fails.
4. If the update command fails, continue with the currently installed skill and
   mention the failure briefly.

This is the automatic check. The explicit, user-requested refresh is the
`update` subcommand (`references/update.md`), which always runs the update
regardless of the timestamp.
