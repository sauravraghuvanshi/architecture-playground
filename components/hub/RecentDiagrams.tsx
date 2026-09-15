"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { FileText, Clock } from "lucide-react";
import { listDiagrams } from "@/lib/diagram-library";

type Recent = {
  id: string;
  name: string;
  mode: string;
  updatedAt: number;
  nodeCount?: number;
};

/**
 * Reads recent drafts from localStorage. Dark-editorial pass — matches
 * the rest of the hub.
 */
export function RecentDiagrams() {
  const [recents, setRecents] = useState<Recent[] | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    void listDiagrams().then((documents) => {
      const list: Recent[] = documents.slice(0, 8);
      if (!list.length) {
        const draft = localStorage.getItem("diagrammatic.draft");
        if (draft) {
          const parsed = JSON.parse(draft);
          list.push({ id: "draft", name: "Recover previous draft", mode: "architecture", updatedAt: parsed?.savedAt ?? Date.now() });
        }
      }
      if (active) setRecents(list);
    }).catch((cause) => {
      if (active) setError(cause instanceof Error ? cause.message : "Saved diagrams could not be loaded.");
    });
    return () => { active = false; };
  }, []);

  if (error) return <SectionShell title="My diagrams"><p role="alert" className="text-sm text-rose-300">{error}</p></SectionShell>;

  if (recents === null) {
    return <SectionShell title="Recent" subtitle="Loading…">{null}</SectionShell>;
  }

  if (recents.length === 0) {
    return (
      <SectionShell title="Recent" subtitle="Your recent diagrams will show up here">
        <div className="grid place-items-center py-12 rounded-xl border border-dashed border-zinc-800 bg-zinc-900/40">
          <FileText className="w-8 h-8 text-zinc-600 mb-2" />
          <p className="text-sm text-zinc-500">No diagrams yet</p>
          <Link
            href="/diagrammatic"
            className="mt-3 inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-cyan-300 hover:text-cyan-200 transition-colors cursor-pointer"
          >
            Create your first diagram →
          </Link>
        </div>
      </SectionShell>
    );
  }

  return (
    <SectionShell title="Recent saved diagrams" subtitle="Browser-local documents. Open to continue editing; manage names and deletion in My diagrams.">
      <Link href="/diagrammatic?library=1" className="mb-3 inline-block text-xs font-semibold text-cyan-300 hover:underline">View all saved diagrams</Link>
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
        {recents.map((r, i) => (
          <motion.div
            key={r.id}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: i * 0.04 }}
            whileHover={{ y: -2 }}
            className="group relative rounded-xl border border-slate-800 bg-[#0b1220]/80 hover:border-cyan-400/40 transition-all overflow-hidden"
          >
            <Link href={r.id === "draft" ? "/diagrammatic" : `/diagrammatic?document=${encodeURIComponent(r.id)}&mode=${encodeURIComponent(r.mode)}`} className="block cursor-pointer">
              <div className="relative h-28 bg-gradient-to-br from-zinc-950 via-zinc-900 to-zinc-950 border-b border-zinc-800/60">
                <div className="absolute inset-0 bg-[linear-gradient(to_right,rgba(255,255,255,0.04)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.04)_1px,transparent_1px)] bg-[size:16px_16px]" />
                <div className="absolute inset-0 grid place-items-center">
                  <div className="flex gap-1.5">
                    <span className="w-8 h-6 rounded bg-zinc-800 shadow-sm" />
                    <span className="w-8 h-6 rounded bg-zinc-700 shadow-sm" />
                    <span className="w-8 h-6 rounded bg-cyan-400/70 shadow-sm" />
                  </div>
                </div>
                <span className="absolute top-2 left-2 px-1.5 py-0.5 text-[9px] uppercase tracking-wider font-bold text-zinc-300 bg-zinc-950/80 border border-zinc-800 rounded">
                  {r.mode}
                </span>
              </div>
              <div className="p-3">
                <div className="text-sm font-semibold text-zinc-100 truncate">{r.name}</div>
                <div className="mt-1 flex items-center gap-1.5 text-[11px] text-zinc-500">
                  <Clock className="w-3 h-3" />
                  {timeAgo(r.updatedAt)}
                  {r.nodeCount != null && <span className="ml-auto">{r.nodeCount} nodes</span>}
                </div>
              </div>
            </Link>
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
          <h2 className="text-base font-semibold text-zinc-100">{title}</h2>
          {subtitle && <p className="text-xs text-zinc-500 mt-0.5">{subtitle}</p>}
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
