/**
 * Palette — searchable, category-grouped icon picker.
 *
 * Two ways to add a service:
 *   - **Drag** onto the canvas — sets `application/x-diagrammatic-icon` on the
 *     dataTransfer; the architecture canvas catches the drop and re-dispatches
 *     a custom event the Workspace listens for.
 *   - **Click** the tile — dispatches a window-level `diagrammatic-add-icon`
 *     event with the icon id; the Workspace forwards it to the canvas's
 *     `addIconAtCenter` imperative method.
 */
"use client";

import { useMemo, useState } from "react";
import {
  Box,
  Circle,
  Database,
  Diamond,
  FileText,
  Globe2,
  Layers3,
  MousePointerClick,
  Search,
  Square,
  UserRound,
} from "lucide-react";
import type { IconLite } from "./types";
import type { ArchShape } from "../modes/architecture/ArchitectureCanvas";

interface Props {
  icons: IconLite[];
}

const PROVIDER_LABELS: Record<string, string> = {
  all: "All",
  azure: "Azure",
  aws: "AWS",
  gcp: "GCP",
};

const PRIMITIVES: Array<{
  shape: ArchShape;
  label: string;
  icon: typeof Box;
}> = [
  { shape: "rectangle", label: "Component", icon: Square },
  { shape: "circle", label: "Circle", icon: Circle },
  { shape: "diamond", label: "Decision", icon: Diamond },
  { shape: "database", label: "Database", icon: Database },
  { shape: "person", label: "Actor", icon: UserRound },
  { shape: "document", label: "Document", icon: FileText },
  { shape: "internet", label: "Internet", icon: Globe2 },
];

