# CI runner — GitHub-hosted

Read this only for a stock GitHub-hosted runner.

## Requirements

- Create an organization API token at <https://nova.shiplight.ai/api-tokens>.
- Store it as a repository or organization secret named
  `SHIPLIGHT_API_TOKEN`.
- Put `SHIPLIGHT_API_TOKEN` at job `env` scope because every `npx shiplight`
  command needs it.
- Set `SHIPLIGHT_REPORT_TO_CLOUD=1` on the report step.
- Install Chromium and its operating-system dependencies before running tests.

Use `assets/e2e-github-hosted.yml` as the root-project baseline. Merge it into
an existing workflow when one exists. Adapt the Node version, package-manager
install command, triggers, and test command to the repository's established
choices; do not introduce a second package manager.

For a project in a subdirectory, prefer `working-directory` on each Shiplight
`run:` step when merging into an existing job. Use job-level
`defaults.run.working-directory` only when every existing `run:` step belongs to
that project. Defaults affect only `run:` steps, not actions invoked with
`uses:`. Keep `actions/checkout` at repository root.

The finished job must retain:

- `npx playwright install --with-deps chromium` before the test run;
- `npx shiplight test` or the repository's equivalent Shiplight test script;
- `npx shiplight report` with `if: always()` and
  `SHIPLIGHT_REPORT_TO_CLOUD=1`.
