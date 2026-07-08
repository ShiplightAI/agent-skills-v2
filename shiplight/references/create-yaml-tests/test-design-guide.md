# E2E Test Design Guide

What to test and how to structure tests. YAML-family guide — also read by `fix`.

## Test isolation

Each test must run independently. Never depend on another test's side effects,
execution order, or leftover state. If a test needs data, it creates that data
itself.

## One journey per YAML test

Each YAML test verifies one logical user journey or variant. If step 3 of 8
fails, steps 4–8 give no useful information — split long flows into focused tests.
Suites may express sequential dependencies when necessary (upload then download);
each test in the suite should still cover one journey.

## Specs can be broader than YAML tests

A spec under `specs/tests/` can cover a feature or journey group and may map to
multiple smaller YAML tests. Use specs for product confidence and YAML files for
executable coverage.

## Assert what users see

Test visible outcomes: text, navigation, enabled/disabled states, user-observable
data. Don't assert CSS classes, data attributes, internal state, or DOM structure
unless there's no user-visible alternative.

## Focused assertions

Verify the one thing that proves the behavior works. Over-asserting makes tests
brittle and causes failures on cosmetic changes.

## Never test third-party services

Don't assert that Stripe checkout, Google OAuth consent, or Twilio delivery works.
Mock external services at the boundary where possible. Test your integration, not
their UI.

## Deterministic test data

Use unique identifiers per test run to avoid collisions. Never rely on hardcoded
data that other tests or users might modify.

## Prefer API seeding over UI setup

When a test needs preconditions, set them up by API or helper function when
possible. UI setup is slow and often tests the wrong thing.

## Explicit wait policy

Minimize explicit waits. Browser actions, navigation, and assertions already
include waiting behavior. Don't add waits after ordinary page loads, clicks, form
submits, or data refreshes just because the UI might change — let the next action
or assertion prove expected state.

## Test error states

Critical journeys should include at least one meaningful error or edge case.
Happy-path-only coverage gives false confidence.

## Design for parallel execution

Tests that modify shared global state cannot safely run in parallel. Prefer unique
per-test data, no global configuration changes, and clear documentation for tests
that must run serially.

## Flaky test policy

A test that passes on retry is still broken. Do not add retries to mask flakiness.

- Timing flake: rely on the next action/assertion first; add targeted waits only
  when necessary.
- Data flake: use unique data and cleanup.
- Order flake: remove hidden dependency on another test.
- Environment flake: mock unstable external services where possible.
