import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { recordAudit, auditContext } from "@/lib/audit";

export const dynamic = "force-dynamic";

async function db() {
  const { getPrisma } = await import("@/lib/prisma");
  return getPrisma();
}

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  const prisma = await db();

  const diagram = await prisma.diagram.findUnique({ where: { id } });
  if (!diagram) return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (diagram.userId !== session?.user?.id) {
    const hasShare = await prisma.shareLink.findFirst({
      where: { diagramId: id, permission: "view" },
    });
    if (!hasShare) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  return NextResponse.json(diagram);
}

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const prisma = await db();

  const diagram = await prisma.diagram.findUnique({ where: { id } });
  if (!diagram || diagram.userId !== session.user.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const body = await req.json();
  const { name, description, graphJson, thumbnail } = body as {
    name?: string;
    description?: string;
    graphJson?: string;
    thumbnail?: string;
  };

  // Auto-snapshot when graphJson changes meaningfully (size delta > 50 chars
  // OR last snapshot is older than 5 min). Best-effort; don't block update.
  if (graphJson !== undefined && graphJson !== diagram.graphJson) {
    try {
      const last = await prisma.diagramVersion.findFirst({
        where: { diagramId: id },
        orderBy: { version: "desc" },
        select: { version: true, createdAt: true },
      });
      const sizeDelta = Math.abs(graphJson.length - diagram.graphJson.length);
      const ageMs = last ? Date.now() - last.createdAt.getTime() : Infinity;
      if (sizeDelta > 50 || ageMs > 5 * 60 * 1000) {
        const next = (last?.version ?? 0) + 1;
        await prisma.diagramVersion.create({
          data: {
            diagramId: id,
            version: next,
            label: `Auto v${next}`,
            graphJson: diagram.graphJson,
          },
        });
      }
    } catch (err) {
      console.warn("[auto-snapshot] failed:", err);
    }
  }

  const updated = await prisma.diagram.update({
    where: { id },
    data: {
      ...(name !== undefined && { name }),
      ...(description !== undefined && { description }),
      ...(graphJson !== undefined && { graphJson }),
      ...(thumbnail !== undefined && { thumbnail }),
    },
  });

  await recordAudit({
    action: "diagram.update",
    userId: session.user.id,
    resourceType: "Diagram",
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

  const diagram = await prisma.diagram.findUnique({ where: { id } });
  if (!diagram || diagram.userId !== session.user.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  await prisma.diagram.update({ where: { id }, data: { archived: true } });
  await recordAudit({
    action: "diagram.archive",
    userId: session.user.id,
    resourceType: "Diagram",
    resourceId: id,
    ...auditContext(req),
  });
  return NextResponse.json({ ok: true });
}
