/**
 * DashboardClient — client-side interactions for the dashboard.
 * Handles creating new diagrams, deleting, and navigation.
 */
"use client";

import { useRouter } from "next/navigation";
import { useCallback, useState } from "react";
import { Plus, Trash2, ExternalLink } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

interface DiagramSummary {
  id: string;
  name: string;
  description: string | null;
  thumbnail: string | null;
  updatedAt: string;
}

interface Props {
  diagrams: DiagramSummary[];
}

export function DashboardClient({ diagrams: initialDiagrams }: Props) {
  const router = useRouter();
  const [diagrams, setDiagrams] = useState(initialDiagrams);
  const [creating, setCreating] = useState(false);

  const handleCreate = useCallback(async () => {
    setCreating(true);
    try {
      const res = await fetch("/api/diagrams", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "Untitled Diagram" }),
      });
      if (!res.ok) throw new Error("Failed to create");
      const diagram = await res.json();
      router.push(`/?diagramId=${diagram.id}`);
    } catch {
      alert("Failed to create diagram");
    } finally {
      setCreating(false);
    }
  }, [router]);

  const handleDelete = useCallback(async (id: string) => {
    if (!confirm("Move this diagram to trash?")) return;
    try {
      await fetch(`/api/diagrams/${id}`, { method: "DELETE" });
      setDiagrams((prev) => prev.filter((d) => d.id !== id));
    } catch {
      alert("Failed to delete");
    }
  }, []);

  return (
    <>
      {/* Create button + grid */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {/* New diagram card */}
        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={handleCreate}
          disabled={creating}
          className="flex h-48 flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-zinc-300 bg-white text-zinc-500 transition-colors hover:border-brand-400 hover:text-brand-600 disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-900 dark:hover:border-brand-500 dark:hover:text-brand-400"
        >
          <Plus className="h-8 w-8" />
          <span className="text-sm font-medium">{creating ? "Creating…" : "New Diagram"}</span>
        </motion.button>

        {/* Existing diagrams */}
        <AnimatePresence>
          {diagrams.map((d) => (
            <motion.div
              key={d.id}
              layout
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="group relative flex h-48 flex-col overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-sm transition-shadow hover:shadow-md dark:border-zinc-800 dark:bg-zinc-900"
            >
              {/* Thumbnail or placeholder */}
              <div className="flex flex-1 items-center justify-center bg-zinc-100 dark:bg-zinc-800">
                {d.thumbnail ? (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img src={d.thumbnail} alt="" className="h-full w-full object-cover" />
                ) : (
                  <div className="text-3xl text-zinc-300 dark:text-zinc-600">📐</div>
                )}
              </div>

              {/* Info */}
              <div className="flex items-center justify-between px-3 py-2">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-zinc-900 dark:text-zinc-100">{d.name}</p>
                  <p className="text-[10px] text-zinc-400">
                    {new Date(d.updatedAt).toLocaleDateString()}
                  </p>
                </div>
                <div className="flex gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                  <a
                    href={`/?diagramId=${d.id}`}
                    className="rounded p-1 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700 dark:hover:bg-zinc-800"
                    title="Open"
                  >
                    <ExternalLink className="h-4 w-4" />
                  </a>
                  <button
                    onClick={() => handleDelete(d.id)}
                    className="rounded p-1 text-zinc-400 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/40"
                    title="Delete"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {diagrams.length === 0 && (
        <p className="mt-8 text-center text-sm text-zinc-400">
          No diagrams yet. Click &quot;New Diagram&quot; to get started!
        </p>
      )}
    </>
  );
}
