# Development log - 2026-09-16

Reporting date: Asia/Kolkata. This entry includes the implementation and validation
session that continued from September 15 into September 16.

## Executive summary

Completed and deployed Diagrammatic's hackathon release around a simpler design, review,
explain, and deployment-handoff workflow. Added browser-local named documents,
real Microsoft Foundry agent integration, stronger evidence-based WAF review,
guided design assistance, and Whiteboard conversion.

The complete change set is pushed to both production and the working branch.
All supported feature groups were exercised, including genuine hosted AI calls,
and defects discovered by live testing were corrected and retested. The final
application release is `29a8bb9`; documentation-only follow-ups do not change the
running application.

## Session close - 16:51 IST

- Confirmed the working tree was clean and both `master` and
  `agents/load-full-project-context` already contained the complete implementation
  and the previous verification summary (`5b64fcc`).
- The running application remains release `29a8bb9`, verified by successful
  deployment run `35065496209`. This close-out is documentation-only and does not
  trigger another application deployment.
- No implementation or release blockers remain from this session. The evidence
  below records the tests performed earlier; they were not rerun for this
  documentation-only close.
- Temporary test authentication state was removed after live verification.
  This close-out does not change local preview processes or Azure resources.
- The README, deployment plan and this log preserve the completed work, release
  identifiers, actual test coverage and limitations for the next session.

Future work is optional, not unfinished release work: cross-device document
sync, shared rate-limit/template storage before scaling out, broader browser and
load testing, and measurement of the proposed 50% productivity improvement.
Generated IaC still requires customer-specific validation and approval; the
single disabled legacy mid-scroll test is documented rather than counted as
passed.

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
| Unit tests | 152 passed, zero failures/skips |
| Chromium checks | 95 distinct cases passed across full, targeted and opt-in real-AI runs: 91 hosted-app journeys and 4 isolated IndexedDB cases |
| Disabled browser case | One existing legacy mid-scroll test; all credential-gated and opted-in AI cases were exercised |
| ESLint and strict TypeScript | Passed |
| Production standalone build | Passed |
| Compiled-production API smoke | Auth gate, consent, anonymous template retrieval/CORS and offline WAF passed |
| Independent persistence follow-up | All six reported data-loss/recovery findings resolved |

The full browser run initially identified obsolete assertions for removed
controls and legacy draft-only saving. Tests were updated to exercise the actual
named-document and New workflows, then rerun. An early canvas interaction race
was fixed by waiting for the actual React Flow instance before enabling controls.

## Live release and verification

Status: complete. All release workflows succeeded, and the final remaining
PowerShell draft and generated-code checks passed on the hosted application.

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
- Real model generation passed for all eight supported diagram modes. The exact
  architecture failure was confirmed as `nodes.0.data.iconId` selecting a missing
  alias. Canonical catalog guidance fixed both original Azure prompts; additional
  AWS and GCP requests preserved their providers and intended services.
- Real Whiteboard conversion passed: a synthetic PNG became two nodes and one
  connection, with no warnings.
- All four image styles produced decodable images through the real hosted SSE
  endpoint. A burst exceeded the provider quota after two images and correctly
  surfaced HTTP 429 as an SSE error. Executive and Blueprint then passed after
  quota refill (19 and 17 seconds respectively).
- Live, explicitly consented offline ARM publication and anonymous retrieval,
  GET/OPTIONS CORS, invalid-token handling and consent enforcement passed.
  No customer Azure resources were created.
- Final deployment-format sweep: Bicep 200 (2 resources / 2 mappings), Terraform
  200 (3/3), Azure CLI 200 (2/2), PowerShell 200 (2/2); zero excluded diagram nodes.
- An actual agent-generated ARM draft was explicitly published and anonymously
  retrieved successfully; this is separate from the offline handoff test.
- A fresh, unmodified hosted Bicep output compiled without resource diagnostics.
  Generated PowerShell passed syntax parsing with zero errors. Neither script was
  executed; Terraform initialization/plan and Azure resource deployment were not
  performed. These sample checks are not a guarantee for every future AI draft.

### Releases

