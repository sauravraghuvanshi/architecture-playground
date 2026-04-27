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

## Secrets

Read from environment variables only:

- `AZURE_OPENAI_ENDPOINT`
- `AZURE_OPENAI_API_KEY`
- `AZURE_OPENAI_DEPLOYMENT` (chat / generate)
- `AZURE_OPENAI_IMAGE_DEPLOYMENT` (DALL·E)
- `AZURE_OPENAI_API_VERSION` (optional)

`/api/ai/status` returns only `{ configured: boolean }` so the client can gate
UI without learning anything about the underlying provider configuration.

## Reporting a vulnerability

Please email security disclosures privately to the repository owner rather
than opening a public issue. We aim to acknowledge within five working days.
