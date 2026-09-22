# Development log - 2026-09-19/20/21/22

Latest consolidated handoff:
[September 22 session summary, lessons and ordered resume checklist](session-summary-2026-09-22.md).

**Ordered backlog resumed:** priority 16 is complete in hosted-verified
application `1404737`; priority 17 is next under the user's September 22
13:29 IST instruction. The morning recovery fix remains included.
The [early September 21 session summary](session-summary-2026-09-21.md)
records the earlier stop after task 8, not the current execution boundary. Older
close-out tables below are historical checkpoints, not the current release.

## September 22 afternoon - Priority 16 regression/release gates

- Replaced copied playground algorithms with 48 tests importing production
  modules. Focused suite: 60/60; eight deliberate in-memory production mutations
  were detected. Only production adjustment was an explicit `.ts` import.
- Added build-time revision/unique-build manifest and authenticated no-store
  `/api/version`. Post-SCM verification requires three consecutive exact
  revision/build matches. Healthy older instances and same-commit different
  artifacts are explicitly rejected; no runtime environment can substitute a
  revision. This does not prove every scaled-out instance has drained.
- Expanded pre-deployment pipeline: full lint/types and contracts, official
  parser checks, 88 isolated script-safety tests, 17 real Bicep/Terraform
  compiler/provider fixtures, 102 Chromium and 16 Firefox/WebKit browser cases.
  PRs validate without deployment credentials, production uploads are serialized,
  and failure artifacts omit authenticated traces.
- Final local contracts: 392/392; new release tests: 7/7. All compiler fixtures,
  script safety and browser gates passed. Final rebuilt screenshot gate: 5/5.
- Application `1404737cbf1a54a0fb2bae6d53344c95eddbd07e`, workflow
  `35705631954`: all Linux pre/post-deployment gates passed in 12m14s.
  Hosted API independently matched CI artifact build
  `56e05f8d-7293-40fa-8b87-3d1c30547bf0`; anonymous access was denied.
  Hosted native/core/screenshot acceptance: 24/24 across three engines.
- Learning: a passing copied algorithm test does not protect the shipped
  implementation; a healthy URL is not proof of the intended build. Gate both
  semantics and actual release identity. Preserve mocked-provider/live-model
  distinctions and never execute generated customer infrastructure.
- Temporary authentication removed and owned runners stopped. Next is priority
  17; competitor additions remain after the numbered roadmap.

## September 22 morning - Saved-scene recovery and successful release

- New screenshot reproduced with a named saved board containing valid geometry,
  a pen dot and unfinished remnants. The prior build rejected the entire board
  and displayed duplicate recovery notices. Saving a separate blank recovery
  copy did not remove the historical notices.
- Corrected native classification: two-point zero-dimension paths are valid,
  including dots. Saved scenes restore around only unfinished placeholders;
  references to omitted placeholders are detached, without clamping or changing
  the remaining geometry. Library intake retains the unmodified source payload
  in an original version before any subsequent document overwrite. Scratch
  source bytes remain unchanged.
- Removed the persistent saved-data recovery banner across diagram pages.
  Truly malformed content remains rejected and retained, with details and raw
  downloads under **My diagrams > Retained original data**. Named recovery
  downloads now include the original document. Actual save/quota/conflict
  failures still remain actionable; no false success is introduced.
- Last night's run `35648068866` failed at hosted Bicep HTTP 503 after deployment.
  Its log did not expose a parser error code, so the historical underlying cause
  cannot be named reliably. Valid/invalid Bicep and the unchanged complete
  hosted parser smoke passed before today's new deployment.
- Fixed the smoke test's first-fixture-only retry: bounded readiness retries now
  apply to every fixture, with safe HTTP/code/attempt diagnostics. Persistent
  unavailability and wrong validation outcomes still fail. No timeout increase,
  fixture skip or validation-gate removal.
- Release **`625e199d6ba360aa81142d5be2201c1045200390`**, workflow
  **`35693782055`**, succeeded at **11:47:14 IST**. All pre/post-deployment gates
  passed, including hosted parser validation and authenticated browser smoke.
- Evidence: **374/374** application contracts, **21/21** parser/integration/retry
  tests, lint/types/build, **5/5** mandatory screenshot journeys, **90/90 local**
  and **90/90 hosted** adjacent three-engine cases. Hosted run took 5.2 minutes.
  AI success responses remain fixtures, not live model-quality certification.
- Learning: live editing deferral and saved-scene compatibility are separate
  contracts. Never reject a whole historical board because the engine would
  omit an unfinished item; archive original data before canonicalizing. Keep
  historical recovery details out of the editing canvas, and test the exact
  screenshot path as well as new drawing.
- Owned servers stopped; temporary auth removed. No priority 16 or competitor
  work started. Users on a blank recovery copy should reopen the original in
  My diagrams after loading the updated app; do not clear browser storage.

## September 22 - Recurring gesture/autosave banner

- User reported "Diagram autosave failed: Finish or cancel the current
  Whiteboard gesture before saving." This was a separate regression from the
  native binding-range rejection fixed in the preceding release.
- Reproduced on the old production build with real native rectangles: begin
  another gesture before the preceding 650ms save timer, then hold it for
  1600ms. The legitimate incomplete-capture guard was incorrectly classified as
  a storage failure; the failed timer did not retry without another revision.
- Application fix `bd27fff` introduces a typed pending-capture state and a
  cancellable retry. Work stays unsaved until a real snapshot is persisted.
  Window pointer-up/cancel also settles the native guard, queued notifications
  from an earlier gesture are invalidated, and manual saving waits briefly for
  the native commit before making the canvas inert for persistence.
- Unload/navigation still protects unfinished work; quota/conflict/malformed
  content errors remain visible. No coordinates, bindings or elements are
  silently discarded, clamped or replaced.
