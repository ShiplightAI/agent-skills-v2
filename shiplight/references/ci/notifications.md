# CI option — Publish triage outcomes

Read this only when the user asks to send triage results to a customer-owned
notification or incident system.

Add a normal caller-owned job after the reusable `triage` job. Give provider
credentials only to this job; never pass them through triage's `extra_env`.

```yaml
  publish-triage-incidents:
    needs: triage
    if: >-
      ${{ always() &&
          (github.event.workflow_run.conclusion == 'failure' ||
           github.event.workflow_run.conclusion == 'timed_out') }}
    continue-on-error: true
    runs-on: ubuntu-latest
    permissions:
      actions: read
    steps:
      - uses: actions/download-artifact@v4
        with:
          name: triage-context
          path: /tmp/triage-context

      - name: Publish incidents
        env:
          INCIDENT_API_TOKEN: ${{ secrets.INCIDENT_API_TOKEN }}
        run: ./scripts/publish-ci-incidents /tmp/triage-context/verdict.json
```

The repository owns `scripts/publish-ci-incidents`; do not invent a provider
implementation without the user's requested system and field mapping.

`verdict.json` contains `failures[]` entries with the test, classification,
confidence, `fixable`, and stable `dedup_key`. Choose the caller policy: notify
all failures, create incidents only for non-fixable failures, or route by
classification. Use `dedup_key` or an equivalent stable customer-visible key to
update an existing incident instead of creating one on every retry.

Each `autofix-result-*` artifact records whether repair was skipped, whether it
changed files, verification status, PR URL, and target test. Download those in a
separate downstream job only when post-autofix notifications are requested.
