# AI evidence and response contracts

New architecture reviews are validated independently of the model. JSON mode is
not schema enforcement, and valid JSON is not proof that an answer is complete.

## Review results

Every newly generated finding requires:

- A unique, nonblank ID, title, severity, evidence and recommendation.
- One known guidance framework and its matching source URL.
- An explicit `evidenceStatus`: `observed` means visible in the submitted source,
  never verified deployed configuration; missing information is `unknown`.
- Unique `nodeIds` and `edgeIds` referencing the exact supplied diagram.
  Observed structured-diagram findings need at least one reference. Images and
  descriptions have empty ID lists; printed image labels are not diagram IDs.
- Remediation with ordered steps, validation criteria and a tradeoff.

The server and personalized-review UI use the strict new-result parser.
Historical-review reading keeps optional legacy fields without inventing them.
Both reject duplicate findings and framework/source mismatches.

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
architecture correctness. Grounded recommendations and model-quality evaluations
remain separate roadmap priorities.
