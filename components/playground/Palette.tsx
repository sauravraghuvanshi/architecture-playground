/**
 * Palette — redesigned for 1,200+ icons with:
 *   - Global search across ALL providers (no cloud-tab restriction)
 *   - Collapsible provider → category tree with icon count badges
 *   - Cloud tabs for quick filtering (can also show "All")
 *   - Optimized rendering with lazy category expansion
 *   - Group + Sticky note tools
 *   - HTML5 drag AND tap-to-place
 */
"use client";

import Image from "next/image";
import { useCallback, useMemo, useRef, useState } from "react";
import { Search, Box, StickyNote, ChevronDown, ChevronRight, Layers } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import type { CloudId, IconManifestEntry } from "./lib/types";
import { usePlaygroundUI } from "./PlaygroundUIContext";

type FilterCloud = CloudId | "all";

const CLOUDS: { id: FilterCloud; label: string; brand: string }[] = [
  { id: "all", label: "All", brand: "#6366f1" },
  { id: "azure", label: "Azure", brand: "#0078D4" },
  { id: "aws", label: "AWS", brand: "#FF9900" },
  { id: "gcp", label: "GCP", brand: "#4285F4" },
];

interface Props {
  icons: IconManifestEntry[];
}

interface CategoryGroup {
  cloud: CloudId;
  cloudLabel: string;
  category: string;
  categoryLabel: string;
  icons: IconManifestEntry[];
}

