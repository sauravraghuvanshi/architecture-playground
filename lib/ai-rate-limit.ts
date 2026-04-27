/**
 * Tiny in-memory token-bucket rate limiter for /api/ai/* routes.
 *
 * Keyed by client IP (X-Forwarded-For first hop, falling back to a constant
 * for local dev). Per-key bucket: 20 requests / minute, refilled linearly.
 *
 * In-process only: a multi-instance App Service deployment will let bursts
 * through equal to (rate × instance count). Acceptable for the current OSS
 * single-instance deployment; swap for Upstash Redis if/when we scale out.
 */

const RATE = 20;          // tokens per window
const WINDOW_MS = 60_000; // 1 minute

interface Bucket { tokens: number; updatedAt: number }
const buckets = new Map<string, Bucket>();

function clientKey(req: Request): string {
  const xff = req.headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0]!.trim();
  const real = req.headers.get("x-real-ip");
  if (real) return real.trim();
  return "local";
}

export interface RateResult {
  ok: boolean;
  remaining: number;
  retryAfterSec: number;
}

export function aiRateLimit(req: Request): RateResult {
  const key = clientKey(req);
  const now = Date.now();
  const b = buckets.get(key) ?? { tokens: RATE, updatedAt: now };
  // Linear refill: full bucket reload over WINDOW_MS.
  const elapsed = now - b.updatedAt;
  const refill = (elapsed / WINDOW_MS) * RATE;
  b.tokens = Math.min(RATE, b.tokens + refill);
  b.updatedAt = now;
  if (b.tokens < 1) {
    buckets.set(key, b);
    const retryAfterSec = Math.max(1, Math.ceil(((1 - b.tokens) / RATE) * (WINDOW_MS / 1000)));
    return { ok: false, remaining: 0, retryAfterSec };
  }
  b.tokens -= 1;
  buckets.set(key, b);
  return { ok: true, remaining: Math.floor(b.tokens), retryAfterSec: 0 };
}

/** Test-only: clear all buckets. */
export function _resetAiRateLimit() { buckets.clear(); }
