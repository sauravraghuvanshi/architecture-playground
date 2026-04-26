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
  accent: string;
  ready: boolean;
  hint?: string;
};

const MODES: Mode[] = [
  { id: "architecture", label: "Cloud architecture", blurb: "1,400+ AWS / Azure / GCP icons", icon: Boxes, accent: "from-violet-500 to-fuchsia-500", ready: true, hint: "⌘1" },
  { id: "flowchart", label: "Flowchart", blurb: "BPMN-friendly process flows", icon: Workflow, accent: "from-sky-500 to-cyan-500", ready: false, hint: "⌘2" },
  { id: "mindmap", label: "Mind map", blurb: "Radial brainstorming", icon: Brain, accent: "from-orange-500 to-rose-500", ready: false, hint: "⌘3" },
  { id: "sequence", label: "Sequence", blurb: "Lifelines + GIF playback", icon: GitBranch, accent: "from-emerald-500 to-teal-500", ready: false, hint: "⌘4" },
  { id: "er", label: "ER diagram", blurb: "Schema + SQL DDL export", icon: Database, accent: "from-indigo-500 to-violet-500", ready: false, hint: "⌘5" },
  { id: "uml", label: "UML class", blurb: "Round-trip to TypeScript", icon: Layers, accent: "from-pink-500 to-rose-500", ready: false, hint: "⌘6" },
  { id: "whiteboard", label: "Whiteboard", blurb: "Sketch · sticky · multiplayer", icon: PenTool, accent: "from-amber-500 to-orange-500", ready: false, hint: "⌘7" },
  { id: "kanban", label: "Kanban", blurb: "Sprint board · WIP limits", icon: ListChecks, accent: "from-lime-500 to-green-500", ready: false, hint: "⌘8" },
  { id: "system", label: "C4 / System", blurb: "Context → Container → Component", icon: Cpu, accent: "from-blue-500 to-indigo-500", ready: false, hint: "⌘9" },
];

export function ModeTiles() {
  return (
    <section className="py-6">
      <div className="flex items-baseline justify-between mb-4">
        <div>
          <h2 className="text-base font-bold text-slate-900">Start fresh</h2>
          <p className="text-xs text-slate-500 mt-0.5">Pick a diagram type</p>
        </div>
      </div>
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {MODES.map((m, i) => {
          const I = m.icon;
          const inner = (
            <div className="relative h-full p-4 rounded-xl border border-slate-200 bg-white hover:border-slate-300 hover:shadow-md transition-all overflow-hidden">
              <div
                className={`absolute -top-8 -right-8 w-24 h-24 rounded-full bg-gradient-to-br ${m.accent} opacity-0 group-hover:opacity-15 blur-2xl transition-opacity`}
              />
              <div className="relative flex items-start gap-3">
                <span
                  className={`grid place-items-center w-10 h-10 rounded-lg bg-gradient-to-br ${m.accent} text-white shadow-sm shrink-0`}
                >
                  <I className="w-5 h-5" />
                </span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-semibold text-slate-900 truncate">{m.label}</h3>
                    {!m.ready && <Lock className="w-3 h-3 text-slate-400 shrink-0" />}
                  </div>
                  <p className="mt-0.5 text-xs text-slate-500 truncate">{m.blurb}</p>
                </div>
                {m.hint && (
                  <kbd className="hidden md:inline-flex items-center px-1.5 py-0.5 text-[10px] font-mono text-slate-500 bg-slate-100 rounded shrink-0">
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
