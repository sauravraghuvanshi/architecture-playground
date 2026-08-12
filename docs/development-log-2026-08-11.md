# Development log — 2026-08-11/12

## Executive summary

Diagrammatic moved from a basic multi-mode canvas to a deployed, access-controlled
architecture workspace with a consistent visual system, reliable authoring,
tested template imports, presentation-quality exports, a richer Whiteboard, and
comprehensive project documentation.

The work was completed iteratively: each reported defect was reproduced, fixed,
covered by a focused Playwright regression, and validated again after deployment.

## Delivered

### Architecture Studio

- Redesigned the workspace around one navy/slate/cyan product system.
- Added a light blueprint canvas, enterprise boundaries, generic primitives, and
  searchable Azure/AWS/GCP assets.
- Increased connection reliability with four-way loose handles and larger hit
  targets.
- Added selectable edge labels, protocol editing, line styles, explicit flow
  stages, validation, comments, versions, and debounced local autosave.
- Added four tested architecture blueprints and repaired all 16 gallery imports.

### Presentation and GIF export

- Added high-resolution PNG, editable SVG, fitted PDF, JSON, and GIF export.
- Export now frames the complete diagram rather than the visible viewport.
- Service cards remain static during playback and GIF capture.
- Edges sharing a step number animate together.
- Each stage records six deterministic motion frames for smoother movement.
- GIF frames stream directly into gifenc instead of retaining every RGBA frame.

### Multi-mode workspace

- Fixed disappearing nodes during connection drags across all React Flow modes.
- Moved React Flow base styles to the root layout so every structured mode loads
  correct stacking and pointer behavior.
- Added an explicit Blank action to all nine modes.
- Stabilized Kanban and shared canvas callbacks to avoid render loops.

### Templates

- Added manifest-backed resolution for legacy cloud icon IDs.
- Normalized legacy absolute child coordinates into parent-relative positions.
- Ensured parent groups hydrate before child nodes.
- Added connection handles to architecture boundaries so group-to-group and
  service-to-group template edges render.
- Verified every architecture template preserves node and edge counts.

### Whiteboard

- Unified Excalidraw controls with the Diagrammatic product theme.
- Added 600 searchable Lucide symbols generated at build time.
- Added click insertion and positioned drag-and-drop insertion.
- Kept Whiteboard assets limited to the bundled Diagrammatic symbol catalog.
- Added licensing notices and an asset-use policy.
- Added Azure OpenAI image generation locally through a server-side development
  proxy when image credentials are absent.
- Fixed a production Maximum update depth loop by stripping volatile Excalidraw
  UI state, deduplicating scene persistence, and stabilizing API registration.

### Product pages and documentation

- Unified Hub, Templates, About, workspace, and Whiteboard visual language.
- Removed unsupported About-page roadmap and capability claims.
- Rebuilt the README with real screenshots, a generated GIF walkthrough, and a
  system architecture diagram.
- Updated security, AI, asset licensing, and environment documentation.

### Access control

- Added a product-focused sign-in page.
- Added environment-backed shared credentials without committing them.
- Added rate-limited login, HMAC-signed eight-hour sessions, HttpOnly and
  SameSite=Strict cookies, API/page protection, safe redirects, status, and
  logout.
- Added base64url secret delivery through GitHub Actions to prevent dotenv
  expansion from corrupting credentials.
- Deployed and verified the access gate on Azure App Service.

## Key blockers and resolutions

