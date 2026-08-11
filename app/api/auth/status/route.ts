import { NextResponse } from "next/server";
import {
  authEnabled,
  SESSION_COOKIE,
  verifySessionToken,
} from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const cookie = request.headers
    .get("cookie")
    ?.split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${SESSION_COOKIE}=`))
    ?.slice(SESSION_COOKIE.length + 1);
  return NextResponse.json({
    enabled: authEnabled(),
    authenticated: await verifySessionToken(cookie),
  });
}
