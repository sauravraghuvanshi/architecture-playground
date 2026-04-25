/**
 * GET    /api/diagrams/[id]/versions/[version]   → fetch one version (full graph)
 * POST   /api/diagrams/[id]/versions/[version]   → restore: copies version graph to current diagram, snapshots prior state first
 */
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { recordAudit, auditContext } from "@/lib/audit";

export const dynamic = "force-dynamic";

async function db() {
  const { getPrisma } = await import("@/lib/prisma");
  return getPrisma();
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string; version: string }> }
) {
  const { id, version } = await params;
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const prisma = await db();
  const diagram = await prisma.diagram.findUnique({ where: { id }, select: { userId: true } });
  if (!diagram || diagram.userId !== session.user.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  const v = await prisma.diagramVersion.findUnique({
    where: { diagramId_version: { diagramId: id, version: Number(version) } },
  });
  if (!v) return NextResponse.json({ error: "Version not found" }, { status: 404 });
  return NextResponse.json(v);
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string; version: string }> }
) {
  const { id, version } = await params;
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const prisma = await db();
  const diagram = await prisma.diagram.findUnique({ where: { id } });
  if (!diagram || diagram.userId !== session.user.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  const target = await prisma.diagramVersion.findUnique({
    where: { diagramId_version: { diagramId: id, version: Number(version) } },
  });
  if (!target) return NextResponse.json({ error: "Version not found" }, { status: 404 });

  // Snapshot the current state before overwriting.
  const last = await prisma.diagramVersion.findFirst({
    where: { diagramId: id },
    orderBy: { version: "desc" },
    select: { version: true },
  });
  const next = (last?.version ?? 0) + 1;
  await prisma.diagramVersion.create({
    data: {
      diagramId: id,
      version: next,
      label: `Auto-snapshot before restoring v${target.version}`,
      graphJson: diagram.graphJson,
    },
  });
  const updated = await prisma.diagram.update({
    where: { id },
    data: { graphJson: target.graphJson },
  });
  await recordAudit({
    action: "diagram.version.restore",
    userId: session.user.id,
    resourceType: "Diagram",
    resourceId: id,
    metadata: { restoredVersion: target.version },
    ...auditContext(req),
  });
  return NextResponse.json(updated);
}
