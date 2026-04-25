/**
 * Dashboard — lists user's diagrams with create/open/delete actions.
 * Server component that fetches diagrams and renders the grid.
 */
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";
import { DashboardClient } from "./DashboardClient";

export const metadata: Metadata = { title: "Dashboard" };
export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const session = await auth();
  if (!session?.user) redirect("/auth/signin");

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
      updatedAt: true,
    },
  });

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950">
      {/* Header */}
      <header className="border-b border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <Link href="/" className="text-lg font-bold text-zinc-900 dark:text-zinc-100">
            Architecture Playground
          </Link>
          <div className="flex items-center gap-4">
            <span className="text-sm text-zinc-600 dark:text-zinc-400">
              {session.user.name ?? session.user.email}
            </span>
            {session.user.image && (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img src={session.user.image} alt="" className="h-8 w-8 rounded-full" />
            )}
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="mx-auto max-w-6xl px-6 py-8">
        <div className="mb-6 flex items-center justify-between">
          <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">My Diagrams</h1>
        </div>

        <DashboardClient
          diagrams={diagrams.map((d: { id: string; name: string; description: string | null; thumbnail: string | null; updatedAt: Date }) => ({
            ...d,
            updatedAt: d.updatedAt.toISOString(),
          }))}
        />
      </main>
    </div>
  );
}