- Added deterministic tests for both shared diagram modes, repeated deferral,
  eventual saving, manual commit, window pointer lifecycle and real failure
  propagation. Full contracts **370/370**, lint/types/production build passed.
- Added the exact native held-gesture test to the mandatory pre-deployment
  screenshot gate: **3/3** pass. Three-engine adjacent validation covers **84
  distinct passing cases** across the main run and focused rerun.
- Testing lesson: Excalidraw uses a leading-frame pointer throttle. Windows
  WebKit delivered synthetic moves within one frame, leaving a smaller native
  rectangle before persistence. The test now paces moves by animation frame;
  exact 100x100 dimensions and identical geometry after reload remain asserted.
  All **9/9** cross-browser screenshot cases then passed. No production
  workaround or weakened geometry assertion was introduced for test timing.
- User stopped work for the day while deployment run `35648068866` was still
  in progress. It completed during close-out: both pre-deployment gates,
  deployment, HTTP health and authenticated CSA API smoke passed; hosted
  parser-only artifact validation failed and final browser smoke was skipped.
  No further implementation or manual hosted test run was started.
  Tomorrow: diagnose that exact parser smoke failure, then run authenticated
  hosted screenshot/persistence/Whiteboard cases and record their results.
  No live model or customer infrastructure execution.
- **Next work remains paused:** priorities 16-33 and competitor additions are
  not authorized by this hotfix request.

## September 21/22 - Urgent screenshot regressions

- User reported spontaneous Whiteboard autosave errors, conversion failure,
  inability to switch to Cloud Architecture, and rejected code generation.
- Reproduced the first three with actual native elbow arrows. The new scene
  validator incorrectly treated binding ratios as bounded percentages. Native
  Excalidraw legitimately returns `1.025`, `-0.025` and focus outside `[-1,1]`.
  The shared rejection blocked every save/serialize-dependent action.
- Corrected only native binding compatibility, preserving exact values and
  keeping finite/type/reference/gap/binary/scene-budget checks. Executable
  native engine fixtures now cover both endpoints, rotation and small targets.
- Matched the code-generation screenshot to the actual catalog: the APIM service
  illustration was missing a supported mapping, and a management-operation icon
  had been renamed "APP Service". Added the audited APIM mapping, visible service
  readiness, an explicit undoable App Service correction, and palette coverage
  labels. Names no longer imply a deployment identity or a false coverage pass.
- Added server-derived service readiness to model evidence; retained parser,
  resource, secret and publication safeguards.
- Prevention: CI now generates its catalog fixtures, runs all contracts and
  executes these exact screenshot journeys on the production build **before**
  deployment. The first clean CI run caught a missing generated-manifest
  prerequisite and stopped before publishing; fixed the ordering without
  disabling tests.
- Verification: **363/363 contracts**, **49/49** focused mapping/route/real-parser
  checks, lint/types/build; **75 local and 75 hosted** adjacent browser cases,
  plus **4 local and 4 hosted** Firefox/WebKit screenshot journeys. AI successes
  were deterministic fixtures, not live model-quality certification.
- Release: `2088d85` plus gate prerequisite `cf6da2bd56de3aa8e42f46248fc77e443204547b`.
  Workflow **35641830814** succeeded in **5m07s**, ending September 21 at
  19:03:24 UTC (September 22 in India).
- Existing scenes are not cleared or clamped. Previously rejected unsaved edits
  exist only in the still-open old tab until the user preserves them; deployment
  cannot retroactively recover data that was never saved.
- Owned servers stopped, temporary authentication removed; backlog remains paused.

## September 21 - Priority 15 completed; execution stopped

- Main cross-browser release: `3a04dbc`, workflow `35623406942`, successful.
  Final restoration correction: `3b5d8fd12eb81fb8b67d839729855ee7fb1d68f8`,
  workflow `35632938257`, successful in 4m22s.
- Fixed Firefox font-descriptor export failure without disabling fonts;
  preserved native drag payloads when custom MIME is dropped; excluded editor
  chrome and released raster buffers; protected document handoffs from stale
  callbacks and Whiteboard gestures from premature reconciliation.
- Updated Playwright to 1.63.0 after proving the old Firefox runner could lose
  a page context while the app itself had restored correctly. No diagnostic
  monkeypatch, cache-disabled browser or increased deadline qualified the release.
- Cross-browser checks exposed WebKit pointer-focus differences; dialog invokers
  and Escape handling now preserve focus without stealing it from active modals.
- Hosted verification then found a real data race: native `isLoading` callbacks
  could save a default white background over a restored dark board. The final
  correction ignores those callbacks, omits loading flags and gates native readiness.
- Evidence: **356/356 final contracts**, lint/types/build, **108/108 local and
  108/108 final hosted** affected three-engine cases. The main release also passed
  152 hosted Chromium cases; all 456 distinct selected local cases were covered
  across the broad run and investigated rechecks, not one clean 456-case run.
- Learning: separate automation-context failures from actual app state; never
  persist initialization defaults; seed corrupt fixtures without an active editor
  racing their writes; inspect real downloaded bytes and actual pixel values.
- Browser/device limits are explicit in [browser support](browser-support.md).
  WebKit automation is not real Safari/iOS-device certification.
- **Stop boundary honored:** no priority 16 or other backlog task started.
  Await details of the user's new issue. Local servers are stopped, temporary
  auth removed, and diagnostic profiler/package backups cleaned up.

## September 21 - Priority 14 continuation

- Deployed `d81a0fd46ed3d46aeeaa2301171ae9f649521c15`; workflow
  `35592309033` succeeded in 4m38s.
- Reproduced 390px portrait canvases shrinking to 86px/102px. Added compact
  architecture/Whiteboard assets, Inspector and utility drawers; the architecture
  canvas now measures 390px wide and 552px high in that viewport.
