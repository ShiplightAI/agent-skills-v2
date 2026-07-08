# YAML Authoring Reference

YAML syntax and actions. YAML-family guide — also read by `fix`. Read the MCP
resources first; they are the source of truth.

## YAML format reference

- `shiplight://yaml-test-spec` — the full YAML language spec (top-level keys,
  statement syntax).
- `shiplight://schemas/action-entity` — the full list of actions and parameters.

## Statement type selection

- **ACTION** is the default. Capture locators with browser tools, then write
  ACTION statements.
- **DRAFT** is a last resort — only when the locator is genuinely unknowable at
  authoring time.
- **VERIFY** is for assertions.
- **URL** is for navigation. Prefer `URL: /path` over a go-to-url action.
- `description:` + `js:` is for network mocking, localStorage manipulation, or
  page-level scripting. Do not use raw JS for clicks, normal assertions, or
  navigation.

## Intent field

`intent` defines what the step should accomplish; `action` and `locator` are
caches of how to do it. When a cache fails, the agent uses `intent` to re-inspect
the page and regenerate the action — intent must be specific enough to act on
without chat history.

Bad:

```yaml
- intent: Click button
- intent: Click the 3rd button in the form
- intent: Click element at index 42
```

Good:

```yaml
- intent: Click the Submit button to save the new project
  action: click
  locator: "getByRole('button', { name: 'Submit' })"
```

Describe the user goal, not DOM position or implementation detail.

## ACTION format

Use structured ACTION format by default for supported actions. Read
`shiplight://schemas/action-entity` before writing or changing actions.

## VERIFY best practices

`VERIFY:` has two modes:

- Natural language only: AI inspects the page and judges whether the statement is
  true.
- With `js:`: JavaScript runs first as a fast deterministic check; if it throws,
  AI fallback re-inspects the page.

```yaml
- VERIFY: The search dialog is visible.

- VERIFY: The search dialog is visible.
  js: await expect(page.getByTestId('search-dialog-container')).toBeVisible({ timeout: 2000 })
```

Use natural language when there's no reliable locator or the check is semantic.
Use `js:` when there's a stable locator and the assertion can be a simple
Playwright `expect()`.

`js:` rules in VERIFY:

- Keep it to a single simple Playwright `expect()` call.
- `page`, `agent`, and `expect` are available.
- Set a short timeout, such as `{ timeout: 2000 }`.
- Resolve locators to a single element to avoid strict-mode errors.
- Fallback only triggers when `js` throws.

Always use `VERIFY:` shorthand. Do not use `action: verify` directly.

## IF and WHILE conditions

Use natural-language AI conditions for DOM-based checks — they self-heal when the
DOM changes. Use `js:` conditions only for counter/state logic (e.g.
`js: retryCount < 3`), never for DOM inspection.

## Waiting

- `WAIT:` is a fixed-duration pause. Use only for known delays.
- `WAIT_UNTIL:` checks a condition repeatedly until met or timed out. It makes
  model calls, so use only for long conditional waits.

Minimize explicit waits — browser actions, navigation, and assertions already
include waiting. Don't add waits after ordinary page loads, clicks, form submits,
or data refreshes; let the next action or assertion prove expected state.

## File downloads

Downloads are tracked automatically on every page (including popups and new tabs);
each file is saved under the test's output directory `downloads/`. Two primitives
carry download support; everything else is an ordinary step:

1. `action: wait_for_download_complete` — blocks until the tracked download
   finishes (also covers downloads not yet started, so size `timeout_seconds`
   (default 10) to cover server-side generation + transfer).
2. `agent.getRecentDownloadedFilePath()` — call in a `js:` block to get the saved
   file's local path; from there it's a normal file.

```yaml
- intent: Click the Export CSV button
  action: click
  locator: "getByRole('button', { name: 'Export CSV' })"

- intent: Wait for the export download to complete
  action: wait_for_download_complete
  timeout_seconds: 30

- description: Verify the downloaded file is non-empty
  js: |
    const filePath = agent.getRecentDownloadedFilePath();
    expect(filePath).toContain('.csv');
    const fs = await import('node:fs');
    expect(fs.statSync(filePath).size).toBeGreaterThan(0);
```

Only the most recent download is tracked. Wait for and verify each download before
triggering the next.

## General conventions

- Put `intent` first in ACTION statements.
- `xpath` is only needed when an ACTION has no `locator`.
- Use a single-test file for isolated tests.
- Use a suite only when tests have a real sequential dependency.
- Use parameters for the same test structure with different data inputs.
