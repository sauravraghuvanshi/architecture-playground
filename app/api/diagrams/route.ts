/**
 * Diagrams API — CRUD operations for cloud-saved diagrams.
 *
 * GET  /api/diagrams          → list user's diagrams
 * POST /api/diagrams          → create new diagram
 * GET  /api/diagrams/[id]     → get single diagram
 * PUT  /api/diagrams/[id]     → update diagram (graph, name, etc.)
 * DELETE /api/diagrams/[id]   → soft-delete (archive)
 */
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { getPrisma } = await import("@/lib/prisma");
  const prisma = getPrisma();

  const diagrams = await prisma.diagram.findMany({
    where: { userId: session.user.id, archived: false },
    orderBy: { updatedAt: "desc" },
    select: {
      id: true,
      name: true,
      description: true,
      thumbnail: true,
      projectId: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  return NextResponse.json(diagrams);
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { getPrisma } = await import("@/lib/prisma");
  const prisma = getPrisma();

  const body = await req.json();
  const { name, description, graphJson, projectId } = body as {
    name?: string;
    description?: string;
    graphJson?: string;
    projectId?: string;
  };

  const diagram = await prisma.diagram.create({
    data: {
      name: name || "Untitled Diagram",
      description,
      graphJson: graphJson || '{"nodes":[],"edges":[]}',
      userId: session.user.id,
      projectId,
    },
  });

  // Create initial version
  await prisma.diagramVersion.create({
    data: {
      diagramId: diagram.id,
      version: 1,
      label: "Initial version",
      graphJson: diagram.graphJson,
    },
  });

  return NextResponse.json(diagram, { status: 201 });
}
