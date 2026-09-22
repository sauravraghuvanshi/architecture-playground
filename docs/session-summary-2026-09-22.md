# Session close-out - September 21 work and September 22 follow-up

## Morning update - completed September 22

The overnight resume checklist below is now historical. The user resumed the
saved-Whiteboard recovery warning and failed-pipeline issue; both are addressed
in **`625e199d6ba360aa81142d5be2201c1045200390`**.

- The persistent recovery banner is removed from all diagram pages. Usable
  saved content opens around native unfinished placeholders, with the original
  preserved as a version. Valid pen dots remain intact. Genuine retained-data
  details/downloads are available in My diagrams.
- Last night's HTTP 503 is documented without inventing an unlogged parser
  cause. Every smoke fixture now has bounded transient retries and diagnostics;
  persistent failure or incorrect validation results still fail.
- [Deployment 35693782055](https://github.com/sauravraghuvanshi/architecture-playground/actions/runs/35693782055)
  succeeded, including the previously failing hosted parser check and final
  browser smoke. **374 contracts, 21 parser/retry tests, lint/types/build,
  5 screenshot gates, 90 local and 90 hosted browser cases passed.**
- Servers stopped and temporary auth removed. **No urgent verification remains
  open for this release.** Await the user's next selection; priorities 16-33
  and competitor additions remain paused.

Current evidence: [development log](development-log-2026-09-20.md) and
[deployment plan](../.azure/deployment-plan.md).

## Historical end-of-day checkpoint

Recorded: September 22, 2026, approximately 01:34 IST (Asia/Kolkata).
This is the latest handoff. The [September 21 summary](session-summary-2026-09-21.md)
is the earlier stop-after-task-8 checkpoint, not the current task status.

**User instruction: stop for the day. Resume the outstanding hotfix verification
in the next session; do not start another backlog item automatically.**

## Current state

| Item | Status at pause |
| --- | --- |
| Numbered roadmap | Priorities **1-15 complete** within their documented scopes; **16-33 pending and paused** |
| Earlier screenshot fixes | `cf6da2b` deployed and hosted-verified |
| Latest gesture/autosave fix | `bd27fff3072c6af0e41c9365adfc1f2ced909818` implemented, locally tested and deployed; **hosted verification incomplete** |
| Latest pipeline | [Run 35648068866](https://github.com/sauravraghuvanshi/architecture-playground/actions/runs/35648068866) completed with an overall failure after deployment |
| Passing pipeline stages | Application contracts, production build, native screenshot gate, Azure deployment, HTTP health and authenticated CSA API smoke |
| Failed stage | **Verify hosted parser-only artifact validation**; cause has not yet been investigated |
| Skipped stage | Final authenticated live CSA browser smoke |
| Manual hosted checks for latest fix | Not started before the user's pause |
| Competitor-inspired additions | Deferred; not part of this hotfix |

Live application: https://architecture-playground.azurewebsites.net/

The failed workflow does **not** mean deployment was blocked: the new release
was already deployed before the hosted parser smoke failed. Conversely, successful
deployment and HTTP health do **not** mean the release is fully verified.

## What was completed in the resumed session

Priorities 1-8 and 11 were delivered before this resumed session. The following
work followed that checkpoint; releases are cumulative.

| Work | Delivered outcome | Release / status |
| --- | --- | --- |
| Priority 9 | Strict AI input/evidence/response contracts, bounded UTF-8 and full evidence-image pixel validation; incomplete/refused completions rejected | `b50a40f`, hosted-verified |
| Priority 10 | Explicit AI destinations, no implicit demo proxy, privacy disclosures, opt-in bounded prompt history and cancellation-safe clearing | `52b5efa`, hosted-verified |
| Priority 12 | Bounded Whiteboard restoration, preserved corrupt originals, binary compatibility, stale-operation invalidation and safe new-document conversion | `a95261e`, hosted-verified |
| Priority 13 | Reliable SSE framing, cancellation/deadlines, independent readiness and explicit provider error outcomes | `d490193`, hosted-verified |
| Priority 14 | Responsive editing drawers, usable mobile canvas width, keyboard navigation and shared dialog focus management | `d81a0fd`, hosted-verified |
| Priority 15 | Cross-browser drag/export/focus fixes, document-generation protection, native loading-state correction and Playwright upgrade | `3a04dbc` / `3b5d8fd`, hosted-verified; backlog then stopped |
| Screenshot binding regression | Preserve legitimate native elbow fixed-point ratios and focus outside previously assumed ranges; restore save/conversion/mode-switch paths | `2088d85` / `cf6da2b`, hosted-verified |
| Screenshot code-generation regression | Support the APIM catalog variant and offer explicit, undoable App Service identity correction instead of guessing from a label | `2088d85` / `cf6da2b`, hosted-verified |
| Regression prevention | Application contracts and native screenshot journeys now run before deployment; clean-checkout catalog generation is included | `cf6da2b`, deployed |
| Latest recurring autosave banner | Defer transient captures, retry after editing settles, preserve dirty work, settle window pointer-up/cancel and retain genuine failure reporting | `bd27fff`, deployed; hosted close-out still pending |

Full stable priority definitions and remaining items:
[implementation roadmap](implementation-roadmap.md).
Chronological detail: [development log](development-log-2026-09-20.md).

## Latest hotfix: root cause and behavior

The latest message was:

> Diagram autosave failed: Finish or cancel the current Whiteboard gesture before saving.

This was **different from** the earlier `startBinding.fixedPoint.0` validation
failure. A save timer from the preceding edit could fire while the next drawing
gesture was still active. The native guard correctly refused an unfinished
snapshot, but the shared save hook treated that expected state as a database
failure and did not schedule a retry on its own.

The regression was reproduced on the prior production build using native
rectangles: start the second gesture before the preceding 650ms autosave and
hold it for 1600ms.

The fix:

- Represents unsettled live capture with `CanvasEditPendingError`, rather than
  a generic storage error.
- Keeps work unsaved and retries autosave after 650ms; cancelled schedules
  cannot continue capturing an obsolete document.
- Observes window pointer-up/cancel as well as the native canvas callback.
- Invalidates earlier queued notifications when another gesture starts.
- Lets manual saving wait up to approximately five seconds for the native
  commit before making the canvas inert for the database write.
- Retains the outgoing canvas and unload protection when saving cannot finish.
- Still reports quota, conflict, malformed-content and other actual failures.
  No geometry is dropped or clamped and no validator is disabled.

Implementation contract: [Whiteboard safety](whiteboard-safety.md).

## Verification evidence

| Scope | Result |
| --- | --- |
| Latest application contracts | **370/370 passed** |
| Latest focused hook/canvas contracts | **45/45 passed**, included in the full suite |
| Lint, strict types and production build | Passed |
| Latest mandatory production screenshot gate | **3/3 passed** locally and passed in CI |
| Latest adjacent local three-engine suite | **84 distinct cases covered**, across an 83-pass main run and a corrected **9/9** screenshot rerun; not one clean 84-case run |
| Previous screenshot release | **363 contracts**, **49 focused mapping/route/parser checks**, **75 local + 75 hosted Chromium cases**, and **4 local + 4 hosted Firefox/WebKit screenshot cases** passed |
| Latest hosted workflow | Deployment/health/API smoke passed; **parser smoke failed**, final browser smoke skipped |
| Latest manual hosted gesture regression | **Pending** |

The native long-gesture test asserts no recovery banner, exact 100x100 shape
dimensions, saved geometry, mode switching and unchanged geometry after reload.
It is part of the pre-deployment gate.

AI success responses in browser acceptance tests are deterministic fixtures.
These results do not certify live-model quality, real Safari/iOS devices or
customer infrastructure deployability. No generated customer infrastructure was
executed.

## Lessons to carry forward

1. **A transient edit is not a persistence failure.** Keep the dirty state,
   defer and retry; do not merely hide a banner or claim a save succeeded.
2. **Guards must agree across entry points.** Autosave, manual save, unload,
   mode switching, restoration and conversion share capture behavior. A
   validator change can break several workflows at once.
3. **Use real native engine output to define compatibility.** Excalidraw
   binding ratios are not bounded percentages. Preserve finite native values
   while maintaining type, reference, binary and scene-budget checks.
4. **Never persist initialization defaults.** Native loading callbacks can
   precede restored content; loading flags and transient defaults are not edits.
5. **Service identity is not its label.** A renamed management symbol must not
   silently become an App Service resource. Use explicit supported mappings and
   visible user-approved corrections.
6. **Separate test-driver timing from persistence defects.** Excalidraw's
   leading-frame throttle can drop sub-frame synthetic pointer moves. Native
   state inspection showed the WebKit test's smaller rectangle existed before
   saving. Pace moves by animation frame; keep exact geometry assertions.
7. **Clean CI must create its prerequisites.** The new contract gate needs the
   generated catalog before tests, not just before the production build.
8. **Deployment is not verification.** Record the exact revision and each
   gate. Do not call the latest release fully verified while hosted parser
   validation is failing or browser checks are skipped.
9. **Protect the user's original unsaved tab.** A deployment cannot recover
   changes never written to storage. Do not clear browser data or recommend
   discarding unsaved work to test a fix.

## Tomorrow: resume in this order

| Order | Remaining task | Completion criteria |
| ---: | --- | --- |
| 1 | Diagnose the hosted parser smoke failure in run `35648068866` | Read that exact failed step and identify the cause; do not assume it is related to gestures or disable the gate |
| 2 | Resolve the verified cause, if needed | Make only necessary changes; run affected checks and the validation/deployment workflow before any new application release |
| 3 | Complete authenticated hosted screenshot and persistence checks | Verify long native gestures, saving/reload, mode switching, conversion, native bindings, code-generation identity correction and real storage-failure protection |
| 4 | Finish release close-out | Record the actual tested revision and results; remove temporary authentication and stop owned test processes |
| 5 | Return to the user before new scope | Priorities **16-33 remain paused**; do not start 16 or competitor additions automatically |

Some release protections from priority 16 were necessarily added while fixing
regressions. That does **not** complete priority 16's broader scope.

## Resume pointers and safeguards

- Working branch: `agents/detailed-audit-cloud-ai-features`.
- Latest application commit: `bd27fff3072c6af0e41c9365adfc1f2ced909818`.
- Last fully hosted-verified release before it:
  `cf6da2bd56de3aa8e42f46248fc77e443204547b`.
- [Deployment plan and proof](../.azure/deployment-plan.md) contain the exact
  workflow and release state.
- Investigate the failed workflow before a rerun; this session ended without
  retrieving its failure log or trying a speculative fix.
- No new local test server or temporary hosted-auth file was left by the
  end-of-day close-out.
- Preserve the deferred competitor checkpoint
  `refs/checkpoints/deferred-competitor-a7e748c4`; do not apply it to the hotfix.
- Keep the local `Audit Report` HTML reports outside Git.
- Continue using GPT-6 Astra only, as requested.
