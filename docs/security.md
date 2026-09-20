# Security overview

This document captures the application-level security posture of the
Diagrammatic workspace as it ships today. It deliberately scopes to what is
in this repository and excludes hosting-environment concerns (TLS termination,
WAF, DDoS, key management) — those live with the deployment target.

## Threat model (one-page)

| Asset                   | Threats                                       | Mitigations                                |
|-------------------------|-----------------------------------------------|--------------------------------------------|
| User-authored diagrams  | XSS via injected node labels; data exfil       | React auto-escaping; CSP; no `dangerouslySetInnerHTML` on user data |
| Browser storage        | Local data visible on shared browser profiles | Per-document isolation prevents accidental overwrite, not user-level access; use separate browser profiles for confidential work |
| Azure OpenAI key        | Server-side credential theft                  | Keys read from env only; never echoed to client; `/api/ai/status` returns boolean only |
| AI endpoints            | Cost-amplification / abuse                    | In-memory token-bucket rate limiter (20 req/min/IP); bounded prompts and architecture images |
| Uploaded architecture image | Oversized payload; unsupported content; unintended retention | PNG/JPEG/WebP allowlist; 5 MiB limit in browser and API; request-scoped processing; no persistence |
| Shared workspace access | Credential guessing; cookie theft; open redirects | Rate-limited login; timing-safe checks; HMAC session; HttpOnly/SameSite cookie; same-origin return paths |
| Workspace iframe embed  | Clickjacking                                  | `X-Frame-Options: DENY` + `frame-ancestors 'none'` in CSP |
| Static assets / build   | Subresource tampering                         | Bundled by Turbopack; no third-party CDN script tags |

## HTTP response headers

Set globally by `middleware.ts` on every non-asset route:

| Header                        | Value                                                                           |
|-------------------------------|---------------------------------------------------------------------------------|
| `Content-Security-Policy`     | See `middleware.ts` — restrictive `default-src 'self'`, blob:/data: img/worker  |
| `Strict-Transport-Security`   | `max-age=63072000; includeSubDomains; preload` (2-year HSTS)                    |
| `X-Frame-Options`             | `DENY` (no embedding)                                                           |
| `X-Content-Type-Options`      | `nosniff`                                                                       |
| `Referrer-Policy`             | `strict-origin-when-cross-origin`                                               |
| `Permissions-Policy`          | denies camera/mic/geo/payment/usb                                               |
| `Cross-Origin-Opener-Policy`  | `same-origin`                                                                   |

The CSP currently allows `'unsafe-inline'` for styles (Tailwind JIT) and
`'unsafe-eval'` for scripts (Next.js 16 client runtime + React Flow). Tighten
once the framework moves off eval.

## Rate limiting

`lib/ai-rate-limit.ts` provides a per-IP token bucket: 20 requests / minute,
linear refill. Keyed by `X-Forwarded-For[0]` falling back to `X-Real-IP`.
Applied to:

- `POST /api/ai/generate`
- `POST /api/ai/image`
- `POST /api/ai/review`
- `POST /api/ai/describe`
- `POST /api/ai/convert`
- `POST /api/ai/deploy`
- `POST /api/deploy/template`

The limiter is in-process. Multi-instance deployments will let bursts through
equal to `(rate × instance count)` — acceptable for the current single-VM
deployment. Replace with a centralized store (Upstash Redis / SignalR /
Cloud Memorystore) before scaling out.

The in-process limiter caps the number of tracked client buckets and rejects
new clients when capacity is exhausted rather than growing memory without
bound. The deployment-template broker also caps outstanding handoff links.
Image-generation request bodies are bounded before JSON parsing. AI chat calls
have a two-minute timeout; image generation has a 270-second timeout and cancels
upstream work when the client disconnects. Provider error bodies are not echoed
to clients.

The shared sign-in endpoint separately allows five failed attempts per IP in a
ten-minute window. Successful sign-in clears that IP's counter.

## Workspace access gate

When `APP_AUTH_ENABLED=true`, middleware protects every non-static page and API
route except `/login`, the three `/api/auth/*` endpoints, and GET/OPTIONS for
`/api/deploy/template`. The latter exposes only explicitly published,
short-lived bearer-token templates; POST publication remains authenticated.

- Credentials are server-side environment values.
- Username and password comparisons both execute for every attempt.
- A successful login issues an eight-hour HMAC-SHA256 session token.
- Production cookies are `Secure`, `HttpOnly`, `SameSite=Strict`, and scoped to `/`.
- Return paths are parsed against a fixed same-origin base and reject slash or
  backslash network-path forms.
- Logout expires the cookie immediately.
- Authentication is disabled by default for local development.

The current model is one shared workspace credential. It provides an access
gate, not individual identity, audit trails, password recovery, or authorization
roles. Use Microsoft Entra ID before introducing multi-user access.

## Secrets

Read from environment variables only:

- `AZURE_OPENAI_ENDPOINT`
- `AZURE_OPENAI_API_KEY`
- `AZURE_OPENAI_DEPLOYMENT` (chat / generate)
- `AZURE_OPENAI_IMAGE_DEPLOYMENT` (`gpt-image-2`)
- `AZURE_OPENAI_IMAGE_ENDPOINT`
- `AZURE_OPENAI_IMAGE_API_KEY`
- `AZURE_OPENAI_API_VERSION` (optional)
- `APP_AUTH_USERNAME` / `APP_AUTH_USERNAME_B64`
- `APP_AUTH_PASSWORD` / `APP_AUTH_PASSWORD_B64`
- `APP_AUTH_SECRET` / `APP_AUTH_SECRET_B64`

