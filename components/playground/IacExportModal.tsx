/**
 * Modal for "Export as IaC" — lets the user pick Bicep or Terraform, shows
 * the generated source, lists warnings for unsupported icons, and downloads
 * with a one-click button.
 */
"use client";

import { useMemo, useState } from "react";
import type { PlaygroundGraph } from "./lib/types";
import { emitIac, type IacFramework } from "./lib/export-iac";

interface Props {
  graph: PlaygroundGraph;
  open: boolean;
  onClose: () => void;
}

export function IacExportModal({ graph, open, onClose }: Props) {
  const [framework, setFramework] = useState<IacFramework>("bicep");
  const result = useMemo(() => (open ? emitIac(graph, framework) : null), [open, graph, framework]);

  if (!open || !result) return null;

  const filename = framework === "bicep" ? "main.bicep" : "main.tf";

  function download() {
    if (!result) return;
    const blob = new Blob([result.output], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1500);
  }

  function copy() {
    if (!result) return;
    void navigator.clipboard.writeText(result.output);
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-950/60 p-4"
      onClick={onClose}
    >
      <div
        className="flex h-[80vh] w-full max-w-4xl flex-col overflow-hidden rounded-lg border border-zinc-200 bg-white shadow-xl dark:border-zinc-800 dark:bg-zinc-900"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-zinc-200 px-4 py-3 dark:border-zinc-800">
          <div className="flex items-center gap-3">
            <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">Export as IaC</h2>
            <select
              value={framework}
              onChange={(e) => setFramework(e.target.value as IacFramework)}
              className="rounded-md border border-zinc-300 bg-white px-2 py-1 text-xs dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
            >
              <option value="bicep">Bicep (Azure)</option>
              <option value="terraform">Terraform (Azure)</option>
            </select>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={copy}
              className="rounded border border-zinc-300 px-2 py-1 text-xs hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-800"
            >
              Copy
            </button>
            <button
              onClick={download}
              className="rounded bg-indigo-600 px-2 py-1 text-xs font-medium text-white hover:bg-indigo-500"
            >
              Download {filename}
            </button>
            <button onClick={onClose} aria-label="Close" className="ml-2 text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100">
              ✕
            </button>
          </div>
        </div>

        {result.warnings.length > 0 && (
          <div className="border-b border-amber-200 bg-amber-50 px-4 py-2 text-xs text-amber-900 dark:border-amber-800 dark:bg-amber-900/30 dark:text-amber-200">
            <strong>{result.warnings.length} warning(s):</strong>{" "}
            {result.warnings.slice(0, 3).join(" · ")}
            {result.warnings.length > 3 ? ` …and ${result.warnings.length - 3} more` : ""}
          </div>
        )}

        <pre className="m-0 flex-1 overflow-auto bg-zinc-950 p-4 text-xs leading-relaxed text-zinc-100">
          <code>{result.output}</code>
        </pre>
      </div>
    </div>
  );
}
