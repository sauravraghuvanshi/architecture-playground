import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();

  const diagram = await prisma.diagram.findUnique({ where: { id } });
  if (!diagram) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Allow public access if there's a share link, otherwise require auth
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

  const updated = await prisma.diagram.update({
    where: { id },
    data: {
      ...(name !== undefined && { name }),
      ...(description !== undefined && { description }),
      ...(graphJson !== undefined && { graphJson }),
      ...(thumbnail !== undefined && { thumbnail }),
    },
  });

  return NextResponse.json(updated);
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const diagram = await prisma.diagram.findUnique({ where: { id } });
  if (!diagram || diagram.userId !== session.user.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  await prisma.diagram.update({ where: { id }, data: { archived: true } });
  return NextResponse.json({ ok: true });
}
