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

Status: pending release execution.

Target: https://architecture-playground.azurewebsites.net

Record commit/workflow identifiers, hosted browser/API outcomes, actual AI
invocation results, and any unresolved runtime configuration here after testing.
Do not count mocked responses or configuration flags as live AI verification.

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
