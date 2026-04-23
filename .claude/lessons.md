# Project Lessons Learned

> Carried over from the parent portfolio (`sauravraghuvanshi/portfolio` `.claude/lessons.md`) where applicable, plus playground-specific lessons learned during extraction. Add a new lesson here every time a correction is made.

---

## CARRIED-OVER LESSONS (from portfolio)

The following lessons apply to this project too, since the stack and deploy target are the same. Read the full entries in the parent `.claude/lessons.md` if the short summary isn't enough — they are renumbered here for this project's history.

### CO-1: Verify build before marking task complete
Always run `NEXT_TURBOPACK=0 npx next build` after any non-trivial change and confirm 0 errors before saying "done".

### CO-2: Plan before implementing multi-step tasks
For any task touching 3+ files or requiring architectural decisions, write a plan first and check in.

### CO-3: Dynamic Tailwind classes must use full string literals in a lookup map
Never construct Tailwind class names via interpolation. Use `Record<string, string>` lookup maps so Tailwind's content scanner retains the class.

### CO-4: Never start a background dev server — instruct the user
Don't run `npm run dev` from the agent. Tell the user to run it in their own terminal.

### CO-5: Use standalone zip deploy, not Oryx source build
- `npm run build` locally → `.next/standalone/` self-contained
- `postbuild.mjs` copies `public/` + `.next/static/` into standalone
- Zip standalone → push via Kudu `/api/zipdeploy`
- `SCM_DO_BUILD_DURING_DEPLOYMENT=false` always

### CO-6: Re-enable Azure SCM basic auth before every push
Tenant policy resets `basicPublishingCredentialsPolicies/scm.allow` to `false`. Run `az rest --method get` on the policy resource before push; if `false`, PUT `{"properties":{"allow":true}}`.

### CO-7: Use Kudu zipdeploy directly, NOT `azure/webapps-deploy` action
Action validates publish-profile XML opaquely and breaks on `$`-prefixed usernames. Use two simple secrets (`AZURE_DEPLOY_USER`, `AZURE_DEPLOY_PASSWORD`) and `curl` to `/api/zipdeploy`.

### CO-8: Secrets containing `$` must use `env:` block, not inline interpolation
The Kudu deploy username starts with `$`. Bash expands `$foo` inline → empty string → 401. Always pass via `env:` block in GitHub Actions.

### CO-9: "Re-run all jobs" replays old workflow YAML — push a new commit instead
GitHub Actions re-runs use the workflow file from the original triggering commit, not the latest. Push an empty commit to test workflow changes.

### CO-10: Never push until user confirms localhost looks good
Run `npm run build`, then STOP. Tell the user to check `http://localhost:3000`. Push only after explicit user approval.

### CO-11: Set new App Service env vars BEFORE pushing code that depends on them
The deploy pipeline runs on push. If env vars aren't already set, the live site breaks immediately. Always: set env vars → verify → push.

### CO-12: Always verify the actual result before confirming success
After any destructive/mutating operation, run a follow-up read/check command to independently confirm the result. Don't trust exit codes — prove it.

### CO-13: Turbopack production builds fail with ENOENT on Windows — use Webpack
`next build` defaults to Turbopack in Next 16. Production build can fail with `ENOENT` on `.next/static/<hash>/_buildManifest.js.tmp.<random>`. Fix: `NEXT_TURBOPACK=0 npm run build`.

### CO-14: F1 Free tier deploys can fail with rsync errors — retry or upgrade
Large standalone builds (~3000 files) can time out rsync on F1. Mitigations: stop app first, use `--clean true`, or temporarily upgrade to B1 for the deploy.

### CO-15: Stale `.next/lock` blocks builds — delete and retry
If `next build` fails with "Unable to acquire lock at .next/lock", delete the lock file (or the entire `.next/` directory) and retry.

### CO-16: Always monitor CI/CD build success before proceeding to next task
After `git push`: `gh run watch`. Don't context-switch until the build is green and live URL is healthy.

### CO-17: Never confirm "it's deployed" until the full verify chain is green
Push success ≠ deploy success. Build success ≠ runtime success. Always: push → watch CI → smoke-test live URL → THEN confirm.

### CO-18: HTTP 200 is not enough — assert on actual content
Smoke tests must check that the page renders meaningful content (canvas mounts, palette icons load), not just status code.

### CO-19: Trace the FULL data flow before confirming a feature is done
When adding a new field/feature, trace data entry → storage → API → consumer. Don't just test the admin/source side.

### CO-20: `.mjs` files are ESM — don't call `require()` inside them
`node --check` won't catch this; only runtime does. Always use top-level `import` or dynamic `await import()` in `.mjs` files.

### CO-21: Audit findings can be stale — verify against current code first
Before acting on any audit finding, glob/grep the codebase + check git log + hit the live URL. The reviewer may have missed a recent change.

### CO-22: Reuse transitive dependencies before adding new packages
Run `npm ls <pkg>` to check whether a package is already installed transitively before `npm install`-ing it.

---

## PLAYGROUND-SPECIFIC LESSONS

