# Azure Deployment Plan

> **Status:** Validated

Generated: 2026-08-12
Updated: 2026-09-22 (Asia/Kolkata; end-of-day pause)

Latest handoff: [completed work, lessons and tomorrow's checklist](../docs/session-summary-2026-09-22.md).

## September 22 morning - Saved-scene rejection and failed pipeline

- **Request:** Remove the persistent recovery warning shown on the screenshot,
  restore usable saved Whiteboards, and resolve last night's failed deployment.
- **Baseline:** Deployed `bd27fff`, local documentation `37ff2f4`.
- **Plan:** Inspect saved-scene intake and recovery notification lifecycle;
  reproduce native unfinished remnants without losing valid elements or original
  bytes; eliminate the persistent canvas recovery banner while keeping real
  actionable storage failures accessible. Diagnose workflow `35648068866`'s
  exact hosted parser failure. Add regressions, validate, deploy through the
  existing pipeline and verify hosted before claiming completion.
- **Scope:** Existing app-only target, no new infrastructure, model endpoints or
  roles. Priorities 16-33 and competitor additions remain paused.
- **State:** Implemented, locally verified and passed the Azure validation
  workflow. Ready for the existing app-only deployment.
- **Reproduction:** The previous production build reproduces all three
  screenshot recovery messages from a named board with one valid shape, a dot
  and unfinished remnants. This is persisted-scene intake, not the active
  pointer guard fixed last night.
- **Fix:** Match native transient classification (two-point dots are valid),
  restore usable elements with bounded/reference validation, preserve the raw
  source in a version on library intake, and move genuine recovery details and
  original downloads into My diagrams. No persistent canvas recovery banner.
  Live unfinished notifications/captures still defer.
- **Workflow diagnosis:** Run `35648068866` failed at hosted Bicep HTTP 503.
  The old script only retried its first fixture and did not log parser codes.
  Exact historical parser cause is not recoverable from that log; do not invent
  a timeout or packaging explanation. Authenticated valid/invalid Bicep probes
  and the unchanged complete hosted parser smoke pass this morning.
  Added bounded retries to every smoke fixture, safe error-code diagnostics,
  and tests that persistent unavailability and wrong semantic results still fail.
  No parser timeout increase, skipped fixture or disabled deployment gate.
- **Evidence:** 374/374 application contracts, 21/21 parser/integration/retry
  checks, full lint/types/build, and 5/5 mandatory production screenshot cases.
  The new saved draft/named cases verify original-version preservation, exact
  usable geometry, no banner, mode switching and reload.
- **All validation checks pass (before deployment):**
  - Application contracts: `npm run test:playground`, **374/374**.
  - Real parser and smoke retry tests: `npm run test:artifact-parsers`, **21/21**.
  - `npx tsc --noEmit`, `npm run lint`, `npm run build`: passed.
  - `node scripts/verify-screenshot-regressions.mjs`: **5/5**.
  - Adjacent save/recovery/conversion/native scene suite: **90/90** in a single
    three-engine run, 4.9 minutes.
  - Static role/target review: unchanged app-only pipeline, no IaC/RBAC/model
    changes. Only the additional smoke-helper contract gate is new in CI.
- **Section 7: Validation Proof (morning fix):** Commands above ran on this
  worktree. Baseline screenshot failed with the three recovery messages; the
  corrected native cases pass without weakening geometry/source retention
  assertions. Authenticated current-production parser probes and full smoke
  also passed before any new deployment. No model inference or customer
  infrastructure operation was invoked. New-release hosted checks remain pending.

## September 22 - Autosave while a drawing gesture is in progress

- **Baseline:** Application `cf6da2b`; documentation `d7f8dbc`.
- **Request:** Stop the recurring "Finish or cancel the current Whiteboard
  gesture before saving" autosave banner on diagram pages.
- **Plan:** Trace native editing state and shared save scheduling; reproduce
  overlapping autosave/gesture timing; defer automatic saving without reporting
  an error or falsely claiming a save; persist immediately after settling.
  Verify real storage failures remain visible, test/build/deploy/verify hosted.
- **Scope:** Current regression only; preserve data and validation. Existing
  app-only Azure deployment; no resource/identity/model changes. Backlog paused.
- **State:** Azure validation workflow completed through error resolution on
  September 22 at 01:26 IST; validated for the existing app-only deployment.
- **Reproduction:** The unchanged prior production build fails the new native
  test when a second rectangle is held for 1600ms, past the preceding edit's
  650ms autosave. This recreates the user's recovery banner without malformed
  data or any model call.
- **Root cause:** The native pointer guard correctly prevented incomplete
  snapshots, but the shared autosave treated that expected state as a database
  failure and did not retry until another document revision arrived.
- **Fix:** Typed pending captures, retained dirty status and cancellable 650ms
  retry; window pointer-up/cancel settlement; invalidated stale frame notices;
  manual save briefly waits for native settlement before making the canvas
  inert. Navigation keeps the outgoing document on an unfinished edit.
  No geometry dropping, no validation bypass, no general error suppression.
- **Protection:** Quota/conflict/malformed-content errors remain visible.
  The exact long-gesture test is in the mandatory pre-deployment screenshot gate.
- **Pre-deployment validation checks passed (hosted checks tracked below):**
  - `npm run test:playground`: **370/370** final contracts, September 21 UTC
    (September 22 IST).
  - Full lint, final changed-file lint, strict types and `npm run build`: passed.
  - `node scripts/verify-screenshot-regressions.mjs`: **3/3**, final build.
  - Adjacent Chromium/Firefox/WebKit suite: **84 distinct cases passing**
    across the 83-pass main run and corrected 9/9 screenshot rerun.
  - The one initial WebKit failure was an exact geometry assertion: native
    Excalidraw's leading-frame throttle drops sub-frame synthetic moves. Probed
    native state before persistence; paced the test moves by animation frame
    instead of weakening the 100x100 geometry or reload-equality assertions.
  - Static role checks: unchanged app-only workflow, no IaC/RBAC/identity or
    provider changes. Existing Azure target and user-approved delivery retained.
- **Section 7: Validation Proof (current hotfix):** Commands and results above
  were executed on the current worktree. Baseline failure, focused contracts,
  final gate and three-engine output are retained in session artifacts.
  Deployment subsequently completed; hosted verification is incomplete as
  recorded below. No live-model claim.
- **End-of-day pause:** The user requested stopping and continuing tomorrow.
  Application `bd27fff3072c6af0e41c9365adfc1f2ced909818` was already pushed.
  Workflow `35648068866` completed during close-out: both pre-deployment gates,
  Azure deployment, HTTP health and authenticated CSA API smoke passed. The
  hosted parser-only artifact-validation smoke failed; final browser smoke was
  skipped. The release is deployed but NOT fully hosted-verified.
- **Resume first:** Inspect the failed `Verify hosted parser-only artifact
  validation` step in that exact workflow; diagnose before any retry. Then
  authenticate ephemerally and run the screenshot/persistence/Whiteboard hosted suite.
  Record the result and remove temporary auth; only then close this hotfix.
  Priorities 16-33 and competitor work remain paused.

## September 21 - Screenshot-reported Whiteboard and code-generation regressions

- **Baseline:** Application `3b5d8fd`; documentation `5473bb1`.
- **Scope:** Fix the native Whiteboard binding rejection affecting autosave,
  conversion and mode switching; fix valid catalog-service code-generation
  eligibility. Preserve existing diagrams, native bindings and safe code validation.
- **Plan:** Reproduce exact screenshot errors using native editor/catalog inputs,
  trace recent changes, correct contracts rather than suppress errors, add
  production-path regressions, validate/build/deploy and verify hosted.
- **Target:** Existing Next.js/App Service application-only pipeline; no new
  infrastructure, model endpoints, identities, permissions or customer deployment.
- **Authorization:** User explicitly requested these four urgent fixes. Numbered
  priorities 16-33 remain paused. Do not expand into the remaining roadmap.
- **State:** Deployed and hosted-verified as `cf6da2bd56de3aa8e42f46248fc77e443204547b`
  (application fix `2088d85`, clean-checkout gate correction `cf6da2b`).

### Exact reproduced paths

- Native User/Server symbols connected with the actual Excalidraw Elbow arrow
  reproduce the screenshot's `startBinding.fixedPoint.0` error before model
  inference. The same `serialize`/save contract causes autosave, conversion and
  tab-switch failures; they are not three independent provider failures.
- The screenshot artwork matches `azure/application/app-service-api-management`
  and `azure/application/app-service-management`. The former is an APIM service
  illustration missing from the finite deployment mapping. The latter is a
  management symbol, not an App Service workload identity despite its renamed
  label. Reproduced the missing APIM mapping in a production-import unit test.
- Added finite APIM support, pre-generation per-node service readiness and an
  explicit undoable "Use Azure App Service" correction for the management symbol.
  No fuzzy label-based mapping or validation bypass is introduced.
- Regression prevention: the existing deployment pipeline will run application
  contracts on Node 24, restore its unchanged Node 20 app-build runtime, build
  and run the screenshot-specific native browser journeys before publishing.
  AI responses in those browser cases are synthetic; route/identity logic is
  tested separately. Nothing runs generated customer infrastructure.

### Screenshot regression validation

- Root cause confirmed in installed Excalidraw 0.18.1: native elbow binding
  ratios include `1.025` and `-0.025`; native focus can reach `+/-1.1`.
  The earlier new validator's `[0,1]`/`[-1,1]` assumptions were incorrect.
  Fixed only the binding contract; exact coordinates remain unchanged, and
  malformed/nonfinite/reference/binary bounds remain enforced.
- [x] **363/363** application contracts, full lint, strict types and production
  build passed. **49/49** focused deployment/mapping/real-parser tests passed.
- [x] The new pre-deployment production-browser gate passed **2/2** exact
  screenshot workflows after first reproducing both failures on the old build.
- [x] Adjacent production-build Chromium suite passed **75/75**. Screenshot
  journeys also passed **4/4** Firefox/WebKit cases. The multi-document code
  journey uses a 60s overall test budget; existing per-action assertions are
  unchanged, including exact identities, connections, binding coordinates,
  Undo/Redo, saved reloads and successful validated generation fixture.
- [x] No live-model invocation or generated customer deployment. Official
  parser/resource checks were exercised independently of mocked browser output.
- [x] Static role/policy checks: application-only update; no new Azure resource,
  permission, provider/model identity or target. Workflow now blocks publication
  before rollout on unit or screenshot-journey regressions.
- [x] Clean Linux gated build, exact rollout and authenticated hosted verification:
  run **35641830814** succeeded in **5m07s**, completed September 21 at
  19:03:24 UTC. Both new pre-deployment gates passed before Azure publication.
- [x] Hosted **75/75** adjacent Chromium cases passed in 3.7 minutes; exact
  screenshot workflows also passed **4/4** Firefox/WebKit cases in 1.6 minutes.
  These exercise native arrows, exact binding preservation, saving/reload,
  mode switching, PNG conversion, explicit identity repair, real offline code
  and mocked validated AI response handling. No live-model quality claim.
- [x] Temporary hosted authentication removed and owned local server stopped.
- **Backlog remains paused:** this is the user's urgent fix, not priority 16.
- First gated CI run `35641487637` correctly stopped before publication: a
  clean checkout lacks the generated icon manifest required by contract tests.
  The gate now invokes the existing `prebuild` generators before tests, matching
  the normal build's asset prerequisites. No tests or protections were disabled.

## Priority 15 - Cross-browser reliability

- **Baseline:** Verified application `d81a0fd`; documentation `fc336ac`.
- **Latest authorization:** Finish and verify priority 15, then stop. The user
  has a new issue to address before any further backlog work. Do not start 16.
- **Plan:** Reproduce current Firefox/WebKit failures using the production build;
  distinguish application bugs, test-driver defects and unsupported environments;
  fix root causes with browser-backed regressions, publish an evidence-bounded
  support policy, validate/deploy and verify hosted, then pause for the new issue.
- **Recipe:** Existing application-only App Service pipeline. No infrastructure,
  model calls, credentials or provider configuration changes.
- **State:** Completed and hosted-verified as
  `3b5d8fd12eb81fb8b67d839729855ee7fb1d68f8`. Stopped after priority 15.
  Do not start priority 16; await the user's new issue.
- **Boundary:** Playwright WebKit on Windows is not real Safari/iOS device
  certification. Do not make device-support promises without direct evidence.

### Priority 15 - Current-release reproduction

- Exact historical 22-case Firefox/WebKit suite: **19 passed, 3 failed**.
  Firefox Whiteboard reload now passes; Firefox architecture raster export and
  WebKit Whiteboard drag/connected-arrow cases remain reproducible.
- Firefox console evidence identifies `html-to-image` calling `.trim()` on
  undefined `CSSFontFaceDescriptors.fontFamily`. Standard
  `getPropertyValue("font-family")` is available. The upstream source still uses
  the failing camel-case property; no vendor files or prototypes are patched.
- WebKit event traces show the application custom MIME disappearing between
  dragstart and drop while standard text MIME survives. Both Whiteboard symbols
  were absent, explaining the downstream unbound arrow. A versioned marked
  text envelope supplements existing custom MIME across both canvases.
- Implemented bounded font CSS embedding through the library's public option,
  preserving fonts rather than disabling them. It is prepared once per export
  and reused for GIF frames. All native/compatibility raster/SVG surfaces share it.
- Drag payloads are bounded and validated; ordinary external text stays with
  the native editor. Custom symbol data is validated before files/elements mutate.
- Browser verification of these changes and support-policy evidence follows.
- Further evidence: WebKit's missing blueprint retained the new intent but lost
  its nodes. The old count-based prop hydration and queued old-canvas notifications
  could race external seeds. Document replacements now advance an explicit canvas
  generation; stale notifications/captures are rejected, and same-canvas restores
  cancel pending notifications instead of guessing from node counts.
- Native WebKit drops now succeed; connected arrows pass when the fixture waits
  for both images rather than drawing before their scene commits. The Firefox
  reload fixture previously cleared storage on every navigation; it now verifies
  the exact retained binary and passed three consecutive genuine reloads.
- Playback tests now observe the actual dimmed/animated state instead of a fixed
  200ms sleep. No assertion thresholds or export deadlines are increased.
- WebKit GIF profiling showed steady 1280x447 frame rendering, not decode
  rejection, at roughly 1-2 seconds per frame. Known invisible editing controls
  are excluded through a shared export filter; actual paths/labels/icons remain.
  Export notices cannot be cleared by an older completed export's timer, and
  overlapping captures are explicitly prevented.
- Firefox reload investigation distinguished an automation failure from app
  failure: a same-origin independent observer saw the timed-out page at
  `readyState=complete`, two restored nodes, `aria-busy=false` and saved state
  while Playwright's original page context could not evaluate. A local-only
  Firefox profile showed idle main threads, not an application JavaScript loop.
  Exit-handler/cache/observer probes did not resolve the stalled context.
- The installed runner is Playwright 1.59.1; current 1.63.0 supports Node >=20.
  Update the test runner and matching browser binaries, then requalify the real
  reload cases rather than accepting a timeout, disabling caching or weakening
  restored-content assertions. Profiles are not uploaded or committed.
- The repository-wide npm lock operation again hit the existing unrelated
  Tailwind WASI mirror 404. No registry/certificate/access policy was bypassed.
  A minimal isolated npm install retrieved only the three approved Playwright
  packages; their authoritative metadata updated only the corresponding lock
  entries. Local package directories were verified non-shared and replaced
  with the npm-installed versions, with backups retained until qualification.
  Clean Linux `npm ci` remains a required release check.
- Playwright 1.63.0 and matching browsers are installed. Six repeated Firefox
  architecture/Whiteboard reload cases now pass with exact identity/binary
  assertions. Restore the original full-load navigation condition for the
  final matrix; no cache-disabled or diagnostic monkeypatch is used.
- A rapid WebKit pointer-up could race appearance reconciliation and truncate a
  bound arrow. Explicit pointer lifecycle tracking now delays reconciliation
  until native geometry settles and reads the current scene, not an old callback.
  The original native gesture/GIF journey passed five consecutive runs.
- The broad three-engine run passed **447/456** initially. The remaining cases
  were investigated rather than skipped: pointer-invoked controls needed explicit
  focus in WebKit; disclosure Escape needed an active-modal-aware document
  handler; bounded standard ResizeObserver deferred-delivery notices are recorded
  with stable-layout/content checks. Final affected WebKit recheck: **43/43**.
- One Firefox mocked-Portal navigation assertion was transient: three isolated
  repeats passed. A read-only review found no document.write/parser lifetime bug;
  the app preopens about:blank, clears opener and navigates after validated
  publication. No speculative Portal behavior change was made.

### Priority 15 - All validation checks pass

- [x] **355/355** application contracts, full lint, strict TypeScript and final
  standalone production build pass.
- [x] All **456 distinct** selected browser cases passed across the main matrix
  and focused rechecks. This is aggregate coverage, not a claim of one clean
  456-case run. Chromium's 152 cases passed in the main run; Firefox's one
  intermittent mocked-popup case passed 3/3 repeats; final affected WebKit
  focus/layout/restoration suite passed 43/43 after fixes.
- [x] Actual PNG/PDF/GIF downloads and full ordered frame counts are asserted.
  SVG checks parse the downloaded document, verify embedded fonts and visible
  graph content, and avoid reporting harmless invisible SVG hit paths as pixels.
- [x] Exact tested engines: Chromium 153.0.8010.12, Firefox 155.0, WebKit 26.6.
  Real macOS Safari/iOS devices are explicitly unqualified.
- [x] Existing app-only ZIP target, unchanged roles/resources/model endpoints.
  Docker/IaC/What-If do not apply. No live model or customer deployment calls.
- [x] Proof: `p15-gesture-contracts` 355 pass; `p15-modal-safe-build` exit 0;
  `p15-final-local-matrix` 447/456; `p15-webkit-final-verified` 43/43;
  `p15-firefox-popup-recheck` 3/3; `p15-webkit-rapid-gestures` 5/5.
- [x] Clean Linux install and exact rollout passed for both `3a04dbc` and
  `3b5d8fd`; final affected hosted verification passed 108/108 as recorded below.
- **Stop boundary:** Do not begin priority 16 after this release.

### Priority 15 - Hosted follow-up, same task

- Application `3a04dbc` deployed successfully through run `35623406942`.
  Clean Linux install/build and pipeline smoke passed; hosted Chromium passed
  **152/152**. The compatibility run identified cold-start precondition failures
  and a genuine Whiteboard restoration race, so close-out remains open.
- Direct live/API-versus-storage inspection proved the race: after the first
  reload, the live canvas was dark and finished loading, while its stored
  document had default white with `isLoading=true`. The next reload restored
  that transient state. This was not caused by invalid-version application.
- Same-task correction: ignore native loading callbacks before reconciliation/
  persistence, never persist `isLoading`, reject captures while restoring and
  expose Whiteboard readiness to the workspace. Tests wait for real application
  readiness, not an arbitrary five-second assertion against an unmounted canvas.
- Strengthened tests require dark background and absence of loading flags after
  repeated reloads, in addition to exact element/binary preservation.
- Finish this correction and hosted verification, then stop for the user's
  separate issue. No next-priority work is authorized.
- Follow-up validation is green: **356/356 contracts**, lint/types/build, and
  **108/108** affected Chromium/Firefox/WebKit browser cases in 4.8 minutes.
  The malformed-version fixture is injected while the editor is unmounted so
  autosave cannot overwrite test evidence. Pixel checks retain exact RGB values
  but use integer comparisons instead of allocating strings for every pixel.
- Evidence: `p15-loading-contracts`, `p15-loading-build`,
  `p15-loading-final-matrix`. No timeout increase or live-model invocation.
- All validation checks pass for the same application-only target; no
  infrastructure, permissions, dependencies or model configuration changed in
  this correction. Exact follow-up rollout and hosted checks remain.
- Final rollout **35632938257** succeeded in **4m22s**, completed September 21
  at 17:39:24 UTC. Clean Linux build and authenticated pipeline smoke passed.
- Final affected hosted gate: **108/108 passed** across Chromium, Firefox and
  WebKit in 6.2 minutes, including repeated-reload background and binary checks.
- The earlier main release's hosted Chromium gate was **152/152**; the final
  correction closes the compatibility failures discovered during that release.
- Local servers are stopped, temporary authentication is removed, and the
  temporary profiler/package-staging backups were removed after successful CI.
- **Execution paused as requested.** No priority 16 or other backlog task started.

## Priority 14 - Responsive and keyboard-accessible editing

- **Baseline:** Verified application `d490193`; documentation `79404b3`.
- **Authorization:** Continue the remaining numbered priorities sequentially.
- **Plan:** Reproduce narrow-screen and keyboard failures; preserve the current
  technical-studio visual language; introduce smaller-screen Inspector/assets
  drawers and shared dialog/menu focus behavior; exercise keyboard and actual
  viewport geometry, validate/build/deploy and verify hosted before priority 15.
- **Recipe:** Existing Next.js application-only App Service pipeline. No model,
  endpoint, identity, resource or infrastructure change.
- **State:** Deployed and verified as `d81a0fd46ed3d46aeeaa2301171ae9f649521c15`.

### Priority 14 - Baseline evidence and implementation

- At 390x844, the released architecture canvas measured **86px** wide and
  Whiteboard **102px** wide because always-visible palettes consumed the screen.
  Keyboard ArrowDown did not open the boundary disclosure or focus its actions.
- Parent implementation moves architecture components, Whiteboard assets and
  Inspector into focus-managed drawers below 1280px. Desktop retains inline
  panels; comments/versions occupy the context rail instead of stacking every
  sidebar. Canvas geometry and data remain mounted while drawers open.
- Shared action disclosures support ArrowUp/Down, Home/End, Escape, outside
  dismissal and focus return, with viewport-clamped positioning. Native button
  semantics and Tab navigation remain intact.
- Workspace mode tabs use roving keyboard focus and manual activation.
  Workspace shortcuts do not edit the canvas behind a focused dialog.
- Legacy export/help/command/context surfaces reuse the same focus/navigation
  foundations. Native dialog focus and narrow-height integration is being
  implemented independently before the combined browser/build release gate.
- Parent scoped lint passes. No priority 14 application deployment yet.
- First integrated production gate: **20/23 passed**, including all 15 shared
  dialog checks and all four compact canvas/drawer cases. At 390px the architecture
  canvas now measures **390px wide / 552px high**; drawer and canvas screenshots
  were inspected. Three follow-ups were identified rather than waived:
  preserving mode-tab focus after async saving, retaining the library invoker
  through the inert save lock, and the legacy pane context-menu event guard.
- Parent has corrected tab completion focus and the native/synthetic context
  event mismatch, added keyboard context invocation, and captured library openers
  before saving. The shared hook's explicit return-target integration follows.
- Follow-ups are resolved: explicit library return targets survive the save
  lock; tab focus follows the completed mode switch; context menus handle
  React events and Shift+F10. Enter/Space keeps existing disclosure/Tab behavior,
  while arrow-key opening focuses the requested action.
- Final production browser gate: **149/149 passed** in 3.9 minutes. A native
  Whiteboard null-versus-empty binding-list settling race was compared using
  equivalent empty bindings; every other element field and binary remains exact.

### Priority 14 - All validation checks pass

- [x] `npm run test:playground`: **340/340 passed** after portal-aware harness
  updates; no production behavior is replaced by harness assertions.
- [x] Full lint, strict TypeScript and standalone production build passed.
- [x] Production browser acceptance: **149/149**; native/compatibility dialogs,
  keyboard focus, 390x844/844x390 geometry, desktop disclosures, AI cancellation/
  commits, boundaries, round-trip, image fidelity, recovery and real exports.
- [x] Visual inspection of the compact studio and asset drawer; architecture
  canvas is 390px wide rather than 86px in the reproduced portrait viewport.
- [x] Static roles/policy: existing ZIP-only app target, no resources, RBAC,
  provider configuration, live-model calls or customer infrastructure changes.
  Docker/IaC/What-If are not applicable to this release.
- [x] September 21 proof: `p14-final-contracts`, 340 pass;
  `p14-disclosure-build`, exit 0; `p14-final-local-browser-verified`, 149 pass.
- [x] Exact rollout **35592309033**, successful in **4m38s**, completed
  September 21 at 11:11:27 UTC. Clean Linux install/build, completed ZIP rollout
  and authenticated API/parser/browser smoke passed.
- [x] Hosted gate: **149/149 passed** in 5.7 minutes. All model outcomes used
  fixtures; no live inference or customer infrastructure execution.
- [x] Temporary hosted auth removed and owned local servers stopped.
  Priority 15 is next.

## Priority 13 - Reliable AI readiness, streaming and cancellation

- **Baseline:** Verified application `a95261e`; documentation `913d05c`.
- **Authorization:** Continue the remaining ordered priorities sequentially.
- **Plan:** Trace readiness and the end-to-end image SSE contract; reproduce
  framing/cancellation/duplicate-result gaps; implement shared bounded event
  handling and explicit terminal outcomes; verify unit/browser regressions,
  validate, deploy the existing app and verify hosted before priority 14.
- **Recipe/model:** Existing Next.js/TypeScript application-only App Service
  pipeline; retain operator-selected Azure deployments and existing SDK/API.
  No model selection, endpoint, infrastructure, role or live inference change.
- **State:** Deployed and verified as `d490193a62add5f018331ffd0c4009a46bf3405c`.

### Priority 13 - Reproduction and implementation

- Seven transport probes failed against the baseline: CR/CRLF framing and data
  spacing, truncated-tail dispatch, invalid UTF-8, unbounded buffering and abort
  while awaiting a pending read. The new production reader passes all seven.
- Shared image-event validation accepts exactly one complete base64 image outcome,
  fails on malformed/duplicate/contradictory output, and delays insertion until EOF.
- Server producers are no longer blocked inside an asynchronous stream start;
  cancellation reaches the provider before producer completion. Direct output
  is bounded and fully pixel-decoded; URL-only responses are explicit failures.
- Timeout/throttle/refusal/invalid-output/unavailable/upstream outcomes are
  distinct and redacted. Configured models, endpoints and request options remain.
- Readiness times out explicitly; final image decoding receives the cancellation
  signal. Graph document commits disable duplicate application/dismissal.
- Guidance: official Azure OpenAI image-generation documentation confirms
  GPT-image base64 output and explicit content-filter/rate-limit outcomes.
  No live inference is used for this release.

### Priority 13 - All validation checks pass

- [x] `npm run test:playground`: **340/340 passed**, including byte-boundary
  SSE framing, pending-read/producer abort, binary formats, terminal cardinality,
  redacted outcome classification and decode-time cancellation.
- [x] `npm run lint`, `npx tsc --noEmit`, `npm run build`: successful.
- [x] Final production-build affected-surface browser gate: **83/83 passed**
  in 4.1 minutes. Includes stalled/malformed/ambiguous readiness, duplicate and
  truncated streams, silent-read and pixel-decode cancellation, document commit
  controls and prior review/deployment/Whiteboard fidelity behavior.
- [x] Existing ZIP-only app pipeline; Docker/IaC/What-If not applicable. No
  infrastructure, resource, role, provider identity or endpoint changes.
- [x] Validation proof September 21: `p13-final-contracts`, 340 passed;
  `p13-final-build`, exit 0; `p13-final-local-browser`, 83 passed.
- [x] Exact rollout **35578931985**, successful in **4m24s**, completed
  September 21 at 08:42:35 UTC. Clean Linux build, completed ZIP operation,
  authenticated API, parser and browser smoke passed.
- [x] Hosted affected-surface gate: **83/83 passed** in 4.3 minutes.
  Synthetic providers only; no live-model quality/latency claim.
- [x] Temporary hosted authentication removed and owned server stopped.
  Priority 14 is next.

## Priority 12 - Safe Whiteboard conversion and restoration

- **Baseline:** Verified application `52b5efa`; documentation `36267f9`.
- **Authorization:** Continue the remaining numbered backlog sequentially.
- **Plan:** Trace import/restore and both conversion directions; reproduce
  malformed scene and late-result risks; implement bounded shared validation
  and explicit commit semantics; test local production build, validate,
  deploy through the existing pipeline and verify hosted before priority 13.
- **Recipe:** Modify existing Next.js application only; existing App Service
  ZIP/GitHub deployment and configured providers unchanged. No infrastructure,
  identity, role, model call or customer deployment is needed.
- **State:** Deployed and verified as `a95261e30cdb581a6276e967ce2e934d99588e15`.

### Priority 12 - Reproduced defects and decisions

- A persisted `elements: [null]` scene bypassed recovery and reached Excalidraw
  before document loading completed. Baseline browser reproduction failed the
  expected recovery alert; original malformed content was not safely isolated.
- Delayed IndexedDB persistence reproduced enabled Cancel/Close after applying a
  conversion. Dismissal could appear to cancel an already committed save.
- The dialog claimed replacement while the existing library operation actually
  preserved both previous documents and created a new one. Keep the safer
  new-document behavior and make consent/button/status match it.
- Analysis remains cancellable. Explicit Create starts a non-dismissible commit;
  duplicate submission is blocked synchronously, failures retain the preview,
  and unmounted dialogs cannot close a later dialog.
- Shared scene validation covers recovery, open/create/capture, initial mount
  and snapshot restore before mutating engine files/elements. Preserve original
  corrupt records and allow explicit recovery copies. Never mount raw local
  Whiteboard JSON ahead of recovery validation.
- Restore invalidates pending animation-frame notifications and asynchronous
  image decoding, including when the same engine instance remains mounted.
- Existing app target/permissions stay unchanged. No reverse conversion exists
  in the current product; this release hardens Whiteboard-to-architecture,
  native scene restoration and image insertion boundaries rather than adding one.
- Native image compatibility includes PNG/JPEG/WebP/GIF/BMP/ICO/AVIF/JFIF,
  known image octet-stream recovery and static SVG. Native canvas-encoder fallback
  MIME labels migrate without rewriting bytes. Tests cover all 1,433 bundled SVGs.
- Unfinished gestures are not new automatic checkpoints; committed document
  capture/restoration explicitly rejects pending/empty content the engine would
  discard. Horizontal/vertical paths remain valid.
- Local gate: **318/318 contracts**, lint, strict types and production build pass.
  Production-build affected browser gate: **55/55 passed** in 1.4 minutes.
  Earlier dev-only browser-tab creation timeout did not recur in this final gate.
  Binary validation is bounded transport/container/header validation, not a full
  pixel-decoding guarantee. Live model inference remains outside this release gate.

### Priority 12 - All validation checks pass

- [x] Core application checks: `npm run test:playground` **318/318**;
  `npm run lint`, `npx tsc --noEmit`, `npm run build` successful.
- [x] Final local production browser gate: **55/55** using two Chromium workers,
  including the previously timed-out dev browser-tab case.
- [x] Docker/infrastructure compile/What-If: not applicable to existing ZIP-only
  app deployment. No customer infrastructure is executed.
- [x] Static role/policy verification: no identity, role, resource, region,
  subscription, provider endpoint or data-plane operation change.
- [x] Validation proof, September 21: `p12-contract-gate`, 318 passed;
  `p12-build`, exit 0; `p12-local-browser`, 55 passed in 1.4 minutes.
- [x] Exact release: **35574277425**, successful in **4m39s**, completed
  September 21 at 07:47:43 UTC. Clean Linux install/build, completed ZIP rollout,
  authenticated API, parser and browser smoke all passed.
- [x] Authenticated hosted gate: **55/55 passed** in 3.0 minutes.
  All model successes remained synthetic fixtures.
- [x] Temporary hosted auth removed; owned dev/production servers stopped.
  Priority 13 is next.

## Priority 10 - Explicit AI destinations and privacy controls

- **Baseline:** Application `b50a40f`, verified; release close-out `9564331`.
- **Scope:** Remove implicit public-demo proxy egress, disclose configured AI
  destinations/data/retention, and add explicit local AI history controls.
  Preserve diagrams and configured production endpoints.
- **Plan:** Trace routing/configuration/status and every AI/history surface;
  implement deliberate opt-in destinations and consistent notices; separate
  local clearing from provider retention; test with synthetic providers,
  validate/build/deploy and verify hosted before priority 12.
- **Recipe:** Existing application-only App Service/GitHub pipeline. No resource,
  role, model identity or live inference changes.
- **State:** Deployed and verified as `52b5efa758c791957d23baf16277ed32484fe8bc`.

### Priority 10 trace and implementation decisions

- The only implicit public-demo egress was the image proxy helper's development
  default. It now requires an explicit approved origin; no configured direct
  destination or proxy means unavailable in every environment.
- Direct chat/image origins are validated without embedded credentials, path,
  query or fragment. Production requires HTTPS; explicit nonproduction HTTP
  loopback remains available for local fixtures. Redirects and self/chained
  proxy hops are rejected; no browser authorization/cookie is forwarded.
- A separate authenticated, no-store privacy endpoint describes selected
  capability origins, submitted data and retention limits without exposing keys,
  deployment/agent names or project paths. The original readiness endpoint keeps
  configuration booleans, with explicit configured-proxy provenance.
- Shared notices are wired into native generation/image, review, deployment and
  Whiteboard conversion. Native dialogs expose clear-session actions with request/
  upload invalidation; accepted diagram/image copies are deliberately preserved.
- Legacy history now uses opt-in persistence and
  scoped clear controls, with in-memory generated candidates and late-response
  cancellation. Do not interpret local clearing as provider-side erasure.
- Local validation: **293/293** application contracts, lint, strict TypeScript
  and standalone production build passed. The final integrated production-browser
  gate passed **64/64** in 1.6 minutes. An older guided-generation readiness mock
  was corrected to include the required image readiness boolean; assertions remain.
- Production-build destination/status endpoints confirm no implicit egress when
  configuration is absent. The disclosure and clear controls were visually
  inspected at 1440px. No live model calls or customer deployments were performed.
- Azure validation, application release and hosted verification follow.

### Priority 10 - All validation checks pass

- [x] Core application validation: 293 contracts, lint, strict types, standalone
  build and 64 production-build browser cases pass. Existing GitHub deployment
  identity/target unchanged; Linux CI repeats clean install/build and parser smoke.
- [x] Infrastructure validation/What-If: not applicable to this application-only
  update. No generated customer template is executed against Azure.
- [x] Docker build: not applicable; existing standalone ZIP deployment retained.
- [x] Static policy/role verification: no infrastructure, identity, role,
  subscription, region or provider configuration change. No new data-plane access.
- [x] Proof: local run `p10-local-gate`, 64/64; contracts `p10-full-contracts`,
  293/293; build `p10-build`, exit 0. Configuration-absent status returns
  unconfigured and privacy metadata returns HTTP 200 with no implicit origin.
- [x] Exact application release and authenticated hosted acceptance:
  GitHub Actions **35567578846**, success in **4m42s**, completed September 21
  at 06:18:55 UTC. Clean Linux build, completed ZIP rollout and authenticated
  API/parser/browser smoke passed.
- [x] Hosted integrated browser gate: **64/64 passed** in 1.5 minutes.
  Provider successes remained mocked; no live-model quality/cost claim is made.
- [x] Temporary hosted authentication removed and owned local server stopped.
  Priority 12 is next; priority 11 was already delivered.

## Priority 9 - Strict AI evidence and response contracts

- **Baseline:** Application `86cde20`, verified; documentation `970aba5`.
- **Authorization:** User resumed the remaining ordered priorities on September
  21 at 10:08 IST. The previous session cutoff is historical; proceed one
  priority at a time and preserve deployment/hosted verification gates.
- **Scope:** Review completeness, unique finding IDs, traceable evidence,
  remediation and consistent image/request bounds before provider invocation.
  Preserve earlier versioned architecture and artifact-validation guarantees.
- **Plan:** Trace/reproduce current gaps; implement shared bounded contracts,
  fail explicitly instead of dropping/truncating content; test server and UI
  boundaries with deterministic fixtures; validate/build/deploy and verify hosted.
- **Recipe:** Existing application-only GitHub Actions/App Service pipeline.
  No new Azure resources, roles, model changes or generated customer IaC execution.
- **State:** Deployed and verified as `b50a40fb3e3b75dc272b25b340e4b4580c9828f8`.
  Priority 10 follows after this release close-out.

### Priority 9 reproduced gaps and implementation

- Reproduced acceptance of duplicate finding IDs, mismatched guidance URLs,
  missing structured remediation and empty/fake PNGs. Generic unversioned review
  evidence accepted missing/duplicate IDs. The legacy route silently sliced
  evidence at 30,000 characters and dropped remediation from its Markdown.
- Separate historical-read compatibility from strict new review acceptance.
  New results must include unique IDs, evidence status, exact reference arrays,
  matching framework sources and complete steps/validation/tradeoff remediation.
  Server corrections and client rendering use the same new-result contract.
- Validate bounded review graph IDs/references without stripping legacy metadata;
  retain the entire graph up to an explicit 120,000-byte budget and reject larger
  evidence before inference. Bounded correction output is retained in full,
  not silently cut. A 128,000-byte response ceiling rejects oversized results.
- Explanation requests now use the same bounded evidence intake, not unbounded
  JSON parsing. UTF-8 decoding rejects invalid input rather than replacing bytes.
  Azure chat completions require explicit normal termination; valid-looking JSON
  from length/content-filter/refusal results is never accepted as complete.
- Shared PNG/JPEG/WebP validation and full server-side decode are implemented;
  both review and Whiteboard conversion use them before
  provider invocation. Tests use deterministic image fixtures, not live models.
- Existing application-only target, no subscription/resource/role/model changes.
  Initial gaps are reproduced and covered; local integration passes. Hosted
  release verification remains pending.

### Priority 9 - All validation checks pass

- [x] Existing application-only CI/CD target and unchanged permissions/resources.
- [x] `npm run test:playground`: **279/279 passed**, including 17 real image
  container/pixel/size/animation tests and exact review/evidence regressions.
- [x] `npm run lint`, strict TypeScript and standalone `npm run build`.
- [x] Final production-build affected-surface browser suite: **37/37 passed**
  in 56.9 seconds; model access was disabled and provider successes were fixtures.
- [x] Image provider boundaries reject corruption even when image headers look
  plausible. Real maximum byte/pixel tests use Sharp-generated fixtures.
- [x] Static role/policy review: no infrastructure, new role or AI configuration
  change. Docker and live customer What-If do not apply to this ZIP app release.
- [x] Azure validation workflow completion and owner-scoped release baseline.

### Priority 9 - Section 7: Validation Proof

Complete legacy evidence beyond 30,000 characters is preserved; oversized graphs,
duplicate/dangling IDs and invalid UTF-8 are rejected before provider calls.
New reviews require complete remediation and validated references; historical
reads retain legacy optional fields without inventing them. Partial/refused
Azure chat completions are rejected even when the text is parseable JSON.

Shared client-safe PNG/JPEG/WebP checks and server full-pixel decoding are wired
to both review and conversion. Sharp 0.34.5 was already installed transitively;
it is now an explicit required runtime dependency. npm lock-only operations hit
an unrelated pre-existing optional Tailwind WASM mirror 404/cache miss. The lock
change was limited to its existing Sharp root requirement and required dependency
flags; package versions/resolved URLs/integrities were not changed. `npm ls sharp`,
decoder tests, strict types and production build passed. CI `npm ci` must also
pass before the release is accepted.

Hosted verification is not implied by local results. No live inference,
customer infrastructure execution, Azure resource creation or permissions change.
Remote master/HEAD verified as `970aba575e933f5cd72c4751d71dd0e9617eb7cd`;
the rollout recipe and deferred competitor checkpoint are unchanged.

### Priority 9 - Deployment and hosted proof

- [Run 35564152616](https://github.com/sauravraghuvanshi/architecture-playground/actions/runs/35564152616)
  succeeded in **5m14s**, including clean Linux `npm ci`, native parser packaging,
  completed async rollout and authenticated smoke.
- **37/37 hosted browser cases passed in one run** (53.1 seconds), covering
  strict new review rendering, complete remediation, image/evidence rejection,
  conversion, model persistence, artifact validation and publication consent.
- Final local proof: **279/279 contracts**, lint, strict types, standalone build,
  and **37/37 production-build browser tests**. No live inference/customer IaC.
- Owned local server stopped; temporary hosted authentication removed. No new
  resources, roles, endpoint or model configuration changes.
- Priority 9 complete; resume the ordered backlog at priority 10.

## Priority 8 - Validated AI-generated engineering handoff

- **Baseline:** Application `bd09594`, deployed and verified 71/71 hosted;
  documentation close-out `07c9c3a`. Competitor work remains deferred.
- **Scope:** Truthful validation of generated code and ARM artifacts, canonical
  diagram/resource mappings, resource prerequisites and cross-artifact consistency.
  Clearly distinguish passed, failed, partial and unavailable validation.
- **Plan:** Reproduce current acceptance gaps; research safe language validation
  options; establish bounded, non-executing checks and coverage reporting; wire
  generation, preview/download and publication; add adversarial fixtures and
  browser gates; validate/build/release via existing pipeline and verify hosted.
- **Safety boundary:** Never execute model-authored scripts, Terraform plan/apply,
  customer What-If or infrastructure deployment. Do not let compiler helpers read
  arbitrary server files, resolve remote modules or access Azure credentials.
  Structural parsing alone must not be labelled compiler/provider verification.
- **Recipe:** Existing application-only GitHub Actions/App Service pipeline.
  No customer infrastructure or model endpoint/identity changes.
- **State:** Deployed and verified. Feature `9c9e498` plus rollout correction
  `86cde202b25da1c2c69a78ca7ffdc5ccdc73de44`; final hosted acceptance 77/77.
- **Latest user cutoff:** finish this priority, deploy and verify it, update
  today's Markdown summary/lessons/backlog, then stop. Do not start priority 9
  or competitor work today.

### Priority 8 reproduced acceptance gaps

The current production-imported draft parser accepts all five synthetic probes:

1. Malformed Bicep text.
2. Malformed Terraform/HCL text.
3. A VM resource mapped to the canonical App Service diagram identity.
4. An App Service with no plan prerequisite/reference.
5. Parameter-only code paired with an ARM template claiming a service resource.

No probe was executed as a script, compiled against customer files, submitted to
Azure or published. These expose missing artifact validation, not live resource
changes. Existing checks only cover response shape, restricted ARM content and
one-to-one resource-map rows.

- The publication endpoint currently accepts only ARM JSON for Foundry drafts,
  losing code/evidence context. Server-side revalidation must bind the reviewed
  artifact set; a client/model-supplied "passed" flag cannot authorize handoff.
- Reuse canonical resource identity and the 14 existing trusted offline mapping
  kinds for initial supported coverage; do not infer types from display labels
  or treat primitive/unknown service nodes as proven provisionable resources.
- Syntax parsing, compiler/type checks, resource inventory consistency,
  prerequisite coverage, and environment validation must be distinct results.
  Unsupported or unavailable checks must not silently become passes.
- Microsoft's [What-If guidance](https://learn.microsoft.com/azure/azure-resource-manager/bicep/deploy-what-if)
  distinguishes static Template validation from provider/permission preflight
  and documents unresolved-expression/short-circuit limits. This release must
  not claim that local parsing proves availability, policy, permission or runtime
  deployment success. No live What-If will be run for these tests.
- Safe JS/WASM grammar/compiler options are being researched. A normal Bicep
  compiler can load files/modules during compilation, so simply spawning it on
  arbitrary model text on the application host is not an acceptable shortcut.

### Priority 8 validation architecture

- Use pinned **official parser-only APIs**: Azure.Bicep.Core 0.47.16 lexer/parser
  in a trusted .NET adapter, and HashiCorp HCL v2.25.0 byte parsing in a trusted
  Go adapter. Never instantiate the full Bicep compiler or evaluate HCL
  expressions. Tree-sitter grammar acceptance alone is too permissive to serve
  as the authoritative gate; the older CDKTF wrapper is sunset.
- Build immutable parser helpers in controlled CI/local tooling, not during
  HTTP requests. Requests pass bounded text through stdin, never source paths,
  executable names, switches, module locations or package installation commands.
  Helpers have scrubbed environments, bounded output/time and process isolation.
- Official PowerShell parser behavior and Bash non-executing syntax mode are
  receiving a separate safety check before selection. Imperative script/ARM
  equivalence will not be inferred from a successful syntax parse.
- Separate syntax diagnostics, supported resource mapping/coverage, prerequisite
  checks and bounded static code/ARM comparison. Computed/dynamic constructs
  outside the comparison profile remain explicitly indeterminate, not passes.
  No parser result establishes provider schema, quota, RBAC or deployability.
- Generation and Portal publication must use server-derived checks over the
  complete reviewed code/ARM/evidence set. Client/model validation flags are
  never trusted. Preserve existing explicit publication consent and offline
  deterministic export provenance.
- Changes remain application-only; no cloud validator resource or new role is
  provisioned. Node 20 lifecycle modernization remains recorded for priority 16;
  this feature does not certify the overall platform's runtime lifecycle.

### Priority 8 implementation checkpoint

- Go was missing locally. Installed official Go 1.27.1 in session storage,
  verified its SHA-256 against the official release manifest, and left global
  PATH untouched. Existing .NET SDK 10.0.400 matches the selected Bicep release.
- Implemented the official HCL byte-parser adapter with bounded input/tokens,
  nesting and AST projection. It never evaluates expressions or reads module/file
  targets from submitted code. Native tests and four Node bridge integration
  tests passed, including real syntax rejection, cancellation, unavailable
  helpers and a two-process concurrency bound.
- Added initial derived-check/coverage contracts and canonical primary/support
  resource policies. Seven policy tests pass, covering all 14 existing mapping
  kinds and rejection of wrong service types, missing prerequisites and forged
  success/publication flags.
- NuGet v3 failed locally with a TLS handshake error. The official NuGet v2
  feed restored the pinned library successfully without disabling certificate
  validation. Dependency locks are being retained for reproducible builds.
- Bicep now uses the official string-only lexer/parser and syntax AST. GNU Bash
  uses fixed noninteractive no-execute arguments, a fresh environment, and
  rejects stderr warnings. PowerShell's public parser was found to perform
  loading/resolution; it is deliberately not invoked on model text.
- The server derives six separate checks and explicit coverage. Failed checks
  get at most one correction; unverified checks stay review-only. Publication
  revalidates the full code/ARM/mappings/evidence set rather than trusting flags
  or a disconnected ARM-only request. The UI displays/downloads the report.
- Trusted helpers are locked, built and native-smoke-tested in the existing
  pipeline; the standalone package checks source/platform fingerprints and
  retains dependency notices. New hosted static smoke performs no AI call,
  publication or resource deployment.
- Final local proof: 247/247 existing contracts, 17/17 real parser/policy
  integration cases, native Go tests, lint/types/standalone build and **77/77
  production-build browser cases**. The actual new endpoint rejects all five
  reproduced acceptance gaps. Report UI was visually inspected.
- Scope remains bounded static checks, not full compiler/provider or deployment
  equivalence. Scripts, computed/unsupported expressions, unresolved Function
  roles and unproven declared requirements remain explicitly unverified.
- Release/hosted verification remain open. Stop after completing this priority
  and today's documentation; do not begin priority 9.

### Priority 8 - All validation checks pass

- [x] Existing application-only Actions target and owner-authorized repository.
- [x] `npm run test:playground`: 247/247.
- [x] `npm run test:artifact-parsers`: 17/17, plus native Go adapter tests.
- [x] Previous CLI/PowerShell executable safety regression: 88/88.
- [x] `npm run lint`, strict TypeScript, locked parser build and standalone build.
- [x] Real endpoint, UI/report/download/consent and broader regression: 77/77.
- [x] Static role/policy review: no new application roles or Azure resources.
  Parser-only validation cannot perform customer What-If, provider setup or
  generated-script execution. Docker/infrastructure validation is not applicable.
- [x] Dependency notices and generated-file hygiene.
- [x] Azure validation workflow and final release checks.

### Priority 8 - Section 7: Validation Proof

Local checks completed during the September 20 session, continuing into
September 21 IST. The final 77-case production-build browser gate passed in
2.0 minutes. It includes actual parser-backed HTTP validation, the five original
bad-artifact probes, Bash syntax-only behavior, PowerShell's unverified state,
complete artifact binding, report download, and all prior model/history/
persistence/boundary/template/conversion workflows.

The helper integration tests verify that file/module expressions remain syntax,
no Bash commands/startup hooks run, unsupported/missing parsers do not become
passes, and concurrency/cancellation are bounded. Windows helpers are verified
locally; the changed CI workflow must build/test Linux helpers and then run the
authenticated hosted validation smoke before release acceptance.
The final report UI screenshot was inspected for readability, explicit limits,
coverage and downloadable evidence. Final lint, strict types, whitespace checks
and the 88-case script-safety regression passed. Remote master remained
`07c9c3a233cef93e4ce0a08d962ac8c3540d19fb`; the local HTML audits remain ignored,
and deferred competitor work remains pinned at `c4b91a44`.

### Priority 8 - Rollout gate correction

- Initial application release `9c9e498` built and native-smoke-tested Linux
  helpers successfully in [run 35537875276](https://github.com/sauravraghuvanshi/architecture-playground/actions/runs/35537875276).
  Its new hosted smoke initially received 404 because the existing pipeline
  accepted asynchronous ZIP upload and checked the still-healthy old app after
  a fixed 30-second wait. The larger parser package made that race visible.
- A subsequent authenticated probe returned the new endpoint with
  `azure-bicep-parser 0.47.16`, and the complete Bicep/HCL/Bash/PowerShell-limit
  hosted smoke passed without any model, publication or infrastructure call.
- The coupled pipeline fix now follows the upload's trusted same-origin SCM
  operation URL until completed, rejects failure/unknown states/foreign URLs,
  and bounds the wait. Initial new-endpoint readiness tolerates only transient
  404/502/503 startup responses; validation assertions are unchanged.
- Two new mocked deployment-operation tests and lint passed. No generated-code
  validation rules, application roles or infrastructure changed in this fix.
  A clean workflow run and full hosted acceptance are still required before
  task 8 is marked complete.
- Gate-fix revalidation: 249/249 full contracts, lint and strict types passed.
  The application/parser source is unchanged from the locally built, 77-case
  verified release and successful Linux build/native smoke. The actual hosted
  validator now passes the complete new static smoke.
- [x] Same application-only target; no Docker, infrastructure or role changes.
- [x] New deploy-operation tests and full contract/static regression.
- [x] Existing unchanged application build proof and hosted parser smoke.
- [x] Rollout-fix validation workflow completion.

### Priority 8 - Final release and stopping point

- [Run 35538732835](https://github.com/sauravraghuvanshi/architecture-playground/actions/runs/35538732835)
  deployed `86cde202b25da1c2c69a78ca7ffdc5ccdc73de44` successfully in **4m22s**.
  Native Linux helper smoke, completed SCM rollout, authenticated API smoke,
  the new real parser-backed hosted smoke and live browser smoke all passed.
- **77/77 hosted acceptance cases passed in one run** in 4.7 minutes. This
  includes real Bicep/HCL validation, all five reproduced rejection cases,
  controlled Bash parsing, explicit PowerShell non-verification, report UI/
  downloads, complete artifact binding, and previous core-workspace regressions.
- Final source evidence: **249/249 application contracts**, **17/17 parser/policy
  cases**, native Go tests, **88/88 prior script-safety cases**, lint, strict types,
  locked helper packaging and standalone build. Local browser gate: 77/77.
- Temporary hosted authentication state was removed. Owned local servers are
  stopped. No real model inference, customer IaC execution, infrastructure or
  role change occurred. Local audit HTML and competitor checkpoint remain intact.
- Task 8 is complete within the documented bounded static profile. PowerShell
  syntax, script effects, full compiler/provider semantics and Azure environment
  checks are not silently certified.
- **Stopped per user instruction. Do not start task 9 or competitor work.**
  Next-session context is in [session summary](../docs/session-summary-2026-09-21.md)
  and [implementation roadmap](../docs/implementation-roadmap.md).

## Priority 7 - Shared typed and versioned architecture model

- **Baseline:** Application `c271483`, priority 6 deployed and verified within
  its scope; close-out `7119fb0`. Competitor checkpoint remains deferred.
- **Scope:** One shared architecture contract for canonical services/providers,
  configuration, environments, boundaries, relationships, requirements and
  evidence, with explicit migration of existing representations.
- **Plan:** Trace current schemas and adapter loss points; define bounded
  backward-compatible metadata and version handling; wire every relevant
  persistence/canvas/AI/conversion/code-input surface; prove round trips and
  migration failures without replacing valid user content; validate/build,
  deploy via the existing pipeline, and verify hosted.
- **Constraints:** Preserve existing visual/identity/geometry/history contracts.
  Do not invent region/SKU/requirements or claim semantic evidence from layout.
  No live model inference, customer IaC execution or new application resources.
- **Recipe:** Existing application-only GitHub Actions/App Service release.
- **State:** Deployed and verified as
  `bd095946e0c78005cdc5e6c2f161e11d0f8af266`; hosted acceptance passed 71/71.

### Priority 7 trace and implementation decisions

- Native types currently live in the React canvas; a separate Zod rebuild drops
  all unrecognized metadata. The React Flow adapters rebuild nodes/edges and
  discard service configuration. Root context is absent from canvas history.
- The legacy graph has provider/properties/metadata and relationship semantics,
  but the native adapter drops them. Whiteboard conversion explicitly discards
  its textual evidence. The review request rebuild drops root metadata.
- Introduce a shared, UI-independent version-1 architecture payload contract.
  Unversioned native payloads migrate explicitly; unknown/future versions fail
  before canvas mutation. This is separate from library envelope and legacy
  storage versions. Preserve existing geometry and visual field names.
- Use bounded shared metadata for environments, requirements and evidence;
  typed node configuration/provider and typed relationship context. Validate
  references and provider consistency without inventing regions, SKUs or trust.
- Retain compatible legacy adapters and storage; share semantic schemas/types,
  migrate existing service properties, preserve root metadata, and reject
  unsupported version migrations explicitly.
- Preserve semantic metadata through native history/serialization, document
  save/reload, conversion, review and deployment inputs. Add editable region/SKU
  and relationship fields in the existing Inspector. Offline code must disclose
  configuration it cannot honor rather than silently claiming equivalence.
- Add migration/reference/round-trip tests and native/legacy/AI boundary tests,
  plus hosted import/edit/save/review/export journeys with deterministic mocks.
  No competitor Outline/mapping-editor/packet work is included.

### Priority 7 implementation and initial verification

- Shared Zod/type contract and explicit unversioned-to-v1 native migration;
  future schemas fail closed. Known aliases canonicalize without label guesses.
- Native history/serialization preserves detached semantic metadata and root
  context. Legacy import/generation uses the same semantic schemas.
- Inspector exposes declared region/SKU/environment, typed relationships,
  original intent and source-labelled requirement/evidence context. JSON remains
  the complete authoring interface for environment/evidence definitions.
- Guided generation retains the original prompt and user constraints separately
  from model prose. Whiteboard conversion retains textual model observations
  without persisting the transient PNG. Review/deployment inputs keep context,
  and context changes invalidate a previous review.
- Offline IaC explicitly reports per-service settings/requirements it does not
  implement; this model is not a claim of complete deployment configuration.
- Initial 242/242 full contracts, lint/types/build, 88 script-safety tests and
  17 real IaC compiler fixtures passed. New browser journeys passed 3/3.
- Broad local browser run first found four outdated expectations of unversioned
  JSON. Expected values now use the migration contract without dropping fields.
  A subsequent 68/69 run exposed empty scratch recovery recreating a deleted
  diagram. Recovery now ignores version-only empty payloads while preserving
  metadata-only and annotation-only work; its new unit regression passes.
- Final trace also found that the legacy UI unwrapped file envelopes without
  checking their version and could overwrite an unsupported autosave. Both
  paths now reject unsupported versions, pause writes with a visible warning,
  retain the original data, and preserve valid legacy source keys during restore.
- Final code checks: **244/244 contracts**, lint, strict TypeScript and standalone
  build passed. **71/71 production-build browser cases passed** in 3.1 minutes,
  including the new five-case model/native/legacy acceptance suite.
- PowerShell harness scratch roots now use ignored `node_modules/.cache`,
  matching CLI tests. The changed harness passed 26/26 alongside concurrent
  full lint without the cleanup race. No production files changed in that step.
- Azure validation, application release and hosted verification subsequently
  completed; exact release proof follows.

### Priority 7 - All validation checks pass

- [x] Core application-only checks: existing Actions target, owner-scoped GitHub
  access, unit/contract tests and local HTTP 200 readiness.
- [x] Docker, infrastructure What-If and live role/policy changes: not applicable
  to this existing standalone application ZIP release. No provisioning is planned.
- [x] `npm run test:playground`: 244/244.
- [x] `npm run lint`, strict TypeScript and `npm run build`.
- [x] Final production-build browser suite: 71/71, with no timeout relaxation.
- [x] Prior IaC safety: 88/88 executable mocks and 17/17 real compiler fixtures.
- [x] Static role review: no change to previously reviewed generated host roles;
  no changes to deployed application permissions or AI configuration.
- [x] Test-harness cleanup handoff and concurrent lint verification.
- [x] Validation workflow completion.

### Priority 7 - Section 7: Validation Proof

Validated locally on 2026-09-20. The 71-case final browser run covers model
metadata edit/history/persistence, future-version protection in both editors,
exact code downloads, nested boundaries, named documents, recovery, Whiteboard
conversion, all bundled templates, exports and prior identity/undo behavior.
Earlier test-only issues (unversioned expectations, combobox label selection and
two incorrectly nested new tests) were corrected without weakening assertions.
The real empty-recovery and legacy-version overwrite risks found during the
trace were fixed and have unit/browser regressions. No live model inference,
customer IaC execution, new infrastructure or role changes were used.
Final harness handoff was rechecked with both executable suites (88/88) running
alongside full ESLint and strict TypeScript. All passed. Remote master remained
`7119fb021eaaa6fcb388e66ecf9759986bcba497`; the deferred competitor checkpoint
remained `c4b91a44d33066e9aceb011a086d57f445a95d0f`.

### Priority 7 - Deployment and hosted verification

- Released `bd095946e0c78005cdc5e6c2f161e11d0f8af266` through
  [Actions run 35527006724](https://github.com/sauravraghuvanshi/architecture-playground/actions/runs/35527006724).
  The pipeline succeeded in 2m25s, including authenticated API/browser smoke.
- **71/71 hosted browser cases passed in one run** (3.8 minutes), matching the
  final local suite. This includes all five new native/legacy model cases:
  metadata edit/history/save/reload, failed future imports, AI context handoff,
  preserving future-version autosaves while editing, and legacy envelope checks.
- Existing artifact downloads, all templates, nested boundaries, persistence,
  Undo/Redo, Whiteboard conversion and graphics exports passed in that run.
  This does not erase the separately recorded intermittent export/browser
  limitations or certify other browsers.
- Temporary hosted authentication state was removed. No owned local server
  remains running. No live model inference, customer IaC execution, provisioning,
  permission or AI endpoint/model configuration changes.
- Shared contract documentation: [architecture model](../docs/architecture-model.md).
  Metadata remains declared context, not verified deployment configuration;
  complete context authoring is available through JSON, and offline IaC warns
  about configuration it does not implement.
- Priority 7 is complete. Continue with priority 8 before competitor stage 3.

## Priority 6 - Repair offline infrastructure-code generation

- **Baseline:** Application `98e130c`, verified and deployed; documentation
  `168e609`. Deferred competitor work remains isolated and excluded.
- **Scope:** Native and legacy generated artifact syntax, duplicate declarations,
  safe/unique names and symbols, Function App prerequisites, and consistent
  configuration across ARM/Bicep/Terraform/CLI/preview surfaces.
- **Plan:** Reproduce failures with real local parsers/compilers; ground fixes
  in current official schemas; reuse one emitter model where practical; test
  supported single-resource and mixed/repeated-service graphs; validate the
  app build and browser downloads; deploy the application and verify hosted.
- **Safety boundary:** No Terraform apply/plan, Azure deployment, resource-group
  creation or customer What-If execution for generator testing. Preserve
  Entra-only SQL and the PowerShell preview-only contract.
- **Recipe:** Existing application-only GitHub Actions/App Service pipeline.
  No application infrastructure, role or model configuration changes.
- **State:** Deployed as `c2714836180d7dca9403c75976d4bc067f4905de`.
  Priority 6 hosted artifact/consent acceptance passed. Broader browser timing
  limitations are recorded below rather than represented as an all-green run.

### Priority 6 reproduced failures and implementation decisions

- Portable local validators were missing. Installed official, checksum-verified
  Terraform 1.16.3 and Bicep 0.47.16 in the session tools directory, not system
  paths. Current AzureRM release is 5.6.0.
- Real Terraform parsing rejects one-line multi-argument variables/resources
  and nested blocks. Bicep rejects leading-digit symbols. ARM duplicate-label
  fixtures produce duplicate site and storage resource names.
- Use a shared deterministic per-node naming allocation with collision checks,
  valid symbols and bounded service names. A common explicit namespace/suffix
  will be used across output formats; generated naming changes require review.
- Keep all generated formats aligned to an explicitly selected existing resource
  group. Terraform reads it; CLI validates it. No implicit group creation.
- Use Node 22 / Functions runtime 4, verified against the Functions template tool.
  Dedicated-plan Functions get a separate keyless host storage account and a
  scoped user-assigned identity/Blob Data Owner role before app creation; retain
  system identity for separately approved workload access. Additional trigger
  permissions and private networking are not inferred.
- Reuse the native emitter from legacy export rather than maintain a second
  divergent implementation. CLI will use the matching Bicep companion, preview
  by default and require an explicit deploy flag for writes; PowerShell remains
  preview-only with no deployment mode.
- Validate syntax/schema with real tools and assert dependency/configuration
  consistency. No Terraform plan/apply or live Azure deployment of fixtures.

### Priority 6 implementation and local proof

- Shared names are deterministic under node reordering and bounded for storage,
  vaults and other mapped resources. Invalid/duplicate service IDs stop generation.
- All 14 supported kinds, one combined graph, a repeated-kind graph and unusual
  labels passed real Bicep 0.47.16 builds, native/compiled ARM inventory checks,
  Terraform 1.16.3 formatting and AzureRM 5.6.0 validation: 17/17 fixtures,
  no provider-validation warnings/errors.
- Nine new production-imported contracts cover safe ARM broker acceptance,
  naming/determinism, legacy/native parity, Function identity/storage/roles,
  workspace/subnet prerequisites, common configuration and credential exclusion.
  The ARM broker accepts the new scoped host roles without changing restrictions.
- Local validation does not establish global name availability, regional
  capacity, live policy compliance, workload deployment or connectivity.
  The supported outputs remain explicitly reviewed starter drafts.

### Priority 6 - All validation checks pass

- [x] Core application-only validation: owner-scoped GitHub access and unchanged
  Actions target; package build and local HTTP readiness verified. Generated
  customer IaC is not the application infrastructure and is not submitted to
  Azure validate/What-If as part of this release.
- [x] Docker build: not applicable to this existing standalone ZIP deployment.
- [x] Azure policy/resource diff: not applicable; no infrastructure, SKU,
  subscription, region or role changes to the hosted application.
- [x] `npm run test:playground`: 231/231 unit/contract cases.
- [x] `npm run test:iac-compilers`: 17/17 compiler/provider fixtures, including
  repeated labels, Unicode, leading digits and an actual FNV hash collision.
- [x] `npm run lint`, strict TypeScript and standalone `npm run build`.
- [x] Production-build local browser regression: 39/39, including exact CLI,
  Bicep, Terraform and ARM downloads, repeated Functions and publication consent.
- [x] Visual inspection of offline CLI notice and Function warnings.
- [x] Final mocked CLI/PowerShell execution safety suites: 62/62 Bash and
  26/26 PowerShell; 88/88 combined. They execute generated scripts against
  isolated command mocks, not Azure.
- [x] Static role review: host Blob Data Owner is scoped to each dedicated
  Function host storage account; no application role or infrastructure changes.
- [x] Existing application-only Actions pipeline and remote baseline `168e609`;
  competitor checkpoint `c4b91a44` remains isolated.
- [x] Validation workflow completed and final evidence recorded.

### Priority 6 - Section 7: Validation Proof

The commands above completed successfully against the current candidate.
The initial browser command used backslash paths that Playwright treated as
regular-expression escapes and found no tests; filename selectors corrected
the invocation. All 39 selected cases subsequently passed in 1.1 minutes.
Compiler fixtures only downloaded the public provider and ran local checks;
no generated customer deployment/What-If or real AI inference was performed.
Hosted verification is pending application release, not implied by local tests.

The executable safety suite found a real PowerShell edge case: the .NET `$`
anchor accepted a namespace ending in a newline. Absolute `\A`/`\z` anchors now
reject it before context/resource access, with the regression retained.
The final rebuilt standalone application returned HTTP 200 with AI disabled;
all ten deployment-assistance browser cases passed again against that build.
An initial concurrent lint scan raced temporary mock-directory cleanup; scratch
roots now live under ignored `node_modules/.cache`. The 62-case CLI suite and
concurrent full lint then passed without the race. Strict types and build passed.

### Priority 6 - Deployment and hosted verification

- [Actions run 35521466617](https://github.com/sauravraghuvanshi/architecture-playground/actions/runs/35521466617)
  deployed exactly `c2714836180d7dca9403c75976d4bc067f4905de` successfully
  in 2 minutes 26 seconds, including authenticated API/browser smoke.
- Hosted affected-surface run: 36/39 passed. All ten deployment-assistance cases
  passed, including exact downloaded CLI/Bicep/Terraform/ARM content, repeated
  Function prerequisites, preview-only PowerShell and no automatic publication.
- The initial broader run had one Chromium context-creation timeout before
  navigation and two connection-selection timeouts. All three passed on each
  of two serial rechecks without assertion/timeout changes.
- The complete enterprise recheck was 9/10: one GIF completion event exceeded
  its 90-second wait; that journey passed in the initial run and the other
  repeat. Screenshot showed "GIF export downloaded" by failure capture time.
  This remains an intermittent export/timing limitation for priorities 15/20/21,
  not a claim of universally reliable graphics export. No export/canvas runtime
  code changed in this release. All 39 distinct selected cases passed at least
  once; the broader suite was not uniformly green.
- No real model inference, customer IaC execution, Azure provisioning or role
  modification. Both temporary hosted auth files were removed, and owned local
  servers stopped. Deferred competitor checkpoint remains untouched.
- GitHub noted Node 20 action deprecation and a future Ubuntu runner migration;
  pipeline modernization/release gates remain priority 16, not silently changed.
- Priority 6 is complete within its offline-artifact scope. Priority 7 is next.

## Priority 5 - Canonical service and provider identification

- **Baseline:** Deployed application `94e1abc`; verification/order documentation
  `ebbb1cb`. The four user-reported fixes are complete.
- **Scope:** Trace prompt scaffolding, provider-locked catalog resolution and
  offline generation. Preserve service identity when labels change, avoid
  duplicate/wrong App Service scaffolds and cross-cloud substitutions, and
  explicitly report unmet/unsupported prompt requirements.
- **Boundary:** Preserve the conversion/template identity fixes already shipped.
  Do not include deferred Outline/collapse/mapping-editor/packet work or the
  separate priority 6 compiler/naming backlog.
- **Plan:** Finish parking competitor WIP after all agents pause; reproduce the
  remaining identity defects; implement a shared deterministic identity contract;
  add exact regression cases; validate/build/deploy through the existing
  application-only pipeline and verify production.
- **State:** Implemented, deployed and hosted-verified as `98e130c`.
  Deferred competitor WIP is isolated at
  `c4b91a44d33066e9aceb011a086d57f445a95d0f`, pinned by
  `refs/checkpoints/deferred-competitor-a7e748c4`. It is not part of this release.
  No infrastructure, role or model configuration changes are planned.
- **Verification:** Local proof recorded below. Continue using GPT-6 Astra and deterministic model
  fixtures; no unverified model calls or customer IaC execution.

### Priority 5 implementation

- Reproduced wrong App Service feature/file picks, cross-cloud Key Vault
  substitution, unknown AWS-to-Panorama fallback, and label-induced Azure
  Function App generation from App Service or AWS Lambda nodes.
- Extracted the shipped finite alias resolver into shared service identity.
  Exact IDs and explicit providers are authoritative; no partial-token guesses.
- Prompt scaffolding uses exact product IDs, one instance per canonical service,
  separate product variants and explicit coverage/proposal diagnostics.
- Both native and legacy Azure generators use a canonical resource-kind
  allowlist, not editable labels or broad family regexes. Zero-mapping outputs
  cannot expose a deployable download. Legacy AI rejects unresolved identity
  atomically without replacing the current canvas or claiming success.
- Targeted unit/contract run: 83 passed; prior PowerShell safety: 8 passed.
  Full suite checkpoint: 222 passed. Six new browser journeys passed locally.
  Strict types and lint passed after correcting a test-only union narrowing.
- Both manual icon pickers now include and rank exact product aliases without
  crossing their provider filter. Generic SQL without provider evidence remains
  ambiguous; named resource variants do not collapse into base services.
- Final dev identity browser suite: 7/7 passed. Final full contracts: 222/222,
  lint and the standalone build passed. A 36-case affected-surface production
  browser run is underway; hosted verification follows deployment.

### Priority 5 - Section 7: Validation Proof

- `npm run test:playground`: 222/222 passed, including ten new production-imported
  identity contracts, all 303 non-Azure catalog entries, rename invariance across
  formats, named variants, catalog gaps and atomic legacy refusal.
- `npm run test:powershell-preview`: 8/8 passed with mocked Azure commands.
- `npm run lint`, `npx tsc --noEmit --incremental false` and the final
  `npm run build` passed. The standalone artifact responds with HTTP 200.
- The first affected-surface run passed 35/36; conversion reload stalled.
  Tracing found 3,085 eager cloud-icon SVG requests across the journey and
  delayed IndexedDB completion. No model or stored-identity corruption occurred.
- The modern picker now defers hidden catalog images, matching the legacy
  picker's existing lazy-loading approach. The same conversion journey makes
  four cloud-icon requests. Both reload repeats and both request-bound checks
  passed without relaxing their timeouts.
- Final standalone affected-surface suite: **37/37 passed** in 2.6 minutes,
  covering eight identity/search/load cases, offline preview/deployment consent,
  architecture editing/exports, round trips, all 16 templates and conversion.
- UI appearance inspected on the final candidate. All AI/publication browser
  responses remain fixtures; no real model invocation, customer IaC execution,
  resource provisioning or role change.
- Existing pipeline/owner permission remains applicable. Remote master is
  `ebbb1cb7ce89b0072f2abc65bfaca4763c3f0a10`; no deployment workflow changes.
- Deferred competitor changes remain isolated at checkpoint `c4b91a44`;
  they are absent from this candidate. Priority 6 compiler/naming repair is
  explicitly not represented as completed by identity correctness.

#### Priority 5 - All validation checks pass

- [x] Unit/contracts, preview safety, lint, strict types, standalone build.
- [x] Full affected-surface browser gate 37/37.
- [x] Existing application-only CI/CD target and owner-scoped permission.
- [x] Static role review: no new identity or permissions; unchanged AI endpoints.
- [x] Infrastructure What-If/Policy/Docker checks are not applicable to this
  code-only standalone zip release.
- [x] Complete azure-validate using actual recorded proof.
- [x] Deploy and verify the exact hosted release.

### Priority 5 deployment result

- Application: `98e130caf43060641f3b9dbf8d7f0be87cf69d83`.
- [Actions run 35515116214](https://github.com/sauravraghuvanshi/architecture-playground/actions/runs/35515116214)
  succeeded in 2 minutes 57 seconds, including authenticated API/browser smoke.
- Production: https://architecture-playground.azurewebsites.net.
- Hosted affected-surface acceptance: **37/37 passed in one run** (2.5 minutes).
  The exact identity, asset-search/request-bound, generator, conversion,
  persistence, export and template behavior is verified on the deployed app.
- Local final gate also passed 37/37; full contracts 222/222, mocked preview
  safety 8/8, lint/types/build passed. No live model calls or customer resources.
- Temporary hosted authentication state removed and owned local server stopped.
  No infrastructure/roles were provisioned, so new-resource live RBAC checks
  are not applicable.
- Next: priority 6, per the user's autonomous sequential instruction. The
  compiler/naming/configuration backlog is not implied fixed by this release.

## Delivery order - latest user instruction

1. The four screenshot-backed fixes are complete, deployed and hosted-verified.
2. Continue the remaining numbered priorities sequentially from the roadmap's
   next item (now 6).
3. Resume competitor-inspired product additions only after that backlog.

Competitor additions started locally are deferred and will be preserved in a
local WIP checkpoint, not included in priority releases. The user authorizes
autonomous sequential work but explicitly prioritizes correctness over rushing.

## Deferred research-to-product upgrade

The user clarified that competitor research must drive shipped capabilities,
not stop at a comparison report. Existing deployed baseline: `94e1abc`,
Actions run `35505636125`. Preserve the four fixes and their evidence below.

- **Implement:** Searchable, keyboard-usable architecture Outline; reveal/focus
  and explicit hierarchy actions; non-destructive boundary collapse/expand and
  remove-boundary/keep-contents with Undo; editable canonical service mappings
  before Whiteboard conversion is applied; a real architecture engineering
  packet export with diagram, complete JSON, inventory, connections and mapping
  coverage/provenance.
- **Model contract:** Optional bounded mapping provenance and collapsed view
  state, preserved through native history/persistence/JSON. View projection must
  never rewrite real edge endpoints or delete hidden nodes.
- **Boundaries:** No speculative cloud pricing, automatic provisioning, new
  identities or real-time collaboration backend. Do not claim complete parity
  with Lucid/Cloudairy. Ship concrete improvements to the core architect workflow.
- **Validation:** Pure helper and UI contracts, view/provenance round-trips,
  collapse/restore/ungroup safety, mapping correction, package escaping and
  offline use, then local production build and hosted acceptance.
- **Deployment:** Existing application-only GitHub Actions/App Service recipe.
  GPT-6 Astra only for engineering. AI testing remains deterministic fixtures.
- **State:** Deferred by the user's latest ordering instruction. Local work is
  not deployed; it must be resumed and revalidated only in stage 3.

## Whiteboard fidelity and nested cloud boundaries - user-selected interruption

This work takes precedence over the numbered roadmap at the user's request.
Baseline: application `d70340c`, documentation `7621e77`. Preserve prior releases.

- **Target/recipe:** Existing application-only GitHub Actions/App Service release
  at https://architecture-playground.azurewebsites.net. No new infrastructure.
- **Scope:** Canvas-aware AI image prompts; readable Whiteboard symbols in both
  themes; faithful service/icon identity in Whiteboard-to-architecture conversion;
  nested Landing Zone, Virtual Network and Subnet boundaries with services inside.
- **Research:** Inspect current implementation and publicly documented Cloudairy
  and Lucidchart capabilities. Record evidence, differentiated opportunities and
  limits in the locally excluded Audit Report; do not claim whole-product parity.
- **Implementation plan:** Reproduce each issue; fix underlying shared behavior;
  cover themes, conversion identity, nested editing/history/save/import/export;
  validate the production build; deploy and repeat focused hosted acceptance.
- **Model/testing boundary:** GPT-6 Astra for engineering work. Use deterministic
  AI fixtures unless an explicitly permitted image-model test can be performed;
  never misrepresent fixtures as proof of live image aesthetics.
- **Validation proof:** Recorded below. No deployment until azure-validate completes.
- **Rollback:** Redeploy the previous application; export diagrams before moving
  back to an older client that may not understand nested architecture boundaries.

### Boundary implementation and intermediate verification

- Added typed, parent-relative nested groups and cycle/missing-parent validation.
  Parent-first loading, ancestor-aware hit testing, explicit parent editing,
  drag-to-parent/detach, subtree deletion and resize containment share helpers.
- Cloud boundary presets include Landing Zone, Subscription, Resource Group,
  Region, Virtual Network, VPC and Subnet. Existing application tiers remain.
  The UI explicitly distinguishes conceptual design from provisioned networking.
- Native hook tests: 19 passed, including eight new hierarchy/history cases.
  Initial full contract suite: 188 passed before the parallel Whiteboard changes.
  Strict types and scoped lint pass for the architecture implementation.
- Browser verification found and corrected non-interactive boundary header text.
  Actual nested drag, reparent, delete/undo, ancestor resizing, save/reload and
  JSON/PNG exports have passed against the loopback development candidate.
- An existing connection test measured handles during fit-view animation; it now
  waits for the real handle to settle before recording coordinates, retaining
  all connection and visibility assertions. The corrected scenario passed.
- Export and boundary disclosures now use native click activation and
  focus-within dismissal rather than a delayed blur timer and mouse-only actions.
  A keyboard test initially tried to focus the workspace while its loading guard
  was inert; it now waits for actual workspace readiness, not an arbitrary delay.
- These are intermediate results, not release approval. Combined production
  build, Whiteboard/AI/conversion acceptance and hosted verification are pending.

### Combined candidate - validation in progress

- Whiteboard: literal-color rendering rather than global image inversion;
  canvas-aware prompt context, decoded image proportions, adaptive owned neutral
  symbols/foregrounds and unchanged arbitrary custom colors. Eight deterministic
  browser cases and 28 scoped unit checks passed after Workspace integration.
  Existing opaque AI rasters are not rewritten; model background compliance is
  best effort, not guaranteed transparency or a verified live-model result.
- Conversion: canonical server/client resolution maps explicit known Azure
  service names to official bundled icons. Explicit source `iconId`/`serviceId`
  metadata, when available, survives relabeling; absent/duplicate associations
  fail rather than silently losing identity. Normal Lucide-only insertion does
  not fabricate provider metadata. Eighteen scoped tests and five browser cases
  passed; original scene/binaries remain intact.
- Combined unit/contract suite: 208 passed. Previous PowerShell preview safety:
  8 passed. Repository lint, strict TypeScript and standalone production build
  passed. The first broad production-candidate run passed 63 of 70 cases.
- Corrected a CRC-invalid synthetic PNG fixture now that insertion validates
  actual decoded dimensions. Corrected an older history test that programmatically
  uploaded JSON while the workspace was inert/loading, bypassing normal user
  readiness; the complete resize/history scenario then passed twice.
- Cloudairy/Lucid research is saved as a self-contained local HTML supplement:
  14 compared capabilities and 32 source entries. Search, print, citation anchors,
  1440/390 layouts and absence of automatic external requests verified. The
  original audit and supplement remain Git-excluded.
- Existing App Service pipeline and owner-scoped push permissions rechecked.
  Remote master is the expected `7621e77454b198709e74ec918589e23ed81fddab`.
  No cloud infrastructure, identity, role, provider configuration or deployment
  workflow changes are introduced. No live model calls were performed.
- Final gate: complete broad acceptance, resolve legacy-asset readability
  coverage, then invoke azure-validate and azure-deploy before release.

### Corrective integration findings

- The broader run found a real Whiteboard live-drawing regression: semantic
  color tagging replaced an arrow while Excalidraw still held its drag reference.
  Reconciliation now waits until drawing/editing ends and transient interaction
  fields are not persisted. A nonzero-length arrow bound to two distinct symbols,
  Undo/Redo and animated GIF export passed after the fix.
- Before-release Lucide assets were verified against baseline `d70340c` with a
  real-pixel test. They contain literal navy artwork and become readable on light
  canvas without migration. Untagged legacy white text is intentionally preserved
  rather than assuming it was not a custom color.
- Shared conversion matching exposed missing known legacy-template aliases.
  Canonical provider-safe coverage and normalized persistence expectations are
  being corrected before the final candidate; false fuzzy matches are not restored.
- Persistence tests now verify exact retained binary maps rather than assuming
  one file per symbol (neutral source plus theme variants are intentional), and
  shared readers respect the active IndexedDB document instead of assuming all
  canvases remain scratch data in localStorage.
- The AI toolbar now remains disabled while readiness is unknown and exposes
  HTTP/malformed-status failures explicitly instead of presenting an enabled
  action or a silent success-shaped fallback. Three new readiness cases pass.
- Corrective readiness/storage/history browser run: 6 passed. Combined source
  checkpoint: 212 unit/contract tests, strict TypeScript and repository lint pass.
  Final production rebuild and acceptance remain required.

### Whiteboard fidelity - Section 7: Validation Proof

#### All validation checks pass - scoped application release

- [x] Core application validation: 212 unit/contract tests, 8 command-mocked
  PowerShell tests, lint, strict types and final standalone build.
- [x] Functional release gate: 32/32 changed-feature browser scenarios.
  Broader baseline/retest limitations are recorded below, not hidden.
- [x] Exact final hierarchy guard: 39/39 hierarchy/conversion tests after
  duplicate-ID rejection, followed by a successful standalone rebuild.
- [x] Existing pipeline and repository permissions checked; no new subscription,
  resources, environment, container or infrastructure artifact is introduced.
- [x] Bicep/ARM validate/What-If and Azure Policy provisioning checks: not
  applicable to this code-only zip release; no customer IaC is executed.
- [x] Docker build: not applicable to the existing Node standalone recipe.
- [x] Static role verification: no new identity, data operation or RBAC change.
- [x] Complete azure-validate workflow for the scoped release and hand off to
  azure-deploy. The unrelated snapshot timing limitation remains disclosed.

Evidence checkpoint: 2026-09-20, after 15:52 IST; existing application-only
GitHub Actions/App Service recipe, with no new infrastructure or role changes.

- `npm run test:playground`: 212/212 unit/contract tests passed, including real
  production helpers for colors, image requests, conversion, template identity,
  hierarchy, history and persistence.
- `npm run test:powershell-preview`: 8/8 passed; all Azure operations mocked,
  preserving the prior release's non-deploying preview guarantee.
- `npm run lint`, `npx tsc --noEmit --incremental false`, and `npm run build`:
  passed. The final standalone build includes the duplicate-ID hierarchy guard.
  The changed hierarchy/conversion subset was rerun after that guard: 39/39.
- Exact final artifact started successfully (HTTP 200). Its nested-template
  handoff and invalid-hierarchy retention browser smoke passed 2/2. Template
  startup uses the same explicit 30-second budget as existing gallery imports.
- Final changed-feature browser gate: **32/32 passed** on the standalone
  candidate: readiness, nested boundaries, both-canvas history, image/theme
  pixels and proportions, canonical conversion, legacy icon colors and bound
  arrow/GIF export. Models are deterministic fixtures; no live inference.
- Corrected broader candidate: **70/74 initially passed**. Three startup guards
  were corrected to wait for actual workspace readiness under the established
  canvas-startup budget and passed twice. The unchanged prior snapshot timing
  case passed one isolated repeat and failed one. All 74 distinct cases were
  verified across the run/retests, but the broad suite is not represented as
  clean or that unrelated intermittent behavior as fixed.
- All 16 bundled template imports passed with a 53-identity audited fixture:
  49 official mappings and four explicit catalog gaps. No unrelated icons are
  substituted for absent services.
- Local rendered UI and the research HTML were inspected. The HTML has 14
  capability rows, 32 evidence entries, valid in-page links, working search and
  print, responsive 1440/390 layouts and no automatic external requests.
- Existing owner-scoped GitHub push/admin permission and expected master
  `7621e77454b198709e74ec918589e23ed81fddab` verified. No IAM, resource provisioning,
  provider configuration, real customer deployment or template publication.
- Static role verification: existing App Service/Foundry access remains
  unchanged; no new principals, role assignments, SDK permissions or secrets.
- Scope limitation: untagged legacy custom white text is preserved; previously
  generated opaque images are not rewritten; model palette compliance is best
  effort. This gate does not certify competitor parity or all-browser support.

### Four-fix release and hosted verification

- Application: `94e1abc32c8181e8e463a47d584211f59f062b74`.
- [Actions run 35505636125](https://github.com/sauravraghuvanshi/architecture-playground/actions/runs/35505636125)
  succeeded in 2 minutes 21 seconds, including authenticated API/browser smoke.
- Production: https://architecture-playground.azurewebsites.net.
- Hosted acceptance: 72/74 passed initially. Two readiness assertions began
  before their HTTP status response had completed; tests now anchor those
  assertions to response completion. Each complete scenario passed two
  consecutive hosted repeats. All 74 distinct cases were verified.
- These checks include image/theme pixels and proportions, pre-release icon
  readability, canonical conversion, bound-arrow/GIF/history, nested editing,
  save/reload/import/export, all 16 templates and prior release regressions.
- No live AI inference, customer IaC, real template publication, provisioning
  or identity changes were performed. No roles were provisioned, so live checks
  of newly provisioned RBAC are not applicable.
- Temporary hosted authentication state has been removed. Local competitor WIP
  is being paused separately and is not part of this deployed application.
- The unrelated local snapshot timing limitation and deliberate model/catalog
  limits above remain disclosed; this is not a whole-product parity claim.

## Priority 4: Truly read-only deployment previews

Current application-only change selected by the user on September 20. Preserve
the session-close Markdown and all completed priority 1-3 behavior below.

- **Target/recipe:** Existing standalone App Service application at
  https://architecture-playground.azurewebsites.net through the current GitHub
  Actions workflow. No new infrastructure, roles, model calls or customer IaC
  execution.
- **Scope:** Remove writes from offline PowerShell preview, run prerequisite
  checks before preview, align download/UI warnings, and prove preview and
  failure paths with mocked PowerShell execution.
- **Baseline:** `d7c0912621ad711a0e79a265dd986fd82ff268a5`; application `64f1c48`.
  The previous close-out README/plan edits and two new session Markdown files
  were already local changes and are preserved for publication with this release.
- **Plan:** Inspect generator/callers and existing contracts; add failing tests;
  implement a read-only preview against an existing resource group; validate
  local unit/browser/build checks; deploy the app and verify hosted downloads
  without deploying any generated infrastructure.
- **Validation and rollback:** Record actual results before release. Redeploy
  the previous app if needed; never run the generated script against a customer
  subscription as an audit or acceptance test.

### Priority 4 - Section 7: Validation Proof

- Official Microsoft What-If documentation confirms that the dedicated
  `Get-AzResourceGroupDeploymentWhatIfResult` API predicts changes without
  resource deployment. What-If still contacts Azure and requires permissions;
  the UI must not claim live validation or generic Reader-only access.
- The prior generator from Git HEAD was executed under the corrected local
  PowerShell mock harness without `main.bicep`: it attempted resource-group
  creation before preflight; the throwing mock blocked the write.
- The new script has no resource-writing, sign-in, context-selection, install
  or deployment command. It uses an explicit subscription GUID, existing group,
  stable suffix, pinned context, incremental What-If and no parameter prompting.
- Initial harness failures came from disabled built-in module autoload and
  script-scope mock variables; the harness was corrected before using its
  results as evidence. No Azure module or external command was invoked.
- Final PowerShell suite: 8/8 tests passed, exercising 23 generated-script
  invocations across success, missing files/dependencies, malformed inputs,
  missing/mismatched context, unavailable groups, denied access, failed provider
  results, dry-run cancellation and unanswered confirmation. All Azure commands
  are mocks, with autoload disabled; no Azure resource or provider was contacted.
- Full existing unit/contract suite: 180/180 passed. Repository ESLint, standalone
  production build and strict TypeScript passed after correcting the new browser
  fixture's explicit architecture type.
- Scoped deployment browser suite: 8/8 passed, including all three new preview,
  paired-download, cancellation/reset and source-provenance cases. The UI was
  also rendered and visually inspected on the local production candidate.
- Broader regression: 44/46 passed. Unchanged snapshot and resize tests hit
  save/export or scratch-read timeouts; each then passed one unchanged isolated
  repeat and failed one. These are retained as intermittent prior-workflow
  limitations, not represented as a clean full-suite result or fixed by task 4.
  No persistence/history/serialization source was changed by this release.
- Known syntax/naming/mapping limitations of generated IaC remain in later
  priorities. This release guarantees a non-deploying offline preview workflow,
  not correctness of arbitrary Bicep/ARM, real Azure What-If success, or safety of
  model-generated scripts.
- Commands: `npm run test:powershell-preview`, `npm run test:playground`,
  `npm run lint`, `npx tsc --noEmit --incremental false`, `npm run build`,
  and the existing/extended deployment Playwright suite against the standalone
  candidate. The broader regression and unchanged repeat results are recorded
  above as limitations, not silently counted as passes.
- Evidence checkpoint: 2026-09-20 12:54 IST. The built standalone candidate
  responds on port 3317; required repository permissions and existing production
  branch were rechecked without inspecting deployment secret values.

### Priority 4: All validation checks pass

Existing CI/CD app-only recipe. No new infrastructure, containers, model or
role configuration is introduced.

- [x] Native PowerShell parser and command-mocked preview execution checks pass.
- [x] Existing unit/contract suite, lint, strict types and production build pass.
- [x] All eight scoped preview/deployment UI tests pass with no live inference
  or actual publication; broader intermittent results are disclosed above.
- [x] Existing target and owner-scoped repository push/admin permission verified;
  production baseline remains `d7c0912`.
- [x] Static role boundary: no authentication, cloud identity, API or workflow changes.
- [x] Completed azure-validate for the scoped preview fix after the actual
  parser/mock/UI/build checks. Existing intermittent save/export/readiness
  limitations remain disclosed; this is not a whole-product readiness claim.
- [x] Deploy and verify the real hosted artifact downloads without running
  customer IaC.

### Priority 4 deployment result

- Application release: `d70340cf0f72c39248e2d898e88ddee99c19936f`
  (`fix(deploy): make offline PowerShell previews read-only`).
- [GitHub Actions run 35496961686](https://github.com/sauravraghuvanshi/architecture-playground/actions/runs/35496961686)
  succeeded in 2 minutes 33 seconds, including authenticated API/browser smoke.
- Production: https://architecture-playground.azurewebsites.net.
- Post-deployment browser run: 36/37 passed initially. The unchanged cross-tab
  test hit its five-second initial save-confirmation wait; the failure screenshot
  already showed the saved confirmation. The complete unchanged scenario then
  passed two consecutive isolated repeats, including revision-conflict recovery.
- All 37 distinct hosted acceptance cases were verified across that run and
  retests: eight deployment/preview cases, eight round-trip cases, six history
  cases, seven recovery cases, six named-document cases and two auth/navigation.
- The hosted offline script and companion Bicep downloads exactly match their
  local generator output. Preview/download does not invoke AI or publication,
  reset/dismissal clears artifacts, and Foundry PowerShell drafts do not inherit
  the offline safety label. Actual Portal publication in browser tests is mocked.
- No generated customer script was executed against Azure. PowerShell execution
  tests used command mocks only; no live What-If, AI inference, customer resource
  deployment, infrastructure or permission changes were performed.
- Temporary hosted authentication state is removed and the owned validation
  server is stopped. Previous session Markdown was preserved and published;
  the original Audit Report remains locally Git-excluded.
- This completion record is documentation-only and does not redeploy the app.
  Next priority: 5, only after the user selects it.

## Session close - 2026-09-20 02:33 IST

The user paused work for the day. Priorities 1-3 are implemented, deployed and
production-verified. Application release `64f1c48` remains live; the latest
release-verification documentation commit is `d7c0912`.

- [Session summary](../docs/development-log-2026-09-20.md) records the audit,
  three releases, actual verification counts, known limitations and cleanup.
- [Implementation roadmap](../docs/implementation-roadmap.md) preserves the
  original 33-item order. **Priority 4 is next; priorities 4-33 are not started.**
- Resume only on the user's next instruction, using GPT-6 Astra and the agreed
  one-priority-at-a-time plan/implement/test/deploy/verify cycle.
- This close-out changes Markdown only. It does not deploy, commit or push a new
  application revision; preserve these local documentation edits next session.
- Temporary hosted authentication files have been removed and the owned local
  validation server has stopped. Do not assume either is available tomorrow.

## Priority 3: Lossless architecture save/import/export

Current application-only release, selected by the user's "move next" under the
existing plan/implement/test/deploy/verify workflow. Earlier priorities remain
completed releases and must retain their recovery and history guarantees.

- **Recipe/target:** Existing GitHub Actions standalone App Service deployment
  at https://architecture-playground.azurewebsites.net. No new resources,
  infrastructure, identities, runtime configuration or live model invocation.
- **Baseline:** `5678dd8395c8b7411c11abec5f0e005e627bc68e`; application `d2c21fe`.
- **Scope:** Preserve native connection handles and supported node geometry,
  identities, grouping, labels and explicit stages through serialization,
  validation, named saves, snapshots and JSON import/export. Align legacy
  sequence/import limits and enforce valid import/template hierarchy.
- **Plan:** Trace all relevant adapters/schemas, add failing round-trip and
  boundary tests, implement backward-compatible fields and invariant checks,
  validate native/legacy behavior plus priorities 1/2, deploy and repeat
  authenticated hosted acceptance on synthetic documents.
- **Boundaries:** No new architecture-model redesign, provider/IaC changes,
  native SVG/PPTX export, Whiteboard features or other backlog priorities.
- **Rollback:** Prior application release; preserve browser documents and
  existing data. No destructive migration or force push. Export updated diagrams
  before a rollback: older clients do not retain the new optional handle fields
  and older legacy imports reject stages above 100.

### Priority 3 - Section 7: Validation Proof

- Twelve new production-bound assertions failed on the prior implementation.
  The initial corrected targeted suite passes 25/25; an additional shared
  sequence-limit boundary test and five browser acceptance journeys were added.
- Native fields remain optional for older files. Explicit declared dimensions
  take precedence over renderer measurement rounding; actual user resize
  dimensions remain authoritative. Native groups are ordered before children.
- Invalid hydration validates before adding history or replacing state.
  Legacy import/template containment uses one shared invariant helper; the
  existing warning-based sanitization policy for unknown icons/edges is retained.
- Final full unit/contract suite: 180/180 passed. Repository ESLint, strict
  TypeScript and standalone production build pass.
- Initial broad browser regression: 62/66 passed. Three initial five-second
  readiness assertions were rerun unchanged. A resize serialization regression
  was corrected by distinguishing per-node user resize updates from ordinary
  rounded layout measurements; a production-bound regression covers both.
- Final focused acceptance: 29/29 passed, including all four earlier failures
  and the added native stage-boundary scenario. Across the broad and focused
  runs, 67 distinct related browser cases passed.
- Eight new round-trip browser journeys cover complete JSON/save/reload
  comparison, actual bottom-to-right routing, snapshot restoration, invalid
  import atomicity, old files, stage-editor bounds, failed template handoff,
  and legacy named handles with stages above 100.
- Native manual/automatic playback assignment cannot create a step above its
  importer limit; errors leave the graph unchanged. User-resize dimensions
  remain authoritative without rounding unrelated fractional-size nodes.
- Validation completed by 2026-09-20 02:13 IST using `npm run test:playground`,
  `npm run lint`, `npx tsc --noEmit --incremental false`, `npm run build`,
  and Playwright against the standalone candidate. The final 29-case run
  completed without failures or skips; prior broad results are retained above.

### Priority 3: All validation checks pass

Existing CI/CD standalone application recipe; no new containers, Azure
resources, role assignments or deployment infrastructure.

- [x] `npm run test:playground`: 180 passing production-bound/unit contracts.
- [x] `npm run lint`, `npx tsc --noEmit --incremental false`.
- [x] `npm run build` and responsive standalone server on port 3317.
- [x] Native/legacy round-trip, template, review, conversion, export, persistence,
  and Undo/Redo regression evidence recorded above; no remaining scoped failures.
- [x] No authentication, model configuration, RBAC or workflow changes.
- [x] Completed azure-validate and verified scoped diff, owner permissions and
  unchanged production baseline after actual tests/build.
- [x] Deploy and repeat authenticated production acceptance.

### Priority 3 deployment result

- Application release: `64f1c4807acc25be7918195266cb896bdccb1f85`
  (`fix(diagrams): preserve architecture round-trip fidelity`).
- [GitHub Actions run 35468584984](https://github.com/sauravraghuvanshi/architecture-playground/actions/runs/35468584984)
  succeeded in 2 minutes 48 seconds, including hosted API/browser smoke.
- Production: https://architecture-playground.azurewebsites.net.
- Post-deployment Chromium acceptance: 32/32 passed in one run (5.4 minutes).
  This covers all eight new round-trip journeys, all six Undo/Redo cases, all
  seven priority 1 recovery cases, six named-document workflows, three template
  import cases (including all 16 bundled templates), and two auth/navigation cases.
- Confirmed actual bottom-to-right routing, fractional geometry, identity,
  grouping and explicit stages survive JSON, named saves, reload and snapshots.
  Invalid imports/handoffs retain the original graph/data and report errors.
  Legacy named-side connections and stages above 100 round-trip correctly.
- No live model inference, customer resource creation, role changes or
  infrastructure modifications. Synthetic AI fixtures were used only where
  needed by existing regression journeys.
- The temporary production authentication file is removed and the owned local
  validation server is stopped. The original Audit Report remains Git-excluded.
- This completion record is documentation-only; no second application deployment
  is triggered. Remaining audit priorities and browser-support limitations remain.

## Priority 2: Complete Undo/Redo for both canvases

Current application-only release. The user's "go to next" selects priority 2
and continues the authorized plan/implement/test/deploy/verify cycle.
Priority 1 and historical results below remain completed prior releases.

- **Recipe/target:** Existing GitHub Actions CI/CD and standalone App Service at
  https://architecture-playground.azurewebsites.net. No new resources, model
  calls, infrastructure, identities, permissions, or runtime configuration.
- **Baseline:** `0dd947605845ef9573833d2a8033c714c02bb211`; application `79e353b`.
- **Scope:** Immediate history checkpoints for Whiteboard click/drag/AI image
  insertion; architecture resize and bulk-style history; preserve binaries on
  redo, gesture-level history, and correct redo branching after a new edit.
- **Plan:** Read native history APIs and existing tests; add failing regression
  coverage; implement minimal history changes; validate related editing,
  persistence, and export behavior; deploy through the existing workflow and
  repeat authenticated acceptance tests against the release.
- **Boundaries:** Preserve priority 1 durability/recovery. Do not change theme,
  image aspect ratio, AI providers, graph schema or unrelated audit priorities.
- **Rollback:** Redeploy the prior application revision without changing browser
  documents. No destructive storage migration or force push.

### Priority 2 - Section 7: Validation Proof

- Five new production-bound assertions failed before changes and now pass.
  The targeted architecture/Whiteboard canvas suite passes 12/12.
- Full unit/contract suite: 163 passed. Repository ESLint, strict TypeScript,
  and standalone production build passed on 2026-09-20 (Asia/Kolkata).
- Browser regression: 49/49 passed across history, architecture editing,
  priority 1 persistence/recovery, named documents, Whiteboard assets/conversion,
  and all-mode export matrix. An additional keyboard-delete history scenario
  passed two unchanged targeted repeats (50 distinct local browser cases total).
- The extra keyboard-delete case initially exceeded a five-second scratch-draft
  setup wait while a separate export suite was running. No history action had
  begun; the unchanged scenario passed after the concurrent run completed.
- Six new real browser history journeys cover click/drag/AI-fixture insertion,
  original binary restoration, native keyboard shortcuts, group resize,
  bulk-style/toolbar state, redo branching, and connected keyboard deletion.
- The fix uses Excalidraw's exported capture action; it does not add a parallel
  Whiteboard undo stack. Architecture snapshots include default edge style,
  deduplicate batched node/edge deletion, and capture resize gestures once.
- The UI edge-style cycle no longer performs a canvas mutation inside a React
  state updater, preventing duplicate history side effects under Strict Mode.
- Validation completed by 2026-09-20 00:57 IST: `npm run test:playground`,
  `npm run lint`, `npx tsc --noEmit --incremental false`, `npm run build`,
  the nine selected Playwright suites against the standalone candidate, and the
  unchanged keyboard-delete test repeated twice. All model responses used by
  these tests were synthetic fixtures; live inference was disabled.

### Priority 2: All validation checks pass

Existing CI/CD application-only recipe; no new AZD, container, infrastructure,
or role assignment validation is applicable to this client history change.

- [x] Owner-scoped push/admin permission and remote baseline confirmed.
- [x] Production-bound unit/contract tests: `npm run test:playground` (163/163).
- [x] `npm run lint`, `npx tsc --noEmit --incremental false`.
- [x] `npm run build` and standalone HTTP readiness on port 3317.
- [x] Relevant browser suites and six new history scenarios passed without
  changing expected output or history semantics.
- [x] Static role boundary: no API, authentication, model, RBAC or workflow changes.
- [x] Completed azure-validate using the actual build/test evidence and reviewed
  release diff. No unresolved priority 2 validation failures remain.
- [x] Deploy and repeat authenticated history/persistence acceptance.

### Priority 2 deployment result

- Application release: `d2c21fe64849abc7d728c140b74436620e23e961`
  (`fix(canvas): complete architecture and Whiteboard undo history`).
- [GitHub Actions run 35464756442](https://github.com/sauravraghuvanshi/architecture-playground/actions/runs/35464756442)
  succeeded in 2 minutes 43 seconds, including hosted API/browser smoke.
- Production: https://architecture-playground.azurewebsites.net.
- Post-deployment Chromium acceptance: 21/21 passed in one run. This includes
  all six new native history scenarios, all seven priority 1 recovery scenarios,
  six named-document workflows, authentication, and non-invoking agent navigation.
- Click/drag/AI-fixture image insertions undo individually and redo with identical
  binaries. Native keyboard and toolbar history agree; new edits replace redo
  branches. Architecture resize, bulk styles/default toolbar state and connected
  keyboard deletion are restored correctly.
- All model output in the history tests used synthetic fixtures. No live model
  inference, cloud resources, role changes or infrastructure modifications.
- Temporary production authentication state is removed and the local validation
  server is stopped. The original local Audit Report remains Git-excluded.
- This completion record is documentation-only and does not trigger another
  application deployment. Remaining audit priorities are unchanged.

## Priority 1: Reliable saving and recovery

This section supersedes the historical release status below for the current
application-only change. The user selected priority 1 and authorized the cycle:
plan, implement, test, validate, deploy, verify production, then select the next
priority. No other audit backlog item is included.

- **Recipe:** Existing GitHub Actions CI/CD and App Service standalone deployment.
- **Target:** https://architecture-playground.azurewebsites.net, existing
  `architecture-playground` App Service in `rg-architecture-playground`.
- **Infrastructure:** No provisioning, SKU, region, identity, network, or model
  configuration changes. Preserve the existing application deployment target.
- **Model policy:** GPT-6 Astra only; no live application model inference.
- **Scope:** Protect pending scratch and named-document edits; preserve save-before-
  navigation and conflict recovery; isolate malformed legacy drafts so valid
  diagrams still open; keep original recovery bytes and report storage failures.
- **Plan:** Trace persistence and canvas notifications, add failing regression
  tests, implement the shared recovery/lifecycle fix, update directly related
  documentation, run focused and full validation, release, and repeat targeted
  browser verification on production.
- **Release authorization:** Commit and push the scoped fix through the existing
  deployment workflow after validation. Verify current remote branch state and
  owner-scoped GitHub permissions before any write; no force push.
- **Rollback:** Redeploy the prior known-good application revision using the
  existing workflow. Preserve browser records and legacy data; no destructive
  storage migration.

### Priority 1 - Section 7: Validation Proof

- Five new production-bound hook regressions cover isolated recovery,
  annotation recovery, pre-save validation, and unchanged cross-tab saves.
  The final hook suite passes 18/18; the full unit suite passes 157/157.
- Repository ESLint, strict TypeScript, and standalone production build passed.
- All seven new browser acceptance scenarios passed: immediate scratch refresh,
  browser Back, Whiteboard binary reload, isolated corruption/recovery copy,
  scratch quota/unload warning, blocked navigation on IndexedDB failure, and
  pending named-document refresh/cancel/save.
- Full local Chromium run: 96 passed, six conditional/disabled skips, one known
  pre-existing Whiteboard AI-availability timing assertion outside priority 1.
- Owner-scoped GitHub API confirms push/admin permission, the deployment
  secret names are present, and remote `master` remains at `bd3803f`.
- Final scoped acceptance run: 17/17 passed, including recovery-download bytes,
  all seven new persistence scenarios, all six existing saved-document journeys,
  and all four real IndexedDB isolation/transaction checks.
- Final build, lint and type checks: 2026-09-20 00:16 IST; scoped browser acceptance
  completed at approximately 00:19 IST. Commands: `npm run build`,
  `npm run lint`, `npx tsc --noEmit --incremental false`, and
  `npx playwright test persistence-recovery.spec.ts saved-diagrams.spec.ts diagram-library.spec.ts --workers=1`
  against the isolated standalone production server on port 3317.
- Validation used synthetic data and disabled model configuration. No new Azure
  resources, customer deployment, model calls or permission changes occurred.
- Initial new-test failures caused by comparing against pre-normalized geometry
  and awaiting a deliberately cancelled reload were corrected without weakening
  persistence assertions. Cross-tab conflicts from unchanged lifecycle saves
  were fixed with canonical committed-content comparison and regression coverage.

### Priority 1: All validation checks pass

This existing CI/CD application-only release has no AZD, Docker, Bicep, Terraform
or provisioning changes. Validate the actual standalone artifact and existing
workflow rather than introducing a new infrastructure deployment recipe.

- [x] Owner-scoped repository permission, production branch baseline, existing
  workflow, and required secret names verified without reading secret values.
- [x] Production-bound hook/unit contracts pass (157 total unit/contract tests).
- [x] Repository ESLint and strict TypeScript pass.
- [x] Final standalone build passes; existing middleware deprecation is a warning.
- [x] Final scoped Chromium persistence, saved-document, and IndexedDB suites pass.
- [x] Full regression comparison: 96 passed, 6 conditional/disabled skips, one
  pre-existing AI-availability timing failure (audit WB-11 / future priority 13).
  No new persistence failures. This is a scoped fix, not certification that the
  remaining audit backlog is production ready.
- [x] Static identity boundary: only client persistence and related tests/docs
  change; no new data-plane calls, customer credentials, RBAC, network or resources.
- [x] Record final scoped test evidence and validate the release diff.
- [x] Completed azure-validate for the scoped priority 1 release after actual
  build/static/unit/browser checks. The unchanged audit WB-11 baseline limitation
  is documented above and is not represented as a passing full-suite result.

### Priority 1 deployment result

- Application release: `79e353b6d498e1beb168c1792bec6ba642ffdf66`
  (`fix(persistence): preserve drafts and isolate recovery failures`).
- Deployment succeeded through [GitHub Actions run 35462536382](https://github.com/sauravraghuvanshi/architecture-playground/actions/runs/35462536382)
  in 2 minutes 37 seconds, including authenticated API/browser smoke.
- Production: https://architecture-playground.azurewebsites.net.
- Authenticated production verification covered 15 distinct browser cases:
  seven new persistence/recovery cases, six existing named-document journeys,
  authentication, and the non-invoking named-agent navigation smoke.
- Initial hosted run: 14 passed; the existing hub-navigation assertion exceeded
  its five-second wait. Its failure screenshot already showed the hub. The exact
  unchanged scenario then passed three consecutive targeted repeats, including
  the persisted two-node assertion. No assertion was relaxed or app code changed.
- Immediate scratch refresh, Back, Whiteboard binaries, corruption isolation,
  original recovery-data download, quota warnings, failed-save navigation,
  pending named saves, and cross-tab recovery were all verified on the release.
- No live model inference, customer resource creation, infrastructure changes,
  or role modifications were performed. Temporary production authentication
  state and owned local validation server are cleaned after verification.
- The broad audit remains applicable to other priorities. In particular, the
  existing local AI-availability timing assertion is not fixed by this release.

This documentation-only completion record does not trigger another application
deployment. Historical September 16 results below remain historical evidence.

## Final release result

The final application commit `29a8bb9` is deployed to
https://architecture-playground.azurewebsites.net through successful GitHub
Actions run `35065496209`. All preceding release runs in today's engineering log
also completed successfully. This result supersedes historical pending sections
below, which retain the diagnostic/validation sequence.

- 152 unit tests, lint, strict TypeScript and production build passed.
- 95 distinct browser checks passed across full and targeted runs (91 hosted-app
  journeys, four isolated IndexedDB helper cases); one legacy mid-scroll case is
  disabled. Real AI UI tests were explicitly opted in and passed.
- All eight model-generation modes, Azure/AWS/GCP architecture examples,
  Whiteboard conversion and four SSE image styles passed real service checks.
- All six Foundry review inputs passed through App Service managed identity.
- Clean final deployment sweep: Bicep, Terraform, Azure CLI and PowerShell all
  HTTP 200, complete resource mappings, zero excluded nodes.
- Both offline and agent-generated ARM publication/anonymous retrieval passed
  with explicit consent. No customer architecture resources were deployed.
- All 36 advertised static/text exports passed file-content checks; architecture
  and Whiteboard animated GIF workflows also passed.
- Fresh hosted Bicep compiled without resource diagnostics; generated PowerShell
  parsed with zero syntax errors. Scripts were not executed; no Terraform plan
  or broad Azure What-If of generated workloads is claimed.
- Existing app identity and project-only Foundry User assignment were read back;
  two tool-free named agents use the existing model. No further setup blockers.
- User preview remains at http://localhost:3210. Temporary test authentication
  state and generated diagnostic artifacts are cleaned separately from source.

Detailed evidence and limitations: `docs/development-log-2026-09-16.md`.

### Session close - 2026-09-16 16:51 IST

All implementation changes and the completed verification report were already
pushed to `master` and `agents/load-full-project-context` when closing began.
The final deployed application remains `29a8bb9`; this documentation-only
close-out does not initiate another deployment or change Azure resources.
No implementation, runtime-configuration or release blockers remain from this
session. Historical pending sections below are retained only as the diagnostic
record, not as outstanding tasks. Optional future improvements and verification
boundaries are recorded in today's development log.

## Current release: Hackathon workspace

The user explicitly authorized pushing all completed changes, deploying the
existing application, testing the live site, and updating today's Markdown log.
This section supersedes the historical implementation recipe below.

- **Recipe:** CI/CD, existing `.github/workflows/deploy.yml`, GitHub Actions plus
  Kudu zipdeploy. No new infrastructure recipe or resource group.
- **Release:** fast-forward `master` from the completed worktree; do not force-push.
  Remote `master` is `445f113e2dc77542d0b9bc84991ca58bd9d414f0`, matching the local
  baseline. The owner-scoped GitHub account has ADMIN access; all five required
  auth/deployment secret names exist. Secret values are not inspected or logged.
- **Target:** existing `architecture-playground` App Service in
  `rg-architecture-playground`, existing subscription and Central India location
  recorded below. This release does not provision customer workloads.
- **Changes:** named IndexedDB documents, simplified navigation, genuine Foundry
  review/deployment transport, persistent WAF baselines, guided designs, Whiteboard
  conversion/styles, and explicit, CORS-enabled ARM-template handoff.
- **Runtime dependency:** check the deployed Foundry project/agent names, model
  capability, managed identity and project access. A configured flag alone is not
  proof of successful invocation. Missing services must remain explicit blockers.
- **Verification:** authenticated hosted browser/API checks, real configured AI
  calls using synthetic inputs, and consented temporary template publication with
  anonymous retrieval. Never approve customer resource creation in Azure Portal.
- **Rollback:** deploy the prior known-good revision through the existing workflow;
  no history rewrite, resource deletion, or silent infrastructure changes.
- **Local preview:** leave `http://localhost:3210` running for the user.
- **Documentation:** create `docs/development-log-2026-09-16.md`, link it from
  README, and replace pending live results with observed evidence after deployment.

### Current validation proof

- [x] All validation checks pass
  - [x] Core validation: owner-scoped GitHub auth, unchanged remote baseline,
    required secret names, existing workflow and standalone artifact/build.
  - [x] Application validation: relevant unit tests, lint, TypeScript and recorded
    full local/browser verification.
  - [x] Docker build: not applicable; this is an existing standalone zip deployment.
  - [x] Azure template validate/What-If and new policy evaluation: not applicable;
    no infrastructure template, SKU, region or resource configuration is deployed
    by this application-only CI/CD release.
  - [x] Static role boundary: Foundry calls use application identity, no customer
    credentials or generated resource writes; missing runtime roles are checked live.

The infrastructure validation recipes assume new Bicep/Terraform or container
artifacts. This existing CI/CD release instead validates its actual executable
pipeline and artifact; it does not invent infrastructure solely to run What-If.

Before this release request, the same worktree passed 130 unit tests, strict
TypeScript, ESLint, and a production standalone build. Eighty-one distinct
Chromium cases passed across the full run and focused retests; three conditional
or disabled checks were skipped. Compiled-production loopback checks passed for
authentication, consent enforcement, anonymous template GET/OPTIONS CORS, invalid
tokens, and offline five-pillar assessment. Run release-specific validation before
changing the status to Validated.

### Current deployment result

Commit `ff3e4e5116f1080e670cb76a05c717e308693e3a` deployed successfully through
GitHub Actions run `35014990938`. The user resumed and authorized completion.
Detailed hosted testing passed 83 browser cases across the full run and two
remote-latency retests; one existing test is disabled. Real generation passed for
seven non-architecture modes; vision conversion, all four image styles and
consented ARM publication/anonymous CORS retrieval also passed.

Architecture generation returned 502 schema validation on two real requests.
The corrective release adds the complete JSON Schema and one validation-only
retry with a shared 120-second deadline, retaining original requirements and
catalog. No provider-error retries, fabricated defaults, or silent fallbacks.
This application-only correction uses the same CI/CD recipe, resource target,
identity boundary and zero-provisioning inventory. Foundry runtime discovery
remains separate; missing named agents are not counted as verified.

### Corrective release validation checklist

- [x] All validation checks pass
  - [x] 48 targeted generation/review unit cases.
  - [x] Full unit suite, lint and TypeScript for shared client/server helper.
  - [x] Next.js standalone production build.
  - [x] CI/CD auth and fast-forward branch state.
  - [x] No Docker, infrastructure, region/SKU, policy or RBAC changes in this patch.
  - [x] Record actual proof. Deployment and real model retests follow validation.

### Required Foundry runtime setup

Read-only discovery confirmed both named-agent settings and the app's managed
identity are absent. Both existing Foundry projects and models are healthy.
The current operator has inherited Owner and Foundry User access; explicit
subscription-scoped authentication is required to avoid another cached identity.

The user's resumed request to finish all remaining capabilities authorizes the
following minimal changes in the existing application environment:

1. Enable the existing App Service's system-assigned managed identity.
2. Grant that identity the appropriate Foundry data-plane user role at the
   existing `ap-foundry-eastus/architecture-playground-ai` project scope only.
   Do not grant subscription/resource-group Owner or Contributor to the app.
3. Create prompt agents `diagrammatic-review` and `diagrammatic-deployment` on
   the existing `gpt-4o-mini` model deployment. No new models, compute plans,
   storage resources, subscriptions or resource groups.
4. Set only the three missing runtime settings to the existing project endpoint
   and those agent names. Preserve all other settings and credentials.
5. Verify role assignments, configuration and genuine live review/deployment
   invocation separately. An application restart may occur when settings change.

Project endpoint:
`https://ap-foundry-eastus.services.ai.azure.com/api/projects/architecture-playground-ai`.
The model reports agentsV2, Responses and JSON-object support. Image generation
continues using the existing image deployment and its existing credentials.
No customer architecture resources will be created or deployed.

### Final diagnosed fixes and verification

Runtime setup is complete and read-back verified: system identity
`d3636586-e6dd-49bd-bf2e-bc23f3f32662`, project-only Foundry User, named prompt
agents `diagrammatic-review:1` and `diagrammatic-deployment:1`, three settings
added without removing the sixteen existing settings, no new model deployment.

Actual provider calls confirmed two distinct defects:

- Generation: the model used nonexistent `azure/application/app-service`.
  The actual `azure/application/application-service` asset already exists.
  Label-to-ID catalog presentation and explicit canonical guidance passed both
  original Azure requests plus AWS and GCP direct real-model validation.
  Offline code generation and WAF now recognize the same canonical service.
- Named agents: service HTTP 400 rejected top-level `instructions`, `text`,
  and untyped input messages. Developer instructions now travel in explicitly
  typed input messages; the agent definition owns JSON formatting. Both agents
  responded through the patched SDK with scoped-user authentication.

An extended nine-mode export matrix also found that percent-encoded SVG text
was truncated to byte values rather than UTF-8 encoded. The shared decoder now
preserves Unicode and binary data. Both affected UML/Whiteboard export journeys
pass locally; seven other mode journeys passed live.

The final application-only patch retains the same CI/CD recipe and existing
resource target. No additional infrastructure/RBAC change is part of this patch.

- [x] All validation checks pass for final fixes
  - [x] Full unit suite, lint and strict TypeScript.
  - [x] Production build and unchanged CI/CD permissions/remote baseline.
  - [x] Direct model verification of both original Azure requests, AWS and GCP.
  - [x] Direct real named-agent transport calls for review and deployment.
  - [x] Locally corrected UML/Whiteboard artifact exports and UTF-8/binary units.
  - [x] Static identity boundary unchanged; live app principal/role read-back verified.
  - [x] Record validation proof. Hosted MI and exports must be verified after release.

### Final agent-output contract correction

Hosted `7585891` passed all static/text exports, both original Azure-generation
requests plus AWS/GCP, and managed-identity review for canvas/import/description/PNG.
Remaining actual failures were diagnosed rather than silently normalized:

- JPEG/WebP: root `$schema` was echoed, then visible image labels were invented
  as node IDs. The response-root instruction and evidence-specific ID allowlist
  now pass both formats through real model validation, with empty image ID arrays.
- Deployment: supporting ARM resources (for example the App Service plan) were
  omitted from resourceMappings. Full schema, explicit one-mapping-per-resource
  rules, safe validation feedback and one correction now pass all four requested
  formats through the actual strict parser. Validation/security rules are retained.

The same application-only CI/CD recipe, subscription, resources, permissions and
identity scope apply; no new Azure configuration change is needed.

- [x] All validation checks pass for agent-output contracts
  - [x] Real direct JPEG and WebP review validation.
  - [x] Real direct Bicep/Terraform/CLI/PowerShell strict draft validation.
  - [x] Full unit suite, lint, TypeScript and production build.
  - [x] CI/CD remote/auth and whitespace checks; record proof before release.

### Final PowerShell follow-up

Hosted `de94e21` passes all six review sources and Bicep/Terraform/CLI deployment
drafts. PowerShell draft validation still rejected two explicit requests, whereas
the same helper and named agent passed with operator identity. This does not
prove an identity problem; no roles are changed.

The follow-up improves App Service root-property guidance based on actual Bicep
compiler warnings and a fresh compiler-clean real model sample. Exhausted draft
validation now reports only allowlisted top-level field names and Zod codes:
no generated code, values, resource names, arbitrary keys or credentials.
These diagnostics make any remaining hosted rejection actionable without
weakening validation. Three opt-in paid-inference browser journeys have also
passed: real design/save/review, native image insertion and Bicep/ARM preview.

The existing application-only deployment recipe and scope remain unchanged.
- [x] All validation checks pass for this follow-up
  - [x] Unit suite: **152 passed**, 0 failed/skipped; runner **14041.2867 ms**,
    command `12:10:32.9563428`-`12:10:49.4805938` IST.
  - [x] Lint: exit 0, **111835.737 ms**, `12:10:33.3307205`-
    `12:12:25.1664573` IST; TypeScript: exit 0, **18363.676 ms**,
    `12:12:25.1828638`-`12:12:43.5465396` IST.
  - [x] Production build: exit 0, **140678.249 ms**, `12:13:01.0375900`-
    `12:15:21.7158391` IST; standalone artifacts verified at `12:16:03` IST.
  - [x] Verify static role boundary and remote fast-forward state; exact command,
    artifact and role proof recorded in Section 7 below.
  - [x] Core validation for the existing CI/CD recipe: owner-scoped GitHub
    authentication/permission, unchanged fetched remote baseline, required secret
    names (**5/5** among 8 configured), **0 ahead / 0 behind**, and the unchanged
    standalone deployment pipeline; `12:09:36.1904089`-`12:09:43.1723205` IST.
  - [x] Docker build applicability: not containerized; standalone Kudu zipdeploy.
  - [x] Azure template validation/What-If and policy applicability: no deployed
    infrastructure, resource configuration, region, SKU or model changes.
  - [x] Static role verification: unchanged application identity and project-only
    data-plane scope; reuse the existing read-back-verified runtime setup.
  - [x] Preserve existing **3 passed** real-AI browser journeys as prior live
    evidence, not a new run; no browser or paid-inference calls in this validation.

All sections below preserve the earlier 2026-08-12 baseline and are not evidence
of this release being deployed.

---

## 1. Project Overview

**Goal:** Evolve Diagrammatic into a one-stop Microsoft CSA workspace with
official Azure guidance, architecture assessment, multi-format
infrastructure-as-code generation, and an explicitly confirmed Azure deployment
handoff.

**Path:** Add Components

**Delivery order:**

1. Azure Architecture Center guidance and patterns
2. Azure Landing Zone Accelerator guidance
3. Cloud Adoption Framework guidance
4. Azure Well-Architected Framework assessment
5. Architecture-to-code generation for Bicep, Terraform, Azure CLI, and PowerShell
6. Unified Azure architecture review for described or imported architectures
7. One-click, user-confirmed Azure deployment handoff

Each milestone must pass its targeted unit, type, lint, build, and Playwright
checks before work begins on the next milestone.

---

## 2. Requirements

| Attribute | Value |
|-----------|-------|
| Classification | Production |
| Scale | Small today, designed for medium scale |
| Budget | Balanced; reuse the existing App Service and Azure AI resources |
| Subscription | Visual Studio Enterprise Subscription (`60e58e3f-da14-4fa7-89dd-3d0369ddbc8b`) |
| Location | Central India for the application; generated architectures keep location configurable |
| Data model | Local-first; no customer diagrams are persisted by the service |
| Identity | Preserve the shared application gate; Azure deployment authentication stays in Azure Portal |
| Compliance | No new regulated-data scope; keep prompts and credentials server-side |

The subscription and region were selected from the only enabled subscription
and the existing `rg-architecture-playground` deployment after the interactive
confirmation prompt was unavailable. No resource will be created or changed
without a later explicit confirmation.

### Product requirements

- Guidance must cite current first-party Microsoft Learn sources.
- Recommendations must be useful without Azure OpenAI; AI enhances rather than
  gates the baseline experience.
- Generated code must be presented as a starting point, identify unsupported
  resources, avoid embedded credentials, and prefer managed identity/RBAC.
- Architecture review findings must identify their framework, pillar or
  methodology, severity, evidence, recommendation, and official source.
- Imported diagrams and free-form descriptions must use the same normalized
  review model.
- Deployment must never happen silently. The final action opens an Azure-owned
  confirmation surface and leaves Azure authentication, policy evaluation,
  parameters, and consent to the user.

### Policy constraints

| Assignment | Impact |
|------------|--------|
| Region restriction blocking West Europe | Exclude West Europe from generated defaults and deployment examples |
| MFA for Azure resource write actions | Keep deployment interactive and user-confirmed |
| MFA for Azure resource delete actions | Do not add automated cleanup or destructive actions |

---

## 3. Components Detected

| Component | Type | Technology | Path |
|-----------|------|------------|------|
| Web application | SSR web app | Next.js 16, React 19, TypeScript | `app/`, `components/` |
| AI API | Route handlers | Next.js Node runtime, Azure OpenAI | `app/api/ai/`, `lib/ai.ts` |
| Architecture workspace | Client application | React Flow | `components/diagrammatic/` |
| Whiteboard | Client application | Excalidraw | `components/diagrammatic/modes/whiteboard/` |
| Kanban | Client application | dnd-kit | `components/diagrammatic/modes/kanban/` |
| Asset pipeline | Build tooling | Node.js scripts | `scripts/` |
| Acceptance tests | Browser tests | Playwright | `e2e/` |
| Deployment pipeline | CI/CD | GitHub Actions and Kudu zipdeploy | `.github/workflows/deploy.yml` |

### Existing infrastructure

| Item | Status |
|------|--------|
| `azure.yaml` | Not present |
| `infra/` | Not present |
| Dockerfile | Not present |
| Hosting | Existing Azure App Service |
| Application resource group | `rg-architecture-playground` |
| AI resources | Existing Azure AI resources in East US and West US 3 |

No GitHub Copilot SDK, Azure Functions, or cross-cloud migration marker was
detected, so no specialized deployment recipe is required.

---

## 4. Recipe Selection

**Selected:** Bicep for the deployable Azure artifact, with an Azure Portal
custom-deployment handoff.

**Rationale:**

- The product must generate four user-facing formats, but only one canonical
  deployment artifact should drive the first safe one-click experience.
- Bicep is Azure-native, can be compiled to an ARM template, and supports an
  Azure-owned deployment confirmation flow.
- Terraform, Azure CLI, and PowerShell remain downloadable alternatives and are
  not executed by the application.
- The existing application deployment remains GitHub Actions plus Kudu
  zipdeploy; this work does not replace production hosting.
- A short-lived, signed template endpoint can support generated ARM templates
  without storing Azure credentials or customer diagrams permanently.

---

## 5. Architecture

**Stack:** Existing App Service

### Existing service mapping

| Component | Azure Service | Current location |
|-----------|---------------|------------------|
| Next.js application and APIs | Azure App Service | Central India |
| Hosting plan | Azure App Service plan | Central India |
| Chat generation/review | Azure AI Foundry resource | East US |
| Whiteboard image generation | Azure AI Foundry resource | West US 3 |

### New logical components

| Component | Runtime | Responsibility |
|-----------|---------|----------------|
| CSA guidance catalog | Checked-in TypeScript data | Curated official guidance, patterns, questions, and source links |
| CSA guidance panel | React client component | Search, filter, inspect, and apply guidance |
| Assessment engine | Pure TypeScript plus optional Azure OpenAI | Deterministic checks and structured AI findings |
| IaC generation engine | Pure TypeScript | Bicep, Terraform, Azure CLI, and PowerShell output |
| Deployment template broker | Next.js Node route | Short-lived signed ARM template handoff; no Azure credentials |

### Supporting services

No new Azure service is required for milestones 1-6. Milestone 7 initially uses
the existing single App Service instance and an in-memory, time-limited template
broker. If the app scales out, the broker must move to encrypted Blob Storage or
another shared store before deployment handoff is enabled.

### Official guidance baseline

- Azure Architecture Center architecture styles and reference architectures
- Azure Landing Zones IaC Accelerator with Azure Verified Modules
- Cloud Adoption Framework methodologies: Strategy, Plan, Ready, Adopt,
  Govern, Secure, and Manage
- Azure Well-Architected Framework pillars: Reliability, Security, Cost
  Optimization, Operational Excellence, and Performance Efficiency

---

## 6. Provisioning Limit Checklist

No Azure resources are provisioned by the current product implementation plan.
The application continues to use existing resources, so quota validation is not
applicable at this stage.

| Resource Type | Number to Deploy | Total After Deployment | Limit/Quota | Notes |
|---------------|------------------|------------------------|-------------|-------|
| None | 0 | Existing inventory unchanged | Not applicable | Feature implementation and local/browser validation only |

**Status:** All current milestones are within limits because no resources are
created. Quota and policy checks must be rerun against the user-selected target
subscription and region before any future direct provisioning capability.

---

## 7. Validation Proof and Security

### Final PowerShell follow-up proof - 2026-09-16

Fresh validation of the application-only follow-up over
`de94e21043a92631dea49eac2089f053c58baaa6`, using the installed
`azure-validate/references/scripts/workflow.ps1` Windows workflow. This patch
adds allowlisted deployment-failure diagnostics, compiler-verified Web
root-property/Bicep guidance, and three opt-in real-AI browser tests. It does not
deploy infrastructure or change RBAC. All timestamps below are 2026-09-16 IST
(`+05:30`); results are pre-release validation, not proof the hosted PowerShell
failure has been resolved.

- The workflow completed `LoadPlan`, `AddValidationSteps`, `RunValidation`,
  `BuildVerification`, `StaticRoleVerification`, `RecordProof`, and
  `ResolveErrors`. At `12:17:06.7448260+05:30`, the script explicitly permitted
  setting status to `Validated`; there are **0 unresolved validation failures**.
  `UpdateStatus` then completed at **`12:17:21.8525211+05:30`**, and the script
  reported the workflow complete. `.azure/validate-status.json` persists
  `"completedStep": "UpdateStatus"`.

| Command/check | Actual result and timing |
| --- | --- |
| `npm run test:playground` | **152 passed**, **0 failed/cancelled/skipped/todo**, 0 suites; runner **14041.2867 ms**. Captured run started `12:10:32.9563428+05:30`, ended `12:10:49.4805938+05:30`, command **16524.251 ms**, exit 0. An earlier fresh run also exited 0; this rerun captured the exact summary without verbose-output truncation. |
| `npm run lint` | No ESLint findings; started `12:10:33.3307205+05:30`, ended `12:12:25.1664573+05:30`, **111835.737 ms**, exit 0. |
| `npx tsc --noEmit` | Strict TypeScript passed; started `12:12:25.1828638+05:30`, ended `12:12:43.5465396+05:30`, **18363.676 ms**, exit 0. Process-scoped npm offline/noninteractive settings prevented dependency installation. |
| `npm run build` | Prebuild, Next.js production build and standalone postbuild passed; started `12:13:01.0375900+05:30`, ended `12:15:21.7158391+05:30`, **140678.249 ms**, exit 0. |
| Owner-scoped GitHub auth/permission | `$env:GH_TOKEN = gh auth token --user sauravraghuvanshi` was held only in this command's process environment and removed afterward. `gh api user --jq .login` returned `sauravraghuvanshi`; `gh repo view --json nameWithOwner,viewerPermission` returned `sauravraghuvanshi/architecture-playground`, **ADMIN**. No token or secret values were output. |
| Authenticated `git fetch origin master` | Used the existing `gh auth git-credential` helper with the owner-scoped token. Before/after `origin/master` and `HEAD` all equal `de94e21043a92631dea49eac2089f053c58baaa6`; **0 ahead / 0 behind**, ancestor check passed. No remote drift. |
| `gh secret list` (names only), existing workflow | **5/5 required names present** among 8 configured: `APP_AUTH_USERNAME`, `APP_AUTH_PASSWORD`, `APP_AUTH_SECRET`, `AZURE_DEPLOY_USER`, `AZURE_DEPLOY_PASSWORD`. Existing Node 20 / standalone zip / Kudu CI/CD workflow is unchanged. |
| CI/CD checks above | Started `12:09:36.1904089+05:30`, ended `12:09:43.1723205+05:30`, **6981.912 ms**; all checks passed. |
| `git diff --check`; `git diff --cached --check` | Passed during CI/CD validation and after production build at `12:16:03` IST; only the generated Whiteboard asset's non-blocking line-ending advisory was emitted. |
| Existing real-AI browser journeys | **3 passed**, as supplied by the parent's prior live run: real design/save/personalized review, native Whiteboard image insertion, and Bicep/ARM preview with publication still disabled without consent. Existing `test-results/.last-run.json` reads `status: passed`, `failedTests: []`; its aggregate marker alone does not supply the count or per-test duration. No browser was opened or rerun here, and no new live-run duration is claimed. |
| Docker / ARM validate / What-If / new policy evaluation | Not applicable to this existing application-only release: **0 deployed IaC files changed**, **0 new resources**, unchanged resource configuration, region, SKU, model and role assignments. Generated example strings are guidance, not executed deployment artifacts. Existing policy constraints remain unchanged. |
| User preview | Port **3210** remains listening, PID **7780**, checked at `12:16:03.2698001+05:30`; no process stopped or restarted. |

#### Production artifact proof for this follow-up

- Next.js **16.2.4** (Turbopack): compilation **58 s**, TypeScript phase **50 s**,
  **9/9** static-page generation tasks completed in **802 ms**.
- Prebuild generated **1,433 cloud icons** (Azure **1,130**, AWS **258**,
  GCP **45**), **600** curated Whiteboard symbols, and a **22,847-byte**
  GIF encoder bundle.
- Postbuild copied `public`, `.next/static`, and `content` into `.next/standalone`.
  All three directories and `.next/standalone/server.js` were verified present.
- `.next/BUILD_ID`: `32cSUnyluFG8FKzPIFKJM`.
- Standalone server SHA-256:
  `77E049ED3A2E1A5248B914DB2140DCC59A037A655CD55555C772A7CA85832A31`.
  Artifact/static verification completed `12:16:03.2698001+05:30`.
- The existing middleware-to-proxy deprecation warning is non-blocking.
  No application code, tooling, dependencies, Azure resources, commits or
  deployments were changed by this validation. The build-generated Whiteboard
  asset timestamp is intentionally left for parent cleanup.

#### Static role verification for this follow-up

- Status: **Verified (static only)**, `12:16:03` IST.
- The changed files contain no deployed Bicep/Terraform or role-assignment patch;
  the identity transport `lib/foundry-agent.ts` and CI/CD workflow are unchanged.
  Calls retain `DefaultAzureCredential`, the configured project endpoint,
  named-agent inference, `store: false`, and `tool_choice: "none"`.
- Existing application principal: `d3636586-e6dd-49bd-bf2e-bc23f3f32662`;
  existing Foundry User scope:
  `ap-foundry-eastus/architecture-playground-ai` project only. This reuses the
  prior read-back-verified runtime setup, not a new live RBAC assertion.
- Guidance describes prospective template properties, not observed deployed
  security. Safe diagnostic assertions retain the validation boundary; no
  customer resource execution or broader management-plane permission is added.
- No live RBAC query/write, Azure deployment, browser run or model invocation
  was performed during this workflow. Hosted PowerShell retesting remains a
  separate post-release responsibility.

### Final agent-output-contract proof - 2026-09-16

Procedural validation of the final application-only patch over
`7585891f5a2bf5aefb8182fffd170244d109362d`, using the installed
`azure-validate/references/scripts/workflow.ps1`. All timestamps below are
2026-09-16 in IST (`+05:30`); this is not deployment or hosted-retest proof.

- Workflow completed at **2026-09-16T11:35:38.2157016+05:30** through
  `LoadPlan`, `AddValidationSteps`, `RunValidation`, `BuildVerification`,
  `StaticRoleVerification`, `RecordProof`, `ResolveErrors`, and `UpdateStatus`.
  The script explicitly permitted `Validated` only after `ResolveErrors` and
  then reported the workflow complete; `.azure/validate-status.json` records
  `"completedStep": "UpdateStatus"`. No validation failures remain.

| Command/check | Actual result and timing |
| --- | --- |
| `npm run test:playground` | **150 tests passed**, 0 failed/cancelled/skipped/todo, 0 suites; runner duration **2261.912 ms**. Captured run started `11:31:13.7318322+05:30`, command completed `11:31:16.7512001+05:30`; exit 0. |
| `npm run lint` | Passed with no ESLint findings; completed `11:31:34.7246729+05:30`; exit 0. |
| `npx tsc --noEmit` | Strict TypeScript passed; completed `11:31:39.3007496+05:30`; exit 0. Dependency installation disabled for this invocation. |
| `npm run build` | Production prebuild, Next.js build and postbuild passed; started `11:31:56.2626801+05:30`, completed `11:34:01.5033572+05:30`; exit 0. |
| Owner-scoped GitHub auth/permission | `$env:GH_TOKEN = gh auth token --user sauravraghuvanshi` used only in process environment; `gh repo view --json nameWithOwner,viewerPermission` returned `sauravraghuvanshi/architecture-playground`, **ADMIN**. No token or secret values exposed. |
| Authenticated `git fetch origin master` | Existing `gh auth git-credential` helper used with the owner-scoped token. Before/after `origin/master` and `HEAD` all equal `7585891f5a2bf5aefb8182fffd170244d109362d`; divergence **0 ahead / 0 behind**, ancestor check passed. No remote drift. |
| `gh secret list` (names only) and workflow inspection | All **5 required secret names** present among 8 configured names: `APP_AUTH_USERNAME`, `APP_AUTH_PASSWORD`, `APP_AUTH_SECRET`, `AZURE_DEPLOY_USER`, `AZURE_DEPLOY_PASSWORD`. Existing Node 20 / standalone zip / Kudu pipeline unchanged. |
| CI/CD checks above | Started `11:30:27.7461255+05:30`, completed `11:30:32.3121716+05:30`; all exit 0. |
| `git diff --check`; `git diff --cached --check` | Passed during CI/CD checks and after production build at `11:34:20` IST. Generated asset line-ending advisory only; no whitespace failures. |
| Docker / ARM validate / What-If / new policy evaluation | Not applicable: existing application-only CI/CD recipe, no container or deployed infrastructure/configuration changes, **0 new resources**, no changed model/region/SKU/RBAC. Existing policy constraints remain unchanged. No Azure deployments were attempted. |
| User preview | Existing listener on port **3210**, PID **7780**, still present at `11:34:20` IST; no process stopped or restarted. |

#### Production build artifact proof

- Next.js **16.2.4** (Turbopack): compilation **43 s**, TypeScript phase **59 s**,
  **9/9** static-page generation tasks completed (735 ms).
- Prebuild: **1,433 cloud icons** (Azure **1,130**, AWS **258**, GCP **45**),
  **600** curated Whiteboard symbols and **22,847-byte** GIF encoder bundle.
- Postbuild copied `public`, `.next/static` and `content` into `.next/standalone`.
  Standalone `server.js`, `.next/static` and `public` were verified to exist.
- `.next/BUILD_ID`: `HFBJoNEA4Z5LlaEGw56aR`.
- `.next/standalone/server.js` SHA-256:
  `77E049ED3A2E1A5248B914DB2140DCC59A037A655CD55555C772A7CA85832A31`.
  Artifact proof completed `11:34:03.1921016+05:30`.
- Existing non-blocking Next.js middleware-to-proxy deprecation warning remains.
  No tooling/dependencies were added, no browser was opened, and no application
  code, Azure resources, commits or deployments were changed by this validation.
  The build-generated Whiteboard asset timestamp is left for parent cleanup.

#### Role assignment verification

- Status: Verified (static review, 2026-09-16 11:34 IST).
- The patch contains no deployed Bicep/Terraform or role-assignment changes.
  Both API routes retain the unchanged `lib/foundry-agent.ts` transport with
  `DefaultAzureCredential`, the existing project endpoint and named agents.
- Identity: existing app principal `d3636586-e6dd-49bd-bf2e-bc23f3f32662`.
  Role/scope: existing Foundry User at the
  `ap-foundry-eastus/architecture-playground-ai` project only, as read-back
  verified in the runtime setup above; no broad management-plane grant.
- Operations remain named-agent data-plane inference, not customer resource
  execution. No additional permissions, identity, models or resources are needed.
  No live RBAC query or write was performed during this procedural validation.

### Final diagnosed-fix proof - 2026-09-16 11:02 IST

- `npm run test:playground`: 142 passed, zero failures/skips.
- `npm run lint` and `npx tsc --noEmit`: passed.
- `npm run build`: passed, including standalone assembly and asset counts.
- `export-matrix` UML and Whiteboard tests: both passed locally, including valid
  SVG XML, PNG signatures, PDF trailers, JSON and TypeScript where advertised.
- Direct existing-model generation: both formerly failing Azure prompts and
  AWS/GCP requests passed full graph/catalog validation on the first attempt.
- Direct patched Foundry transport: both named agents responded under the
  explicitly scoped operator identity. App MI invocation remains a live release gate.
- GitHub Owner account still has ADMIN; remote master remains `cca875e`;
  no concurrent upstream commits or unresolved whitespace failures.

### Corrective release proof - 2026-09-16 10:22 IST

- Targeted generation and CSA tests: 48 passed.
- `npm run test:playground`: 138 passed, zero failures/skips.
- `npm run lint` and `npx tsc --noEmit`: passed.
- `npm run build`: passed, including TypeScript and standalone asset copying.
- Remote baseline remains the deployed `ff3e4e5`; owner-scoped GitHub permission
  is ADMIN. No infrastructure, RBAC, model, region, SKU or resource changes are
  included in the corrective code patch.
- Two hosted timing-sensitive browser tests passed with the same assertions and
  a 15-second remote-load wait. The total is 83 passing distinct hosted cases,
  one disabled legacy mid-scroll case.

### Current release proof - 2026-09-16

| Command or check | Actual result |
| --- | --- |
| Owner-scoped `gh repo view`, branch metadata and secret-name listing | ADMIN, unprotected master at the unchanged baseline, five required secret names present |
| `node --test scripts/test-live-csa-smoke.mjs` | 6/6 passed after correcting the review context field |
| `npm run lint`; `npx tsc --noEmit` | Passed; focused config/smoke lint and strict types also passed |
| Authenticated loopback `auth-gate` and `live-csa` Chromium runs | Both passed; fixed stale review-dialog selectors and used the actual browser session for capability/logout requests |
| `npm run build` | Passed at 2026-09-16 01:03 IST; an initial EBUSY was resolved by stopping only the isolated port-3211 preflight server |
| User preview | Port 3210 kept running throughout |
| Static role/IaC boundary | No Bicep/Terraform deployment or RBAC changes; application identity only, no customer resource execution |

Runtime Foundry existence, identity authorization, and actual model invocation
are post-deployment checks, not established by the above build/configuration
validation. Previously recorded 130-unit and 81-browser local evidence remains
applicable; this release adds execution of the two previously credential-gated
browser journeys.

- Keep Azure credentials and Azure OpenAI keys server-side.
- Treat imported diagram text as untrusted content.
- Validate API payloads and structured model output with Zod.
- Use allowlisted official source URLs in framework guidance.
- Do not claim compliance or certification from an automated review.
- Never execute generated scripts from the browser or server.
- Require an explicit user action before opening the Azure deployment flow.
- Sign short-lived deployment template identifiers and apply strict expiry,
  size, content type, and rate limits.
- Preserve CSP, authentication middleware, and API rate limiting.

### Milestone validation gate

For every milestone:

1. Add pure unit coverage for catalogs, normalization, or generators.
2. Add focused Playwright coverage for the user journey.
3. Run `npm run lint`.
4. Run `npx tsc --noEmit`.
5. Run `npm run test:playground`.
6. Run the smallest relevant Playwright project/spec.
7. Run `npm run build` when a route, production bundle, or deployment flow changes.
8. Mark the milestone complete only after all targeted checks pass.

---

## 8. Execution Checklist

### Phase 1: Planning

- [x] Analyze workspace
- [x] Gather requirements and record explicit assumptions
- [x] Identify the only enabled subscription and existing deployment region
- [x] Check subscription policy assignments
- [x] Prepare the zero-resource provisioning inventory
- [x] Scan the codebase
- [x] Select the Bicep plus Azure Portal handoff recipe
- [x] Plan architecture and milestone gates
- [x] User approved this plan

### Phase 2: Sequential product execution

- [x] Implement and validate Azure Architecture Center guidance
- [x] Implement and validate Landing Zone Accelerator guidance
- [x] Implement and validate Cloud Adoption Framework guidance
- [x] Implement and validate Well-Architected assessment
- [x] Implement and validate four-format architecture code generation
- [x] Implement and validate unified architecture review
- [x] Implement and validate one-click Azure deployment handoff
- [x] Update status to `Ready for Validation`

### Phase 3: Azure readiness and deployment

- [x] Invoke `azure-validate`
- [x] Bicep compilation succeeds for representative generated output
- [x] Bicep lint succeeds for representative generated output
- [x] Azure authentication is valid for the selected subscription
- [x] Resource-group template validation succeeds without deployment
- [x] What-If preview succeeds without deployment
- [x] Subscription policy constraints are documented and compatible
- [x] Static identity and RBAC review is complete
- [x] Production application build succeeds
- [x] Resolve all validation findings
- [x] Obtain explicit deployment confirmation
- [x] Invoke `azure-deploy` only if deployment of this application is requested
- [x] Verify the production health and critical CSA journeys

---

## 9. Validation Proof

Validated: 2026-08-12

### Application

| Check | Result |
|-------|--------|
| `npm run lint` | Passed with no ESLint findings |
| `npx tsc --noEmit` | Passed under strict TypeScript |
| `npm run test:playground` | 35/35 unit tests passed |
| `npx playwright test --project=chromium` | 49 passed, 2 credential-dependent tests skipped |
| `npm run build` | Next.js production standalone build passed |

### Azure artifact validation

| Check | Result |
|-------|--------|
| `az account show --subscription 60e58e3f-da14-4fa7-89dd-3d0369ddbc8b` | Authenticated; subscription enabled |
| `az bicep build --file .azure/validation/main.bicep` | Representative and comprehensive generated Bicep compiled |
| `az bicep lint --file .azure/validation/main.bicep` | Passed after correcting Log Analytics SKU placement |
| `az deployment group validate ... --template-file .azure/validation/main.bicep` | Passed in `rg-architecture-playground`, Central India |
| `az deployment group validate ... --template-file .azure/validation/deploy.json` | Actual portal ARM template passed with SQL Entra-only and APIM parameters |
| `az deployment group what-if ...` | Passed; generated resources were `Create`, existing resources were `Ignore`, and no deletes were proposed |

### Policy validation

- West Europe is blocked and is not used as a generated default.
- Azure write and delete operations require MFA, which is compatible with the
  Azure Portal confirmation handoff.
- No resource was created, modified, or deleted during validation.

### Role assignment verification

- Managed identities are enabled for generated compute and applicable platform
  services.
- The diagram model does not yet encode data-plane operation or permission
  semantics, so the generator intentionally does not guess role assignments.
- Every generated format and the deployment confirmation surface explicitly
  warns that least-privilege, resource-scoped data-plane roles must be added
  before a workload is deployed.
- No generic Reader, Contributor, or Owner assignment is generated.

### Resolved validation findings

1. Moved Log Analytics `sku` under `properties` in Bicep and ARM output.
2. Corrected the nested SQL database ARM name and dependency expressions.
3. Added explicit RBAC coverage warnings for every generated format and portal
   deployment handoff.

Application deployment was not requested and was not executed.

---

## 10. Multimodal Architecture Review Extension

**Goal:** Let a customer upload a PNG, JPEG, or WebP architecture diagram, add
optional business and operational context, and receive the same structured
cross-framework review available for the current canvas, written descriptions,
and Diagrammatic JSON.

**Mode:** Modify existing production application.

**Architecture:** Browser validates and previews the image, then sends one
bounded data URL plus optional context to the existing authenticated
`/api/ai/review` route. The route validates MIME type and size, sends
multimodal content to the existing Azure OpenAI chat deployment, validates the
structured JSON response, and returns no uploaded data for persistence.

**Security:**

- Accept PNG, JPEG, and WebP only.
- Enforce a 5 MiB binary limit in the browser and API.
- Do not log or persist uploaded diagrams.
- Treat diagram text and labels as untrusted evidence, never instructions.
- Keep the existing AI rate limit and authenticated API boundary.

**Validation:**

- [x] Unit-test request validation and multimodal prompt construction.
- [x] Browser-test upload, preview, optional context, request shape, rating, and findings.
- [x] Verify invalid type and oversized-file behavior.
- [x] Run lint, strict TypeScript, unit tests, focused Playwright, and production build.

### Multimodal extension validation proof

Validated: 2026-08-12

| Check | Result |
|-------|--------|
| `npm run lint` | Passed |
| `npx tsc --noEmit` | Passed |
| `npm run test:playground` | 37/37 tests passed, including image type and 5 MiB validation |
| `npx playwright test e2e/csa-guidance.spec.ts --project=chromium --workers=1` | 9/9 CSA journeys passed |
| `npm run build` | Production standalone build passed |
| `az account show` | Selected subscription authenticated and enabled |
| `az cognitiveservices account deployment list` | `gpt-4o-mini` deployment is provisioned and vision-capable |
| `az bicep build` and `az bicep lint` | Existing generated deployment path remains valid |

No Azure resources, roles, or infrastructure definitions changed. The existing
static RBAC review and policy validation remain applicable.

### Multimodal production proof

- User explicitly requested the validated changes be pushed live.
- Commit `12f6c55` delivered the feature and documentation.
- Commits `417703d` and `8ed4a86` hardened release readiness and the vision
  fixture after production smoke surfaced real issues.
- Workflow `31584648843` completed successfully.
- Authenticated API smoke called the live multimodal review endpoint and
  received a structured rating with findings.
- Authenticated Chromium smoke confirmed the Upload diagram entry in the live
  review dialog.
