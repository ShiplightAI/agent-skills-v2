# CI option — Automated failure triage and autofix

Read this only when automated diagnosis/autofix is requested and a test workflow
already exists. The shared pipeline reads failed-run logs and uploaded report
artifacts, classifies failures, repairs fixable spec issues, verifies the repair,
and opens a PR. It never auto-merges.

The caller workflow owns its `workflow_run` trigger and credential mapping. The
reusable pipeline lives in [ShiplightAI/ci-triage].

**Resolve the current release tag before writing any workflow.** Do not copy a
version out of this document — it goes stale on every ci-triage release:

```sh
git ls-remote --tags --refs https://github.com/ShiplightAI/ci-triage 'v*.*' \
  | sed 's#.*refs/tags/##' | sort -V | tail -1
```

Substitute that tag for `@vX.Y` in every `uses:` below, including the asset
workflow. Pattern `v*.*` skips the bare `v1` pointer, which is not maintained;
`--refs` drops the dereferenced `^{}` entries. Release tags are immutable
pins — the upstream `release-tags` ruleset blocks deletion, update, and
non-fast-forward on `refs/tags/v*` — so a resolved tag needs no SHA.

This workflow includes autofix and PR creation, not diagnosis alone. If the user
asks only for “triage” without mentioning repair, explain the write behavior and
confirm autofix before adding the workflow. Do not use it for a diagnosis-only
request.

## 1. Upload triage evidence from the test workflow

After the test step, add this separately from `npx shiplight report`:

```yaml
      - name: Upload test report for triage
        if: ${{ !cancelled() }}
        uses: ShiplightAI/ci-triage/upload-report@vX.Y
        with:
          report-dir: shiplight-report
          # Sharded jobs also need a unique artifact name:
          # name: test-report-shard-${{ matrix.shardIndex }}
          # retention-days: "1"
```

The helper removes Playwright trace ZIPs and videos from this GitHub artifact;
the separate cloud report retains the complete evidence.

For a test project in a subdirectory, `defaults.run.working-directory` does not
affect this `uses:` step. Set the action's literal path explicitly:

```yaml
        with:
          report-dir: <project-dir>/shiplight-report
```

Never derive `report-dir` from attacker-controlled input.

## 2. Add the caller workflow

Create `.github/workflows/ci-failure-triage.yml` at the repository root, using
`assets/ci-failure-triage.yml` as the baseline and adapting it to the repository.

- `workflows:` must contain the exact top-level `name:` of each test workflow to
  watch. Never list the triage workflow itself.
- Mirror the test workflow's app credential environment through `extra_env`.
  Keep provider/incident credentials out of `extra_env`.
- Provide at least one primary model credential:
  `claude_code_oauth_token` or `anthropic_api_key`. `openai_api_key` enables the
  Codex fallback. `autofix_github_token` is optional.
- `autofix-runner` re-runs tests and needs browsers and network. Use a Shiplight
  runner or another runner image with Chromium already installed. The reusable
  workflow exposes no caller hook that installs Chromium, so plain
  `ubuntu-latest` is unsupported for autofix.
- Verify that the selected `autofix-runner` label is configured and available to
  the repository before copying the asset's `shiplight-medium` default. If no
  eligible runner exists, stop and report the runner setup as a prerequisite.
- Set `working-directory` only when `package.json` and `playwright.config.ts`
  live below repository root. `allowed-paths` and verdict `target_file` values
  are relative to it.
- Keep `allowed-paths` limited to the test directories the agent may repair.
- This pipeline receives write permissions and live credentials. Use a protected
  immutable release tag, never a branch such as `@main`.

## 3. Add notifications only when requested

The reusable workflow publishes `triage-context` and `autofix-result-*`
artifacts; it does not contact customer systems. Read `notifications.md` only
when the user asks to consume those artifacts.

[ShiplightAI/ci-triage]: https://github.com/ShiplightAI/ci-triage
