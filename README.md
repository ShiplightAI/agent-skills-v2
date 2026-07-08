# Shiplight Agent Skills

AI-powered test automation for your coding agent — ship with confidence by letting it verify, test, review, and fix autonomously.

Single source of truth for every agent (Claude Code, Cursor, Codex, and [40+ more](https://github.com/vercel-labs/skills#supported-agents)). Install with [`skills`](https://www.npmjs.com/package/skills) and the MCP server with [`add-mcp`](https://www.npmjs.com/package/add-mcp).

> **v2** ships everything as a **single `/shiplight` skill** with subcommands, instead of many top-level slash commands. You invoke `/shiplight <subcommand>` (e.g. `/shiplight verify`), and the skill routes to the right workflow. Natural phrasing works too — `/shiplight screenshot the change` resolves to `verify`.

## Prerequisite

All subcommands depend on the [Shiplight MCP server](https://www.shiplight.ai). Install it once for your agent (see [Install](#install) below), or run:

```bash
npx add-mcp "npx -y @shiplightai/mcp@latest" -n shiplight --env PWDEBUG=console
```

## Usage

One entry point routes to every workflow:

```
/shiplight <subcommand> [context]
```

- `/shiplight` alone (or `/shiplight help`) shows the menu.
- `/shiplight help <subcommand>` explains a subcommand without running it.
- Subcommands match natural phrasing, so you don't need the exact token — `/shiplight set up tests for my app` → `cover`, `/shiplight show failing tests` → `cloud`.

## Subcommands

### Setup

| Subcommand | Purpose |
|------------|---------|
| `init` | Scaffold a Shiplight test project and write `specs/context.md` |
| `auth` | Set up or repair login and saved storage state |
| `update` | Refresh installed Shiplight skills |

### Author

| Subcommand | Purpose |
|------------|---------|
| `create-yaml-tests` | Implement deterministic YAML E2E tests from a spec — plan, scaffold, and write by walking through the app |
| `create-agent-verification` | Create a reusable coding-agent-driven verification script that runs against a live environment (browser, API, DB, logs) with auditable PASS/FAIL reports |
| `cover` | Decide the test format and effort, plan, drive the producers, and report what was tested and by what type |

### Maintain

| Subcommand | Purpose |
|------------|---------|
| `fix` | Reproduce failing or drifted tests, diagnose root causes, repair the YAML, and report app bugs |

### Check

| Subcommand | Purpose |
|------------|---------|
| `verify` | Visually confirm UI changes in the browser during local development |

### Review

`review` is a single entry point that triages your app and runs the right domain reviews, or jump straight to one with `/shiplight review <domain>` (e.g. `/shiplight review security`).

| Subcommand | Purpose |
|------------|---------|
| `review` | App-quality review across domains: **security** (OWASP, auth, injection, access control, supply chain), **privacy** (PII, consent, tracking, data flows, user rights), **compliance** (HIPAA, SOC 2, PCI-DSS, GDPR), **design** (visual, responsive, accessibility, typography, i18n), **resilience** (error handling, degradation, edge states, API contracts), **performance** (Core Web Vitals, bundles, runtime), **SEO** (meta, structured data, crawlability), **GEO** (AI citation readiness, llms.txt, entity clarity) |

### Ship

| Subcommand | Purpose |
|------------|---------|
| `ci` | Wire CI workflows and the failure-triage pipeline |
| `cloud` | Read Shiplight Cloud (Nova) results — runs, failing/flaky tests, artifacts (subscription required) |

### Help

| Subcommand | Purpose |
|------------|---------|
| `help` | List subcommands, or `help <subcommand>` for details — never executes |

## Install

### Claude Code

```bash
npx -y skills add ShiplightAI/agent-skills-v2 -a claude-code -y && \
npx -y add-mcp "npx -y @shiplightai/mcp@latest" -n shiplight --env PWDEBUG=console -a claude-code -y
```

### Cursor

```bash
npx -y skills add ShiplightAI/agent-skills-v2 -a cursor -y && \
npx -y add-mcp "npx -y @shiplightai/mcp@latest" -n shiplight --env PWDEBUG=console -a cursor -y
```

Cursor disables newly-added MCP servers by default. Enable it: **Cursor → Settings… → Cursor Settings → Tools & MCPs → Installed MCP Servers → shiplight (Disabled)** — toggle the switch to enable.

### Codex

```bash
npx -y skills add ShiplightAI/agent-skills-v2 -a codex -y && \
npx -y add-mcp "npx -y @shiplightai/mcp@latest" -n shiplight --env PWDEBUG=console -a codex -y
```

### Any other agent

Pick from [supported agents](https://github.com/vercel-labs/skills#supported-agents) and swap the `-a` flag. Use `--all` to install to every detected agent, or `-g` for a user-level (global) install.

```bash
npx skills add ShiplightAI/agent-skills-v2 --all
```

Restart your agent after installing.

## Update

```bash
npx skills update
```

Shiplight also runs an opportunistic daily update check. On a subcommand invocation, the skill uses `.shiplight-agent-skills-last-update` as a project-local attempt timestamp. On first use, if the file does not exist yet, the agent creates it and skips the update so a newly installed project does not pay for a second install. After that, the agent runs `npx -y skills@latest update -y` at most once every 24 hours. Treat this file as local cache and do not commit it.

## Links

- [Shiplight](https://www.shiplight.ai)
- [Documentation](https://docs.shiplight.ai/getting-started/quick-start.html)
- [`skills` CLI](https://github.com/vercel-labs/skills)
- [`add-mcp` CLI](https://github.com/neondatabase/add-mcp)
</content>
</invoke>
