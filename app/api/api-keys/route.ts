/**
 * Authenticated user API for managing their own API keys (used by /api/v1/*).
 *
 * GET  /api/api-keys   → list (no plaintext returned)
 * POST /api/api-keys   → create { name, scopes? } → returns plaintext ONCE
 */
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { generateApiKey } from "@/lib/api-keys";
import { recordAudit, auditContext } from "@/lib/audit";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

async function db() {
  const { getPrisma } = await import("@/lib/prisma");
  return getPrisma();
}

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const prisma = await db();
  const keys = await prisma.apiKey.findMany({
    where: { userId: session.user.id },
    orderBy: { createdAt: "desc" },
    select: {
      id: true, name: true, prefix: true, scopes: true,
      lastUsedAt: true, expiresAt: true, revokedAt: true, createdAt: true,
    },
  });
  return NextResponse.json(keys);
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = (await req.json().catch(() => ({}))) as { name?: string; scopes?: string };
  if (!body.name || !body.name.trim()) {
    return NextResponse.json({ error: "Missing 'name'" }, { status: 400 });
  }
  const { plaintext, prefix, hash } = generateApiKey();
  const prisma = await db();
  const created = await prisma.apiKey.create({
    data: {
      hashedKey: hash,
      prefix,
      name: body.name.trim().slice(0, 100),
      scopes: (body.scopes || "read,write").split(",").map((s: string) => s.trim()).filter(Boolean).join(","),
      userId: session.user.id,
    },
  });
  await recordAudit({
    action: "apikey.create",
    userId: session.user.id,
    resourceType: "ApiKey",
    resourceId: created.id,
    ...auditContext(req),
  });
  // Plaintext returned ONCE.
  return NextResponse.json({
    id: created.id,
    name: created.name,
    prefix: created.prefix,
    scopes: created.scopes,
    createdAt: created.createdAt,
    plaintext,
  }, { status: 201 });
}