export function Palette({ icons }: Props) {
  const [q, setQ] = useState("");
  const [cloud, setCloud] = useState<string>("all");

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return icons.filter((i) => {
      if (cloud !== "all" && i.cloud !== cloud) return false;
      if (!needle) return true;
      return (
        i.label.toLowerCase().includes(needle) ||
        i.category.toLowerCase().includes(needle) ||
        i.id.toLowerCase().includes(needle)
      );
    });
  }, [icons, q, cloud]);

  const grouped = useMemo(() => {
    const m = new Map<string, IconLite[]>();
    for (const i of filtered) {
      const key = `${i.cloudLabel} · ${i.categoryLabel}`;
      const arr = m.get(key);
      if (arr) arr.push(i);
      else m.set(key, [i]);
    }
    return Array.from(m.entries()).slice(0, 60);
  }, [filtered]);

  const clouds = useMemo(() => {
    const set = new Set(icons.map((i) => i.cloud));
    return ["all", ...Array.from(set)];
  }, [icons]);

  const providerCounts = useMemo(
    () =>
      icons.reduce<Record<string, number>>((counts, icon) => {
        counts[icon.cloud] = (counts[icon.cloud] ?? 0) + 1;
        return counts;
      }, {}),
    [icons]
  );

  const addShape = (shape: ArchShape) => {
    window.dispatchEvent(new CustomEvent("diagrammatic-add-shape", { detail: { shape } }));
  };

  return (
    <aside className="flex h-full w-[304px] shrink-0 flex-col border-r border-slate-800 bg-[#0b1220] text-slate-200">
      <div className="border-b border-slate-800 px-4 py-3">
        <div className="mb-3 flex items-center justify-between">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-cyan-400">Asset library</p>
            <h2 className="mt-0.5 text-sm font-semibold text-white">Cloud &amp; primitives</h2>
          </div>
          <span className="rounded-md border border-slate-700 bg-slate-900 px-2 py-1 font-mono text-[10px] text-slate-400">
            {icons.length.toLocaleString()}
          </span>
        </div>
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
          <input
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search services, databases, AI…"
            aria-label="Search cloud services"
            className="w-full rounded-xl border border-slate-700 bg-slate-950/70 py-2.5 pl-9 pr-3 text-xs text-white outline-none placeholder:text-slate-500 focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/10"
          />
        </div>
        <div className="mt-2 grid grid-cols-4 gap-1">
          {clouds.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setCloud(c)}
              className={`cursor-pointer rounded-lg border px-2 py-1.5 text-[10px] font-semibold transition ${
                cloud === c
                  ? "border-cyan-400 bg-cyan-400 text-slate-950"
                  : "border-slate-800 bg-slate-900 text-slate-400 hover:border-slate-700 hover:text-white"
              }`}
            >
              <span>{PROVIDER_LABELS[c] ?? c}</span>
              {c !== "all" && (
                <span className={`ml-1 ${cloud === c ? "text-slate-700" : "text-slate-600"}`}>
                  {providerCounts[c] ?? 0}
                </span>
              )}
            </button>
          ))}
        </div>
        <p className="mt-2 flex items-center gap-1.5 text-[10px] text-slate-500">
          <MousePointerClick className="h-3 w-3" />
          Click to add · drag for precise placement
        </p>
      </div>

      {!q && cloud === "all" && (
        <section className="border-b border-slate-800 px-3 py-3">
          <div className="mb-2 flex items-center gap-2 px-1">
            <Layers3 className="h-3.5 w-3.5 text-cyan-400" />
            <h3 className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-400">Diagram primitives</h3>
          </div>
          <div className="grid grid-cols-4 gap-1.5">
            {PRIMITIVES.map(({ shape, label, icon: Icon }) => (
              <button
                key={shape}
                type="button"
                draggable
                onDragStart={(event) => {
                  event.dataTransfer.setData("application/x-diagrammatic-shape", shape);
                  event.dataTransfer.effectAllowed = "copy";
                }}
                onClick={() => addShape(shape)}
                className="group flex min-h-16 cursor-pointer flex-col items-center justify-center gap-1 rounded-xl border border-slate-800 bg-slate-900/70 p-2 text-slate-400 transition hover:-translate-y-0.5 hover:border-cyan-500/60 hover:bg-slate-900 hover:text-cyan-300"
                title={`Add ${label}`}
              >
                <Icon className="h-5 w-5" strokeWidth={1.6} />
                <span className="text-center text-[9px] font-medium leading-tight">{label}</span>
              </button>
            ))}
          </div>
        </section>
      )}

      <div className="flex-1 overflow-y-auto p-2 [scrollbar-color:#334155_transparent] [scrollbar-width:thin]">
        {grouped.length === 0 && (
          <div className="mx-2 my-8 rounded-xl border border-dashed border-slate-700 px-4 py-6 text-center">
            <Search className="mx-auto mb-2 h-5 w-5 text-slate-600" />
            <p className="text-xs font-medium text-slate-400">No services match &quot;{q}&quot;</p>
            <p className="mt-1 text-[10px] text-slate-600">Try a product family like compute, AI, or storage.</p>
          </div>
        )}
        {grouped.map(([group, list]) => (
          <details key={group} className="group mb-1" open={!!q || grouped.length < 12}>
            <summary className="cursor-pointer rounded-lg px-2 py-2 text-[10px] font-bold uppercase tracking-[0.12em] text-slate-400 hover:bg-slate-900 hover:text-slate-200">
              {group} <span className="font-mono text-slate-600">({list.length})</span>
            </summary>
            <div className="mt-1 grid grid-cols-3 gap-1 px-1 pb-3">
              {list.slice(0, 60).map((icon) => (
                <button
                  key={icon.id}
                  type="button"
                  draggable
                  onDragStart={(e) => {
                    e.dataTransfer.setData("application/x-diagrammatic-icon", icon.id);
                    e.dataTransfer.effectAllowed = "copy";
                  }}
                  onClick={() => {
                    // Click-to-add: surfaces the icon at the canvas center.
                    // Workspace listens at window-level and forwards to the
                    // canvas's `addIconAtCenter` imperative.
                    window.dispatchEvent(
                      new CustomEvent("diagrammatic-add-icon", { detail: { id: icon.id } })
                    );
                  }}
                  className="group/btn flex min-h-[72px] cursor-pointer flex-col items-center justify-center gap-1.5 rounded-xl border border-transparent p-1.5 transition hover:border-cyan-500/40 hover:bg-slate-900"
                  title={`Click to add · drag for placement: ${icon.label}`}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={icon.path}
                    alt=""
                    className="h-8 w-8 object-contain transition-transform group-hover/btn:scale-110"
                    draggable={false}
                  />
                  <span className="line-clamp-2 text-center text-[9px] leading-tight text-slate-500 group-hover/btn:text-slate-200">
                    {icon.label}
                  </span>
                </button>
              ))}
              {list.length > 60 && (
                <p className="col-span-3 px-1 py-1 text-center text-[10px] text-slate-600">
                  +{list.length - 60} more — refine your search
                </p>
              )}
            </div>
          </details>
        ))}
      </div>
    </aside>
  );
}
