/**
 * Edge middleware — security headers + a tiny per-route bypass list.
 *
 * Applies a baseline set of HTTP response headers to every route except
 * Next.js internals and static assets. The CSP is intentionally permissive
 * (allows inline styles, data:/blob: images for excalidraw + AI images,
 * 'unsafe-eval' for the Next.js 16 client runtime) — tighten as the codebase
 * matures.
 *
 * AI-route rate limiting is enforced inside the route handlers themselves
 * (see lib/ai-rate-limit.ts) so it can return 429 with a Retry-After header.
 * Doing it in middleware would force an Edge runtime, but our rate-limit
 * state is per-instance in-memory which only works on the Node runtime the
 * AI routes already pin via `export const runtime = "nodejs"`.
 */
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const CSP = [
  "default-src 'self'",
  // Next.js 16 dev/Turbopack injects inline runtime; eval is required by
  // some React DevTools tooling and by @xyflow/react in a few code paths.
  "script-src 'self' 'unsafe-inline' 'unsafe-eval' https:",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https:",
  // Excalidraw 0.18+ lazy-loads its rough-fonts (Excalifont, Cascadia, etc.)
  // from esm.sh at runtime; without https: here the renderer ends up
  // crashing the tab ("This page couldn't load") after dozens of CSP
  // violations. Allow https: + data: globally — fonts are public, low risk.
  "font-src 'self' data: https:",
  // Excalidraw fetches its own assets; AI image route may return blob:.
  "connect-src 'self' https: wss:",
  "worker-src 'self' blob:",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
].join("; ");

const SECURITY_HEADERS: Record<string, string> = {
  "Content-Security-Policy": CSP,
  "Strict-Transport-Security": "max-age=63072000; includeSubDomains; preload",
  "X-Frame-Options": "DENY",
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "Permissions-Policy": "camera=(), microphone=(), geolocation=(), payment=(), usb=()",
  "Cross-Origin-Opener-Policy": "same-origin",
};

export function middleware(_req: NextRequest) { // eslint-disable-line @typescript-eslint/no-unused-vars
  const res = NextResponse.next();
  for (const [k, v] of Object.entries(SECURITY_HEADERS)) {
    res.headers.set(k, v);
  }
  return res;
}

export const config = {
  // Match all routes except Next internals + static assets.
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml|.*\\.(?:png|jpg|jpeg|svg|gif|webp|ico|woff2?|ttf|otf)).*)",
  ],
};
