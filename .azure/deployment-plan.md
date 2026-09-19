# Azure Deployment Plan

> **Status:** Deployed

Generated: 2026-08-12
Updated: 2026-09-20 (Asia/Kolkata)

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
