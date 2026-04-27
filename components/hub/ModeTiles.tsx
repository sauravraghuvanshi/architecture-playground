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
  Lock,
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
  { id: "flowchart", label: "Flowchart", blurb: "BPMN-friendly process flows", icon: Workflow, ready: false, hint: "⌘2" },
  { id: "mindmap", label: "Mind map", blurb: "Radial brainstorming", icon: Brain, ready: false, hint: "⌘3" },
  { id: "sequence", label: "Sequence", blurb: "Lifelines + GIF playback", icon: GitBranch, ready: false, hint: "⌘4" },
  { id: "er", label: "ER diagram", blurb: "Schema + SQL DDL export", icon: Database, ready: false, hint: "⌘5" },
  { id: "uml", label: "UML class", blurb: "Round-trip to TypeScript", icon: Layers, ready: false, hint: "⌘6" },
  { id: "whiteboard", label: "Whiteboard", blurb: "Sketch · sticky · multiplayer", icon: PenTool, ready: false, hint: "⌘7" },
  { id: "kanban", label: "Kanban", blurb: "Sprint board · WIP limits", icon: ListChecks, ready: false, hint: "⌘8" },
  { id: "system", label: "C4 / System", blurb: "Context → Container → Component", icon: Cpu, ready: false, hint: "⌘9" },
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
          const inner = (
            <div
              className={`relative h-full p-4 rounded-xl border bg-zinc-900/60 transition-all overflow-hidden ${
                m.ready
                  ? "border-zinc-800 hover:border-lime-300/40 hover:bg-zinc-900 hover:shadow-[0_10px_30px_-15px_rgba(190,242,100,0.25)]"
                  : "border-zinc-800/60"
              }`}
            >
              <div className="relative flex items-start gap-3">
                <span
                  className={`grid place-items-center w-10 h-10 rounded-lg shrink-0 ${
                    m.ready
                      ? "bg-lime-300 text-zinc-950"
                      : "bg-zinc-800 text-zinc-500"
                  }`}
                >
                  <I className="w-5 h-5" />
                </span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-semibold text-zinc-100 truncate">{m.label}</h3>
                    {!m.ready && <Lock className="w-3 h-3 text-zinc-500 shrink-0" />}
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
          );
          return (
            <motion.div
              key={m.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: i * 0.03 }}
              whileHover={m.ready ? { y: -2 } : undefined}
              className="group"
            >
              {m.ready ? (
                <Link href={`/diagrammatic?mode=${m.id}`} className="block cursor-pointer">{inner}</Link>
              ) : (
                <div className="opacity-60 cursor-not-allowed" title="Coming soon">{inner}</div>
              )}
            </motion.div>
          );
        })}
      </div>
    </section>
  );
}
