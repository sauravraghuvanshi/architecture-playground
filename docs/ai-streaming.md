# AI readiness, streaming and cancellation

## Readiness is not inference

Generation remains disabled until the independent diagram/image readiness flags
are checked. Invalid, failed or stalled checks produce an explicit disabled error;
the status request has a ten-second deadline. Reload to retry. Readiness describes
operator configuration, not a successful live model invocation or available quota.

## One insertable image outcome

The image endpoint emits a started event, heartbeat comments and exactly one
result or error, then closes. Results carry bounded base64 bytes and their MIME
type. The direct provider's single image is fully decoded and checked before
being emitted. URL-only, multiple, empty and corrupt images are errors; the app
does not download arbitrary provider-returned URLs.

The browser accepts LF, CRLF and CR framing, including separators and UTF-8 split
across network chunks. Incomplete final events, invalid JSON/UTF-8, excess data,
duplicate terminal events and an error after a result cannot insert an image.
Insertion happens only after the entire valid response has completed.

The reader bounds events to 7,100,000 characters and total transport to 8,000,000
bytes. Direct provider JSON is bounded to 7,100,000 bytes; images retain the shared
5 MiB / 8192-side / 16-million-pixel limits. Explicit MIME types are required on
new server results; historic base64-only PNG fixtures/proxies remain readable.

## Deadlines and cancellation

The direct provider deadline remains 270 seconds. The browser image request and
stream have 285-second safety deadlines. Heartbeats keep the connection active;
they do not extend the absolute deadline or make a request durable/reconnectable.

Cancel, Close, Clear AI session and unmount abort pending inference/reads.
Cancellation settles even while a read has no incoming bytes. Response-stream
cancellation aborts the server producer without waiting for generation to finish.
The same cancellation signal reaches final pixel decoding, preventing a late
image insertion after clearing the session.

Saving an accepted generated graph is different: once a document commit begins,
duplicate application and dismissal are disabled until saving finishes. Errors
retain a visible retry path. Already committed browser storage cannot be rolled
back by cancelling inference.

## Explicit failures

Image failures distinguish timeout, throttling, content-policy refusal,
invalid/incomplete output, unavailable configuration/credentials and upstream
failure. Provider diagnostic text is not returned to the browser. Requests are
not automatically retried and never fall back to another destination.

See [Microsoft's image-generation guidance](https://learn.microsoft.com/azure/foundry/openai/how-to/dall-e),
[AI privacy](ai-privacy.md), [Whiteboard safety](whiteboard-safety.md) and the
[release evidence](../.azure/deployment-plan.md). Tests use synthetic providers;
they do not establish live model quality, service latency or customer deployability.
