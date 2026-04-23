# Architecture Playground — Copilot / Claude Workspace Instructions

> Standalone Next.js app extracted from the portfolio. Read this file FIRST at every session start.

## Project

| Field | Value |
|---|---|
| **Name** | Architecture Playground |
| **Owner** | Saurav Raghuvanshi (Digital Cloud Solution Architect @ Microsoft) |
| **Stack** | Next.js 16 App Router · TypeScript · React 19 · Tailwind v4 · React Flow (`@xyflow/react`) · Framer Motion · `gifenc` (web worker) · `html-to-image` |
| **Repo (planned)** | `sauravraghuvanshi/architecture-playground` |
| **Live (planned)** | `https://architecture-playground.azurewebsites.net` |
| **Local** | `C:\Users\sraghuvanshi\Downloads\My-Projects\Architecture-Playground\` |
| **Origin** | Extracted from `sauravraghuvanshi/portfolio` commit `f3274cb` (April 2026) |

## Session Start Protocol (AUTOMATIC — do this FIRST before anything else)

1. **Read full project context:** `.claude/project-memory.md` (architecture, infra plan, migration state, roadmap)
2. **Read lessons:** `.claude/lessons.md` (carried over from portfolio + playground-specific)
3. **Read patterns:** `.claude/patterns.md` (React Flow node/edge patterns, exporter, history reducer, sequence player)
4. **Read architecture decisions:** `.claude/architecture.md`
5. **Brief the user:** one-line summary of last session + top remaining items
6. If user has a task, proceed. If not, suggest the highest-priority remaining item.

## Session End Protocol

Before the session ends or user signals "done" / "push" / "ship":

1. **Update `.claude/project-memory.md`** — add a "Last Session Summary" with date, what was completed, files touched, last commit hash, what's next
2. **Update `.claude/lessons.md`** — if any corrections were made or new patterns discovered
3. **Update `.claude/patterns.md`** — if new component or hook patterns were established
4. **Update `.claude/architecture.md`** — if design decisions changed
5. **Update `README.md`** — if notable features added/changed
6. **Commit format:** `feat:` / `fix:` / `chore:` / `docs:` prefix, concise

## Key Rules (most critical — taken from portfolio lessons + playground specifics)

- **Never start `npm run dev` yourself** — tell the user to run it in their own terminal
- **Push only after user confirms localhost looks good**
- **Set Azure env vars BEFORE pushing code that depends on them**
- **Build check:** Run `NEXT_TURBOPACK=0 npx next build` after non-trivial changes (Turbopack production builds have ENOENT race conditions on Windows)
- **No `console.log` in production** — use `const log = isDev ? console.log : () => {};`
- **SCM auth check before push:** `az rest --method get` to verify `basicPublishingCredentialsPolicies/scm`
- **Tailwind dynamic classes:** full-string lookup maps, never interpolate
- **React Flow nodes:** memoize node components with `React.memo` and stable `nodeTypes` reference (else infinite re-mounts)
- **Web worker:** `gifenc.bundle.js` lives at `public/playground/` and must be re-bundled on prebuild; don't import gifenc directly into client code
- **localStorage payload:** version every change to the persisted graph schema and validate with Zod before hydrating
- **No textbook copyright issues:** cloud icons are © Microsoft / Amazon / Google — credited in footer; do not bundle vendor SDK marks beyond the icons themselves

## Verify Before Confirming

Never tell the user "it's deployed" or "it works" until:

```bash
npm run lint
NEXT_TURBOPACK=0 npx next build
npx playwright test          # against local dev
# push → watch CI/CD → smoke-test live URL
```

`HTTP 200` is NOT enough — assert on actual content (canvas mounts, palette renders, export buttons present).

## Migration State

Migration from the portfolio repo is **complete** (2026-04-24). Phases 1–4 done. Portfolio cleanup committed (`22fd4a5`). See `.claude/project-memory.md` § "Migration Plan" for full history.
