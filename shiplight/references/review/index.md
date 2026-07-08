# review — App-quality review (orchestrator)

The single entry point for application reviews. Triages what matters, runs one or
more domain reviews, and merges them into a unified report. Each domain lives in a
sibling file (`security.md`, `privacy.md`, …) and is loaded only when selected.
This is a **two-level router**: `/shiplight review` → here → domain.

## When to use

- User wants a review but isn't sure which kind
- Pre-launch readiness assessment
- Post-incident review planning
- A targeted request for one domain ("check my app's security", "review SEO")

## Modes

The router passes the remainder after `review` as the selector:

- **Triage** (default, `/shiplight review`) — ask context questions, recommend a
  plan, run it.
- **Full suite** (`/shiplight review --all`) — run every applicable domain.
- **Targeted** (`/shiplight review <domain>`) — jump straight into one domain,
  skipping triage (e.g. `/shiplight review security`, `/shiplight review seo`).
  Accepts an optional depth flag (`--quick` / `--thorough`).

## Domains

Each row maps to a sibling reference file. Load it only when the domain is selected.

| Domain | Reference | Run it when… (trigger signals) |
|--------|-----------|-------------------------------|
| security | `security.md` | auth/login changes, sensitive data, OWASP, headers/CORS/CSP, supply chain |
| privacy | `privacy.md` | collects PII, tracking/analytics, consent banners, GDPR/CCPA |
| compliance | `compliance.md` | regulated industry, audit prep, HIPAA/SOC 2/PCI-DSS/GDPR, payments or health data |
| design | `design.md` | UI shipping without a designer, responsive, accessibility, typography, i18n |
| resilience | `resilience.md` | error handling, network/API failures, empty/edge states, degradation |
| performance | `performance.md` | slow pages, Core Web Vitals, bundle size, runtime/render perf |
| seo | `seo.md` | public site, meta tags, structured data, crawlability, sitemaps |
| geo | `geo.md` | discovered via AI assistants, LLM citation readiness, llms.txt, entity clarity |

Shared conventions (phases, scoring, confidence, severity, output paths) live in
`report-format.md` — every domain follows them. The browser-evidence protocol is
`_shared/evidence-and-report.md` (shared with `verify`).

## Steps

### 1. Gather context

- Read the project: tech stack, framework, `package.json`, routes, components.
- Check `git diff` for recent changes.
- Look for existing reports in `shiplight/reports/`.
- Auto-detect compliance markers (HIPAA/PHI, PCI/payment fields, GDPR/cookie consent).

If invoked as `/shiplight review <domain>`, skip to step 4 for that domain.

### 2. Ask targeted questions (max 4)

One at a time, with auto-detected defaults:

1. **What type of application?** (SaaS, healthcare, fintech, e-commerce, internal tool, marketing site, API-only)
2. **What triggered this review?** (pre-launch, new feature, dependency update, security incident, audit prep, routine)
3. **Any compliance requirements?** (none, HIPAA, SOC2, PCI-DSS, GDPR, multiple) — auto-detect from codebase
4. **Specific concerns?** (open-ended, optional)

### 3. Generate review plan

Categorize each applicable domain as **CRITICAL** (must run), **RECOMMENDED**
(meaningful value), or **OPTIONAL** (nice to have), with estimated depth
(quick / standard / thorough).

**SEO vs GEO prioritization by product type:**

| Product type | SEO | GEO |
|---|---|---|
| Developer tools, API products, SaaS | RECOMMENDED | CRITICAL |
| E-commerce, local business, marketplace | CRITICAL | OPTIONAL |
| Content/media, documentation, blog | CRITICAL | CRITICAL |
| Internal tools | — | — |

Present a decision matrix (Review | Priority | Rationale | Depth).

### 4. Execute

Ask: "Run all CRITICAL reviews now? [Y/n] Or pick specific ones."

For each selected domain, **read `<domain>.md` and follow its five phases**,
applying `report-format.md` for scoring, severity, and output paths. Run domains
sequentially; show a brief summary after each before moving on.

### 5. Unified report

Merge the per-domain reports into one, saved to
`shiplight/reports/review-{date}.md`:

- Overall readiness score (0–10) and per-domain scores
- Top 5 findings across all domains, by severity
- Regression test summary (total YAML tests generated, in `tests/`)

## Tips

- Run `/shiplight review` before every major launch.
- `/shiplight review <domain>` is the fast path when you already know what you need.
- Reports accumulate in `shiplight/reports/`; YAML regression tests from reviews
  accumulate in `tests/` — the orchestrator can show trends.
