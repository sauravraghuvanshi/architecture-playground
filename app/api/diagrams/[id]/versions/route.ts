/**
 * GET    /api/diagrams/[id]/versions          → list versions (most recent first)
 * POST   /api/diagrams/[id]/versions          → manual snapshot { label?: string }
 *
 * Auto-snapshot on update is handled in the parent diagram PUT route.
 */
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
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const prisma = await db();
  const diagram = await prisma.diagram.findUnique({ where: { id }, select: { userId: true } });
  if (!diagram || diagram.userId !== session.user.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  const versions = await prisma.diagramVersion.findMany({
    where: { diagramId: id },
    orderBy: { version: "desc" },
    select: { id: true, version: true, label: true, createdAt: true },
  });
  return NextResponse.json(versions);
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const prisma = await db();
  const diagram = await prisma.diagram.findUnique({ where: { id } });
  if (!diagram || diagram.userId !== session.user.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  const body = (await req.json().catch(() => ({}))) as { label?: string };
  const last = await prisma.diagramVersion.findFirst({
    where: { diagramId: id },
    orderBy: { version: "desc" },
    select: { version: true },
  });
  const next = (last?.version ?? 0) + 1;
  const version = await prisma.diagramVersion.create({
    data: {
      diagramId: id,
      version: next,
      label: body.label ?? `v${next}`,
      graphJson: diagram.graphJson,
    },
  });
  await recordAudit({
    action: "diagram.version.create",
    userId: session.user.id,
    resourceType: "DiagramVersion",
    resourceId: version.id,
    metadata: { diagramId: id, version: next },
    ...auditContext(req),
  });
  return NextResponse.json(version, { status: 201 });
}
