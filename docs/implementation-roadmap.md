# Implementation roadmap

Last updated: 2026-09-22, Asia/Kolkata (priority 16 deployed and verified; next 17).

**Priorities 1-16 are deployed and verified within their stated scopes.
The user resumed the remaining priorities at 13:29 IST on September 22.
Priority 17 is next; 17-33 follow in order. Competitor-inspired additions
remain after the numbered roadmap.**

**Previous urgent work completed:** the user resumed the saved-Whiteboard
recovery warning and failed-pipeline issue. Release `625e199` removes the
persistent canvas recovery banner, restores usable saved content while archiving
the original, and hardens hosted parser smoke retries/diagnostics. Workflow
`35693782055` and **90/90 hosted three-engine cases passed**. The overnight
incomplete-verification blocker is closed. The subsequent user instruction
explicitly resumes priority 16 and the ordered backlog.

The September 21 screenshot-reported regressions are now fixed in `cf6da2b`:
native elbow binding compatibility restores saving/conversion/mode switching;
deployment readiness recognizes the APIM illustration and offers explicit
undoable App Service symbol correction. Pre-deployment contracts and native
screenshot journeys are now mandatory pipeline gates. The numbered backlog
does not resume automatically.

## User-selected interruption - 20 September 2026

Deployed release `94e1abc` addresses canvas-aware AI image prompts, readable
Whiteboard theme behavior, canonical service icons during conversion, and real
nested cloud boundaries. It also includes a local, Git-excluded Cloudairy/Lucid
research supplement in `Audit Report/competition-and-canvas-fidelity.html`.
The release passed 212 unit/contract tests, 8 PowerShell safety tests, 32 scoped
local browser cases and all 74 distinct hosted cases across the main run and
targeted readiness rechecks. Detailed broader local limitations remain recorded.

That release completed priority 11 and portions of 5, 7, 12, 13 and 14.
Priorities 5-10 and 12 were completed subsequently; later AI/accessibility
scope remains pending. Local Outline/collapse/mapping-editor/engineering-packet work
started after the research is deferred, not deployed, under the latest order.

This is the persistent copy of the 33-item implementation order agreed in the
session. Keep these numbers stable so the user can select work by number.
They are not the 47 finding IDs in the original local HTML audit.

