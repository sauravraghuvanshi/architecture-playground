# Contributing

Thanks for considering a contribution. The Diagrammatic workspace is a Next.js
app with several modes (architecture, flowchart, mind map, sequence, ER, UML,
C4, Kanban, whiteboard) layered on `@xyflow/react`, `dnd-kit`, and Excalidraw.
This guide is the short version — see `task/implementation.md` for the long
roadmap and `docs/security.md` for the security baseline.

## Local setup

```bash
git clone https://github.com/sauravraghuvanshi/architecture-playground
cd architecture-playground
npm install
npm run dev          # starts Next.js on :3000
```

Optional environment variables (place in `.env.local`):

```
AZURE_OPENAI_ENDPOINT=https://<your-resource>.openai.azure.com
AZURE_OPENAI_API_KEY=...
AZURE_OPENAI_DEPLOYMENT=gpt-4o
AZURE_OPENAI_IMAGE_DEPLOYMENT=dall-e-3   # optional, enables /api/ai/image
```

Without these, AI features remain visible but disabled (the Sparkles button
shows a tooltip explaining the missing config).

## Project layout (high level)

| Path                                         | Purpose                                      |
|----------------------------------------------|----------------------------------------------|
| `app/`                                       | Next.js App Router pages + API routes        |
| `app/diagrammatic/`                          | Workspace landing — server component         |
| `app/api/ai/{generate,image,status}/`        | AI endpoints (rate limited)                  |
| `components/diagrammatic/Workspace.tsx`      | Top-level shell, mode tab strip, panels      |
| `components/diagrammatic/modes/<m>/`         | One per mode (Canvas + templates.ts)         |
| `components/diagrammatic/shared/`            | Toolbar, Palette, Inspector, panels, modals  |
| `lib/ai-mode-prompts.ts`                     | Per-mode AI system prompts                   |
| `lib/ai-rate-limit.ts`                       | In-memory token bucket                       |
| `middleware.ts`                              | Security headers                             |
| `e2e/`                                       | Playwright smoke tests                       |
| `task/implementation.md`                     | Phased roadmap (source of truth for scope)   |
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
npx tsc --noEmit                                # type check
npm run lint                                    # baseline is 15 problems — keep it that way
npm run build                                   # turbopack build
npx playwright test --project=chromium          # smoke tests
```

The lint baseline is a snapshot of pre-existing issues; do not introduce new
ones. To verify, run `git stash && npm run lint && git stash pop` before and
after your changes and compare counts.

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
