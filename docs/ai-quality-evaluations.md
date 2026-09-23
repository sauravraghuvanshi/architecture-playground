# Domain-specific AI evaluations

This is an **offline evaluator of supplied outputs**, not an automatic model
runner or a production-readiness certificate. Reference fixtures test the
evaluation machinery and contracts. They do not demonstrate live-model quality
and can never authorize a changed AI subject.

## Golden tasks and metrics

The versioned benchmark covers four distinct families:

| Family | Required checks |
| --- | --- |
| Architecture generation | Production response schema, canonical service identities, named roles, provider boundaries, directed topology and explicitly required connection labels |
| Whiteboard conversion | Real, decodable synthetic PNG input; native output schema; preserved identities/roles, direction and specified labels |
| Architecture review | Production grounded-review contract, required guidance themes, preservation of unknown evidence and recorded-review provenance binding |
| IaC | Requested language, independently specified resource inventory, actual trusted parser, mappings, coverage, prerequisites and static code/ARM correspondence |

Each declared metric has threshold **1.0**. Every required case must pass;
averages cannot hide a wrong provider, omitted service, reversed connection,
invented citation or invalid artifact. Missing cases, extra case IDs, duplicate
IDs, stale input hashes and mismatched dataset/subject versions fail explicitly.

Requirements coverage means the **declared structural requirements** in these
tasks, not automatic understanding of every natural-language requirement.
Grounding coverage checks source associations and reference contracts, not
free-form factual entailment. Recorded review cases also need an explicit
grounding adjudication from a qualified reviewer, bound to the exact output
hash. The evaluator checks the record, not the reviewer's identity.

Visual aesthetics, general semantic truth, stochastic repeatability, real
deployment, runtime correctness, and cost/latency SLOs are not automatically
evaluated. Run repeated experiments and appropriate human/runtime assessments
before drawing broader conclusions.

## Running locally

Use the repository's supported Node version with native TypeScript stripping
(Node 24 in CI). Restore dependencies and generate the catalog normally.
Trusted parser helpers must already have been built using the existing
`build:validators` workflow; missing or timed-out infrastructure is an
**evaluation error**, not evidence that the model failed.

```powershell
npm run prebuild
npm run test:ai-evaluations
npm run evaluate:ai -- --reference --output ai-evaluation-results\reference.json
npm run evaluate:ai -- --gate --output ai-evaluation-results\gate.json
```

Reports include per-case metrics, blockers, dataset/candidate/subject
fingerprints, evaluator and parser source fingerprints, and toolchain versions.
Raw candidate code, images and prompts are not repeated in reports. Generated
reports in `ai-evaluation-results` are Git-ignored.

The reference result must say `origin: "reference-fixture"` and
`eligibleForSubjectPromotion: false`, even when all checks pass.

## Recorded candidate evaluation

Export only the synthetic requests; expected answers are deliberately excluded:

```powershell
npm run evaluate:ai -- --export-inputs ai-evaluation-results\requests.json
```

The export includes task IDs, API paths, required request headers, input hashes
and the exact subject fingerprint. Obtain outputs from the intended candidate
application/model separately, with explicit authorization for any provider
charges. **This command does not invoke a provider.** Review requests use
`X-Diagrammatic-Review-Contract: 2`.

Create a candidate JSON file following
[`evaluationCandidateSchema`](../lib/ai-evaluation-contract.ts):

- `schemaVersion: 1`, dataset ID/version/hash and current subject hash.
- `origin: "recorded-candidate"`, a run ID and capture timestamp.
- Declared model IDs and versions for generation, conversion, review and IaC.
  Do not invent an immutable version from a deployment alias. Null/unresolved
  versions permit inspection but block subject promotion.
- Exactly one output per task, with the task ID and exported input hash.
  Use the API JSON body, not a serialized precomputed evaluation report.
- For review cases, retain server provenance and include `groundingReview`
  with reviewer, review timestamp, exact `outputSha256`, `grounded` decision
  and substantive notes. The adjudication must not predate capture. Changing
  any output bytes invalidates its approval hash.

```powershell
npm run evaluate:ai -- --candidate ai-evaluation-results\candidate.json --output ai-evaluation-results\candidate-report.json
if ($LASTEXITCODE -ne 0) { throw "Candidate failed declared quality checks." }
```

Inspect `eligibleForSubjectPromotion` and `promotionBlockers` as well as the
task pass rate. Passing structural checks alone does not satisfy provenance,
model-version or human-grounding requirements. Operator-supplied model
attribution and adjudications are **not independently attested**.

Do not select only favorable runs or fabricate provider results/approvals from
the reference fixtures. Use only the synthetic benchmark inputs for artifacts
intended for repository review; do not commit credentials or customer data.

## Release gate and bootstrap boundary

CI scores the reference contracts, then compares current AI subjects with the
immutable initial subject checkpoint `4ba594f2994554e842e19247f678d5ad978de33c`.
This checkpoint was selected at the first installation of the evaluation gate,
after the urgent screenshot fixes and live review/code-generation checks. It
includes the explicit citation constraint correction. It is **grandfathered,
not model-qualified**; the gate does not retroactively claim a full recorded
model benchmark exists for the current application.

The subject fingerprint covers nominated prompt/contract/transport sources,
AI dependencies, textual catalog membership and catalog-building logic.
Comments, TypeScript-only syntax, line endings and equivalent explicit `.ts`
import suffixes are normalized. Changes to actual prompt text or behavior
remain significant.

When a subject changes, CI requires the complete recorded candidate at:

```text
content\ai-evaluation\candidates\<current-subject-sha256>.json
```

CI recalculates all metrics from its outputs. It never accepts a caller-authored
`passed` flag or a reference fixture as approval. An existing candidate is
checked even for the grandfathered subject; a failed candidate is not ignored.
Changing the benchmark invalidates recorded candidates with its former hash.

An optional `content\ai-evaluation\model-selection.json` can nominate model
IDs/versions for each family using `{ "schemaVersion": 1, "models": ... }`.
Its values enter the subject fingerprint and must match recorded candidate
metadata. This file is **not** applied to Azure. Changes to runtime environment
variables or mutable Foundry agent definitions outside the repository are not
automatically detected; operators must recapture and review those changes.

Evaluation inputs and candidate captures are excluded from standalone
production packaging. A build fails if evaluation data unexpectedly appears
in the runtime package.

See [AI evidence contracts](ai-evidence-contracts.md),
[engineering validation](engineering-validation.md), and
[release qualification](browser-support.md) for the complementary safeguards.
