import { NextResponse } from "next/server";
import { describeAiPrivacy } from "@/lib/ai-privacy";

export const dynamic = "force-dynamic";
export function GET() {
  return NextResponse.json(describeAiPrivacy(), { headers: { "Cache-Control": "no-store" } });
}
