/**
 * DELETE /api/api-keys/[id]   → revoke (sets revokedAt; key remains in DB for audit)
 */
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { recordAudit, auditContext } from "@/lib/audit";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

async function db() {
  const { getPrisma } = await import("@/lib/prisma");
  return getPrisma();
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const prisma = await db();
  const k = await prisma.apiKey.findUnique({ where: { id }, select: { userId: true } });
  if (!k || k.userId !== session.user.id) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const updated = await prisma.apiKey.update({
    where: { id },
    data: { revokedAt: new Date() },
  });
  await recordAudit({
    action: "apikey.revoke",
    userId: session.user.id,
    resourceType: "ApiKey",
    resourceId: id,
    ...auditContext(req),
  });
  return NextResponse.json(updated);
}
