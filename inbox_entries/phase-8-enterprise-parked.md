# Phase 8 — Enterprise hardening (PARKED)

**Status**: partially shipped (security headers + AI rate limit + docs);
remaining items parked behind external services.

## What's shipped

- `middleware.ts` — CSP, HSTS, X-Frame-Options, X-Content-Type-Options,
  Referrer-Policy, Permissions-Policy, COOP. See `docs/security.md`.
- `lib/ai-rate-limit.ts` — 20 req/min/IP token bucket on AI endpoints.
- `docs/security.md` — threat model, header table, rate-limit notes.

## What's parked

| Plan item                        | Why parked                                           |
|----------------------------------|------------------------------------------------------|
| Postgres (multi-tenant + audit log) | Auth subsystem ripped out (commit `3ee1b43`); no users to scope tenants by |
| SAML / SCIM SSO                  | Requires identity provider setup + persistent user table |
| Stripe billing                   | No accounts to bill; needs persistence + auth         |
| SOC 2 audit log table            | Same dependency as Postgres                          |
| Per-tenant key-vault for Azure   | Single-tenant deployment; key in env is sufficient    |
| Centralized rate limiter (Redis) | Single-instance deployment makes in-memory acceptable |

## Migration path when accounts return

1. Reintroduce auth + Prisma tables.
2. Add `tenantId` column to diagrams / comments / versions.
3. Move rate limit state to Redis keyed by `tenantId:userId` — swap the impl
   inside `lib/ai-rate-limit.ts`; signature stays the same.
4. Wire SAML/SCIM via a dedicated `/api/auth/*` adapter (NextAuth or Clerk).
5. Stripe webhook → `BillingEvent` table; gate AI endpoints by quota.
6. Tighten CSP: drop `'unsafe-eval'` once Next.js 16 / React Flow no longer
   require it; pin script hashes for the few inline runtime stubs.

No throwaway code: the headers + rate limit graduate cleanly into the
multi-tenant model. Until then, the security baseline is in place.
