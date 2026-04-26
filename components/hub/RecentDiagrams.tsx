"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { FileText, Clock, Trash2 } from "lucide-react";

type Recent = {
  id: string;
  name: string;
  mode: string;
  updatedAt: number;
  nodeCount?: number;
};

/**
 * Reads recent drafts from localStorage. Server-side persistence lands
 * with /api/diagrams in the next phase.
 */
export function RecentDiagrams() {
  const [recents, setRecents] = useState<Recent[] | null>(null);

  useEffect(() => {
    try {
      const draft = localStorage.getItem("diagrammatic.draft");
      const list: Recent[] = [];
      if (draft) {
        const parsed = JSON.parse(draft);
        list.push({
          id: "draft",
          name: "Untitled draft",
          mode: parsed?.mode ?? "architecture",
          updatedAt: parsed?.savedAt ?? Date.now(),
          nodeCount: parsed?.payload?.nodes?.length ?? 0,
        });
      }
      const recent = localStorage.getItem("diagrammatic.recent");
      if (recent) {
        const arr = JSON.parse(recent) as Recent[];
        if (Array.isArray(arr)) list.push(...arr);
      }
      setRecents(list);
    } catch {
      setRecents([]);
    }
  }, []);

  const clearDraft = (id: string) => {
    if (id === "draft") localStorage.removeItem("diagrammatic.draft");
    setRecents((arr) => arr?.filter((r) => r.id !== id) ?? null);
  };

  if (recents === null) {
    return <SectionShell title="Recent" subtitle="Loading…">{null}</SectionShell>;
  }

  if (recents.length === 0) {
    return (
      <SectionShell title="Recent" subtitle="Your recent diagrams will show up here">
        <div className="grid place-items-center py-12 rounded-xl border border-dashed border-slate-200 bg-slate-50/50">
          <FileText className="w-8 h-8 text-slate-300 mb-2" />
          <p className="text-sm text-slate-500">No diagrams yet</p>
          <Link
            href="/diagrammatic"
            className="mt-3 inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-violet-700 hover:text-violet-900 transition-colors cursor-pointer"
          >
            Create your first diagram →
          </Link>
        </div>
      </SectionShell>
    );
  }

  return (
    <SectionShell title="Recent" subtitle={`${recents.length} ${recents.length === 1 ? "diagram" : "diagrams"}`}>
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
        {recents.map((r, i) => (
          <motion.div
            key={r.id}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: i * 0.04 }}
            className="group relative rounded-xl border border-slate-200 bg-white hover:border-slate-300 hover:shadow-md transition-all overflow-hidden"
          >
            <Link href={r.id === "draft" ? "/diagrammatic" : `/diagrammatic/${r.id}`} className="block cursor-pointer">
              <div className="relative h-28 bg-gradient-to-br from-violet-50 via-fuchsia-50 to-orange-50 border-b border-slate-100">
                <div className="absolute inset-0 bg-[linear-gradient(to_right,rgba(15,23,42,0.04)_1px,transparent_1px),linear-gradient(to_bottom,rgba(15,23,42,0.04)_1px,transparent_1px)] bg-[size:16px_16px]" />
                <div className="absolute inset-0 grid place-items-center">
                  <div className="flex gap-1.5">
                    <span className="w-8 h-6 rounded bg-white/90 shadow-sm" />
                    <span className="w-8 h-6 rounded bg-white/70 shadow-sm" />
                    <span className="w-8 h-6 rounded bg-white/90 shadow-sm" />
                  </div>
                </div>
                <span className="absolute top-2 left-2 px-1.5 py-0.5 text-[9px] uppercase tracking-wider font-bold text-slate-600 bg-white/90 rounded">
                  {r.mode}
                </span>
              </div>
              <div className="p-3">
                <div className="text-sm font-semibold text-slate-900 truncate">{r.name}</div>
                <div className="mt-1 flex items-center gap-1.5 text-[11px] text-slate-500">
                  <Clock className="w-3 h-3" />
                  {timeAgo(r.updatedAt)}
                  {r.nodeCount != null && <span className="ml-auto">{r.nodeCount} nodes</span>}
                </div>
              </div>
            </Link>
            <button
              type="button"
              onClick={() => clearDraft(r.id)}
              aria-label="Delete"
              className="absolute top-2 right-2 p-1 rounded text-slate-400 bg-white/80 opacity-0 group-hover:opacity-100 hover:text-rose-600 transition-all cursor-pointer"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </motion.div>
        ))}
      </div>
    </SectionShell>
  );
}

function SectionShell({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="py-6">
      <div className="flex items-baseline justify-between mb-4">
        <div>
          <h2 className="text-base font-bold text-slate-900">{title}</h2>
          {subtitle && <p className="text-xs text-slate-500 mt-0.5">{subtitle}</p>}
        </div>
      </div>
      {children}
    </section>
  );
}

function timeAgo(ts: number) {
  const s = Math.max(0, (Date.now() - ts) / 1000);
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}