| Blocker | Root cause | Resolution |
| --- | --- | --- |
| Services disappeared while drawing a connection | React Flow's temporary connection SVG also uses `react-flow__container`; a broad background rule painted an opaque full-canvas layer above nodes | Scoped background styling to the React Flow root and forced connection layers transparent |
| Other diagram modes could not reliably start connections | React Flow base CSS was imported only by the Architecture dynamic bundle, leaving backgrounds above handles when another mode loaded first | Moved React Flow CSS to the root application layout |
| Imported templates lost icons or appeared malformed | 94 template nodes referenced legacy icon IDs; some grouped templates mixed absolute and relative coordinates | Added fuzzy manifest resolution, group-first ordering, and per-parent coordinate normalization |
| Hub-Spoke template showed no edges | Boundaries were valid nodes but had no connection handles | Added boundary handles and covered group-edge rendering in the exhaustive import test |
| PNG/SVG export failed under the app's own CSP | The exporter converted data URLs by calling `fetch(data:)`, but `connect-src` did not allow data URLs | Removed the fetch dependency and used direct data URL or in-memory conversion paths |
| GIF felt abrupt and moved services | Capture produced one frame per edge and pulsed target cards | Removed card motion, grouped equal steps, added six dash-motion frames per stage, and streamed encoding |
| Whiteboard crashed with Maximum update depth | Excalidraw API registration and full app-state persistence fed volatile menu/sidebar/runtime state back into React | Made API registration one-shot, removed volatile fields, deduplicated persistence, and removed the unstable background menu item |
| Whiteboard AI was disabled locally | The local worktree intentionally had no Azure credentials, while production did | Added mode-specific AI status and a development-only server proxy to the configured production image route |
| Azure MCP could not set App Service settings | The active Azure credential belonged to a different tenant | Used trusted GitHub deployment secrets and copied a protected runtime environment into the standalone package |
| Runtime secret file could corrupt `$` characters | Next's dotenv expansion interpolates `$VAR` even inside JSON-quoted values | Encoded username, password, and signing secret as base64url before writing the runtime environment |
| First browser checks after deployment were intermittently blank | App Service was still restarting and client chunks were briefly unavailable | Added stabilization waits and reran isolated production checks after restart |

## Validation evidence

- Lint: clean.
- TypeScript strict check: clean.
- Node unit suite: 30 tests passed.
- Cross-mode visual and blank-canvas suites passed.
- All 16 architecture templates passed exhaustive import checks.
- Whiteboard manifest verified at exactly 600 unique assets.
- Whiteboard click, drag-drop, persisted reload, legacy-state, and mocked AI SSE
  insertion tests passed.
- Architecture connection, same-step playback, static-card, PNG, SVG, PDF, and
  44-frame GIF assertions passed.
- Live sign-in flow verified anonymous redirect, API 401, invalid login,
  successful login, HttpOnly cookie, safe redirect, logout, and re-protection.

## Production releases

| Commit | Purpose |
| --- | --- |
| `e34f5e3` | Enterprise architecture studio and documentation release |
| `0522319` | Whiteboard persistence and symbol drag-drop hotfix |
| `90ac9b9` | Shared sign-in access gate |
| `4018911` | Product-focused sign-in copy |
| `3ec96ba` | Removed the requested word from sign-in copy |

## Key learnings

1. **Library class names are not semantic boundaries.** A generic React Flow
   class can be shared by the root, viewport, and transient SVG overlays.
   Styling must target the exact rendered layer.
2. **Import compatibility needs migration logic, not path reconstruction.**
   Long-lived templates outlast asset naming conventions and coordinate models.
3. **Animation quality is a data-model concern.** Smooth GIFs required explicit
   stages, synchronized groups, deterministic phases, and bounded-memory encoding.
4. **Persist domain state, not UI runtime state.** Excalidraw menu/sidebar/cursor
   state should never be replayed as document state.
5. **Security configuration is part of the build artifact.** Secrets must avoid
   source control, logs, shell expansion, dotenv interpolation, and client bundles.
6. **Production verification must account for platform restart windows.** A
   successful deploy call does not mean client chunks are immediately stable.
7. **Claims should be executable.** About-page and README statements are now tied
   to working behavior and regression coverage.

## Follow-up opportunities

- Update the GitHub deployment health check to follow the expected sign-in
  redirect instead of warning on HTTP 307.
- Migrate the deprecated Next.js `middleware` convention to `proxy`.
- Upgrade workflow actions/runtime declarations to remove the Node.js 20 warning.
- Replace in-memory rate limiting if App Service scales beyond one instance.
- Move from one shared credential to Microsoft Entra ID when multi-user identity,
  audit, and role assignment become requirements.
