# Test Spec: <Name>

## Status

Draft

Allowed values: Draft, Ready, Implemented.

## Goal

Describe the user-visible behavior or feature confidence this spec protects.

## User Roles

Describe the users, account types, permission levels, or auth states covered.

## Starting Point

- Base URL: <target URL for this spec>
- Auth: <none, anonymous visitor OR logged in as role/account via shared auth, per-test auth, or existing project auth setup>

## Preconditions

- List required setup, existing account state, feature flags, or app state before tests start.
- Keep concrete records, IDs, names, and generated values in Test Data.

## Journeys And Variants

### <Journey Name>

- Priority: P0 | P1 | P2
- Preconditions:
- Steps:
- Expected result:
- Edge cases:
- Out of scope:

## Test Data

- List concrete records, IDs, names, routes, input values, fixture files, generated data, and uniqueness requirements.
- If data must already exist, include enough detail to locate it deterministically.
- If data is created during a test, describe how it should be named and cleaned up.

## Assertions

- List concrete user-visible checks the executable tests should make.

## Cleanup

- List any state tests must remove, reset, or restore.
- If cleanup is not needed, write: None.

## Implementation Plan

- Test files:
- Implementation order:
- Flakiness risks:
- Data setup:

## Implementation

- Test files:
- Coverage:
- Known gaps:

## Notes

- Add non-obvious assumptions, known product constraints, or open questions.
