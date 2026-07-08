# Shared: Project layout, edit contract & commands

The canonical layout, the editable vs do-not-edit contract, and the standard
commands for a Shiplight test project. Consumed by `init`, `cover`,
`create-yaml-tests`, `fix`, `ci`. Note the two spec locations are **distinct
artifacts**: `cover`'s `specs/<feature>/test-spec.md` is the format-agnostic
*testing-what contract* (what to prove + priority + modality), while
`specs/tests/*.md` is the *E2E plan* `create-yaml-tests` authors and implements. All paths are relative to the **test project root** —
identify it before reading or writing project files; if it's unclear, ask the
user to confirm before creating or moving files.

## Canonical layout

```text
specs/context.md       project-level app, risk, data, and target-deployment context
specs/tests/           Markdown E2E specs — the plan `create-yaml-tests` implements
specs/<feature>/       `cover` artifacts — test-spec.md (testing-what contract + priority), test-report.md (session record)
tests/                 executable Shiplight YAML tests
playwright.config.ts   project-level Playwright config, shared auth, and runtime defaults
auth.setup.ts          shared-account Playwright auth setup, if needed
auth/                  optional auth helpers or per-test login scripts
templates/             reusable YAML statement groups, if any
helpers/               TypeScript helper functions, if any
fixtures/              fixture files, if any
knowledge/             durable notes discovered by agents
test-results/          generated runtime artifacts; do not edit
shiplight-report/      generated reports; do not edit
.shiplight/            local Shiplight state; do not edit
```

Do not pre-create empty directories — create them only when you have content to
place in them (e.g. don't create `templates/` until you have a template).

> **Scaffolding** a new or existing repo (the `scaffold_project` MCP tool and its
> conflict-merge handling) is the **`init`** subcommand's responsibility. If a
> project isn't scaffolded yet, run `/shiplight init` first.

## Edit contract

Agents **may edit**:

- `specs/context.md`
- `specs/tests/**/*.md`
- `tests/**/*.test.yaml`
- `playwright.config.ts`
- `auth.setup.ts`
- `*.login.ts`, `auth/**/*.login.ts`
- existing project auth helpers referenced by `playwright.config.ts` or YAML `use.account.auth`
- `templates/**/*.tmpl.yaml`
- `helpers/**/*.func.ts`
- `fixtures/**`
- `package.json` only when changing commands or dependencies

Agents **must not edit**:

- `**/*.yaml.spec.ts`
- `test-results/**`, `shiplight-report/**`, `.shiplight/**`, `node_modules/**`
- `.env`, unless the user explicitly asks
- `package-lock.json`, unless a dependency change requires it

## Commands

Use the narrowest relevant command when debugging a specific test.

```sh
npm test
npm run test:headed
npx shiplight test --headed
```

If the project's `package.json` defines a more specific script, prefer it.