- Shared dialog focus handles initial focus, visible/enabled Tab cycles,
  topmost ownership, Escape, restoration and non-dismissible committed saves.
  Native overlays use portals; dirty-library invokers are captured before saving.
- Added bounded keyboard disclosures, roving mode tabs with completion focus,
  legacy context keyboard invocation and compatible export/help/command dialogs.
  Existing Enter/Space/Tab disclosure behavior remains intact.
- Validation: **340 contracts**, lint/types/build, **149 local and 149 hosted**
  production browser cases passed; compact visuals were inspected.
- Learning: capture invokers before asynchronous inert save locks. Treat native
  `null` and `[]` empty binding lists equivalently without ignoring any actual
  element or binary changes. Keep keyboard enhancement compatible with established
  disclosure behavior rather than silently replacing it with menu semantics.
- Temporary auth removed; owned servers stopped. Priorities 1-14 complete;
  priorities 15-33 and competitor additions remain. Cross-browser work follows.
- Details: [Responsive and keyboard editing](responsive-keyboard-editing.md).

## September 21 - Priority 13 continuation

- Deployed `d490193a62add5f018331ffd0c4009a46bf3405c`; workflow
  `35578931985` succeeded in 4m24s.
- Reproduced seven stream transport gaps. Implemented bounded UTF-8 and
  LF/CRLF/CR framing, no truncated-tail dispatch, timeout and prompt pending-read
  cancellation. Server cancellation now reaches a pending producer immediately.
- Validated one complete insertable result; duplicated/contradictory events and
  URL-only responses never become images. Direct output uses actual MIME and
  full bounded pixel decoding. Errors distinguish timeout/throttle/refusal/
  invalid output/configuration/upstream without provider diagnostic leakage.
- Readiness requires independent flags and has a deadline. Cancellation reaches
  final pixel decoding; committed graph saves cannot be dismissed or duplicated.
- Validation: **340 contracts**, lint/types/build, **83 local and 83 hosted**
  production browser cases passed. No real model or customer deployment calls.
- Learning: an async `ReadableStream.start` can defer cancellation until its
  producer finishes. Treat an image result as provisional until the complete
  stream is verified; a second terminal event must invalidate it.
- Temporary auth removed and owned server stopped. Priorities 1-13 complete;
  priority 14 follows. Priorities 14-33 and competitor additions remain.
- Behavioral details: [AI streaming](ai-streaming.md).

## September 21 - Priority 12 continuation

- Deployed `a95261e30cdb581a6276e967ce2e934d99588e15`; workflow
  `35574277425` succeeded in 4m39s.
- Reproduced malformed scenes reaching the engine and cancellable UI during
  committed conversion saves. Added bounded shared scene intake before
  recovery/open/capture/mount/restore, retained corrupt originals, compatible
  native raster/SVG migration and late-image/notification invalidation.
- Converted Whiteboards create a **separate document**, preserving previous
  diagrams. Consent and status now describe this accurately. Analysis cancels;
  committed saving cannot be dismissed or duplicated and failures remain retryable.
- Validation: **318 contracts**, lint/types/build, **55 local and 55 hosted**
  production browser cases passed. The earlier dev-only tab-creation timeout
  passed in both final gates. Models were mocked, not invoked.
- Learning: native image ingress can preserve a source MIME label over PNG
  encoder bytes; compatibility needs explicit signature-based migration.
  Unfinished native gestures must not be advertised as restorable checkpoints.
  Header/container checks are not the same as full pixel decoding.
- Temporary auth removed and owned servers stopped. Priorities 1-12 complete;
  priority 13 follows. Priorities 13-33 and competitor additions remain.
- Behavioral details: [Whiteboard safety](whiteboard-safety.md).

## September 21 - Priority 10 continuation

- Deployed `52b5efa758c791957d23baf16277ed32484fe8bc`; workflow
  `35567578846` succeeded in 4m42s.
- Removed development's implicit demo proxy; validated explicit destinations,
  blocked redirects/proxy loops, and disclosed capability origins/data/retention.
- Added clear-session controls, opt-in legacy local history and memory-only
  candidates. Clearing preserves accepted diagram copies and does not claim
  provider erasure; late responses cannot restore cleared state.
- Validation: 293 application contracts, lint/types/production build, **64/64
  local and 64/64 hosted** browser cases. Synthetic provider responses only.
- Learning: metadata reads must be included in broad AI route mocks; readiness
  fixtures must honor the complete current contract. Provider retention cannot
  be inferred from local deletion or `store:false`.
- Temporary hosted auth removed; owned server stopped. Priorities 1-11 are
  complete. Priority 12 follows; 12-33 and deferred competitor work remain.

Reporting timezone: Asia/Kolkata. This session started on September 19 and
continued until approximately 02:33 IST on September 20, 2026.

**Overnight close-out:** priorities 1-3 were deployed and verified when work was
paused. **Priority 4 was subsequently implemented, deployed and verified** at
the user's request; see the continuation section and current deployment plan.
The later four-fix release `94e1abc` is also deployed and hosted-verified.
The latest delivery order and continuation authority are recorded at the end.

## Executive summary

1. Completed an evidence-led audit of Cloud Architecture, Whiteboard, and their
   AI workflows, using repository inspection, a local production build,
   authenticated hosted tests, and targeted reproductions.
2. Produced the local interactive HTML Audit Report with 47 findings, strengths,
   readiness boundaries, feature opportunities, and a 30/60/90-day roadmap.
3. Converted the audit into 33 ordered implementation priorities, giving the
   core architecture, Whiteboard, and AI workflows higher priority.
