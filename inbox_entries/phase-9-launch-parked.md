# Phase 9 — Marketing landing + perf + docs site (PARTIALLY PARKED)

**Status**: legal + a11y nudges shipped; marketing/perf/docs site parked.

## What's shipped

- `LICENSE` — MIT.
- `CONTRIBUTING.md` — local setup, project layout, mode-add walkthrough,
  verification commands, commit conventions.
- `CODE_OF_CONDUCT.md` — Contributor Covenant 2.1.
- A11y nudge on the mode tab strip: proper `role="tablist"` /
  `role="tab"` / `aria-selected` semantics on the workspace mode switcher.
- Existing `docs/security.md` (Phase 8).

## What's parked

| Plan item                                | Why parked                                           |
|------------------------------------------|------------------------------------------------------|
| Marketing landing redesign               | Hub at `/` already in place; redesign requires copy + design pass beyond the engineering scope |
| Perf budget + Lighthouse CI              | Needs CI runner + budget thresholds — adopt when GitHub Actions setup lands |
| Full a11y audit (axe, focus traps, kbd)  | Single nudge shipped; comprehensive sweep deserves its own milestone with manual SR testing |
| Docs site (Docusaurus / Nextra)          | `docs/` directory is sufficient at current scale; promote when ≥ 10 pages exist |
| Telemetry / product analytics            | No analytics vendor selected; privacy implications need review |
| i18n / RTL                               | Single-locale (en) for now; add when first non-en deployment requested |

## Migration path

1. Pick an analytics vendor (Plausible / PostHog) → wrap in a thin client
   that's no-op when unconfigured (mirror `/api/ai/status` pattern).
2. Add `playwright-axe` smoke tests under `e2e/` — reuse the existing mode
   smoke spec scaffolding.
3. Lighthouse CI in GitHub Actions: budget JSON, fail PR on regression.
4. Copy/design pass on `/` once a designer is engaged.
5. Promote `docs/` to Nextra when content exceeds 10 pages.

The legal/a11y baseline is in place and won't churn.
