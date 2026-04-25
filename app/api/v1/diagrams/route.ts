/**
 * Public REST API (v1) — programmatic access to diagrams, authenticated via
 * `Authorization: Bearer ap_live_...` API keys. See lib/api-keys.ts.
 *
 * GET   /api/v1/diagrams      → list caller's diagrams
 * POST  /api/v1/diagrams      → create
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

export async function GET(req: Request) {
  const auth = await authenticateApiKey(req.headers.get("authorization"));
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!requireScope(auth, "read")) return NextResponse.json({ error: "Insufficient scope" }, { status: 403 });

  const prisma = await db();
  const diagrams = await prisma.diagram.findMany({
    where: { userId: auth.userId, archived: false },
    orderBy: { updatedAt: "desc" },
    select: {
      id: true, name: true, description: true,
      projectId: true, createdAt: true, updatedAt: true,
    },
  });
  return NextResponse.json({ data: diagrams });
}

export async function POST(req: Request) {
  const auth = await authenticateApiKey(req.headers.get("authorization"));
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!requireScope(auth, "write")) return NextResponse.json({ error: "Insufficient scope" }, { status: 403 });

  const body = (await req.json().catch(() => ({}))) as {
    name?: string;
    description?: string;
    graphJson?: string;
  };
  const prisma = await db();
  const diagram = await prisma.diagram.create({
    data: {
      name: body.name || "Untitled (API)",
      description: body.description,
      graphJson: body.graphJson || '{"nodes":[],"edges":[]}',
      userId: auth.userId,
    },
  });
  await prisma.diagramVersion.create({
    data: { diagramId: diagram.id, version: 1, label: "API created", graphJson: diagram.graphJson },
  });
  await recordAudit({
    action: "api.diagram.create",
    userId: auth.userId,
    resourceType: "Diagram",
    resourceId: diagram.id,
    metadata: { apiKeyId: auth.apiKeyId },
    ...auditContext(req),
  });
  return NextResponse.json(diagram, { status: 201 });
}
