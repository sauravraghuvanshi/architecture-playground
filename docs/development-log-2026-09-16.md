# Development log - 2026-09-16

Reporting date: Asia/Kolkata. This entry includes the implementation and validation
session that continued from September 15 into September 16.

## Executive summary

Prepared Diagrammatic's hackathon release around a simpler design, review,
explain, and deployment-handoff workflow. Added browser-local named documents,
real Microsoft Foundry agent integration, stronger evidence-based WAF review,
guided design assistance, and Whiteboard conversion.

The user authorized pushing the complete change set and testing the hosted
application. Live release results will be recorded below only after verification.

## Delivered

- Named architectures and Whiteboards in IndexedDB, with autosave, reopen,
  rename, delete, isolated comments/snapshots, and Whiteboard image binaries.
- Recovery of legacy drafts without deleting original data; save-before-New,
  mode switching and hub navigation; fresh-ID recovery copies for stale-tab conflicts.
- Removal of the duplicate top Templates menu and generic CSA rail.
  The gallery is for starting designs; Review my architecture is personalized.
- Named Foundry review and deployment agents using the application's Azure
  identity, native image input, bounded requests, cancellation, and no silent
  ordinary-chat fallback.
- Five offline WAF pillar scorecards, evidence, remediation playbooks and
  baselines that survive closing the review, editing the canvas and reopening.
- Business constraints and explicit preview/apply for guided architecture proposals.
- Whiteboard image style presets and preview/consent-based structured conversion,
  preserving the original Whiteboard and prior architecture as separate documents.
- Four deployment code formats, explicit offline starters, separate ARM previews,
  publication consent, anonymous token GET/OPTIONS with CORS, and manual upload
  instructions when Azure Portal cannot retrieve a link.
- Input validation, bounded corrective AI retry, timeouts, cancellation, rate and
  storage limits, correct undo/import behavior, and explicit export failures.

## Local verification

| Check | Observed result |
| --- | --- |
| Unit tests | 130 passed |
| Chromium journeys | 81 distinct cases passed across a full run and focused retests |
| Conditional/disabled browser cases | 3 skipped locally |
| ESLint and strict TypeScript | Passed |
| Production standalone build | Passed |
| Compiled-production API smoke | Auth gate, consent, anonymous template retrieval/CORS and offline WAF passed |
| Independent persistence follow-up | All six reported data-loss/recovery findings resolved |

The full browser run initially identified obsolete assertions for removed
controls and legacy draft-only saving. Tests were updated to exercise the actual
named-document and New workflows, then rerun. An early canvas interaction race
was fixed by waiting for the actual React Flow instance before enabling controls.

## Live release and verification

Status after resuming on September 16: initial release deployed; detailed live
acceptance and fixes in progress.

Target: https://architecture-playground.azurewebsites.net

- Release commit: `ff3e4e5116f1080e670cb76a05c717e308693e3a`
  (`feat: deliver hackathon workspace and Foundry workflows`).
