# Azure Deployment Plan

> **Status:** Validated

Generated: 2026-08-12

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

## 7. Security and Validation

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
- [ ] Obtain explicit deployment confirmation
- [ ] Invoke `azure-deploy` only if deployment of this application is requested
- [ ] Verify the production health and critical CSA journeys

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
