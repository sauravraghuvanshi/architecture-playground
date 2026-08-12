# Contributing

Thanks for considering a contribution. The Diagrammatic workspace is a Next.js
app with several modes (architecture, flowchart, mind map, sequence, ER, UML,
C4, Kanban, whiteboard) layered on `@xyflow/react`, `dnd-kit`, and Excalidraw.
See `docs/security.md` for the security baseline and
`docs/development-log-2026-08-11.md` for the latest implementation retrospective.

## Local setup

```bash
git clone https://github.com/sauravraghuvanshi/architecture-playground
cd architecture-playground
npm install
npm run build:icon-manifest
npm run build:whiteboard-assets
npm run dev          # starts Next.js on :3000
```

Optional environment variables (place in `.env.local`):

```
AZURE_OPENAI_ENDPOINT=https://<your-resource>.openai.azure.com
AZURE_OPENAI_API_KEY=...
AZURE_OPENAI_DEPLOYMENT=gpt-4o
AZURE_OPENAI_IMAGE_ENDPOINT=https://<your-image-resource>.openai.azure.com
AZURE_OPENAI_IMAGE_API_KEY=...
AZURE_OPENAI_IMAGE_DEPLOYMENT=gpt-image-2
```

Without chat credentials, prompt-to-diagram AI is disabled. During development,
Whiteboard image AI can use the public Diagrammatic proxy; set
`DIAGRAMMATIC_AI_PROXY_URL=disabled` to opt out.

The optional shared access gate uses `APP_AUTH_ENABLED`, `APP_AUTH_USERNAME`,
`APP_AUTH_PASSWORD`, and a minimum 32-character `APP_AUTH_SECRET`. Never commit
populated values.

## Project layout (high level)

| Path                                         | Purpose                                      |
|----------------------------------------------|----------------------------------------------|
| `app/`                                       | Next.js App Router pages + API routes        |
| `app/diagrammatic/`                          | Workspace landing — server component         |
| `app/api/ai/{generate,image,status}/`        | AI endpoints (rate limited)                  |
| `components/diagrammatic/Workspace.tsx`      | Top-level shell, mode tab strip, panels      |
| `components/diagrammatic/modes/<m>/`         | One per mode (Canvas + templates.ts)         |
| `components/diagrammatic/shared/`            | Toolbar, Palette, Inspector, panels, modals  |
| `components/diagrammatic/csa/`               | CSA guidance, assessment, code, deployment  |
| `lib/ai-mode-prompts.ts`                     | Per-mode AI system prompts                   |
| `lib/architecture-review.ts`                 | Structured Azure review schema and prompt   |
| `lib/ai-rate-limit.ts`                       | In-memory token bucket                       |
| `lib/auth.ts`                                | Credential and signed-session helpers        |
| `middleware.ts`                              | Access gate + security headers               |
| `e2e/`                                       | Playwright smoke tests                       |
| `inbox_entries/phase-*-parked.md`            | Notes on deliberately deferred work          |

## Adding a new diagram mode

1. Create `components/diagrammatic/modes/<mode>/Canvas.tsx`. Implement the
   `BaseCanvasHandle` contract from `shared/modeRegistry.ts` (most modes use
   the `shared/useFlowCanvas` hook to do the boilerplate).
2. Create `components/diagrammatic/modes/<mode>/templates.ts` with at least
   one `ModeTemplate`.
3. Register both in `shared/modeCatalog.tsx` via a dynamic import.
4. Add a smoke test row to `e2e/diagrammatic-modes.spec.ts`.

## Verification before opening a PR

```bash
npm run lint                                    # clean ESLint baseline
npx tsc --noEmit                                # strict type check
npm run test:playground                         # pure unit tests
npx playwright test --project=chromium          # browser regression suites
npm run build                                   # production standalone build
```

Architecture review changes should include both pure validation coverage in
`scripts/test-csa.mjs` and a browser journey in `e2e/csa-guidance.spec.ts`.
Image review accepts only PNG, JPEG, and WebP up to 5 MiB; keep browser and API
validation rules synchronized.

## Commit messages

Conventional-ish: short subject (`Phase X: <thing>`), optional body. We
co-author commits with Copilot when AI assistance was used:

```
Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>
```

## Code style

- TypeScript strict; avoid `any`. Prefer narrowing with type guards over
  type assertions.
- Functional React with hooks. Keep components <500 lines; split when bigger.
- Comments for *why*, not *what* — the code already says what.
- Tailwind for styling; no CSS modules unless absolutely necessary.

## Reporting issues

Open a GitHub issue with:

- What you expected
- What actually happened
- Steps to reproduce (mode, payload, browser)
- Console / network errors

For security issues see `docs/security.md`.
