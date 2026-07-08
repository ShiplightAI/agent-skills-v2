# Testing Strategy

Optional project-wide testing posture for the `cover` workflow. It is the
middle tier of strategy resolution: a per-behavior note in `test-spec.md` wins
over this, and this wins over the baked-in default. Delete this file to ride the
baked-in default.

This is **prose guidance a coding agent reads** — not a schema'd config, and not
read by Quality Center scoring (scoring stays transparent, derived from evidence
`type` and observations). Keep it short and specific to what differs from the
default.

## Contexts

Stable labels for where proof runs (they match evidence `contexts`):

- `local` — developer-local, fast iteration.
- `pr-ci` — the default pull-request gate.
- `staging-gate` — pre-release gate.
- <add project lanes, e.g. `keyed-browser`, `opt-in-live`>

## Posture by priority

Priority (P0–P3) is the effort lever — it is declared upstream (PRD / feature
breakdown / spec), never invented here.

- **P0** — at least one automated test (`unit`/`contract`/`integration`/`e2e`/`agent`)
  in a gate context; consider defense-in-depth (≥2 distinct automated layers).
- **P1** — at least one automated test.
- **P2** — a dedicated or workflow-level test.
- **P3 / unknown** — indirect/supporting proof acceptable; absence is a noted gap,
  not a push target.

## Modality preferences

- **Prefer:** <unit, contract, integration — cheap, deterministic proof>
- **Reserve (expensive):** <e2e, agent — for browser/live/product-promise seams>
- **Avoid by default:** <manual — last resort / un-automatable only>

## Floors (non-negotiable)

- Unit coverage on core and changed logic.
- At least one gate on every P0 check.

## Project notes

<Project-specific rules, e.g. "shared engine changes must be proven at the seam
they ship through"; "use live or keyed proof only when deterministic layers
cannot prove the promise".>
