# Implementation roadmap

Last updated: 2026-09-20, Asia/Kolkata.

**Priorities 1-4 are deployed and verified. Priorities 5-33 are pending.
The user has selected the Whiteboard fidelity / conversion / nested-boundary
detour below before resuming the numbered backlog.**

## User-selected interruption - 20 September 2026

The current candidate addresses canvas-aware AI image prompts, readable
Whiteboard theme behavior, canonical service icons during conversion, and real
nested cloud boundaries. It also includes a local, Git-excluded Cloudairy/Lucid
research supplement in `Audit Report/competition-and-canvas-fidelity.html`.
Combined production validation and release verification are in progress; do
not treat candidate functionality as deployed until the release record is added.

This overlaps parts of priorities 5, 7, 11, 12 and 14 without completing their
entire scope. Preserve the stable numbers and remaining acceptance criteria.

This is the persistent copy of the 33-item implementation order agreed in the
session. Keep these numbers stable so the user can select work by number.
They are not the 47 finding IDs in the original local HTML audit.

- [Session summary and test evidence](development-log-2026-09-20.md)
- [Deployment history and current release](../.azure/deployment-plan.md)
- Live app: https://architecture-playground.azurewebsites.net
- Current deployed application: `d70340cf0f72c39248e2d898e88ddee99c19936f`
- Original audit: local `Audit Report/index.html`, intentionally Git-excluded.
  Do not add the HTML report or test authentication files to a commit.

## Working agreement

- Use **GPT-6 Astra only**, including any explicitly delegated work.
- Handle **one user-selected priority at a time**.
- Plan, implement, test, complete readiness checks, deploy through the existing
  application workflow, then verify the deployed behavior.
- Ask the user for the next priority after finishing. If they are unavailable,
  wait; do not automatically implement the rest of this backlog.
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

These releases are cumulative. Current production includes all four.

## Remaining implementation priorities

Entries below retain their original scope. The user-selected interruption
above covers specific portions; broader requirements remain pending.
Descriptions are acceptance guidance, not claims of deployed functionality.

| Priority Number | Feature / Fix to Implement | Description |
| ---: | --- | --- |
| **5 - next** | **Correct cloud service and provider identification** | Use canonical service/provider identities instead of ambiguous editable labels. Fix duplicate/wrong App Service scaffolds and cross-cloud substitutions; report unmet prompt requirements explicitly. |
| 6 | Repair offline infrastructure-code generation | Fix invalid Terraform syntax, repeated declarations, resource-name collisions, invalid Bicep symbols, missing Function prerequisites, and configuration divergence across output formats. Add language/tool-backed validation. |
| 7 | Shared typed architecture model | Define one versioned model for services, providers, regions/SKUs, environments, relationships, boundaries, requirements and evidence. Use explicit migrations and preserve intent across canvas, AI, conversion and code. |
| 8 | Validated AI-generated engineering handoff | Check syntax, resource types, diagram mappings, prerequisites and code/ARM consistency. Show supported, partial and excluded components; never imply deployability from a nonempty string or mapped-node count. |
| 9 | Strict AI evidence and response contracts | Stop silent review truncation; require complete findings, unique IDs, valid evidence references and remediation. Consistently reject invalid images and oversized inputs before provider invocation. |
| 10 | Explicit AI destination and privacy controls | Remove implicit public-demo proxying in development. Require deliberate destinations, disclose prompt/image egress, and provide clear history deletion and retention controls. |
| 11 | Correct Whiteboard colors and image proportions | Fix actual dark/light canvas inversion and preserve decoded image aspect ratios. Verify displayed and exported pixels, not only theme-state strings or requested image sizes. |
| 12 | Safe Whiteboard conversion and restoration | Define cancellable analysis versus committed application; prevent late application after dismissal. Validate scene elements, geometry, bindings and binaries, and clarify new-document versus replacement behavior. Priority 3 protects the shared restore boundary but does not complete these Whiteboard-specific contracts. |
| 13 | Reliable AI loading, streaming and cancellation | Show disabled/checking state until readiness is known. Fix SSE framing and pending-read cancellation, support one insertable image-result contract, and distinguish timeout, throttle, refusal and truncated output. |
| 14 | Responsive and keyboard-accessible editing | Provide smaller-screen Inspector and Whiteboard asset drawers. Make menus keyboard-operable and all dialogs manage initial focus, focus trapping, Escape and focus restoration. |
| 15 | Cross-browser reliability for core workflows | Diagnose the repeated Firefox export/reload and WebKit drag/arrow failures. Publish a support policy and validate real Safari devices when promised; do not hide failures with timeouts. |
| 16 | Regression and release gates | Replace copied-test algorithms with production imports, add semantic/compiler-backed assertions, gate promotion on relevant suites, and verify completed deployment of the expected revision. Retain the production-bound tests already added. |
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

## Next task: priority 5 handoff

Build the detailed plan after the user's selection. Focus on canonical cloud
service/provider identity rather than editable labels or fuzzy cross-cloud
substitution. Related audit findings: AI-02, CA-03 and CA-12.

- Starting points: [heuristic scaffold](../lib/prompt-to-arch.ts),
  [offline codegen](../components/diagrammatic/csa/architecture-codegen.ts),
  [legacy icon resolution](../components/playground/lib/resolve-icons.ts),
  [service registry](../components/playground/lib/service-registry.ts), and
  [Studio template adapter](../components/diagrammatic/Workspace.tsx).
- Cover canonical App Service aliases, cross-tier duplicates, ambiguous labels,
  provider-locked matching, unknown-service reporting, and all bundled templates.
- Relabeling a resource must not change its provider/type. Unsupported nodes
  should remain explicitly unmapped rather than silently substituted.
- Preserve preview safety, graph fidelity, Undo/Redo and recovery. Do not
  accidentally absorb priority 6's entire IaC compiler/naming backlog or invoke
  live non-Astra models.
- Plan -> implement -> test -> validate -> deploy the app -> hosted verification
  -> ask for the next priority. No infrastructure provisioning is authorized.

## Useful regression surfaces

| Area | Existing tests |
| --- | --- |
| Priority 1 persistence/recovery | [persistence-recovery.spec.ts](../e2e/persistence-recovery.spec.ts), [saved-diagrams.spec.ts](../e2e/saved-diagrams.spec.ts), [test-diagram-documents.mjs](../scripts/test-diagram-documents.mjs) |
| Priority 2 native history | [undo-redo.spec.ts](../e2e/undo-redo.spec.ts), [test-architecture-canvas.mjs](../scripts/test-architecture-canvas.mjs), [test-whiteboard-canvas.mjs](../scripts/test-whiteboard-canvas.mjs) |
| Priority 3 graph fidelity | [architecture-roundtrip.spec.ts](../e2e/architecture-roundtrip.spec.ts), [test-graph-roundtrip.mjs](../scripts/test-graph-roundtrip.mjs), [test-hackathon.mjs](../scripts/test-hackathon.mjs) |
| Shared template/import behavior | [template-imports.spec.ts](../e2e/template-imports.spec.ts), [hackathon-workflows.spec.ts](../e2e/hackathon-workflows.spec.ts) |
| Priority 4 preview safety | [test-powershell-preview.mjs](../scripts/test-powershell-preview.mjs), [mock PowerShell harness](../scripts/test-preview-powershell.ps1), [deployment-assistance.spec.ts](../e2e/deployment-assistance.spec.ts) |

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
- The original HTML audit stays out of Git. Keep source changes, release evidence
  and this backlog separate from the immutable audit snapshot.
