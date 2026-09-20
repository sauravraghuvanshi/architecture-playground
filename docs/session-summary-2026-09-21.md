# Session close-out - September 20 work, completed September 21

Timezone: Asia/Kolkata. Final hosted verification completed at approximately
03:08 IST on September 21, 2026.

**Stopped after task 8, as requested. No task 9 or later priority was started.**

## Current state

- Live: https://architecture-playground.azurewebsites.net/
- Deployed release: `86cde202b25da1c2c69a78ca7ffdc5ccdc73de44`
- [Successful deployment 35538732835](https://github.com/sauravraghuvanshi/architecture-playground/actions/runs/35538732835):
  4m22s, including native Linux parser and authenticated hosted smoke.
- Completed roadmap items: **1-8 and 11**.
- Next: **9**, in the next requested session.
- Full stable 33-item backlog: [implementation roadmap](implementation-roadmap.md).

## What was delivered in this resumed session

| Work | Delivered outcome | Release |
| --- | --- | --- |
| Task 4 | Read-only offline PowerShell What-If preview with explicit context and companion Bicep; no deployment mode | `d70340c` |
| Four user-reported fixes, including task 11 | Canvas-aware AI image context/aspect ratio, theme-readable owned symbols, official cloud conversion identities, nested cloud boundaries | `94e1abc` |
| Task 5 | Canonical provider-safe service identity across prompt/pickers/conversion/code; honest unsupported coverage; lazy catalog loading | `98e130c` |
| Task 6 | Valid offline IaC syntax, collision-safe names, shared configuration, Function prerequisites, matching CLI/Bicep artifacts and real compiler tests | `c271483` |
| Task 7 | Shared versioned architecture semantics, safe migration, context/evidence preservation, Inspector fields and future-version overwrite protection | `bd09594` |
| Task 8 | Independent parser-backed engineering reports, canonical coverage/prerequisites/static correspondence and complete-set publication revalidation | `9c9e498` |
| Task 8 rollout correction | Wait for completed asynchronous SCM deployment rather than accepting a healthy old instance; verify the new endpoint | `86cde20` |

Priorities 1-3 remain part of the cumulative deployed baseline. Detailed earlier
history is preserved in [the development log](development-log-2026-09-20.md).

## Final evidence

| Gate | Result |
| --- | --- |
| Application unit/contract suite | **249/249 passed** |
| Real parser and artifact-policy integration | **17/17 passed** |
| Native Go parser tests | Passed |
| Existing CLI/PowerShell execution-safety mocks | **88/88 passed** |
| Priority 6/7 real IaC compiler fixtures | **17/17 passed** |
| Lint, strict types, locked helper packaging, standalone build | Passed |
| Final local production-build browser gate | **77/77 passed** |
| Final hosted browser gate | **77/77 passed in one run**, 4.7 minutes |
| Corrected deployment workflow | Successful, including real hosted parser smoke |

No real model inference, customer Terraform plan/apply, customer What-If,
model-authored script execution, resource provisioning or role changes were performed.
AI success paths use deterministic fixtures. Parser tests intentionally parse
untrusted-looking examples but do not execute their artifact behavior.
Deterministic offline scripts were executed only against isolated command mocks.

The first task 8 workflow did not pass: its smoke encountered the old instance's
404 during asynchronous rollout. This was investigated, reproduced and corrected;
it is not hidden behind the later successful run.

## Lessons retained

1. **Parsing, compilation, provider validation and deployment are different.**
   A grammar tree or nonempty string is not proof that code compiles or deploys.
   Real tools exposed invalid Terraform blocks, bad symbols and collisions.
2. **A method called a parser can still have side effects.** PowerShell's public
   parser can resolve modules/assemblies and initialize DSC. Bicep no-restore
   compilation is not a no-filesystem guarantee. Use the verified parser-only
   APIs and never quietly downgrade an unavailable check to a pass.
3. **Bash startup and warning paths matter.** Scrub inherited startup hooks;
   noninteractive `-n` and exit zero alone are insufficient for warning cases.
4. **Identity must not come from an editable label.** Canonical catalog identity,
   provider boundaries and explicit unknowns prevent plausible but wrong diagrams
   and infrastructure.
5. **Migration must preserve data and avoid false writes.** Version-only changes
   must not cause revision churn. Empty recovery must not resurrect deleted
   diagrams, and future-version data must not be overwritten by an older editor.
6. **Artifact validation must remain bound to the artifact set.** Revalidate
   code, ARM, mappings and evidence at publication; never trust client/model
   "passed" flags or a disconnected ARM-only submission.
7. **Upload acceptance is not deployment completion.** Follow Kudu's returned
   operation until complete, then verify a release-specific endpoint.
8. **Keep test scratch files away from watched source roots.** Temporary-folder
   cleanup races broke concurrent lint; ignored cache roots resolved them.
9. **Pin and reproduce tooling.** Native adapters use locked dependencies and
   retain notices. NuGet v3 TLS failed locally; the official v2 feed worked
   without weakening certificate validation. Portable Go did not alter global PATH.

## Known limits, not hidden failures

- Validation is a bounded static profile, not full language binding,
  provider-schema checking or production/deployment equivalence.
- AI PowerShell remains explicitly review-only; no approved isolated syntax
  backend is available on this host. The deterministic offline preview remains
  a separate, tested read-only path.
- Dynamic/unsupported constructs, unresolved Function roles, unproven declared
  configuration and business requirements remain unverified.
- Node 20 lifecycle modernization and broader CI gates remain task 16.
- Historical Firefox/WebKit failures and intermittent GIF timing remain tasks
  15/20/21. A passing Chromium run does not prove those issues are permanently fixed.
- Full environment/evidence definition authoring is JSON-based in the task 7
  foundation; it is not a complete structured authoring UI.

## Tomorrow / next-session priorities

| Order | Work to resume |
| --- | --- |
| **9** | Strict AI evidence/response contracts: reproduce remaining gaps, unique finding IDs, valid references, complete remediation, bounded inputs and no silent loss |
| 10 | Explicit AI destinations, privacy/retention and history controls |
| 12-13 | Safe conversion/restoration and reliable loading/streaming/cancellation |
| 14-16 | Responsive keyboard accessibility, cross-browser reliability, runtime/release gates |
| 17-33 | Continue the unchanged numbered roadmap; do not skip to competitor additions |

The competitor Outline/collapse/mapping-review/engineering-packet work is
**preserved but deferred**, not deployed:

- Checkpoint: `refs/checkpoints/deferred-competitor-a7e748c4`
- Stash commit: `c4b91a44d33066e9aceb011a086d57f445a95d0f`
- Do not apply it during the numbered backlog; rebase it when stage 3 begins.

## Clean handoff

- Owned local servers stopped; temporary hosted authentication files removed.
- No credentials or native SDK/binary caches were committed.
- Original HTML audits remain local under `Audit Report/`, Git-excluded.
- Read this summary, the roadmap and the deployment plan before the next change.
- Continue using GPT-6 Astra only and the prepare -> validate -> deploy -> hosted
  verification sequence. Do not restart work automatically after this close-out.