- [Latest session handoff: completed work, lessons and tomorrow's tasks](session-summary-2026-09-22.md)
- [Chronological development log and test evidence](development-log-2026-09-20.md)
- [Deployment history and current release](../.azure/deployment-plan.md)
- Live app: https://architecture-playground.azurewebsites.net
- Current hosted-verified application: `1404737cbf1a54a0fb2bae6d53344c95eddbd07e`,
  [successful deployment 35705631954](https://github.com/sauravraghuvanshi/architecture-playground/actions/runs/35705631954).
- Historical gesture release `bd27fff` reached Azure but failed its parser smoke;
  its incomplete verification is superseded by the current successful release.
- [Earlier stop-after-8 checkpoint](session-summary-2026-09-21.md)
- Original audit: local `Audit Report/index.html`, intentionally Git-excluded.
  Do not add the HTML report or test authentication files to a commit.

## Working agreement

- Use **GPT-6 Astra only**, including any explicitly delegated work.
- Handle **one numbered priority at a time**.
- Plan, implement, test, complete readiness checks, deploy through the existing
  application workflow, then verify the deployed behavior.
- **Latest authorization:** resume remaining priorities in order, beginning
  with 16. Complete and verify each release before advancing to the next.
  Earlier pause instructions remain historical checkpoints.
- Competitor-audit product additions are stage 3, after the numbered backlog.
  Preserve their local WIP without mixing it into earlier priority releases.
- Do not sacrifice verification to a time estimate; accurately record blockers
  and remaining work rather than promising the entire backlog by a deadline.
- Favor Cloud Architecture, Whiteboard, and AI outcomes. Preserve earlier fixes
  with regression tests, and do not fold unrelated audit items into a release.
- A configured AI flag, mocked response, or historical test is not a current
  successful live-model invocation. Label verification boundaries accurately.
- Preserve local-first use. Team identity, collaboration, and cloud sync are
  explicit later scope decisions, not assumptions about the current product.

## Completed priorities

| Priority Number | Feature / Fix | Status and delivered behavior |
| ---: | --- | --- |
| 1 | Reliable saving and recovery | **Deployed - `79e353b`.** Live scratch checkpoints, corruption isolation, recovery downloads/copies, storage-failure protection, and conflict-safe dirty tracking. |
| 2 | Complete Undo/Redo for both canvases | **Deployed - `d2c21fe`.** Immediate Whiteboard insertion history, binary-preserving Redo, architecture resize/bulk-style/deletion history, toolbar restoration, and correct redo branching. |
| 3 | Lossless architecture save/import/export | **Deployed - `64f1c48`.** Connection sides, explicit geometry, grouping, identity and stages survive round-trips; invalid input is rejected before mutation; legacy hierarchy/stage limits are consistent. |
| 4 | Truly read-only deployment previews | **Deployed - `d70340c`.** Offline `preview.ps1` uses the dedicated What-If result API with preflight, explicit matching subscription and an existing group; matching Bicep download and provenance guidance. No resource-write or execution mode. |
| 5 | Correct cloud service and provider identification | **Deployed - `98e130c`.** Shared canonical alias resolution, exact provider-locked picks, one service per identity in heuristic drafts, visible coverage/assumptions, canonical picker search, label-independent native/legacy Azure resource kinds, atomic rejection of unresolved legacy AI and zero-artifact guards. Hidden palette images load lazily. |
| 6 | Reliable offline infrastructure drafts | **Deployed - `c271483`.** Shared native/legacy generation, collision-safe bounded names, explicit common namespace/existing group, valid Terraform, keyless Function host prerequisites, workspace/subnet dependencies and matching CLI Bicep companion. Verified with real compilers, executable mocks and hosted downloads; customer deployability remains unproven. |
| 7 | Shared typed and versioned architecture model | **Deployed - `bd09594`.** Shared schemas/types, explicit safe migration, declared configuration/environments/relationships, requirement/evidence provenance and original intent across editing/history/persistence/conversion/AI. Inspector context, future-version overwrite protection and explicit offline-code limitations. Full context definition authoring remains JSON-based. |
| 8 | Independently validated AI engineering handoff | **Deployed - `9c9e498`, rollout gate `86cde20`.** Official Bicep/HCL parser-only checks, controlled Bash syntax checks, canonical coverage, selected prerequisites/correspondence, visible unverified states and validation-report download. Complete artifact/evidence sets are revalidated before publication. PowerShell and unsupported/dynamic cases remain review-only; no generated infrastructure is executed. |
| 9 | Strict AI evidence and response contracts | **Deployed - `b50a40f`.** Complete new-review remediation, unique findings/references, matching guidance sources, exact evidence references, no legacy evidence truncation, bounded UTF-8 intake, actual PNG/JPEG/WebP full decoding before providers and rejection of incomplete/refused chat completions. Historical reads remain explicit. |
| 10 | Explicit AI destinations and privacy controls | **Deployed - `52b5efa`.** No implicit demo proxy, validated configured origins, redirect/self/chained-proxy rejection, authenticated origin/data/retention disclosures, opt-in bounded local prompt history, memory-only candidates and cancellation-safe scoped clearing. Saved diagrams and provider retention are explicitly separate. |
| 11 | Correct Whiteboard colors and image proportions | **Deployed - `94e1abc`.** Literal-color rendering/export, canvas-aware image context, decoded aspect ratios, adaptive owned neutral foregrounds and legacy bundled-icon readability, verified with displayed/exported pixels. Custom and ambiguous legacy white text remains user-controlled. |
| 12 | Safe Whiteboard conversion and restoration | **Deployed - `a95261e`.** Bounded native scene/geometry/reference/binary validation before recovery or mutation, preserved corrupt originals, compatible raster/static-SVG migration, unfinished-scene guards, stale decode/notification invalidation and separate cancellable analysis versus committed new-document creation. Existing diagrams are preserved; failures retain a retryable preview. Binary checks are structural/header-based, not universal pixel decoding. |
| 13 | Reliable AI readiness, streaming and cancellation | **Deployed - `d490193`.** Independent readiness flags/deadline; bounded UTF-8/CR/LF SSE parser; prompt pending-read and producer cancellation; exactly one validated base64/MIME outcome; direct-provider pixel validation; redacted timeout/throttle/refusal/error states; decode-time cancellation and guarded graph document commits. No live-model or durable-job guarantee. |
| 14 | Responsive and keyboard-accessible editing | **Deployed - `d81a0fd`.** Compact palette/assets/Inspector and utility drawers, full-width canvas, shared native/compatibility dialog focus management, commit-safe dismissal, asynchronous opener/tab focus restoration, viewport-bounded keyboard disclosures and context actions. Verified actual portrait/landscape geometry and 149 local/149 hosted Chromium cases; not a cross-browser or formal WCAG certification. |
| 15 | Cross-browser reliability | **Deployed - `3a04dbc`, restoration correction `3b5d8fd`.** Portable native drag envelopes, standard font embedding, deterministic document handoffs, pointer-safe Whiteboard reconciliation, raster cleanup and WebKit focus handling. Playwright 1.63.0 and explicit support policy. Loading defaults cannot overwrite saved boards. Final correction: 356 contracts, 108 local and 108 hosted three-engine cases pass. Real Safari/iOS remains unqualified. |
| 16 | Regression and release gates | **Deployed - `1404737`.** Actual production imports replace mirrored algorithms, 392 application contracts, official parser and script-safety gates, 17 Bicep/Terraform compiler/provider fixtures, 118 selected pre-deployment browser cases, credential-free PR checks, serialized deployments and authenticated exact commit/build verification. All Linux CI gates and 24 hosted three-engine cases passed. |

These releases are cumulative. Current production includes all sixteen numbered
items plus the explicitly requested nested-boundary and conversion improvements.

## Remaining implementation priorities

Entries below retain their original scope. The user-selected interruption
above covers specific portions; broader requirements remain pending.
Descriptions are acceptance guidance, not claims of deployed functionality.

| Priority Number | Feature / Fix to Implement | Description |
| ---: | --- | --- |
| 17 | Grounded, reproducible architecture reviews | Tie recommendations to supporting evidence, not just framework landing pages. Record prompt/model/schema versions and distinguish depicted, proposed, validated and runtime-verified facts. |
| 18 | Domain-specific AI quality evaluations | Build versioned golden tasks for generation, review, conversion and IaC. Measure requirements, identity/topology fidelity, grounding and artifact validity; gate prompt/model changes on meaningful results. |
| 19 | Correct request-flow ordering and selectable scenarios | Make automatic ordering follow topology; separate infrastructure/telemetry relationships from narrated flows. Add named happy-path, failure, retry and streaming scenarios. The stage-bound fixes in priority 3 do not complete scenario semantics. |
| 20 | Faithful diagram and document exports | Fix Mermaid/draw.io identity and direction loss; provide genuine editable interchange and a complete document package containing metadata, comments, versions and image files. Priority 3 covers architecture JSON fidelity, not every export format or package. |
| 21 | Large-canvas and GIF performance | Coalesce changes before serialization, avoid preparing every frame upfront, bound native rasterization, and move heavy work off the UI thread when appropriate. Provide progress, cancellation and measured scene limits. |
| 22 | AI-assisted incremental architecture changes | Propose evidence-linked node/edge/configuration diffs rather than whole-diagram replacement. Support selective approval, document-revision checks, atomic application and Undo. Depends on the shared model and quality gates. |
| 23 | Editable, source-linked Whiteboard conversion | Convert selected regions, correct uncertain services/connections and merge approved objects. Preserve source-element provenance and offer a return-to-source workflow. |
| 24 | Professional architecture and Whiteboard starter kits | Add provider-locked patterns and workshop starters for landing zones, trust boundaries, networking, resilience, RAG, agents and AI delivery. Validate semantic identities and topology, not only appearance. |
| 25 | Presenter mode and customer handoff pack | Repair presentation loading from local documents. Add named walkthroughs, speaker notes, redaction, architecture decisions, unresolved questions and action ownership in a reusable customer package. |
| 26 | AI Forward-Deployed Engineer workbench | Model agents, tools, retrieval, memory, guardrails and evaluations. Attach prompt/model versions, datasets, traces, quality results and unit costs to the architecture. |
| 27 | Provider-aware AI capabilities and multi-cloud expansion | Reject unsupported cloud-only requests before inference; disclose Azure-specific and multi-cloud capabilities. Add AWS/GCP review and IaC adapters only with independent mappings and evaluation gates. |
| 28 | AI cost, context and concurrency controls | Add weighted user/tenant budgets, attempt-level usage, bounded concurrency and retries, and smaller relevant catalog context. Include correction/cancellation costs; request counts alone are insufficient. |
| 29 | Operational visibility and durable long-running jobs | Add correlation IDs, readiness/version endpoints, redacted AI/save/export diagnostics and alerts. Make long operations reconnectable, cancellable and idempotent where needed; SSE alone is not durability. |
| 30 | Optional enterprise identity, sync and durable shared state | Add individual SSO, scoped roles/projects, tenant isolation, audit, retention and optional backup/sync. Externalize limits and expiring template state before scale-out, while preserving the local-only edition. |
| 31 | Read-only infrastructure import and drift detection | Import authorized cloud inventory and IaC into the typed model. Compare intended design with timestamped deployed evidence without modifying customer resources. Requires connector authorization and scope controls. |
| 32 | Cost, latency and resilience comparison | Compare alternatives using explicit traffic, region, SKU, pricing and recovery assumptions, including AI costs. Show sources, dates and uncertainty; estimates are not quotes or verified guarantees. |
| 33 | Collaborative workshops and design approvals | Add presence, follow-presenter, voting, assigned comments, approvals and conflict-safe editing after identity, authorization, durable state and offline/recovery behavior are established. |

## Completed priority 4: preview safety contract

### Fixed issue

The audit finding `CA-05` identified an offline PowerShell generator that invoked
`New-AzResourceGroup ... -Force` before checking for the referenced Bicep file.
Only the subsequent deployment command had What-If behavior. Release `d70340c`
replaces that wrapper with a preview-only command and no deployment path.

The fix was tested with the actual generated script in PowerShell against mocks,
not a customer subscription. The unchanged generated Bicep and model-generated
drafts retain the validation limitations assigned to later priorities.

### Starting points

- [Offline architecture code generation](../components/diagrammatic/csa/architecture-codegen.ts)
- [Code preview UI](../components/diagrammatic/csa/ArchitectureCodeModal.tsx)
- [Deployment preview and consent UI](../components/diagrammatic/csa/AzureDeployModal.tsx)
- [CSA/code-generation tests](../scripts/test-csa.mjs)
- [Deployment contract tests](../scripts/test-foundry-deployment.mjs)
- [Deployment browser tests](../e2e/deployment-assistance.spec.ts)

### Verified acceptance and continuing regression requirements

1. Preview performs no Azure resource writes, including resource-group creation.
2. Required files, inputs and dependencies are checked before potentially
   consequential commands.
3. Execution, if offered, is a separate explicit user choice; UI labels and
   downloaded-script behavior agree.
4. Mocked tests prove preview, missing-file, invalid-input and cancellation paths
   do not invoke write commands.
5. Existing code-preview/download/consent behavior and priorities 1-3 remain
   covered by regression tests.
6. After the application release, verify the hosted generated preview/download
   without executing customer infrastructure deployment.

Verification: 180 existing unit/contract checks, eight PowerShell mock tests
(23 generated-script invocations), all eight deployment UI cases, and 37 distinct
hosted cases across the main run and unchanged retests. Broader local timing
failures are disclosed in the deployment plan. No real What-If or customer
resource creation was performed.

## Next task: priority 10

Priority 9 is deployed and verified. Continue with priority 10 under the user's
September 21 authorization; competitor work remains deferred.

- Starting points: AI proxy/configuration helpers, request routing and status,
  every AI invocation surface, persisted prompt/review history and privacy notices.
  Remove implicit destinations without changing configured production model
  endpoints. Distinguish local history deletion from provider retention.
- Preserve the [shared model](architecture-model.md) and the
  [engineering-validation boundary](engineering-validation.md). Tighten remaining
  evidence/response contracts without running model-authored code or silently
  truncating results.
- Preserve [canonical identity](../lib/service-identity.ts), explicit unsupported
  coverage and the no-resource-write PowerShell preview contract.
- Generated drafts remain distinct from permission to deploy customer resources.
  No generated customer IaC is to be executed against Azure during testing.
- Continue plan -> implement -> test -> validate -> deploy the application ->
  hosted verification for each ordered priority, then move to the next.
- Deferred competitor work remains pinned at
  `refs/checkpoints/deferred-competitor-a7e748c4` (stash `c4b91a44`); do not apply
  it during the numbered backlog.

## Useful regression surfaces

| Area | Existing tests |
| --- | --- |
| Priority 1 persistence/recovery | [persistence-recovery.spec.ts](../e2e/persistence-recovery.spec.ts), [saved-diagrams.spec.ts](../e2e/saved-diagrams.spec.ts), [test-diagram-documents.mjs](../scripts/test-diagram-documents.mjs) |
| Priority 2 native history | [undo-redo.spec.ts](../e2e/undo-redo.spec.ts), [test-architecture-canvas.mjs](../scripts/test-architecture-canvas.mjs), [test-whiteboard-canvas.mjs](../scripts/test-whiteboard-canvas.mjs) |
| Priority 3 graph fidelity | [architecture-roundtrip.spec.ts](../e2e/architecture-roundtrip.spec.ts), [test-graph-roundtrip.mjs](../scripts/test-graph-roundtrip.mjs), [test-hackathon.mjs](../scripts/test-hackathon.mjs) |
| Shared template/import behavior | [template-imports.spec.ts](../e2e/template-imports.spec.ts), [hackathon-workflows.spec.ts](../e2e/hackathon-workflows.spec.ts) |
| Priority 4 preview safety | [test-powershell-preview.mjs](../scripts/test-powershell-preview.mjs), [mock PowerShell harness](../scripts/test-preview-powershell.ps1), [deployment-assistance.spec.ts](../e2e/deployment-assistance.spec.ts) |
| Priority 5 canonical identity | [test-service-identity.mjs](../scripts/test-service-identity.mjs), [service-identity.spec.ts](../e2e/service-identity.spec.ts), [audited template identities](../scripts/fixtures/template-icon-identities.json) |
| Priority 6 IaC correctness | [test-iac-codegen.mjs](../scripts/test-iac-codegen.mjs), [compiler validation](../scripts/validate-iac.mjs), [CLI safety](../scripts/test-azure-cli-draft.mjs), [deployment-assistance.spec.ts](../e2e/deployment-assistance.spec.ts) |
| Priority 7 model/migrations | [test-architecture-model.mjs](../scripts/test-architecture-model.mjs), [architecture-model.spec.ts](../e2e/architecture-model.spec.ts), [model contract](architecture-model.md), shared canvas/document and legacy graph tests |
| Priority 8 artifact validation | [test-artifact-parser.mjs](../scripts/test-artifact-parser.mjs), [test-engineering-validation.mjs](../scripts/test-engineering-validation.mjs), [engineering-validation.spec.ts](../e2e/engineering-validation.spec.ts), [contract](engineering-validation.md) |
| Priority 9 evidence and response contracts | [test-review-contracts.mjs](../scripts/test-review-contracts.mjs), [test-review-image.mjs](../scripts/test-review-image.mjs), [review-contracts.spec.ts](../e2e/review-contracts.spec.ts), [contract](ai-evidence-contracts.md) |
| Async rollout completion | [deploy-zip.mjs](../scripts/deploy-zip.mjs), [test-deploy-zip.mjs](../scripts/test-deploy-zip.mjs), hosted validation smoke |

## Next-session operational reminders

- Read the current Git status and remote branch before editing or releasing.
  The overnight closing Markdown was preserved and published with priority 4;
  do not discard any newer local changes.
- Application source is already released on `master` and the working branch.
  Do not redeploy merely to publish documentation.
- Use the existing App Service/GitHub Actions recipe; no new environment,
  resources or Azure subscription choice is needed unless the user changes scope.
- Run `azure-prepare` -> `azure-validate` -> `azure-deploy` for each application
  release and record actual proof. Do not mark validation complete by assumption.
- Use an owner-authorized GitHub identity without printing tokens or changing
  unrelated global authentication settings.
- Use fresh isolated hosted test state, remove it afterward, and keep secrets out
  of source, Markdown, reports and logs.
- Treat model configuration as configuration, not successful invocation or
  verified model identity. Honor the GPT-6 Astra-only restriction.
- Existing local test results contain readiness/timing failures and known
  non-Chromium issues; distinguish baseline limitations from new regressions.
  Priority 6 hosted artifacts passed; broader acceptance was 36/39 plus 9/10
  serial rechecks. Initial connection failures passed both repeats, while one
  GIF completion exceeded 90 seconds. Preserve this intermittent issue for
  priorities 15/20/21; do not describe the whole suite as uniformly green.
  The subsequent priority 7 release passed its full 71-case hosted suite in one
  run; that is new release evidence, not proof that intermittent/cross-browser
  issues have been permanently fixed.
  Priority 8 also passed 77/77 hosted in one run. Broader Node 20 lifecycle,
  cross-browser, performance and release-gate work remains in the numbered backlog;
  fixing the coupled async-upload race does not mark all of priority 16 complete.
- The original HTML audit stays out of Git. Keep source changes, release evidence
  and this backlog separate from the immutable audit snapshot.
