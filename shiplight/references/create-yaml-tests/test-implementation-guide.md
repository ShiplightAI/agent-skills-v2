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

## The `js:` key — one model

`js:` always means the same thing: run this Playwright code in the **test
context (Node.js)** instead of asking the AI. The scope is always the same —
`page`, `expect`, and `agent` are available and `await` is allowed.
`document`/`window` are **not** defined; browser-side state must go through
`page.evaluate(() => ...)`. What varies by statement type:

| Statement | Natural language is… | `js:` form | When the JS fails | Self-heals at runtime |
|---|---|---|---|---|
| Code (`description:` + `js:`) | label only | statement block | test fails | no |
| `VERIFY:` + `js:` | the assertion — AI fallback intent | one `expect()` assertion | AI re-checks the natural-language assertion | **yes** |
| `IF:` / `WHILE:` `"js: ..."` | *(absent)* | single expression | a throw fails the test; falsy just takes the other branch / ends the loop | no |
| `WAIT_UNTIL:` + `js:` | the intent — label + regeneration source | single expression | never fails — warning in the step result, test continues at timeout | no at runtime; regenerate from intent when authoring |

Why only VERIFY falls back to AI: fallback exists only where failure is
detectable at runtime. An assertion throws when it is wrong; a wait cannot
distinguish "not yet" from "never", and a stale selector can turn a wait
predicate truthy instantly — there is no failure signal to fall back on.

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
DOM changes. Prefer `js:` conditions for counter/state logic (e.g.
`js: retryCount < 3`) and avoid them for DOM inspection: a renamed selector would
break the branch, and unlike a natural-language condition a `js:` check does not
self-heal. (`WAIT_UNTIL` deliberately inverts this trade-off — see Waiting below.)

## Waiting

- `WAIT:` is a fixed-duration pause. Use only for known delays.
- `WAIT_UNTIL:` polls a condition until met or timed out. **Always author the
  intent + `js:` form**: keep the natural-language description of what the wait
  is for in `WAIT_UNTIL:`, and attach the cheap predicate as a sibling `js:` key:

  ```yaml
  - WAIT_UNTIL: The dashboard has finished loading
    js: "(await page.locator('.spinner').count()) === 0"
    timeout_seconds: 10
  ```

  When `js:` is present it is polled exclusively, in-process, with **no model
  calls** — there is no AI fallback (unlike VERIFY). The intent is what reports
  show and what regenerates the predicate when the DOM drifts. Never author the
  bare `WAIT_UNTIL: "js: ..."` prefix form (legacy, read-only), and never combine
  the prefix form with a sibling `js:` (validation rejects it).
  - **The DOM rule inverts here vs IF/WHILE: prefer `js:`, and DOM predicates are
    fine.** IF/WHILE avoid `js:` DOM checks to keep self-healing, and can afford
    to: the condition runs once (IF) or per-iteration (WHILE), so an AI check is
    cheap. A `WAIT_UNTIL` re-checks on *every poll*, so an AI condition costs a
    model call per poll (up to ~10 per wait) — far more than the one-time
    self-heal is worth.
  - Write a boolean-returning expression against the Playwright `page`, e.g.
    `js: (await page.locator('.spinner').count()) === 0`. There is **no**
    `document`/`window` in scope — the predicate runs in the Node test context,
    so `js: !document.querySelector('.spinner')` errors on every poll and the
    wait silently burns the full timeout. For browser-side state, wrap it:
    `js: await page.evaluate(() => document.readyState === 'complete')`.
    A Playwright `waitFor()` resolves to `undefined` and never registers as met —
    don't use it as the predicate.
  - Use a natural-language condition alone only when the wait is genuinely
    semantic (no reliable selector, or the check can't be expressed as a short
    predicate).
- **A wait is not a gate.** `WAIT_UNTIL` never fails the test: when the timeout
  expires, the step records a warning and the test continues. If correctness
  depends on the condition ("the order confirmation appeared"), follow the wait
  with a `VERIFY:` — that is what fails the test when the condition never held.

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
