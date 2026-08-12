# Development log — 2026-08-12

## Executive summary

Diagrammatic evolved from an architecture editor into a Microsoft CSA workspace.
The session delivered first-party Azure guidance, assessments, infrastructure
generation, deployment handoff, Whiteboard product separation, universal canvas
themes, connected Whiteboard flow GIFs, and multimodal customer architecture
review.

Every feature was implemented in a small milestone, validated locally, deployed
through the existing GitHub Actions and Azure App Service path when requested,
and exercised through authenticated production smoke tests.

## Delivered

### Microsoft CSA guidance

- Added searchable Azure Architecture Center styles, patterns, principles,
  tradeoffs, official guidance, and pattern application.
- Added Azure Landing Zones IaC Accelerator planning for Bicep or Terraform and
  GitHub or Azure DevOps.
- Added all eight landing-zone design areas with discovery questions and
  readiness tracking.
- Added the seven Cloud Adoption Framework methodologies with outcome tracking
  and recommended next focus.
- Added an evidence-based Azure Well-Architected assessment across Reliability,
  Security, Cost Optimization, Operational Excellence, and Performance
  Efficiency.

### Architecture-to-code and Azure deployment

- Added Bicep, Terraform, Azure CLI, and Azure PowerShell generation from the
  active architecture.
- Enforced Microsoft Entra-only Azure SQL administration.
- Added explicit unsupported-service and missing data-plane RBAC warnings.
- Added a short-lived ARM template broker and Azure Portal Review + Create
  handoff.
- Kept Azure authentication, subscription selection, policy validation,
  parameters, costs, and final consent inside Azure Portal.
- Validated representative and comprehensive Bicep, the actual ARM handoff
  template, and a non-destructive Azure What-If.

### Unified architecture review

- Added review of the current Diagrammatic canvas.
- Added free-form architecture descriptions.
- Added Diagrammatic JSON import.
- Added PNG, JPEG, and WebP architecture image upload up to 5 MiB.
- Added optional business and operational context for uploaded diagrams.
- Added multimodal Azure OpenAI analysis with high image detail.
- Added a 0–100 rating, posture, strengths, assumptions, prioritized findings,
  actionable recommendations, and official framework links.
- Tagged findings to Azure Architecture Center, Azure Landing Zones, Cloud
  Adoption Framework, or Azure Well-Architected Framework pillars.
- Uploaded images are request-scoped and are not persisted by Diagrammatic.

### Whiteboard ownership and product separation

- Removed upstream help, documentation, repository, blog, YouTube, social, and
  community-library surfaces from the product UI.
- Removed library URL import, public library browsing, library and scene deep
  links, `.excalidraw` and `.excalidrawlib` drops, and related shortcuts.
- Suppressed the native library trigger and the entire restored library sidebar,
  including the public repository message shown by stale UI state.
- Preserved required third-party license attribution without exposing the
  dependency as Diagrammatic's product identity.
- Kept the bundled 600-symbol Diagrammatic catalog as the only Whiteboard asset
  source.

### Canvas and animated storytelling

- Added independently persisted White and Black canvas choices to all nine
  diagram modes.
- Added a Whiteboard Flow arrow tool that creates native bound arrows between
  symbols.
- Added Whiteboard animated GIF export that walks connected arrows in scene
  order while symbols stay fixed.
- Retained architecture GIF sequencing and synchronized flow stages.

### Production verification

- Corrected deployment health checks to treat the shared sign-in redirect as
  healthy.
- Added an authenticated live API smoke using protected GitHub secrets.
- Added an authenticated live Chromium smoke covering CSA guidance, code
  generation, review, Azure deployment handoff, Whiteboard separation, canvas
  theme, and GIF availability.
- Added release-readiness waiting so asynchronous Kudu zipdeploy cannot test a
  stale application version.

## Validation evidence

- ESLint: clean.
- Strict TypeScript: clean.
- Unit suite: 37 tests passed after multimodal review coverage.
- CSA browser suite: 9 journeys passed.
- All nine canvas themes toggled and persisted.
- Whiteboard symbols inserted by click and drag and survived reload.
- Whiteboard flow arrow bound two symbols and exported an animated GIF.
- Whiteboard upstream menu, shortcut, deep-link, file-drop, and restored-sidebar
  surfaces were absent.
- Production standalone build passed.
- Generated Bicep compiled and linted.
- ARM template validation and Azure What-If passed with no deletes.
- Authenticated production API and Chromium smoke passed.

