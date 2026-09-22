# AI evidence and response contracts

New architecture reviews are validated independently of the model. JSON mode is
not schema enforcement, and valid JSON is not proof that an answer is complete.

## Review results

Every newly generated finding requires:

- A unique, nonblank ID, title, severity, evidence and recommendation.
- One known guidance framework, 1-3 unique curated `guidanceIds`, a matching
  specific article URL and a `guidanceRationale` explaining applicability to
  this evidence and proposed action. Framework landing pages alone no longer
  qualify new findings.
- An explicit `evidenceStatus`: `observed` means visible in the submitted source,
  never verified deployed configuration; missing information is `unknown`.
- Unique `nodeIds` and `edgeIds` referencing the exact supplied diagram.
  Observed structured-diagram findings need at least one reference. Images and
  descriptions have empty ID lists; printed image labels are not diagram IDs.
- Remediation with ordered steps, validation criteria and a tradeoff.

The server and personalized-review UI use the strict new-result parser.
Historical-review reading keeps optional legacy fields without inventing them.
Both reject duplicate findings and framework/source mismatches.

The current UI requests `X-Diagrammatic-Review-Contract: 2`. Already-open v1
clients without that header receive an explicit `contractVersion: 1` projection
with the original finding fields and framework URLs, so deploying the new
strict response does not break cached tabs. The server still generates and
validates the grounded result first. New v2 clients receive the specific
guidance and provenance; unknown contract versions are rejected. The legacy
`{ graph }` Markdown envelope remains available with enhanced guidance.

## Grounding and provenance

The system prompt supplies a versioned set of original summaries of specific
Microsoft Learn guidance. Each card states applicability and the configuration
or test evidence needed to verify implementation. The model may select only
these IDs and URLs, with framework consistency checked independently. This is
curated grounding, not live web retrieval or proof that a recommendation is
factually correct for a customer's deployment.

New API results carry server-authored provenance separate from model JSON:
prompt/output-schema/guidance versions; creation time; SHA-256 fingerprints of
submitted evidence, curated guidance, system prompt, output schema, final review and each attempt's
message history; and provider-reported model/response IDs plus effective
request settings. Keys use canonical ordinal JSON ordering for stable digests;
array order remains significant. Missing provider identifiers remain explicit
nulls. Named agents are not version-pinned by the current transport; that
limitation is recorded, not filled with an invented version. The metadata
supports traceability, not a guarantee of deterministic replay.

The UI validates the metadata and matches evidence, guidance and result digests
before presenting a fresh review. It distinguishes **depicted** intent,
**proposed** actions, **schema/reference validation**, and **runtime unverified**
facts. Even user-supplied configuration/test claims are not independently
runtime-verified by this tool.

An explicit **Download review JSON** action includes the captured diagram or
description/context, review, provenance, selected guidance and the full curated
guidance snapshot for independent fingerprint comparison. Image
bytes are excluded; the digest still covers the original submitted request.
Consequently an image review cannot be replayed from the package alone.
Reports remain in memory unless the user downloads them, and Clear AI session
also removes the captured report metadata/evidence. Legacy Markdown responses
include a provenance section, while historical structured reports remain
readable without fabricating missing grounding or metadata.

A validation failure permits one correction within the existing shared deadline.
The complete bounded prior response is retained, not sliced. Oversized responses
are rejected rather than displayed or fed back as a partial answer. The output
limit is **128,000 UTF-8 bytes**, with at most 20 findings and the documented
per-field schema limits.

Azure chat completions must report `finish_reason: "stop"` with nonblank text
and no refusal. Length-limited, filtered, tool-call, missing-status or refused
responses are rejected even if they contain valid-looking JSON. Foundry named
agent responses retain their separate completed-status gate.

## Evidence intake

- Native versioned diagrams use the shared architecture model.
- Legacy graph evidence retains its fields and metadata. Node/connection IDs
  must be nonblank and unique; every connection must reference existing nodes.
- Serialized graph evidence is bounded to **120,000 UTF-8 bytes**, 500 nodes
  and 1,000 connections. Larger evidence is rejected with an explicit message,
  not silently truncated at an arbitrary character position.
- Review source selection is authoritative: unrelated payloads/images are
  rejected rather than silently ignored.
- Legacy review Markdown includes remediation, validation, tradeoffs and
  guidance, with the complete structured review also returned.
- Explanation requests use the same bounded evidence contract and streamed
  request-body reader. Invalid UTF-8 JSON is rejected without replacement bytes.
- HTTP body limits apply even without a `Content-Length` header.

Image review and Whiteboard conversion use shared input-image bounds and
validation before invoking their configured provider: PNG/JPEG/WebP for review
and PNG for conversion, **5 MiB**, **8192 pixels per side** and **16 megapixels**.
Canonical base64 and declared MIME must match the bytes; empty, truncated,
animated/multipage and corrupt evidence is rejected. The server fully decodes
pixels with pinned Sharp 0.34.5 rather than trusting file extension or metadata.
Original evidence bytes are retained; invalid files are not silently repaired.
Image validation is
separate from evaluating the model's visual understanding; passing the file
checks does not certify the accuracy of transcription or review.

## Verification boundaries

Tests use deterministic provider responses and synthetic images. These checks
validate completeness, shape, IDs, supported source associations and input
handling—not factual truth, live-model quality, compliance or runtime
architecture correctness. Source association and digest checks do not prove
semantic entailment. Model-quality evaluations remain a separate roadmap
priority.