(Add new entries here as we encounter playground-only issues.)

### PG-1: React Flow `nodeTypes` and `edgeTypes` must be stable references
Defining `nodeTypes={{ service: ServiceNode }}` inline in the JSX prop creates a new object every render → React Flow re-mounts every node every frame → catastrophic perf collapse + lost selection state.

**Fix:** Define `const nodeTypes = { service: ServiceNode }` at module scope (or wrap in `useMemo` with `[]` deps).

```tsx
// ✅ CORRECT — module scope
const nodeTypes = { service: ServiceNode, group: GroupNode, sticky: StickyNoteNode };

export function Canvas() {
  return <ReactFlow nodeTypes={nodeTypes} ... />;
}

// ❌ WRONG — new object every render
return <ReactFlow nodeTypes={{ service: ServiceNode }} ... />;
```

### PG-2: React Flow custom nodes must be `React.memo`'d
Without `memo`, every node re-renders on every state change in the parent — even when its own data hasn't changed. With 50+ nodes the canvas drops below 30fps.

**Rule:** Wrap every custom node component in `React.memo` with a custom comparison if data has nested objects.

### PG-3: `gifenc` must run in a web worker — never on the main thread
Encoding a 30-frame 1280×720 GIF on the main thread freezes the UI for 8–15 seconds. Bundle `gifenc` into an IIFE worker (`scripts/bundle-gifenc-worker.mjs` → `public/playground/gifenc.bundle.js`) and post frames to it via `postMessage`.

**Rule:** Anything CPU-intensive (GIF encoding, large image conversion, sequence diff) goes to a worker. The exporter (`lib/export.ts`) provides a `GifFrameDriver` abstraction that drives the worker.

### PG-4: `html-to-image` requires a settled DOM — wait one frame after layout changes
Calling `toPng(node)` immediately after a state change captures the pre-layout snapshot. Wrap exports in:

```ts
await new Promise(requestAnimationFrame);
await new Promise(requestAnimationFrame);
const dataUrl = await toPng(node);
```

Two `rAF`s — one to flush React, one to flush layout/paint.

### PG-5: localStorage payload schema must be versioned + validated
The persisted graph schema **will** evolve (new node types, new edge metadata). Always:

1. Stamp every saved payload with a `version` integer
2. Validate with Zod on load — reject (or migrate) anything that doesn't match
3. Bump the version when fields change; provide a migration shim for old versions

Without this, a single schema change strands every existing user with a broken canvas (and no error message).

### PG-6: Drag-and-drop from palette must use `dataTransfer.setData` — NOT `useDrag` from `react-dnd`
React Flow's drop target reads from native HTML5 `dataTransfer`. Adding `react-dnd` introduces a second DnD context that doesn't interop. Stick to the native API:

```ts
// In palette
e.dataTransfer.setData("application/playground-icon", iconId);
e.dataTransfer.effectAllowed = "move";

// In canvas onDrop
const iconId = e.dataTransfer.getData("application/playground-icon");
```

### PG-7: Sequence playback must use React Flow's `setEdges` updater, not direct DOM
Animating edges by mutating SVG attributes directly bypasses React Flow's reconciliation and breaks on every redraw (zoom, pan). Use `setEdges((es) => es.map(e => e.id === activeId ? { ...e, animated: true } : { ...e, animated: false }))` so React Flow owns the rendering.

### PG-8: SVG icon dimensions must be normalised on load
Vendor SVGs ship with wildly different `viewBox` sizes (Microsoft: 18×18, AWS: 80×80, GCP: 200×200). Set explicit `width`/`height` on the `<img>` and let `object-fit: contain` handle the rest. Don't trust the SVG's intrinsic size.

### PG-9: Cloud icon copyright must be acknowledged
The Azure / AWS / GCP service icons are © their respective vendors. Keep the small attribution footer ("Service icons © Microsoft, Amazon, and Google. Used here for architecture demonstration; this playground is not affiliated with any cloud provider.") visible at all times. Don't remove it.

### PG-10: Don't bundle the worker via Next.js — use a static asset
Next 16's webpack tries to bundle anything imported via `new Worker(new URL(...))`. For `gifenc.bundle.js` this fails because the bundle uses globals the worker context provides. Build the worker once with esbuild → drop in `public/playground/` → instantiate with `new Worker("/playground/gifenc.bundle.js")`.

### PG-11: Hydration safety — `useReactFlow()` must be called inside `<ReactFlowProvider>`
Calling `useReactFlow()` in any component rendered outside `<ReactFlowProvider>` throws at runtime. Wrap the entire client tree in the provider in `Playground.tsx`. If you need flow imperatives in the toolbar, hoist the toolbar inside the provider too.

---

## How to Add a Lesson

When you discover a new pattern, gotcha, or correction:

1. Pick a short, memorable name (e.g. "PG-12: Edge labels must be portal-rendered for export")
2. Describe **what went wrong** (concrete symptom)
3. Describe the **root cause**
4. Show the **fix** (code snippet preferred)
5. State the **rule** as a one-liner

Always commit lessons in the same PR as the fix that taught them.