`/api/ai/status` returns feature booleans and a non-secret source label so the
client can gate diagram and image AI independently.

Foundry review and deployment agents use `DefaultAzureCredential` and the
application's Azure identity, preferably App Service managed identity. Their
non-secret runtime settings are `AZURE_AI_PROJECT_ENDPOINT`,
`AZURE_AI_REVIEW_AGENT_NAME`, and `AZURE_AI_DEPLOY_AGENT_NAME`. Configuration
booleans are not connectivity or authorization checks. No customer subscription
credentials are accepted, and these agents cannot execute tools or deploy resources.

Production authentication values are stored as GitHub Actions secrets. The
deployment workflow base64url-encodes them before creating the standalone
runtime environment, which avoids dotenv `$` expansion and keeps raw values out
of source and logs.

During local development only, Whiteboard image generation can proxy through a
trusted Diagrammatic deployment when local image credentials are missing.
Developers can opt out with `DIAGRAMMATIC_AI_PROXY_URL=disabled`.

## Customer architecture image review

The architecture review UI accepts PNG, JPEG, and WebP diagrams up to 5 MiB.
The browser validates the file before preview, and the API independently
validates MIME type, data URL consistency, base64 shape, and decoded size.

The validated image and optional customer context are sent directly in the
authenticated Microsoft Foundry review-agent request. Diagrammatic does not write the
image to disk, browser storage, logs, the deployment-template store, or a
database. The review system prompt treats all text inside the image as
untrusted evidence and explicitly refuses embedded instructions.

Foundry requests specify `store:false` and do not create conversations. This is
not a guarantee of zero provider retention: service policies, configured agent
features, and Azure diagnostics still apply. Do not include secrets.

## Azure Portal handoff

The deterministic offline PowerShell export is a preview-only `preview.ps1`
with a companion `main.bicep` from the same input. It checks local files,
parameters and dependencies first, requires a separately selected matching
subscription and an existing resource group, and invokes only the resource-group
lookup and What-If result APIs against that checked context. It does not create
groups, switch context, sign in or execute deployments. Cancellation through
`-WhatIf` skips the remote request; `-Confirm` confirms preview only.

This guarantee does not extend to arbitrary Foundry-generated scripts, Azure
CLI exports, or user-modified files. Those remain unverified drafts. Azure
What-If requires permissions and has evaluation limitations; preview does not
imply authorization to create resources. Portal publication and final deployment
approval remain separate from preview/download.

Generated code and ARM templates are unverified drafts. The application validates
bounded template structure, evidence mappings, and a restricted handoff subset;
it is not an ARM compiler, policy evaluator, or proof of deployability. It rejects
nested deployments, deployment scripts, extensions, credential-disclosing
expressions, and literal values in recognized sensitive fields. These checks do
not replace human review or guarantee that arbitrary text is free of secrets.

Publication requires explicit consent. Only the reviewed ARM template is held
in memory for 10 minutes, with a 100-link capacity bound and a random bearer
token. Anonymous GET/OPTIONS support Azure Portal downloads with CORS and
no-store headers. Anyone with a valid link can read the template. Do not place
customer secrets or credentials in templates; use secure parameters entered in
Azure Portal instead.

The store is instance-local and cannot survive restarts or cross-instance
routing. Easy Auth and private networking can also block downloads. The UI
provides ARM download and manual Portal-upload instructions. Azure Portal
handles subscription authentication, final review, cost approval, and creation;
Diagrammatic never creates the resources.

This request-scoped image policy is distinct from Whiteboard persistence:
generated or user-inserted Whiteboard images are part of the user's browser-local
draft and version snapshots. Clearing browser site data removes those drafts;
export important work before clearing storage or changing devices.

## Named diagram storage

Named documents, their comments, snapshots, and Whiteboard image binaries are
stored in IndexedDB in the current browser profile. Document and list-summary
writes commit atomically. Revision checks reject stale saves instead of
overwriting another tab's newer document. Original legacy drafts are not
deleted during recovery. New/Open operations save current work before switching.

There is no cross-device synchronization, user-specific encryption, or remote
backup. The shared sign-in gate does not partition local browser data by user,
and signing out does not erase saved work. Use separate browser profiles on
shared machines and export backups before clearing site data.

Scratch recovery checkpoints are also written on browser navigation and when
the page is hidden. These contain the same browser-local scene and image data
as the existing draft cache; they are not uploaded. Quota/unavailable-storage
errors are surfaced and pending named-document changes warn before unloading.
Per-mode recovery errors do not discard healthy documents or overwrite damaged
draft bytes. Recovery downloads contain the affected original local data and
should be handled with the same confidentiality as the diagrams themselves.

Whiteboard conversion follows the same request-scoped policy for its rendered
PNG and bounded source identity/label evidence. This evidence is extracted from
explicit canonical service metadata and associated labels, not arbitrary
custom-data fields or binary image files. The user explicitly starts analysis and separately confirms replacement
of the architecture canvas. PNG dimensions are limited to 8,192 per side and
16 megapixels, and request bodies are byte-bounded before JSON parsing. The
model receives a transcription-only prompt; node IDs, topology, evidence, and
icon identifiers are validated before the preview is accepted. Unknown icon
identifiers produce generic nodes with warnings, never arbitrary asset URLs.

## Reporting a vulnerability

Please email security disclosures privately to the repository owner rather
than opening a public issue. We aim to acknowledge within five working days.