- Pushed atomically to `master` and `agents/load-full-project-context`.
- Workflow: [Deploy to Azure - 35014990938](https://github.com/sauravraghuvanshi/architecture-playground/actions/runs/35014990938).
- The overnight workflow completed successfully, including authenticated API and
  browser smoke. Those smoke checks reported both Foundry agents unavailable;
  deployment success alone did not establish AI feature readiness.
- Release preflight additionally passed the two credential-gated browser journeys
  against an isolated authenticated production build.
- The authenticated full hosted Chromium run exercised 84 cases: 81 passed,
  two storage/load assertions exceeded their five-second waits, and one existing
  mid-scroll test remained disabled. Both failing assertions passed targeted
  retests with explicit remote-load allowances and unchanged expected contents:
  83 distinct cases passed overall.
- Seven real model generation calls passed for Flowchart, Mind Map, Sequence,
  ER, UML, C4 and Kanban. Architecture generation returned schema-validation 502
  on two synthetic requests. The corrective release adds the full JSON Schema
  and one validation-only correction under a shared deadline. The precise live
  failing field was not exposed by the old route and remains unconfirmed;
  tests reproduce invalid catalog aliases and malformed output without relaxing
  validation. Corrective validation passed 138 unit tests, lint, TypeScript and
  production build; real-model re-verification follows deployment.
- Real Whiteboard conversion passed: a synthetic PNG became two nodes and one
  connection, with no warnings.
- All four image styles produced decodable images through the real hosted SSE
  endpoint. A burst exceeded the provider quota after two images and correctly
  surfaced HTTP 429 as an SSE error. Executive and Blueprint then passed after
  quota refill (19 and 17 seconds respectively).
- Live, explicitly consented offline ARM publication and anonymous retrieval,
  GET/OPTIONS CORS, invalid-token handling and consent enforcement passed.
  No customer Azure resources were created.
- The initial daily log was included in the first release. The overnight handoff
  and resumed test evidence are included with the corrective release.

### Tomorrow's resume checklist

1. Inspect workflow `35014990938`; resolve any failed build/deploy/smoke step before
   proceeding. Confirm the hosted app serves the new release, not the old process.
2. Complete the read-only Azure runtime discovery. Confirm the Foundry project,
   named review/deployment agents, compatible models, App Service identity and
   least-privilege project access. No runtime settings or Azure resources were
   changed during this release preparation.
3. Run the authenticated hosted Chromium suite, using a temporary cookie-only
   storage state outside the repository. Login-specific tests deliberately start
   with empty cookies. Keep the local preview running.
4. Independently exercise real configured diagram/image generation, multimodal
   Foundry review, Whiteboard conversion and deployment-draft generation with
   synthetic data. Distinguish provider calls from mocked UI coverage.
5. Verify consented temporary ARM publication and anonymous live GET/OPTIONS/CORS.
   Do not approve actual customer resource creation in Azure Portal.
6. Replace pending results in this log and the deployment plan with observed
   evidence, update README if needed, commit/push the final documentation, and
   check the resulting workflow.

The user resumed and authorized completion at 09:47 IST. The pause is lifted.
Do not count mocked responses or configuration flags as live AI verification.

## Detailed acceptance matrix

The browser suites target the deployed application unless explicitly marked
isolated. Mocked AI UI responses test rendering, consent and failure behavior;
the separate real-service rows prove provider invocation.

| Feature | Verification and current result |
| --- | --- |
| Authentication | Hosted anonymous redirects, API denial, failed/correct login, cookie flags, safe return paths and logout passed |
| Nine workspace modes | Hosted initialization, supported controls, theme persistence and New workflows passed |
| Architecture authoring | Four-side connections, grouped boundaries, delete cascades, ordered/synchronized flow stages and undo/redo passed |
| Catalog and gallery | 1,433 cloud icons, 600 bundled symbols, all 16 architecture templates and provider-specific imports verified |
| Named documents | Save/New/Open/edit/reload, hub deep links, rename/delete, original draft recovery and cross-tab recovery passed |
| Document metadata | Comments and snapshots stay isolated; Whiteboard binary images survive reopen/reload/export |
| Storage fault behavior | Four isolated-origin IndexedDB tests verify large payloads, stale revisions and atomic rollback; not remote database tests |
| WAF | All five deterministic pillars, evidence tags, playbooks, baseline close/edit/reopen and added/removed evidence diffs passed |
| Review UI | Context, ranked findings, source switching, unavailability/error states and stale-review warnings passed with mocked AI |
| Real Foundry review | Hosted managed-identity canvas, imported JSON, description and PNG review passed; JPEG/WebP schema failures are being corrected |
| Real architecture generation | Both originally failing Azure prompts now pass on hosted `7585891`; AWS and GCP requests preserve their providers and services |
| Other real diagram generation | Flowchart, Mind Map, Sequence, ER, UML, C4 and Kanban returned valid native payloads |
| Real engineering explanation | Hosted model produced the required Components, Data flows and Notes sections |
| Real Whiteboard conversion | Native synthetic PNG transcribed into two service nodes and one connection; preview/consent/source preservation separately tested in UI |
| Real image generation | All four presets passed SSE and image decode checks; provider burst 429 surfaced explicitly and recovered after quota refill |
| Static/text export matrix | All 36 advertised PNG/SVG/PDF/JSON/SQL/TypeScript/Markdown outputs across nine modes passed actual download/content checks on hosted `7585891` |
| Animated exports | Architecture ordered/synchronized GIF and Whiteboard connected-flow GIF downloaded successfully |
| Deployment UI | All formats, code/ARM preview, downloads, consent reset, malformed output and manual fallback paths passed with mocked agent replies |
| Real Foundry deployment | Managed identity reaches the model; returned-draft validation failure is being diagnosed for all four formats |
| Portal handoff | Live consent enforcement, temporary offline ARM publication, anonymous GET/OPTIONS and CORS passed; no customer resources created |
| Guardrails | Bounded imports/uploads, malformed input, cancellation, rate-limit/error contracts and no silent export/AI fallback covered by targeted API/unit/browser tests |

### Additional defects found by deeper live testing

1. Exact App Service catalog identity was wrong in real generated output. Schema
   completeness alone did not fix it. Existing canonical service-name guidance
   now produces the correct asset without adding duplicates or remapping output.
2. Named Foundry agents reject top-level `instructions`/`text` overrides and
   require explicitly typed messages. The corrected transport works with actual
   hosted managed identity for review.
3. SVG data URL conversion truncated Unicode text into byte values. Valid UTF-8
   conversion fixed XML parser failures in UML and Whiteboard exported files.

## Boundaries and lessons

- Saved documents remain in the current browser profile: no account sync,
  cross-device storage, or service-side diagram backup.
- Review/conversion images are not persisted by Diagrammatic. Whiteboard images
  deliberately inserted into a document are saved with that browser-local scene.
- Foundry requests use `store:false` without conversations; provider policies and
  Azure diagnostics still apply, so this is not a universal zero-retention claim.
- Generated code is an unverified draft, not proof of deployability or compliance.
  Azure Portal owns customer authentication, final review, cost approval and creation.
- The template broker is instance-local; restarts, multi-instance routing, private
  networking and Easy Auth can break links despite correct application CORS.
- A 50% reduction in non-customer time remains a measurable goal, not a proven result.
- Local success is not production readiness until the deployed release is tested.
