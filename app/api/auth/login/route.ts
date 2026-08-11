import { NextResponse } from "next/server";
import {
  createSessionToken,
  getAuthConfig,
  SESSION_COOKIE,
  SESSION_MAX_AGE_SECONDS,
  timingSafeTextEqual,
} from "@/lib/auth";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const WINDOW_MS = 10 * 60 * 1000;
const MAX_ATTEMPTS = 5;
const attempts = new Map<string, { count: number; resetAt: number }>();

function clientId(request: Request): string {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    "unknown"
  );
}

function rateLimit(request: Request): { ok: true } | { ok: false; retryAfter: number } {
  const now = Date.now();
  const id = clientId(request);
  const current = attempts.get(id);
  if (!current || current.resetAt <= now) {
    attempts.set(id, { count: 0, resetAt: now + WINDOW_MS });
    return { ok: true };
  }
  if (current.count >= MAX_ATTEMPTS) {
    return {
      ok: false,
      retryAfter: Math.max(1, Math.ceil((current.resetAt - now) / 1000)),
    };
  }
  return { ok: true };
}

export async function POST(request: Request) {
  const config = getAuthConfig();
  if (!config) {
    return NextResponse.json(
      { error: "Sign-in is not configured on this server." },
      { status: 503 }
    );
  }

  const rate = rateLimit(request);
  if (!rate.ok) {
    return NextResponse.json(
      { error: "Too many sign-in attempts. Try again later." },
      { status: 429, headers: { "Retry-After": String(rate.retryAfter) } }
    );
  }

  let username = "";
  let password = "";
  try {
    const body = (await request.json()) as { username?: string; password?: string };
    username = body.username?.trim() ?? "";
    password = body.password ?? "";
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const usernameMatches = timingSafeTextEqual(username, config.username);
  const passwordMatches = timingSafeTextEqual(password, config.password);
  if (!(usernameMatches && passwordMatches)) {
    const id = clientId(request);
    const current = attempts.get(id) ?? {
      count: 0,
      resetAt: Date.now() + WINDOW_MS,
    };
    attempts.set(id, { ...current, count: current.count + 1 });
    return NextResponse.json(
      { error: "Invalid username or password." },
      { status: 401 }
    );
  }

  attempts.delete(clientId(request));
  const response = NextResponse.json({ ok: true });
  response.cookies.set({
    name: SESSION_COOKIE,
    value: await createSessionToken(config.username),
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/",
    maxAge: SESSION_MAX_AGE_SECONDS,
  });
  return response;
}
