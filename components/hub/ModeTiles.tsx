"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import {
  Boxes,
  Workflow,
  Brain,
  GitBranch,
  Database,
  Layers,
  PenTool,
  ListChecks,
  Cpu,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

type Mode = {
  id: string;
  label: string;
  blurb: string;
  icon: LucideIcon;
  ready: boolean;
  hint?: string;
};

const MODES: Mode[] = [
  { id: "architecture", label: "Cloud architecture", blurb: "1,400+ AWS / Azure / GCP icons", icon: Boxes, ready: true, hint: "⌘1" },
  { id: "flowchart", label: "Flowchart", blurb: "BPMN-friendly process flows", icon: Workflow, ready: true, hint: "⌘2" },
  { id: "mindmap", label: "Mind map", blurb: "Radial brainstorming", icon: Brain, ready: true, hint: "⌘3" },
  { id: "sequence", label: "Sequence", blurb: "Lifelines + animated playback", icon: GitBranch, ready: true, hint: "⌘4" },
  { id: "er", label: "ER diagram", blurb: "Schema + SQL DDL export", icon: Database, ready: true, hint: "⌘5" },
  { id: "uml", label: "UML class", blurb: "Round-trip to TypeScript", icon: Layers, ready: true, hint: "⌘6" },
  { id: "whiteboard", label: "Whiteboard", blurb: "Sketch · sticky · freehand", icon: PenTool, ready: true, hint: "⌘7" },
  { id: "kanban", label: "Kanban", blurb: "Sprint board · WIP limits", icon: ListChecks, ready: true, hint: "⌘8" },
  { id: "c4", label: "C4 / System", blurb: "Context → Container → Component", icon: Cpu, ready: true, hint: "⌘9" },
];

export function ModeTiles() {
  return (
    <section className="py-6">
      <div className="flex items-baseline justify-between mb-4">
        <div>
          <h2 className="text-base font-semibold text-zinc-100">Start fresh</h2>
          <p className="text-xs text-zinc-500 mt-0.5">Pick a diagram type</p>
        </div>
      </div>
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {MODES.map((m, i) => {
          const I = m.icon;
          return (
            <motion.div
              key={m.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: i * 0.03 }}
              whileHover={{ y: -2 }}
              className="group"
            >
              <Link href={`/diagrammatic?mode=${m.id}`} className="block cursor-pointer">
                <div className="relative h-full p-4 rounded-xl border border-slate-800 bg-[#0b1220]/80 transition-all overflow-hidden hover:border-cyan-400/40 hover:bg-slate-900 hover:shadow-[0_10px_30px_-15px_rgba(34,211,238,0.2)]">
                  <div className="relative flex items-start gap-3">
                    <span className="grid place-items-center w-10 h-10 rounded-lg shrink-0 bg-cyan-400 text-slate-950">
                      <I className="w-5 h-5" />
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <h3 className="text-sm font-semibold text-zinc-100 truncate">{m.label}</h3>
                        <span className="rounded bg-cyan-400/15 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-cyan-300">Live</span>
                      </div>
                      <p className="mt-0.5 text-xs text-zinc-500 truncate">{m.blurb}</p>
                    </div>
                    {m.hint && (
                      <kbd className="hidden md:inline-flex items-center px-1.5 py-0.5 text-[10px] font-mono text-zinc-500 bg-zinc-950 border border-zinc-800 rounded shrink-0">
                        {m.hint}
                      </kbd>
                    )}
                  </div>
                </div>
              </Link>
            </motion.div>
          );
        })}
      </div>
    </section>
  );
}
