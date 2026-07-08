# init — Scaffold a Shiplight test project + write context

Greenfield setup: scaffold the Shiplight project files, then discover and write
`specs/context.md`. Run once per project. `cover` invokes this as conditional
step-0 on the Shiplight-format branch; `create-yaml-tests` and `fix` assume an
initialized project.

> **Confirm before scaffolding a non-empty project.** Scaffolding merges into an
> existing repo — never overwrite the user's files; resolve conflicts (below).

## Read first

- `_shared/project-layout.md` (canonical layout + edit contract)
- `_shared/knowledge.md`, `_shared/secrets.md`

## 1. Identify the project root

All paths are relative to the Shiplight test project root. If it's not clear, ask
the user to confirm before creating or moving files.

## 2. Scaffold

Call the `scaffold_project` MCP tool against the project root — even if the
directory already contains a repo, `.env`, or its own `package.json`. The tool
writes any missing files and reports the rest under `files_needing_agent_merge`.

Do not pre-create empty directories — create them only when you have content to
place in them.

### Resolve scaffold_project conflicts

When the target was empty, `files_needing_agent_merge` is empty — proceed. When the
user already had files, it contains one entry per conflict. For each entry: Read
the file at `abs_path`, apply the change described by `merge_strategy` and
`instructions` using the supplied `template` (and `lines_to_ensure` / `merge_key`
when present) as the source of truth, and write the merged result back with Edit
(preferred) or Write — **never delete the user's existing content**.

| Strategy | Typical file | What to do |
|----------|--------------|------------|
| `json_merge_deps_and_scripts` | `package.json` | Add missing deps + `test`/`test:headed` scripts. Don't change `name`, `version`, or other fields. Ask before flipping `type` to `"module"`. |
| `append_missing_lines` | `.gitignore` | For each line in `lines_to_ensure`, append if absent. Group under a `# Shiplight` block. |
| `json_merge_under_key` | `.mcp.json` | Add the template's entries under `merge_key` (e.g. `mcpServers`). Don't overwrite a server name the user already has. |
| `append_missing_env_keys` | `.env.example` | For each `KEY=` line in the template, append (preserving commented form) only if `KEY` isn't already mentioned. |
| `review_and_decide` | `playwright.config.ts` | Show the user the template; ask whether to replace, merge `...shiplightConfig()`, or leave alone. Don't modify without confirmation. |

Resolve every entry before `npm install` — a skipped merge usually leaves the
project unable to run Shiplight tests. Then run `npm install`.

## 3. Discover & write `specs/context.md`

Understand the application, user goals, risks, target deployment, auth needs, and
data strategy. Before asking questions, scan available context: existing
`specs/context.md` and `specs/tests/`; codebase routes, components, framework, and
`package.json`; the git branch diff; existing tests; README/PRDs/docs; existing
`knowledge/` notes.

Write or update `specs/context.md` with:

- **App profile** — name, framework, key pages and features
- **Risk profile** — what matters most and what is fragile
- **Testing scope** — in-scope and out-of-scope areas
- **User roles** — roles and permission levels to cover
- **Data strategy** — how test data is created and cleaned up
- **Targets** — base URLs, auth method, special setup
- **Known facts and decisions** — durable preferences and constraints
- **Open questions** — unresolved or stale questions

Do not store raw secrets (`_shared/secrets.md`).

## Next

Once initialized, author tests with `create-yaml-tests` /
`create-agent-verification`, or let `cover` drive the full create-flow.
