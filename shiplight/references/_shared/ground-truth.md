# Shared: Ground-truth precedence

When sources disagree, this precedence applies. Consumed by `cover`,
`create-yaml-tests`, `fix` (and any subcommand that edits specs or tests).

1. Explicit user instruction
2. Feature or journey spec in `specs/tests/`
3. Existing YAML test `goal`, step `intent`, and `VERIFY` assertions
4. Current app behavior
5. Project context in `specs/context.md` and `knowledge/`
6. Agent docs in this skill
7. Agent inference

If current app behavior conflicts with a spec or test goal, **report the
mismatch**. Do not silently rewrite intent to match current behavior. If intended
product behavior genuinely changed, update the matching spec before updating YAML.
