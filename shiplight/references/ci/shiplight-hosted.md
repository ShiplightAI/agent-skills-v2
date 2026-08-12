# CI runner — Shiplight-hosted

Read this only for an ephemeral `shiplight-*` runner.

## Requirements

- Install the Shiplight GitHub App on the repository or organization. This can
  require administrator approval.
- Have an organization owner enable runners in Shiplight Org Settings:
  <https://nova.shiplight.ai/org?tab=settings>.
- Do not add `SHIPLIGHT_API_TOKEN`, `SHIPLIGHT_REPORT_TO_CLOUD`, or a Playwright
  browser-install step. The runner provisions credentials and includes Chromium
  with Playwright.

Use `assets/e2e-shiplight-hosted.yml` as the root-project baseline. Merge it into
an existing workflow when one exists. Adapt the package-manager install command,
triggers, and test command to the repository's established choices.

Runner sizes are `shiplight-small` (4 vCPU / 16 GB), `shiplight-medium` (8 / 32),
`shiplight-large` (16 / 64), and `shiplight-xlarge` (32 / 128). Preserve an
existing size; otherwise start with `shiplight-small` unless the user identifies
a larger resource requirement.

For a project in a subdirectory, prefer `working-directory` on each Shiplight
`run:` step when merging into an existing job. Use job-level
`defaults.run.working-directory` only when every existing `run:` step belongs to
that project. Defaults affect only `run:` steps, not actions invoked with
`uses:`. Keep `actions/checkout` at repository root.
