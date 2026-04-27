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
import { Search, MousePointerClick } from "lucide-react";
import type { IconLite } from "./types";

interface Props {
  icons: IconLite[];
}

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

  return (
    <aside className="flex h-full w-72 flex-col border-r border-zinc-800 bg-zinc-950 text-zinc-200">
      <div className="space-y-2 border-b border-zinc-800 p-3">
        <div className="relative">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-zinc-500" />
          <input
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search 1,400+ icons…"
            className="w-full rounded-md border border-zinc-800 bg-zinc-900 py-1.5 pl-8 pr-3 text-sm placeholder:text-zinc-500 focus:border-zinc-600 focus:outline-none"
          />
        </div>
        <div className="flex flex-wrap gap-1">
          {clouds.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setCloud(c)}
              className={`cursor-pointer rounded px-2 py-0.5 text-[11px] uppercase tracking-wide transition ${
                cloud === c ? "bg-lime-300 text-zinc-900" : "bg-zinc-900 text-zinc-400 hover:bg-zinc-800"
              }`}
            >
              {c}
            </button>
          ))}
        </div>
        <p className="flex items-center gap-1.5 text-[10px] text-zinc-500">
          <MousePointerClick className="h-3 w-3" />
          Click to add at center, or drag onto canvas
        </p>
      </div>
      <div className="flex-1 overflow-y-auto p-2">
        {grouped.length === 0 && (
          <p className="px-2 py-4 text-center text-xs text-zinc-500">No icons match &quot;{q}&quot;.</p>
        )}
        {grouped.map(([group, list]) => (
          <details key={group} className="mb-1 group" open>
            <summary className="cursor-pointer rounded px-2 py-1 text-[11px] font-semibold uppercase tracking-wide text-zinc-400 hover:bg-zinc-900">
              {group} <span className="text-zinc-600">({list.length})</span>
            </summary>
            <div className="mt-1 grid grid-cols-3 gap-1 px-1 pb-2">
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
                  className="group/btn flex cursor-pointer flex-col items-center gap-1 rounded border border-transparent p-1.5 hover:border-lime-300/50 hover:bg-zinc-900"
                  title={`Click to add · drag for placement: ${icon.label}`}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={icon.path}
                    alt=""
                    className="h-8 w-8 object-contain"
                    draggable={false}
                  />
                  <span className="line-clamp-2 text-center text-[9px] leading-tight text-zinc-400 group-hover/btn:text-zinc-200">
                    {icon.label}
                  </span>
                </button>
              ))}
              {list.length > 60 && (
                <p className="col-span-3 px-1 py-1 text-center text-[10px] text-zinc-600">
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

