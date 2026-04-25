/**
 * GET  /api/diagrams/[id]/comments    → list comments + replies
 * POST /api/diagrams/[id]/comments    → create comment
 *   { body: string, nodeId?, edgeId?, pinX?, pinY?, parentId? }
 */
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { recordAudit, auditContext } from "@/lib/audit";

export const dynamic = "force-dynamic";

async function db() {
  const { getPrisma } = await import("@/lib/prisma");
  return getPrisma();
}

async function canAccessDiagram(diagramId: string, userId?: string) {
  const prisma = await db();
  const diagram = await prisma.diagram.findUnique({ where: { id: diagramId }, select: { userId: true } });
  if (!diagram) return false;
  if (diagram.userId === userId) return true;
  // Allow share-link "edit" permission to comment.
  const share = await prisma.shareLink.findFirst({ where: { diagramId, permission: "edit" } });
  return !!share;
}

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  if (!(await canAccessDiagram(id, session?.user?.id))) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  const prisma = await db();
  const comments = await prisma.comment.findMany({
    where: { diagramId: id },
    orderBy: { createdAt: "asc" },
    include: { author: { select: { name: true, email: true, image: true } } },
  });
  return NextResponse.json(comments);
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!(await canAccessDiagram(id, session.user.id))) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  const body = (await req.json().catch(() => ({}))) as {
    body?: string;
    nodeId?: string;
    edgeId?: string;
    pinX?: number;
    pinY?: number;
    parentId?: string;
  };
  if (!body.body || !body.body.trim()) {
    return NextResponse.json({ error: "Missing 'body'" }, { status: 400 });
  }
  const prisma = await db();
  const c = await prisma.comment.create({
    data: {
      diagramId: id,
      authorId: session.user.id,
      body: body.body.trim().slice(0, 4000),
      nodeId: body.nodeId ?? null,
      edgeId: body.edgeId ?? null,
      pinX: body.pinX ?? null,
      pinY: body.pinY ?? null,
      parentId: body.parentId ?? null,
    },
  });
  await recordAudit({
    action: "comment.create",
    userId: session.user.id,
    resourceType: "Comment",
    resourceId: c.id,
    metadata: { diagramId: id },
    ...auditContext(req),
  });
  return NextResponse.json(c, { status: 201 });
}
