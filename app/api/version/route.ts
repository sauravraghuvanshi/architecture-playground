import { NextResponse } from "next/server";
import { readReleaseInfo } from "@/lib/release-info.mjs";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  try {
    return NextResponse.json(readReleaseInfo(), { headers: { "Cache-Control": "no-store" } });
  } catch {
    console.error("[release-identity] Build manifest unavailable or invalid.");
    return NextResponse.json({ error: "Release identity unavailable." }, {
      status: 503, headers: { "Cache-Control": "no-store" },
    });
  }
}