export function Palette({ icons }: Props) {
  const [cloud, setCloud] = useState<FilterCloud>("all");
  const [query, setQuery] = useState("");
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());
  const { placementIconId, setPlacementIconId, announce } = usePlaygroundUI();
  const listRef = useRef<HTMLDivElement>(null);

  // Filter icons by cloud tab + search query
  const filtered = useMemo(() => {
    let pool = icons;
    if (cloud !== "all") pool = pool.filter((i) => i.cloud === cloud);

    if (!query.trim()) return pool;
    const q = query.toLowerCase();
    return pool.filter(
      (i) =>
        i.label.toLowerCase().includes(q) ||
        i.slug.toLowerCase().includes(q) ||
        i.categoryLabel.toLowerCase().includes(q) ||
        i.cloudLabel.toLowerCase().includes(q)
    );
  }, [icons, cloud, query]);

  // Group by cloud → category
  const groups = useMemo(() => {
    const map = new Map<string, CategoryGroup>();
    for (const i of filtered) {
      const key = `${i.cloud}/${i.category}`;
      let group = map.get(key);
      if (!group) {
        group = { cloud: i.cloud, cloudLabel: i.cloudLabel, category: i.category, categoryLabel: i.categoryLabel, icons: [] };
        map.set(key, group);
      }
      group.icons.push(i);
    }
    return Array.from(map.values()).sort(
      (a, b) => a.cloudLabel.localeCompare(b.cloudLabel) || a.categoryLabel.localeCompare(b.categoryLabel)
    );
  }, [filtered]);

  // Auto-expand when searching, collapse when not
  const effectiveExpanded = useMemo(() => {
    if (query.trim()) {
      return new Set(groups.map((g) => `${g.cloud}/${g.category}`));
    }
    return expandedCategories;
  }, [query, groups, expandedCategories]);

  const toggleCategory = useCallback((key: string) => {
    setExpandedCategories((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }, []);

  const handleDragStart = useCallback((e: React.DragEvent, payload: object) => {
    e.dataTransfer.setData("application/playground-item", JSON.stringify(payload));
    e.dataTransfer.effectAllowed = "copy";
  }, []);

  const handleSelectForPlacement = useCallback((iconId: string, label: string) => {
    setPlacementIconId(iconId);
    announce(`${label} selected. Tap on the canvas to place. Press Escape to cancel.`);
  }, [setPlacementIconId, announce]);

  // Per-cloud count badges
  const cloudCounts = useMemo(() => {
    const counts: Record<string, number> = { all: icons.length };
    for (const i of icons) counts[i.cloud] = (counts[i.cloud] ?? 0) + 1;
    return counts;
  }, [icons]);

  return (
    <aside className="flex h-full w-72 flex-col border-r border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950">
      {/* Header: tabs + search + tools */}
      <div className="border-b border-zinc-200 p-3 dark:border-zinc-800">
        {/* Cloud filter tabs */}
        <div className="mb-2 flex gap-1" role="tablist" aria-label="Cloud provider filter">
          {CLOUDS.map((c) => (
            <button
              key={c.id}
              role="tab"
              aria-selected={cloud === c.id}
              onClick={() => { setCloud(c.id); setExpandedCategories(new Set()); }}
              className={`flex-1 rounded-md px-1.5 py-1.5 text-[11px] font-medium transition-colors ${
                cloud === c.id
                  ? "text-white shadow-sm"
                  : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-700"
              }`}
              style={cloud === c.id ? { background: c.brand } : undefined}
            >
              {c.label}
              <span className="ml-1 opacity-70">{cloudCounts[c.id] ?? 0}</span>
            </button>
          ))}
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" aria-hidden />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={`Search ${cloud === "all" ? "all" : cloud} services…`}
            aria-label="Search services"
            className="w-full rounded-md border border-zinc-200 bg-zinc-50 py-1.5 pl-8 pr-2 text-xs text-zinc-900 placeholder:text-zinc-400 focus:border-brand-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
          />
        </div>

        {/* Tools: Group + Sticky */}
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

      {/* Icon list — categorized tree */}
      <div ref={listRef} className="flex-1 overflow-y-auto p-2">
        {filtered.length === 0 && (
          <p className="px-2 py-4 text-center text-xs text-zinc-500">No services match.</p>
        )}

        {/* Result count when searching */}
        {query.trim() && filtered.length > 0 && (
          <p className="mb-2 px-2 text-[10px] text-zinc-400">
            {filtered.length} result{filtered.length !== 1 ? "s" : ""}
          </p>
        )}

        {groups.map((group) => {
          const key = `${group.cloud}/${group.category}`;
          const isExpanded = effectiveExpanded.has(key);

          return (
            <section key={key} className="mb-1">
              {/* Category header — click to expand/collapse */}
              <button
                type="button"
                onClick={() => toggleCategory(key)}
                className="flex w-full items-center gap-1.5 rounded-md px-2 py-1.5 text-left hover:bg-zinc-100 dark:hover:bg-zinc-800/60"
              >
                {isExpanded ? (
                  <ChevronDown className="h-3 w-3 flex-shrink-0 text-zinc-400" />
                ) : (
                  <ChevronRight className="h-3 w-3 flex-shrink-0 text-zinc-400" />
                )}
                {cloud === "all" && (
                  <span
                    className="h-2 w-2 flex-shrink-0 rounded-full"
                    style={{ background: CLOUDS.find((c) => c.id === group.cloud)?.brand }}
                  />
                )}
                <Layers className="h-3 w-3 flex-shrink-0 text-zinc-400" />
                <span className="flex-1 truncate text-[11px] font-medium text-zinc-700 dark:text-zinc-300">
                  {group.categoryLabel}
                </span>
                <span className="rounded-full bg-zinc-100 px-1.5 py-0.5 text-[9px] font-medium text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400">
                  {group.icons.length}
                </span>
              </button>

              {/* Icons grid — animated expand/collapse */}
              <AnimatePresence initial={false}>
                {isExpanded && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.2, ease: "easeInOut" }}
                    className="overflow-hidden"
                  >
                    <div className="grid grid-cols-3 gap-1 px-1 py-1">
                      {group.icons.map((i) => {
                        const isPlacing = placementIconId === i.id;
                        return (
                          <button
                            type="button"
                            key={i.id}
                            draggable
                            onDragStart={(e) => handleDragStart(e, { kind: "service", iconId: i.id })}
                            onClick={() => handleSelectForPlacement(i.id, i.label)}
                            title={`${i.label} (${i.cloudLabel})`}
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
                  </motion.div>
                )}
              </AnimatePresence>
            </section>
          );
        })}
      </div>

      {/* Placement mode indicator */}
      <AnimatePresence>
        {placementIconId && (
          <motion.div
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 20, opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="border-t border-brand-200 bg-brand-50 px-3 py-2 text-[11px] text-brand-700 dark:border-brand-800 dark:bg-brand-950/40 dark:text-brand-300"
          >
            Tap canvas to place. <kbd className="rounded border border-current px-1">Esc</kbd> cancels.
          </motion.div>
        )}
      </AnimatePresence>
    </aside>
  );
}
