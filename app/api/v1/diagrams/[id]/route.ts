/**
 * GET    /api/v1/diagrams/[id]   → fetch full diagram (incl. graphJson)
 * PUT    /api/v1/diagrams/[id]   → update name/description/graphJson
 * DELETE /api/v1/diagrams/[id]   → archive
 */
import { NextResponse } from "next/server";
import { authenticateApiKey, requireScope } from "@/lib/api-keys";
import { recordAudit, auditContext } from "@/lib/audit";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

async function db() {
  const { getPrisma } = await import("@/lib/prisma");
  return getPrisma();
}

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await authenticateApiKey(req.headers.get("authorization"));
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!requireScope(auth, "read")) return NextResponse.json({ error: "Insufficient scope" }, { status: 403 });
  const { id } = await params;
  const prisma = await db();
  const d = await prisma.diagram.findUnique({ where: { id } });
  if (!d || d.userId !== auth.userId) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(d);
}

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await authenticateApiKey(req.headers.get("authorization"));
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!requireScope(auth, "write")) return NextResponse.json({ error: "Insufficient scope" }, { status: 403 });
  const { id } = await params;
  const prisma = await db();
  const d = await prisma.diagram.findUnique({ where: { id } });
  if (!d || d.userId !== auth.userId) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const body = (await req.json().catch(() => ({}))) as {
    name?: string; description?: string; graphJson?: string;
  };
  const updated = await prisma.diagram.update({
    where: { id },
    data: {
      ...(body.name !== undefined && { name: body.name }),
      ...(body.description !== undefined && { description: body.description }),
      ...(body.graphJson !== undefined && { graphJson: body.graphJson }),
    },
  });
  await recordAudit({
    action: "api.diagram.update",
    userId: auth.userId, resourceType: "Diagram", resourceId: id,
    metadata: { apiKeyId: auth.apiKeyId },
    ...auditContext(req),
  });
  return NextResponse.json(updated);
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await authenticateApiKey(req.headers.get("authorization"));
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!requireScope(auth, "write")) return NextResponse.json({ error: "Insufficient scope" }, { status: 403 });
  const { id } = await params;
  const prisma = await db();
  const d = await prisma.diagram.findUnique({ where: { id } });
  if (!d || d.userId !== auth.userId) return NextResponse.json({ error: "Not found" }, { status: 404 });
  await prisma.diagram.update({ where: { id }, data: { archived: true } });
  await recordAudit({
    action: "api.diagram.archive",
    userId: auth.userId, resourceType: "Diagram", resourceId: id,
    metadata: { apiKeyId: auth.apiKeyId },
    ...auditContext(req),
  });
  return NextResponse.json({ ok: true });
}