4. Implemented, tested, deployed, and production-verified priorities 1, 2, and 3.
5. Preserved the complete remaining backlog in
   [Implementation roadmap](implementation-roadmap.md). Do not infer that the
   remaining audit items are complete because these three releases passed.

## Final application and repository state

| Item | State at session close |
| --- | --- |
| Production | https://architecture-playground.azurewebsites.net |
| Deployed application commit | `64f1c4807acc25be7918195266cb896bdccb1f85` |
| Latest release-verification documentation commit before this close-out | `d7c0912` |
| Working branch | `agents/detailed-audit-cloud-ai-features` |
| Production branch | `master` |
| Branch publication | Both branches already contain the three application releases and their verification records |
| Application worktree before this documentation update | Clean |
| Local validation server | Stopped; do not assume port 3317 is still serving an app |
| Temporary hosted authentication state | Removed; obtain fresh authorized credentials/state for future hosted tests |
| Azure changes | Application deployments only; no customer workloads, new resources, role changes, or infrastructure provisioning |
| Closing documentation | This request updates Markdown only; no new application deployment, commit, or push is performed for the close-out |

The detailed deployment evidence remains in
[Azure deployment plan](../.azure/deployment-plan.md). Historical September 16
claims in that file and the older engineering log describe an earlier release,
not the current validation baseline.

## Audit deliverable and verification boundaries

- The report is at `Audit Report/index.html` in the local workspace. It is
  deliberately excluded through local Git metadata (`.git/info/exclude`), not
  committed or published with the app.
- It contains 47 findings: 22 P1, 24 P2, and one P3, with evidence levels,
  remediation owners, acceptance criteria, persona workflows, and ten proposed
  product capabilities. These are not 47 production incidents or security
  vulnerabilities.
- Report interactions were checked: search/filtering, expandable findings, CSV
  export, print expansion, 137 source links, and layouts at 1440, 1024, 768, and
  390 px. The report performs no automatic external requests.
- The report is the original audit snapshot. Use the roadmap and this log for
  implementation status; audit finding IDs and implementation priority numbers
  are different identifiers.
- Audit baseline verification included 152 unit/contract tests and 84 distinct
  hosted Chromium cases. Expanded Firefox/WebKit testing passed 18 of 22 cases;
  four failures persisted on targeted retest and remain a separate backlog item.
- All delegated audit reviews were explicitly configured for GPT-6 Astra.
  Live application-model inference was not invoked: the hosted model identities
  could not be verified as Astra, and image generation uses a separate image
  model. AI success-path interactions were exercised with deterministic fixtures.
- No claim is made of live model-quality certification, comprehensive
  penetration testing, WCAG certification, production-scale load validation, or
  correctness of every generated infrastructure artifact.

## Delivered priority 1 - Reliable saving and recovery

Application commit: `79e353b6d498e1beb168c1792bec6ba642ffdf66`.

- Checkpoint the live scratch canvas on refresh, browser Back, page exit, and
  tab hiding, including changes not yet delivered by the next animation frame.
- Warn on failed storage or pending named-document saves rather than silently
  abandon work; preserve save-before-switch behavior.
- Recover modes independently so a malformed Whiteboard draft does not hide a
  healthy saved architecture.
- Retain original damaged bytes, expose recovery-data downloads, and support
  separate recovery copies.
- Recover valid legacy comments/versions independently.
- Compare against committed content to avoid revision changes from unchanged
  canvas notifications and unnecessary cross-tab save conflicts.

Verification:

- 157 unit/contract tests; lint, strict TypeScript, and standalone build passed.
- Final local persistence/IndexedDB acceptance: 17/17 passed.
- Production: 15 distinct cases verified. The first hosted run passed 14; one
  five-second hub-navigation assertion timed out, with the hub already visible
  in its failure capture. The unchanged scenario then passed three repeats.
- The broader local run passed 96 cases, skipped six conditional/disabled cases,
  and retained the pre-existing AI-availability timing failure. It was not
  represented as a completely passing full suite.

## Delivered priority 2 - Complete Undo/Redo

Application commit: `d2c21fe64849abc7d728c140b74436620e23e961`.

- Use Excalidraw's immediate native history capture for individual click, drag,
  and AI-fixture image insertion.
- Preserve original image binaries through Redo; use the same history for native
  keyboard shortcuts and the workspace toolbar.
- Capture one architecture checkpoint per resize gesture and bulk-style action.
- Restore the default edge style and toolbar state with Undo/Redo.
- Deduplicate batched node/edge deletion checkpoints.
- Clear stale redo branches after a new edit; remove canvas side effects from
  the React edge-style state updater.

Verification:

- 163 unit/contract tests; lint, strict TypeScript, and standalone build passed.
- 50 distinct related local browser cases passed across the main regression run
  and targeted repeats. An extra deletion case initially exceeded a setup wait
  under concurrent export load, then passed twice unchanged.
- Production: 21/21 cases passed in one run, including all six new history
  journeys and the priority 1 recovery checks.

## Delivered priority 3 - Lossless architecture save/import/export

Application commit: `64f1c4807acc25be7918195266cb896bdccb1f85`.

- Persist native connection-side handles through validation, serialization,
  named saves, reloads, snapshots, and JSON export/import.
- Preserve explicit icon/shape dimensions and fractional geometry instead of
  replacing them with rounded layout measurements.
- Treat actual user-resize dimensions as authoritative without changing
  unrelated fractional-size nodes.
- Load parents before their children while preserving relative coordinates.
- Validate native hydration and snapshot restoration before changing state or
  adding history.
- Reject unsupported native handles and nested/invalid group references rather
  than silently detach or omit them.
- Validate legacy hierarchy, positive dimensions, and template containment.
  Filtering a boundary cascades to descendants and dependent edges.
- Assign stable names to legacy service handles; use shared legacy stage bounds
  of 1-500 and native stage bounds of 1-100,000.
