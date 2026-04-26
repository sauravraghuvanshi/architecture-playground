/**
 * Palette — searchable, category-grouped icon picker.
 *
 * Drag-source: each tile sets `application/x-diagrammatic-icon` on the
 * dataTransfer with the icon id. The architecture canvas listens for the
 * matching drop event at the canvas level; the Workspace bridges the two by
 * resolving the id back to an IconLite and calling `canvas.dropIcon(...)`.
 */
"use client";

import { useMemo, useState } from "react";
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
        <input
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search 1,400+ icons…"
          className="w-full rounded-md border border-zinc-800 bg-zinc-900 px-3 py-1.5 text-sm placeholder:text-zinc-500 focus:border-zinc-600 focus:outline-none"
        />
        <div className="flex flex-wrap gap-1">
          {clouds.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setCloud(c)}
              className={`rounded px-2 py-0.5 text-[11px] uppercase tracking-wide transition ${
                cloud === c ? "bg-zinc-100 text-zinc-900" : "bg-zinc-900 text-zinc-400 hover:bg-zinc-800"
              }`}
            >
              {c}
            </button>
          ))}
        </div>
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
                  className="group/btn flex flex-col items-center gap-1 rounded border border-transparent p-1.5 hover:border-zinc-700 hover:bg-zinc-900"
                  title={icon.label}
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
