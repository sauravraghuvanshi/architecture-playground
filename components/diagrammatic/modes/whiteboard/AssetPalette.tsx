"use client";

import { useEffect, useMemo, useState } from "react";
import { BadgeCheck, Loader2, Search } from "lucide-react";
import { writeDiagramDrag } from "@/lib/diagram-drag";

export interface WhiteboardAsset {
  id: string;
  label: string;
  category: string;
  tags: string[];
  svg: string;
}

interface AssetManifest {
  count: number;
  license: string;
  source: string;
  assets: WhiteboardAsset[];
}

interface Props {
  onInsert: (asset: WhiteboardAsset) => void;
  insertingId?: string | null;
}

export function WhiteboardAssetPalette({ onInsert, insertingId }: Props) {
  const [manifest, setManifest] = useState<AssetManifest | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("All");

  useEffect(() => {
    let active = true;
    fetch("/whiteboard-assets.json")
      .then((response) => {
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        return response.json() as Promise<AssetManifest>;
      })
      .then((data) => {
        if (active) setManifest(data);
      })
      .catch((reason: unknown) => {
        if (active) {
          setError(reason instanceof Error ? reason.message : "Unable to load symbols");
        }
      });
    return () => {
      active = false;
    };
  }, []);

  const categories = useMemo(
    () => ["All", ...Array.from(new Set(manifest?.assets.map((asset) => asset.category) ?? []))],
    [manifest]
  );
  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return (manifest?.assets ?? [])
      .filter((asset) => category === "All" || asset.category === category)
      .filter(
        (asset) =>
          !needle ||
          asset.label.toLowerCase().includes(needle) ||
          asset.tags.some((tag) => tag.toLowerCase().includes(needle))
      )
      .slice(0, 160);
  }, [category, manifest, query]);

  return (
    <aside className="flex h-full w-[288px] max-w-full shrink-0 flex-col border-r border-slate-800 bg-[#0b1220] text-slate-200">
      <div className="border-b border-slate-800 px-4 py-3">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-cyan-400">
              Whiteboard assets
            </p>
            <h2 className="mt-0.5 text-sm font-semibold text-white">Curated symbols</h2>
          </div>
          <span className="rounded-md border border-slate-700 bg-slate-900 px-2 py-1 font-mono text-[10px] text-slate-400">
            {manifest?.count ?? "—"}
          </span>
        </div>
        <div className="relative mt-3">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search people, systems, arrows…"
            aria-label="Search Whiteboard assets"
            className="w-full rounded-xl border border-slate-700 bg-slate-950/70 py-2.5 pl-9 pr-3 text-xs text-white outline-none placeholder:text-slate-500 focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/10"
          />
        </div>
      </div>

      <div className="border-b border-slate-800 px-3 py-2">
        <select
          value={category}
          onChange={(event) => setCategory(event.target.value)}
          aria-label="Whiteboard asset category"
          className="w-full rounded-lg border border-slate-700 bg-slate-950 px-2.5 py-2 text-[11px] text-slate-300 outline-none focus:border-cyan-500"
        >
          {categories.map((item) => (
            <option key={item}>{item}</option>
          ))}
        </select>
      </div>

      <div className="flex-1 overflow-y-auto p-2 [scrollbar-color:#334155_transparent] [scrollbar-width:thin]">
        {!manifest && !error && (
          <div className="grid h-32 place-items-center text-xs text-slate-500">
            <Loader2 className="h-5 w-5 animate-spin" />
          </div>
        )}
        {error && (
          <div className="m-2 rounded-xl border border-rose-900/60 bg-rose-950/20 p-3 text-xs text-rose-300">
            {error}
          </div>
        )}
        {manifest && filtered.length === 0 && (
          <div className="m-2 rounded-xl border border-dashed border-slate-700 p-6 text-center text-xs text-slate-500">
            No symbols match this search.
          </div>
        )}
        <div className="grid grid-cols-4 gap-1.5">
          {filtered.map((asset) => {
            const inserting = insertingId === asset.id;
            return (
              <button
                key={asset.id}
                type="button"
                draggable
                onDragStart={(event) => {
                  writeDiagramDrag(event.dataTransfer, "whiteboard", JSON.stringify({ svg: asset.svg, label: asset.label }));
                }}
                onClick={() => onInsert(asset)}
                disabled={inserting}
                title={`Click or drag to insert ${asset.label}`}
                className="group flex min-h-[70px] cursor-pointer flex-col items-center justify-center gap-1 rounded-xl border border-transparent bg-slate-900/60 p-1.5 transition hover:-translate-y-0.5 hover:border-cyan-500/50 hover:bg-slate-900 disabled:cursor-wait disabled:opacity-60"
              >
                {inserting ? (
                  <Loader2 className="h-6 w-6 animate-spin text-cyan-300" />
                ) : (
                  // Generated from the local, ISC-licensed Lucide manifest.
                  <span
                    aria-hidden
                    className="grid h-7 w-7 place-items-center [&>svg]:h-6 [&>svg]:w-6 [&>svg]:stroke-slate-300 group-hover:[&>svg]:stroke-cyan-200"
                    dangerouslySetInnerHTML={{ __html: asset.svg }}
                  />
                )}
                <span className="line-clamp-2 text-center text-[8px] leading-tight text-slate-500 group-hover:text-slate-200">
                  {asset.label}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="border-t border-slate-800 px-3 py-2.5">
        <p className="flex items-center gap-1.5 text-[9px] leading-relaxed text-slate-500">
          <BadgeCheck className="h-3 w-3 shrink-0 text-cyan-400" />
          600 bundled Lucide symbols · ISC licensed
        </p>
      </div>
    </aside>
  );
}
