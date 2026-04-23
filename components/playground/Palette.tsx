/**
 * Palette — searchable, cloud-tabbed catalog of service icons + group/sticky.
 * Items are draggable (HTML5 DnD) AND tappable (placement mode for touch/keyboard).
 */
"use client";

import Image from "next/image";
import { useMemo, useState } from "react";
import { Search, Box, StickyNote } from "lucide-react";
import type { CloudId, IconManifestEntry } from "./lib/types";
import { usePlaygroundUI } from "./PlaygroundUIContext";

const CLOUDS: { id: CloudId; label: string; brand: string }[] = [
  { id: "azure", label: "Azure", brand: "#0078D4" },
  { id: "aws", label: "AWS", brand: "#FF9900" },
  { id: "gcp", label: "Google Cloud", brand: "#4285F4" },
];

interface Props {
  icons: IconManifestEntry[];
}

export function Palette({ icons }: Props) {
  const [cloud, setCloud] = useState<CloudId>("azure");
  const [query, setQuery] = useState("");
  const { placementIconId, setPlacementIconId, announce } = usePlaygroundUI();

  const cloudIcons = useMemo(
    () => icons.filter((i) => i.cloud === cloud),
    [icons, cloud]
  );

  const filtered = useMemo(() => {
    if (!query.trim()) return cloudIcons;
    const q = query.toLowerCase();
    return cloudIcons.filter(
      (i) =>
        i.label.toLowerCase().includes(q) ||
        i.slug.toLowerCase().includes(q) ||
        i.categoryLabel.toLowerCase().includes(q)
    );
  }, [cloudIcons, query]);

  const grouped = useMemo(() => {
    const map = new Map<string, IconManifestEntry[]>();
    for (const i of filtered) {
      const arr = map.get(i.categoryLabel) ?? [];
      arr.push(i);
      map.set(i.categoryLabel, arr);
    }
    return Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  }, [filtered]);

  const handleDragStart = (e: React.DragEvent, payload: object) => {
    e.dataTransfer.setData("application/playground-item", JSON.stringify(payload));
    e.dataTransfer.effectAllowed = "copy";
  };

  const handleSelectForPlacement = (iconId: string, label: string) => {
    setPlacementIconId(iconId);
    announce(`${label} selected. Tap on the canvas to place. Press Escape to cancel.`);
  };

  return (
    <aside className="flex h-full w-72 flex-col border-r border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950">
      <div className="border-b border-zinc-200 p-3 dark:border-zinc-800">
        <div className="mb-2 flex gap-1" role="tablist" aria-label="Cloud provider">
          {CLOUDS.map((c) => (
            <button
              key={c.id}
              role="tab"
              aria-selected={cloud === c.id}
              onClick={() => setCloud(c.id)}
              className={`flex-1 rounded-md px-2 py-1.5 text-xs font-medium transition-colors ${
                cloud === c.id
                  ? "text-white"
                  : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-700"
              }`}
              style={cloud === c.id ? { background: c.brand } : undefined}
            >
              {c.label}
            </button>
          ))}
        </div>
        <div className="relative">
          <Search className="absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" aria-hidden />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search services…"
            aria-label="Search services"
            className="w-full rounded-md border border-zinc-200 bg-zinc-50 py-1.5 pl-8 pr-2 text-xs text-zinc-900 placeholder:text-zinc-400 focus:border-brand-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
          />
        </div>
        <div className="mt-3 flex gap-1.5 text-[10px]">
          <button
            type="button"
            draggable
            onDragStart={(e) => handleDragStart(e, { kind: "group", variant: "vpc" })}
            onClick={() => handleSelectForPlacement("__group__:vpc", "Group container")}
            className="flex flex-1 items-center justify-center gap-1 rounded-md border border-dashed border-sky-400 px-2 py-1.5 text-sky-600 hover:bg-sky-50 dark:hover:bg-sky-950/40"
          >
            <Box className="h-3 w-3" aria-hidden /> Group
          </button>
          <button
            type="button"
            draggable
            onDragStart={(e) => handleDragStart(e, { kind: "sticky" })}
            onClick={() => handleSelectForPlacement("__sticky__", "Sticky note")}
            className="flex flex-1 items-center justify-center gap-1 rounded-md border border-dashed border-amber-400 px-2 py-1.5 text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-950/40"
          >
            <StickyNote className="h-3 w-3" aria-hidden /> Note
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-2">
        {grouped.length === 0 && (
          <p className="px-2 py-4 text-center text-xs text-zinc-500">No services match.</p>
        )}
        {grouped.map(([category, items]) => (
          <section key={category} className="mb-3">
            <h3 className="mb-1 px-2 text-[10px] font-semibold uppercase tracking-wide text-zinc-500">
              {category}
            </h3>
            <div className="grid grid-cols-3 gap-1">
              {items.map((i) => {
                const isPlacing = placementIconId === i.id;
                return (
                  <button
                    type="button"
                    key={i.id}
                    draggable
                    onDragStart={(e) => handleDragStart(e, { kind: "service", iconId: i.id })}
                    onClick={() => handleSelectForPlacement(i.id, i.label)}
                    title={i.label}
                    aria-label={`${i.label} (${i.cloudLabel})`}
                    className={`flex aspect-square cursor-grab flex-col items-center justify-center gap-0.5 rounded-md border bg-zinc-50 p-1 text-[9px] leading-tight text-zinc-700 transition-colors hover:border-brand-400 hover:bg-brand-50 active:cursor-grabbing dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800 ${
                      isPlacing ? "border-brand-500 ring-1 ring-brand-500" : "border-zinc-200 dark:border-zinc-800"
                    }`}
                  >
                    <Image src={i.path} alt="" width={28} height={28} unoptimized className="h-7 w-7" draggable={false} />
                    <span className="line-clamp-2 text-center">{i.label}</span>
                  </button>
                );
              })}
            </div>
          </section>
        ))}
      </div>

      {placementIconId && (
        <div className="border-t border-brand-200 bg-brand-50 px-3 py-2 text-[11px] text-brand-700 dark:border-brand-800 dark:bg-brand-950/40 dark:text-brand-300">
          Tap canvas to place. <kbd className="rounded border border-current px-1">Esc</kbd> cancels.
        </div>
      )}
    </aside>
  );
}
