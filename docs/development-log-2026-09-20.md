# Development log - 2026-09-19/20

Reporting timezone: Asia/Kolkata. This session started on September 19 and
continued until approximately 02:33 IST on September 20, 2026.

**Overnight close-out:** priorities 1-3 were deployed and verified when work was
paused. **Resumed at the user's request later on September 20 for priority 4;**
see the continuation section at the end and the current deployment plan.

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

The authoritative pending list is priorities 4-33 in the
[implementation roadmap](implementation-roadmap.md). Notable unresolved items:

- Offline PowerShell described as a safe What-If preview still performs a
  resource-group write before template preflight. **This is priority 4, not
  fixed today. Do not execute that generated script against Azure for testing.**
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
3. Confirm that the user's next selection is **priority 4**, or use another
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
changes are retained and will be published with this application release.

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

Release and hosted-verification results will be recorded after deployment.
