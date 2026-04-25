/**
 * PATCH  /api/comments/[id]   → update body / resolved
 * DELETE /api/comments/[id]   → delete (cascades to replies)
 */
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { recordAudit, auditContext } from "@/lib/audit";

export const dynamic = "force-dynamic";

async function db() {
  const { getPrisma } = await import("@/lib/prisma");
  return getPrisma();
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const prisma = await db();
  const existing = await prisma.comment.findUnique({ where: { id }, select: { authorId: true } });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (existing.authorId !== session.user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const body = (await req.json().catch(() => ({}))) as { body?: string; resolved?: boolean };
  const updated = await prisma.comment.update({
    where: { id },
    data: {
      ...(body.body !== undefined && { body: body.body.trim().slice(0, 4000) }),
      ...(body.resolved !== undefined && { resolved: !!body.resolved }),
    },
  });
  await recordAudit({
    action: "comment.update",
    userId: session.user.id,
    resourceType: "Comment",
    resourceId: id,
    ...auditContext(req),
  });
  return NextResponse.json(updated);
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const prisma = await db();
  const existing = await prisma.comment.findUnique({ where: { id }, select: { authorId: true } });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (existing.authorId !== session.user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  await prisma.comment.delete({ where: { id } });
  await recordAudit({
    action: "comment.delete",
    userId: session.user.id,
    resourceType: "Comment",
    resourceId: id,
    ...auditContext(req),
  });
  return NextResponse.json({ ok: true });
}
