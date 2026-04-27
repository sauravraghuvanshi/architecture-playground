"use client";

/**
 * Client-side template gallery: search, filter, parameterize, then "Use this
 * template" → resolves with current parameter overrides and stows the graph
 * in sessionStorage under TEMPLATE_HANDOFF_KEY before navigating to /.
 */
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  resolveTemplate,
  type ParameterizedTemplate,
  type ParameterValue,
} from "@/components/playground/lib/template-engine";

export const TEMPLATE_HANDOFF_KEY = "architecture-playground:template-handoff";

interface Props {
  templates: ParameterizedTemplate[];
}

export function TemplateGalleryClient({ templates }: Props) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [provider, setProvider] = useState<string>("all");
  const [category, setCategory] = useState<string>("all");
  const [difficulty, setDifficulty] = useState<string>("all");
  const [active, setActive] = useState<ParameterizedTemplate | null>(null);
  const [paramValues, setParamValues] = useState<Record<string, ParameterValue>>({});

  const categories = useMemo(() => {
    const set = new Set<string>();
    for (const t of templates) if (t.category) set.add(t.category);
    return ["all", ...Array.from(set).sort()];
  }, [templates]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return templates.filter((t) => {
      if (provider !== "all" && t.cloud !== provider) return false;
      if (category !== "all" && t.category !== category) return false;
      if (difficulty !== "all" && t.difficulty !== difficulty) return false;
      if (!q) return true;
      const hay = [t.name, t.description, t.category, ...(t.tags ?? [])]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return hay.includes(q);
    });
  }, [templates, query, provider, category, difficulty]);

  function openPreview(t: ParameterizedTemplate) {
    setActive(t);
    const defaults: Record<string, ParameterValue> = {};
    for (const p of t.parameters ?? []) defaults[p.id] = p.default;
    setParamValues(defaults);
  }

  function handoffAndGo(t: ParameterizedTemplate, values: Record<string, ParameterValue>) {
    const graph = resolveTemplate(t, values);
    // Use localStorage with a unique handoff key (cross-tab safe) and open in
    // a NEW tab so the user's existing canvas in the original tab is preserved.
    const handoffId = `tpl_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
    localStorage.setItem(
      `${TEMPLATE_HANDOFF_KEY}:${handoffId}`,
      JSON.stringify({ id: t.id, name: t.name, graph, savedAt: new Date().toISOString() })
    );
    window.open(`/diagrammatic?templateHandoff=${handoffId}`, "_blank", "noopener");
  }

  return (
    <>
      <div className="mb-6 flex flex-wrap items-center gap-3">
        <input
          type="search"
          placeholder="Search templates…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="min-w-64 flex-1 rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-indigo-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
        />
        <select
          value={provider}
          onChange={(e) => setProvider(e.target.value)}
          className="rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
        >
          <option value="all">All providers</option>
          <option value="azure">Azure</option>
          <option value="aws">AWS</option>
          <option value="gcp">GCP</option>
          <option value="multi">Multi-cloud</option>
        </select>
        <select
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          className="rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
        >
          {categories.map((c) => (
            <option key={c} value={c}>
              {c === "all" ? "All categories" : c}
            </option>
          ))}
        </select>
        <select
          value={difficulty}
          onChange={(e) => setDifficulty(e.target.value)}
          className="rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
        >
          <option value="all">All levels</option>
          <option value="beginner">Beginner</option>
          <option value="intermediate">Intermediate</option>
          <option value="advanced">Advanced</option>
        </select>
      </div>

      {filtered.length === 0 ? (
        <p className="rounded-md border border-dashed border-zinc-300 p-8 text-center text-sm text-zinc-500 dark:border-zinc-700 dark:text-zinc-400">
          No templates match your filters.
        </p>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((t) => (
            <button
              key={t.id}
              onClick={() => openPreview(t)}
              className="group flex flex-col items-start rounded-lg border border-zinc-200 bg-white p-4 text-left transition hover:border-indigo-400 hover:shadow-md dark:border-zinc-800 dark:bg-zinc-900 dark:hover:border-indigo-500"
            >
              <div className="mb-2 flex w-full items-center justify-between gap-2">
                <h3 className="truncate text-base font-semibold text-zinc-900 group-hover:text-indigo-600 dark:text-zinc-100 dark:group-hover:text-indigo-400">
                  {t.name}
                </h3>
                <span className="shrink-0 rounded bg-zinc-100 px-1.5 py-0.5 text-[10px] font-medium uppercase text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400">
                  {t.cloud}
                </span>
              </div>
              <p className="line-clamp-3 text-sm text-zinc-600 dark:text-zinc-400">
                {t.description}
              </p>
              <div className="mt-3 flex flex-wrap gap-1">
                {(t.tags ?? []).slice(0, 4).map((tag) => (
                  <span
                    key={tag}
                    className="rounded bg-indigo-50 px-1.5 py-0.5 text-[10px] font-medium text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300"
                  >
                    {tag}
                  </span>
                ))}
                {t.difficulty && (
                  <span className="rounded bg-amber-50 px-1.5 py-0.5 text-[10px] font-medium text-amber-700 dark:bg-amber-900/30 dark:text-amber-300">
                    {t.difficulty}
                  </span>
                )}
              </div>
              <div className="mt-3 text-[11px] text-zinc-500 dark:text-zinc-500">
                {t.graph.nodes.length} nodes · {t.graph.edges.length} edges
                {t.parameters?.length ? ` · ${t.parameters.length} params` : ""}
              </div>
            </button>
          ))}
        </div>
      )}

      {active && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-950/60 p-4"
          onClick={() => setActive(null)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-lg rounded-lg border border-zinc-200 bg-white p-6 shadow-xl dark:border-zinc-800 dark:bg-zinc-900"
          >
            <div className="mb-2 flex items-start justify-between gap-3">
              <h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-100">{active.name}</h2>
              <button
                onClick={() => setActive(null)}
                aria-label="Close"
                className="text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100"
              >
                ✕
              </button>
            </div>
            <p className="mb-4 text-sm text-zinc-600 dark:text-zinc-400">{active.description}</p>

            {(active.parameters ?? []).length > 0 && (
              <div className="mb-4 space-y-3 rounded-md border border-zinc-200 p-3 dark:border-zinc-800">
                <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                  Customize
                </p>
                {(active.parameters ?? []).map((p) => (
                  <label key={p.id} className="block text-sm">
                    <span className="mb-1 block text-zinc-700 dark:text-zinc-300">{p.label}</span>
                    {p.type === "boolean" ? (
                      <input
                        type="checkbox"
                        checked={!!paramValues[p.id]}
                        onChange={(e) => setParamValues((v) => ({ ...v, [p.id]: e.target.checked }))}
                      />
                    ) : p.type === "enum" && p.choices ? (
                      <select
                        value={String(paramValues[p.id] ?? p.default)}
                        onChange={(e) => {
                          const raw = e.target.value;
                          const original = p.choices?.find((c) => String(c.value) === raw)?.value ?? raw;
                          setParamValues((v) => ({ ...v, [p.id]: original }));
                        }}
                        className="w-full rounded border border-zinc-300 bg-white px-2 py-1 dark:border-zinc-700 dark:bg-zinc-800"
                      >
                        {p.choices.map((c) => (
                          <option key={String(c.value)} value={String(c.value)}>
                            {c.label}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <input
                        type="number"
                        value={Number(paramValues[p.id] ?? p.default)}
                        min={p.min}
                        max={p.max}
                        onChange={(e) => setParamValues((v) => ({ ...v, [p.id]: Number(e.target.value) }))}
                        className="w-full rounded border border-zinc-300 bg-white px-2 py-1 dark:border-zinc-700 dark:bg-zinc-800"
                      />
                    )}
                    {p.description && (
                      <span className="mt-1 block text-xs text-zinc-500">{p.description}</span>
                    )}
                  </label>
                ))}
              </div>
            )}

            <div className="flex justify-end gap-2">
              <button
                onClick={() => setActive(null)}
                className="rounded-md border border-zinc-300 px-3 py-1.5 text-sm text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
              >
                Cancel
              </button>
              <button
                onClick={() => handoffAndGo(active, paramValues)}
                className="rounded-md bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-indigo-500"
              >
                Use this template
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