- Prevent manual/automatic stage assignment from creating a graph rejected by
  its own importer. Surface failed template handoffs and preserve original data.
- Retain compatibility with older files lacking handle fields. This cannot
  reconstruct attachment choices that older releases never stored.

Verification:

- 180/180 unit/contract tests; lint, strict TypeScript, and standalone build passed.
- 67 distinct related local browser cases passed across broad and corrective
  runs. The initial 66-case run had three readiness-wait failures and a resize
  serialization regression. The resize defect was fixed and the final focused
  29-case run passed, including all earlier failures and the new stage-boundary
  case. Assertions were not relaxed.
- All 16 bundled templates remain compatible.
- Production: 32/32 cases passed in one run: eight round-trip cases, six history
  cases, seven recovery cases, six named-document cases, three template cases,
  and two authentication/navigation cases.

## Deployment evidence

| Priority | Application commit | Successful workflow | Production acceptance |
| --- | --- | --- | --- |
| 1 | `79e353b` | [35462536382](https://github.com/sauravraghuvanshi/architecture-playground/actions/runs/35462536382) | 15 distinct cases, including unchanged navigation retests |
| 2 | `d2c21fe` | [35464756442](https://github.com/sauravraghuvanshi/architecture-playground/actions/runs/35464756442) | 21/21 in one run |
| 3 | `64f1c48` | [35468584984](https://github.com/sauravraghuvanshi/architecture-playground/actions/runs/35468584984) | 32/32 in one run |

The test counts overlap between releases. Do not add them together as unique
coverage. Documentation commits `0dd9476`, `5678dd8`, and `d7c0912` recorded the
release outcomes with `[skip ci]`; they did not redeploy the application.

## Important remaining issues

The authoritative pending list is now priorities 5-33 in the
[implementation roadmap](implementation-roadmap.md). Notable unresolved items:

- The audited offline PowerShell write-before-preview defect was fixed during
  the priority 4 continuation below. Older downloaded scripts remain unsafe to
  assume read-only; use the new preview-only export and review all prerequisites.
- Heuristic/provider/service identity, offline IaC validity and semantic mapping,
  AI evidence/contract/grounding, and privacy-default issues remain.
- Whiteboard theme inversion and non-square image sizing remain; fixing history
  did not fix those separate behaviors.
- AI availability can appear enabled before its runtime configuration settles.
  The pre-existing local five-second disabled-button assertion remains a known
  timing issue; a separate settled-state probe observed correct disabled state.
- Firefox architecture export/Whiteboard reload and WebKit drag/flow failures
  remain unqualified. Windows WebKit is not proof of real-device Safari support.
- Shared-credential identity, local-only backup/sync boundaries, deployment
  completion/revision verification, observability, distributed budgets, and
  instance-local template storage still need their scheduled work.
- Some original Playground tests still test copied implementations. New tests
  added here use production code, but the older test cleanup remains priority 16.
- Existing Next middleware and CI Node/action-runtime deprecation warnings are
  recorded; no unrelated runtime or workflow upgrade was performed.

## Next-session handoff

1. Read this log and [Implementation roadmap](implementation-roadmap.md).
2. Inspect the worktree before changing anything. These closing Markdown updates
   are local and may still be uncommitted; preserve them.
3. Confirm that the user's next selection is **priority 5**, or use another
   priority number they explicitly choose. Do not start multiple priorities.
4. Use **GPT-6 Astra only**. Do not infer authorization to use the application's
   differently configured live models.
5. Follow the agreed cycle: plan -> implement -> local tests/readiness checks ->
   existing app deployment -> hosted verification -> ask for the next priority.
6. Use fresh isolated browser state and authorized authentication for hosted
   tests. No credentials or cookies are retained in this log or the repository.
7. Recheck the production branch and owner-authorized GitHub permissions before
   pushing; do not force-push, provision infrastructure, or deploy customer IaC.
8. Before any rollback, export updated diagrams. Older clients may drop optional
   handle fields and reject legacy sequence stages above 100.

No implementation work on priority 4 or later was started in this closing turn.

## Continuation - September 20: priority 4

The user resumed and selected truly read-only deployment previews. The earlier
close-out section is preserved as a historical record. Its local Markdown
changes were retained and published with this application release.

- Replaced the offline PowerShell deployment wrapper with preview-only
  `preview.ps1`, using the dedicated What-If result cmdlet and an existing group.
- Added local file/input/dependency checks, explicit subscription matching,
  pinned Azure context, a stable suffix and no automatic sign-in/context changes.
- Added matching companion `main.bicep` download, scoped safety/provenance labels,
  and a clear separation between preview and separately approved deployment.
- The original group-write-before-preflight defect was reproduced under local
  throwing mocks only; no real Azure operation was performed.
- Local checks: eight native PowerShell mock tests, 180 existing unit/contract
  tests, all eight deployment UI cases, lint/types/build passed. The broader
  run and intermittent unchanged save/export/readiness cases are disclosed in
  the deployment plan; they are not represented as a clean full-suite run.
- No live AI inference, customer resource creation, identity changes, or
  unrelated audit-priority implementation.

- Release `d70340cf0f72c39248e2d898e88ddee99c19936f` deployed through
  [workflow 35496961686](https://github.com/sauravraghuvanshi/architecture-playground/actions/runs/35496961686),
  which succeeded in 2 minutes 33 seconds.
- Hosted verification: 36/37 initially passed. An existing cross-tab test's
  initial save-confirmation wait timed out; the screenshot already showed the
  saved result, and the unchanged complete scenario passed two isolated repeats.
  All 37 distinct hosted cases were verified across the run and retests, including
  all eight preview/deployment cases and prior-priority regressions.
- Hosted offline downloads matched the generator exactly. No real Azure
  What-If, customer script execution, AI inference or template publication was
  performed; model/publication responses in browser tests remained fixtures.
- Credentials/state were removed and the local validation server stopped.
  Next: **priority 5**, not started. The roadmap now records 4 completed and
  29 pending priorities. This final record is documentation-only, not a new app
  deployment.

## User-selected interruption - Whiteboard fidelity and cloud boundaries

The user paused the numbered queue to address four screenshot-backed issues.
The implementation is deployed and hosted-verified as `94e1abc`; earlier
candidate checkpoints below retain their original limitations. The existing application-only App Service pipeline remains
the deployment target. Engineering and delegated work used GPT-6 Astra.

### Delivered in the candidate

1. Image-generation requests capture the actual canvas theme/background and
   foreground. Prompt instructions request a flat matching illustration without
   photographed paper, white slides, frames or mattes. Insertion awaits decoding
   and preserves real bitmap proportions.
2. Whiteboard rendering/export preserves literal image colors rather than
   globally inverting artwork. Owned neutral symbols and new automatic
   foregrounds adapt to the canvas; arbitrary custom colors remain untouched.
   Pre-release bundled Lucide artwork was pixel-tested on light canvas.
3. Whiteboard conversion uses canonical, provider-safe icon resolution. Known
   Azure App Service/SQL labels become official icons; explicit imported source
   identity survives relabeling. Ordinary Lucide symbols do not fabricate cloud
   identity metadata. Audited legacy aliases cover 49 of 53 template identities;
   four genuine catalog gaps remain labeled generic components.
4. Cloud Architecture supports nested Landing Zone, Subscription, Resource
   Group, Region, Virtual Network, VPC and Subnet boundaries. Parent selection,
   drag reparent/detach, minimum child extents, ancestor expansion, subtree
   deletion, Undo/Redo and parent-first persistence/import are implemented.
   These are design boundaries, not provisioned resources or network validation.

### Integration findings and evidence

- Full source checkpoint: 212 unit/contract tests, 8 PowerShell safety tests,
  repository lint, strict TypeScript and a fresh standalone build passed.
- A broad first candidate run found real template-alias and live-arrow
  regressions. Both were corrected before release. Color reconciliation now
  waits until native drawing/editing ends, preserving Excalidraw's live object
  references; transient gesture state is not stored.
- Tests were strengthened to verify complete retained image-file maps,
  canonical normalized payloads and actual active IndexedDB/scratch ownership.
  Invalid synthetic PNG bytes were replaced with CRC-valid fixtures.
- AI readiness now disables the toolbar during checking and reports unavailable
  or malformed status explicitly. Tests cover delayed success and both failures.
- The corrected broad candidate passed 70/74 initially. Three new startup
  assertions used the default five-second action budget while the workspace was
  still inert; they now wait for the actual ready guard using the existing
  30-second canvas-startup budget, without loosening behavioral assertions.
- The remaining failure is the unchanged, previously documented snapshot
  save-confirmation timing case. In isolated repeats it passed once and failed
  once. All 74 distinct cases have passed across the run and corrective repeats,
  but this is not a claim of a clean single broad run or a snapshot fix.
- Final changed-feature acceptance and hosted results will be recorded below.

### Research and intentional limits

- Local excluded supplement:
  `Audit Report/competition-and-canvas-fidelity.html`.
- Fourteen capability comparisons, 32 source entries, explicit documented /
  marketing / unverified / proposed labels, and a differentiated product plan.
  Search, print, citation anchors, 1440/390 layouts and zero automatic external
  requests were verified. No competitor account or authenticated editor was used.
- No live AI inference, customer IaC execution or resource creation was used for
  verification. Model background matching remains best effort, not guaranteed
  transparency. Existing opaque generated images must be regenerated to change
  their painted background.
- Untagged legacy white text is preserved because it is indistinguishable from
  intentionally chosen white text; users can explicitly change its native color.
- AWS API Gateway, GCP Pub/Sub, GCP Cloud Load Balancing and Azure Business
  Process Tracking lack specific bundled icons and are not replaced with
  unrelated products. Broader prompt/IaC identity work remains in priority 5.
- Native group nesting and fidelity are not equivalent to Lucid/Cloudairy
  feature parity. Enterprise collaboration, drift, cost analysis, source-linked
  AI diffs and stronger engineering handoffs remain on the roadmap.

### Release verification and revised delivery order

- Application commit: `94e1abc32c8181e8e463a47d584211f59f062b74`.
- [Deployment run 35505636125](https://github.com/sauravraghuvanshi/architecture-playground/actions/runs/35505636125)
  completed successfully in 2 minutes 21 seconds.
- Live: https://architecture-playground.azurewebsites.net.
- Final local changed-feature gate: 32/32 passed. Final artifact hierarchy
  smoke: 2/2 passed. Unit/contract suite: 212/212; preview safety: 8/8.
- Hosted run: 72/74 initially passed. Two readiness checks asserted before the
  corresponding status response had completed. After explicitly awaiting that
  response, both complete scenarios passed two consecutive hosted repeats.
  All 74 distinct hosted cases are verified, including the prior snapshot case.
- The temporary authenticated test-state file was removed. Existing local
  snapshot timing caveats remain documented; no live model inference occurred.
- The user clarified the order: first finish these four fixes (done), then
  remaining numbered priorities, then competitor-audit product additions.
  Competitor additions had started locally; preserve and defer them without
  deployment. They must not be mixed into priority 5 or subsequent releases.
- The user authorizes autonomous sequential progress without asking for the
  next number. Do not rush, skip validation, or promise the whole backlog inside
  a time limit. Priority 11 is covered by this release; priority 5 is next.

## Delivered priority 5 - Canonical service and provider identity

- Application release `98e130caf43060641f3b9dbf8d7f0be87cf69d83`.
- [Actions run 35515116214](https://github.com/sauravraghuvanshi/architecture-playground/actions/runs/35515116214)
  succeeded in 2 minutes 57 seconds. Hosted affected-surface acceptance:
  **37/37 passed in one run**, including all 16 bundled template imports.
- Replaced fuzzy cross-cloud matching and arbitrary unknown fallbacks with a
  shared finite alias resolver. App Service search/scaffolding selects the real
  Application Service asset once, not feature/file icons in multiple tiers.
- Both pickers respect provider filters; prompt diagnostics explicitly show
  unmatched recognized requirements and proposed choices. Named variants are
  not collapsed into base products; unrecognized prose/configuration still needs
  review rather than a false complete-requirements claim.
- Native and legacy Azure resource kinds are resolved from canonical identity,
  not editable labels. Tests cover all 303 non-Azure catalog entries and
  adversarial renaming. Unsupported variants and zero mappings do not expose
  a misleading deployment artifact.
- Legacy AI application rejects unresolved identities atomically and reports an
  error without replacing the current graph or claiming it was applied.
- An initial browser regression exposed an eager catalog-image flood: 3,085
  cloud-icon SVG requests across a conversion/reload journey. Hidden palette
  images now load lazily; repeated corrected traces record four such requests.
  The existing reload checks pass without timeout relaxation.
- Final evidence: 222/222 unit/contract tests, 8/8 mocked PowerShell safety tests,
  lint, strict TypeScript, standalone build and 37/37 local production browser
  cases passed. Final hosted acceptance also passed 37/37.
- No live model inference, customer infrastructure execution, identity or role
  change. Temporary authenticated test state was removed and owned server stopped.
- Competitor work is preserved, not deployed, at immutable checkpoint
  `c4b91a44d33066e9aceb011a086d57f445a95d0f` and
  `refs/checkpoints/deferred-competitor-a7e748c4`. It resumes only in stage 3.
- Completed numbered priorities: 1-5 and 11. **Priority 6 is next.**

## Priority 6 continuation - offline IaC correctness

Released as `c2714836180d7dca9403c75976d4bc067f4905de`:

- Reproduced actual Terraform parsing failures, invalid leading-digit Bicep
  symbols and duplicate ARM resource names. Installed checksum-verified portable
  validators in session storage, without modifying the user's global tools.
- Both editors now share generation. Naming version 2 uses bounded labels and
  stable IDs with collision handling; all formats use the same explicit
  3-10 character namespace and target an existing resource group.
- Added Node 22 Function runtime prerequisites, isolated keyless host storage,
  scoped host identity/role, workspace-backed Application Insights and a VNet
  workload subnet. Workload permissions, private integration and code remain
  explicit customer responsibilities, not inferred from edges.
- Replaced divergent CLI per-resource snippets with a matching Bicep companion.
  Preview is the default; `--deploy` is a distinct explicit write action after
  What-If. PowerShell remains preview-only with no write mode.
- Added executable validation of 17 synthetic graphs using Bicep 0.47.16,
  Terraform 1.16.3 and AzureRM 5.6.0. All passed with zero provider errors/warnings,
  including a real FNV hash collision. No Terraform plan/apply, customer What-If
  or Azure resource deployment was executed.
- Current local evidence: 231/231 unit/contracts, lint, strict types, standalone
  build and 39/39 production-build browser cases. UI notice/warnings inspected.
  Script safety subsequently passed 62/62 Bash and 26/26 PowerShell cases.
  A trailing-newline namespace bug found by actual PowerShell execution was
  fixed using absolute regex anchors. The final rebuild and all ten deployment
  browser cases passed again.
- Deferred competitor work remains untouched. Priority 7 follows only after
  priority 6 is released and verified.

### Priority 6 release close-out

- [Deployment run 35521466617](https://github.com/sauravraghuvanshi/architecture-playground/actions/runs/35521466617)
  succeeded in 2m26s with authenticated hosted API and browser smoke.
- Hosted affected-surface acceptance: 36/39 passed, including every one of the
  ten deployment-assistance cases and exact artifact-content comparisons.
  The three initial failures were one browser-context startup timeout and two
  connection interaction timeouts, not code-generation failures.
- Two serial enterprise-suite repeats passed those three cases both times.
  Overall repeat result was 9/10: one GIF completion wait exceeded 90 seconds;
  the same graphics-export case passed initially and in the second repeat.
  Screenshot at failure capture showed "GIF export downloaded". This intermittent
  graphics/timing issue remains tracked in priorities 15/20/21; no timeout or
  assertion was weakened, and no graphics-export code changed in this release.
- All 39 distinct selected hosted cases passed at least once, but the broader
  suite was not uniformly green. Offline-IaC functionality is verified within
  its scope; universal production/workload readiness is not claimed.
- Owned local servers stopped and both temporary auth files removed. No live
  inference, generated customer infrastructure execution or role changes.
- Priorities **1-6 and 11 complete**; **7 next**, then the remaining numbered
  backlog. Competitor work stays deferred until stage 3.

## Priority 7 continuation - shared architecture semantics

Released as `bd095946e0c78005cdc5e6c2f161e11d0f8af266`:

- Introduced one UI-independent runtime/type contract with native payload
  version 1, explicit migration of older unversioned data, canonical provider-safe
  identities and rejection of unknown versions before replacing valid content.
- Added bounded environments, requirements, evidence and original design intent;
  declared service region/SKU/properties and typed relationship metadata survive
  native serialization/history, legacy adaptation, save/reload and JSON export.
- Inspector displays source-labelled context and supports region/SKU/environment
  and relationship edits. Complete environment/evidence definition authoring is
  available through the documented JSON contract, not an implied full metadata UI.
- Guided generation retains original user constraints separately from model prose.
  Whiteboard conversion retains textual model observations, never its transient
  source PNG. Versioned review/deployment inputs use the shared context; stale
  review detection includes metadata. Offline generators explicitly disclose
  per-service settings/requirements they do not implement.
- Fixed migration-only dirty revision churn and empty scratch recovery that could
  recreate a deleted blank diagram, without dropping metadata-only or annotated
  work. Legacy future-version imports/autosaves now preserve originals, reject
  invalid envelopes and pause writes with a visible recovery warning.
- Final current proof: **244/244 contracts**, lint/types/standalone build,
  **71/71 production-build browser cases**. IaC regression also passed 88
  executable safety cases and 17 real compiler/provider fixtures.
- The PowerShell harness cleanup was completed and passed 26/26 with concurrent
  lint; both final executable suites then passed 88/88 alongside lint/types.

### Priority 7 release close-out

- [Actions run 35527006724](https://github.com/sauravraghuvanshi/architecture-playground/actions/runs/35527006724)
  deployed the exact release successfully in 2m25s, with authenticated smoke.
- **71/71 hosted browser tests passed in one run**, in 3.8 minutes. The five new
  model cases and existing persistence/history, native/legacy import, boundary,
  conversion, template and export workflows are verified on this release.
- Temporary hosted auth was removed and owned local servers stopped. No live
  inference or generated customer infrastructure execution occurred.
- The model contract is documented in [architecture-model.md](architecture-model.md).
  Declared intent is not independent verification, and offline code still warns
  about per-service settings it does not implement. Full environment/evidence
  definition authoring is JSON-based.
- Completed priorities: **1-7 and 11**. **Priority 8 is next**. The deferred
  competitor checkpoint remains untouched until stage 3.

## Priority 8 continuation - independent engineering validation

Implemented and locally verified; deployment and hosted acceptance pending:

- Reproduced five accepted bad drafts: malformed Bicep/HCL, wrong canonical
  resource identity, missing plan prerequisites and code/ARM inventory mismatch.
- Added official Bicep and HCL parser-only helpers with pinned dependencies,
  bounded isolated processes and no artifact evaluation. Bash uses controlled
  no-execute syntax mode. PowerShell is deliberately reported unverified because
  its public parser can perform module/assembly/DSC resolution.
- Added canonical resource coverage, selected prerequisite/correspondence checks,
  a downloadable independent report and complete-set server revalidation before
  AI template publication. Failed/unverified checks cannot authorize publication.
- Local gate: **247/247 application contracts, 17/17 parser/policy cases, native
  Go tests, lint/types/build and 77/77 production-build browser cases**.
  All five original probes are rejected by the actual HTTP validator.
- Added locked native helper builds, source/platform fingerprints, retained
  dependency notices and a no-model/no-deployment hosted CI smoke.
- Latest user boundary: **finish task 8, deploy and verify it, update today's
  summary/lessons/backlog, then stop**. Priority 9 is for the next requested
  session, not tonight. Work has continued into September 21 IST.

### Priority 8 release close-out and final stop

- Feature commit `9c9e4988682b13a9bf6d7a682a31bf7090de72e7`.
- The first rollout's new smoke encountered 404 while the old app was still
  healthy. Native Linux build and the app package were valid; the old pipeline
  treated asynchronous upload acceptance as deployment completion.
- Correction `86cde202b25da1c2c69a78ca7ffdc5ccdc73de44` waits on the returned
  trusted SCM deployment operation, then verifies the new endpoint. Failure,
  unknown operation states, foreign URLs and bounded timeout are explicit errors.
- [Corrected deployment 35538732835](https://github.com/sauravraghuvanshi/architecture-playground/actions/runs/35538732835)
  passed in **4m22s**, including native Linux helpers and real hosted validation.
- **77/77 hosted tests passed in one run** (4.7 minutes). Final contracts are
  **249/249**, real parser/policy integration **17/17**, prior script safety
  **88/88**, plus native Go tests and lint/types/build.
- PowerShell remains explicitly unverified in the AI validator because its
  public parser can perform loading/resolution. Bounded static checks are not
  compiler/provider validation or deployment equivalence; the UI states that.
- Owned local servers stopped; temporary hosted auth removed. No live model
  inference, customer infrastructure execution, resource or permission change.
- Markdown now records deliveries, learning and the full pending roadmap.
  **Completed: 1-8 and 11. Next requested session: 9. No new priority started.**
- Deferred competitor work and local Git-excluded HTML audits remain unchanged.

## September 21 resumed work - priority 9 completed

- Released `b50a40fb3e3b75dc272b25b340e4b4580c9828f8`;
  [deployment 35564152616](https://github.com/sauravraghuvanshi/architecture-playground/actions/runs/35564152616)
  passed in 5m14s including Linux dependency restore and hosted smoke.
- New reviews require complete remediation, unique finding IDs, exact evidence
  references and matching framework URLs. Historical reads do not invent fields.
- Complete legacy evidence is retained within an explicit byte budget; oversized
  evidence/output and invalid UTF-8 fail explicitly. Explanation intake is bounded.
  Incomplete/refused chat responses cannot pass as complete JSON.
- Shared client container/header checks and full server decoding reject invalid
  PNG/JPEG/WebP, spoofing, truncation, animation, excessive bytes/dimensions/pixels.
  Sharp 0.34.5 is now explicitly required rather than optionally transitive.
- npm lock-only was blocked locally by an unrelated optional Tailwind mirror
  package. A surgical existing-lock update preserved all versions/integrities;
  clean Linux CI installation subsequently passed.
- Verification: **279/279 contracts**, lint/types/build, **37/37 local and 37/37
  hosted browser cases**. No real model inference or customer infrastructure.
- Temporary auth removed, local server stopped. Next ordered priority: **10**.