## Production releases

| Commit | Purpose |
| --- | --- |
| `75b1ccc` | Microsoft CSA guidance, review, code generation, and deployment handoff |
| `50fac50` | Authenticated live API and browser deployment smoke |
| `79b83b1` | Stable production pattern verification |
| `320ae85` | Universal canvas themes, Whiteboard flow arrows, GIFs, and upstream UI removal |
| `0fd2268` | Wait for the active App Service release before live assertions |
| `12f6c55` | Multimodal customer architecture image review and day-close documentation |
| `417703d` | Release-specific multimodal readiness capability |
| `8ed4a86` | Valid rendered architecture image for production vision smoke |

Successful production workflow examples:

- `31569987573` — initial CSA workspace deployment
- `31570872167` — authenticated live CSA verification
- `31579252387` — live Whiteboard separation, themes, and GIF verification
- `31584648843` — live multimodal review plus authenticated browser verification

## Key blockers and resolutions

| Blocker | Root cause | Resolution |
| --- | --- | --- |
| Live screenshots still showed import and library actions | The cleanup had been validated locally but not pushed | Committed, deployed, and added authenticated production assertions for the exact menu and sidebar |
| Native library sidebar could appear without its trigger | Persisted or internal engine state could reopen the sidebar | Forced `openSidebar: null`, hid the complete default sidebar, and tested forced reopening |
| Theme preference looked correct but persisted the opposite value | A localStorage write inside a React state updater ran twice under Strict Mode | Moved storage side effects outside the updater and tested navigation plus reload |
| GitHub smoke intermittently exercised the previous release | Kudu zipdeploy is asynchronous and the old health endpoint already existed | Wait for a release-specific UI marker before starting production assertions |
| Parallel Whiteboard tests timed out | Multiple heavy canvas instances exhausted browser/dev-server resources | Run the focused Whiteboard acceptance suite serially |
| Architecture images could not be reviewed | The review API accepted text and graph JSON only | Added bounded base64 image content and a vision-enabled Azure OpenAI message |
| Uploaded diagrams alone lacked operational context | A visual rarely contains RTO, data sensitivity, ownership, or scale | Added an optional customer-context field and treat missing information as assumptions |
| Multimodal smoke initially reached the prior review schema | The readiness endpoint existed in both old and new releases | Added an authenticated `architectureImageReview` capability and wait for that exact release marker |
| Azure vision rejected the one-pixel smoke fixture | Its bytes passed base64 validation but Azure could not decode the image | Replaced it with a rendered architecture PNG and verified the exact REST payload directly against `gpt-4o-mini` |

## Lessons learned

1. **A local fix is not a customer fix until production proves it.** A release
   must be pushed, activated, and tested through the authenticated customer
   journey.
2. **Hide is weaker than disable.** Product separation required removing
   handlers, deep links, shortcuts, drops, menus, triggers, and restored state,
   not only hiding one visible button.
3. **External engine state must be treated as hostile UI state.** A hidden
   trigger did not prevent a persisted sidebar from reappearing.
4. **State updaters must remain pure.** Browser storage writes inside a React
   updater can run twice under Strict Mode and persist the wrong result.
5. **Asynchronous deployment needs release-specific readiness.** Generic health
   checks can pass against the prior App Service process.
6. **Visual architecture evidence needs narrative context.** Diagrams show
   topology; reliable recommendations also need criticality, scale, data,
   recovery, governance, and organizational constraints.
7. **Framework review should distinguish evidence from absence.** Missing
   content becomes an assumption or discovery question, not an automatic defect.
8. **Generated infrastructure must be honest about semantic gaps.** A diagram
   edge does not prove which data-plane permission a workload needs, so the tool
   warns instead of inventing RBAC.
9. **Claims should remain executable.** Product documentation, regression tests,
   Azure validation, and production smoke now describe the same behavior.
10. **Syntactic base64 is not proof of a valid image.** Multimodal smoke fixtures
    must be decoded by the same Azure model path used in production.

## Follow-up opportunities

- Add multi-page PDF diagram ingestion by rendering pages to supported images.
- Add framework-specific score cards in addition to the overall rating.
- Add an exportable customer review report with findings, owners, priorities,
  and remediation status.
- Add explicit arrow ordering controls for Whiteboard GIF playback.
- Upgrade GitHub Actions declarations to remove the Node.js 20 runtime warning.
- Replace in-memory rate limiting and deployment-template storage before
  scaling App Service beyond one instance.