| Application commit | Purpose | Successful GitHub Actions run |
| --- | --- | --- |
| `ff3e4e5` | Complete hackathon workspace | [35014990938](https://github.com/sauravraghuvanshi/architecture-playground/actions/runs/35014990938) |
| `cca875e` | Full generation schema and bounded correction | [35057560382](https://github.com/sauravraghuvanshi/architecture-playground/actions/runs/35057560382) |
| `7585891` | Canonical icon guidance, Foundry protocol and UTF-8 exports | [35060174478](https://github.com/sauravraghuvanshi/architecture-playground/actions/runs/35060174478) |
| `de94e21` | Image evidence references and complete ARM resource mappings | [35062336603](https://github.com/sauravraghuvanshi/architecture-playground/actions/runs/35062336603) |
| `29a8bb9` | Compiler-guided Web resource shapes, safe diagnostics and real-AI UI tests | [35065496209](https://github.com/sauravraghuvanshi/architecture-playground/actions/runs/35065496209) |

### Runtime configuration completed

- Enabled the existing App Service's system-assigned managed identity.
- Granted **Foundry User** only at the existing
  `ap-foundry-eastus/architecture-playground-ai` project scope.
- Created `diagrammatic-review:1` and `diagrammatic-deployment:1` using the
  existing `gpt-4o-mini` deployment, with no tools and JSON-object output.
- Added only the three missing Foundry settings; preserved all existing settings.
- Verified actual invocation through the hosted app identity, not just the
  operator's identity or a configuration flag.
- No new model deployments, resource groups, or customer workload resources.

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
| Real Foundry review | All six hosted managed-identity inputs passed on `de94e21`: canvas, imported JSON, description, PNG, JPEG and WebP; image findings contain no invented structured IDs |
| Real architecture generation | Both originally failing Azure prompts now pass on hosted `7585891`; AWS and GCP requests preserve their providers and services |
| Other real diagram generation | Flowchart, Mind Map, Sequence, ER, UML, C4 and Kanban returned valid native payloads |
| Real engineering explanation | Hosted model produced the required Components, Data flows and Notes sections |
| Real Whiteboard conversion | Native synthetic PNG transcribed into two service nodes and one connection; preview/consent/source preservation separately tested in UI |
| Real image generation | All four presets passed SSE and image decode checks; provider burst 429 surfaced explicitly and recovered after quota refill |
| Static/text export matrix | All 36 advertised PNG/SVG/PDF/JSON/SQL/TypeScript/Markdown outputs across nine modes passed actual download/content checks on hosted `7585891` |
| Animated exports | Architecture ordered/synchronized GIF and Whiteboard connected-flow GIF downloaded successfully |
| Deployment UI | All formats, code/ARM preview, downloads, consent reset, malformed output and manual fallback paths passed with mocked agent replies |
| Real Foundry deployment | All four formats passed a clean final hosted sweep with complete resource mappings and zero excluded nodes |
| Real AI browser workflows | Without mocked responses: generated design saved as a named document and reviewed; generated image inserted in the Whiteboard draft; generated Bicep and ARM reached deployment previews with publishing disabled until consent |
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
4. Image-review responses echoed JSON Schema metadata and invented IDs from box
   labels. Explicit root fields and source-specific ID allowlists preserve strict
   validation and now pass real PNG/JPEG/WebP review.
5. Deployment drafts omitted mappings for supporting resources. Complete mapping
   instructions plus a bounded validation-only correction preserve one mapping
   for each ARM resource. All formats passed final hosted verification.
6. Bicep samples put `identity` and `kind` under `properties`. Official root-field
   guidance and a compiler-verified example produced a new hosted sample without
   those diagnostics. Rejected drafts now expose only safe field/code categories,
   not generated values or credentials.

### Reproducing opt-in live AI checks

The normal suite uses mocks for deterministic AI UI behavior. The separate
`e2e/live-ai-workflows.spec.ts` makes real, paid inference calls and is disabled
unless `LIVE_INVOKE_AI=true` and `PLAYWRIGHT_STORAGE_STATE` points to a temporary
authenticated cookie-only state. Set `PLAYWRIGHT_BASE_URL` to the hosted app and
`PLAYWRIGHT_SKIP_WEBSERVER=true`; keep the state outside the repository and delete
it after testing. These tests never publish a template or create Azure resources.

The API smoke uses separate explicit opt-ins: `LIVE_INVOKE_AGENTS=true`,
`LIVE_REQUIRE_AGENTS=true`, and `LIVE_PUBLISH_TEMPLATE=true`. Publication stores
only the synthetic reviewed ARM template at a ten-minute bearer URL; it does not
deploy its resources.

## Boundaries and lessons

- Verification covers representative supported workflows in desktop Chromium,
  not every possible architecture, browser, load level or generated program.
  AI remains nondeterministic: provider throttling and invalid drafts can occur,
  are surfaced explicitly, and are not converted into false success.
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
