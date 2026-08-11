# Security overview

This document captures the application-level security posture of the
Diagrammatic workspace as it ships today. It deliberately scopes to what is
in this repository and excludes hosting-environment concerns (TLS termination,
WAF, DDoS, key management) — those live with the deployment target.

## Threat model (one-page)

| Asset                   | Threats                                       | Mitigations                                |
|-------------------------|-----------------------------------------------|--------------------------------------------|
| User-authored diagrams  | XSS via injected node labels; data exfil       | React auto-escaping; CSP; no `dangerouslySetInnerHTML` on user data |
| Browser localStorage    | Cross-tenant leakage on shared machines       | Per-mode + per-diagram namespacing; documented in code |
| Azure OpenAI key        | Server-side credential theft                  | Keys read from env only; never echoed to client; `/api/ai/status` returns boolean only |
| AI endpoints            | Cost-amplification / abuse                    | In-memory token-bucket rate limiter (20 req/min/IP); 2000-char prompt cap |
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

The limiter is in-process. Multi-instance deployments will let bursts through
equal to `(rate × instance count)` — acceptable for the current single-VM
deployment. Replace with a centralized store (Upstash Redis / SignalR /
Cloud Memorystore) before scaling out.

The shared sign-in endpoint separately allows five failed attempts per IP in a
ten-minute window. Successful sign-in clears that IP's counter.

## Workspace access gate

When `APP_AUTH_ENABLED=true`, middleware protects every non-static page and API
route except `/login` and the three `/api/auth/*` endpoints.

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

Production authentication values are stored as GitHub Actions secrets. The
deployment workflow base64url-encodes them before creating the standalone
runtime environment, which avoids dotenv `$` expansion and keeps raw values out
of source and logs.

During local development only, Whiteboard image generation can proxy through a
trusted Diagrammatic deployment when local image credentials are missing.
Developers can opt out with `DIAGRAMMATIC_AI_PROXY_URL=disabled`.

## Reporting a vulnerability

Please email security disclosures privately to the repository owner rather
than opening a public issue. We aim to acknowledge within five working days.
