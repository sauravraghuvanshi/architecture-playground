"use client";

import { useMemo, useState } from "react";
import { Check, Code2, Copy, Download, TriangleAlert, X } from "lucide-react";
import type { ArchPayload } from "../modes/architecture/ArchitectureCanvas";
import {
  generateArchitectureCode,
  type ArchitectureCodeFormat,
} from "./architecture-codegen";

interface Props {
  open: boolean;
  payload: ArchPayload;
  onClose: () => void;
}

const FORMATS: Array<{ id: ArchitectureCodeFormat; label: string }> = [
  { id: "bicep", label: "Bicep" },
  { id: "terraform", label: "Terraform" },
  { id: "azure-cli", label: "Azure CLI" },
  { id: "powershell", label: "PowerShell" },
];

export function ArchitectureCodeModal({ open, payload, onClose }: Props) {
  const [format, setFormat] = useState<ArchitectureCodeFormat>("bicep");
  const [copied, setCopied] = useState(false);
  const result = useMemo(
    () => generateArchitectureCode(payload, format),
    [format, payload]
  );

  if (!open) return null;

  const copy = async () => {
    await navigator.clipboard.writeText(result.output);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1500);
  };

  const download = () => {
    const blob = new Blob([result.output], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = result.filename;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Architecture to code"
      className="fixed inset-0 z-[110] flex items-center justify-center bg-slate-950/80 p-5 backdrop-blur-sm"
    >
      <div className="flex h-[min(48rem,90vh)] w-[min(70rem,96vw)] flex-col overflow-hidden rounded-3xl border border-slate-700 bg-[#08111f] shadow-2xl">
        <header className="flex items-start justify-between border-b border-slate-800 px-5 py-4">
          <div>
            <div className="flex items-center gap-2 text-base font-semibold text-white">
              <Code2 className="h-5 w-5 text-cyan-300" />
              Architecture to code
            </div>
            <p className="mt-1 text-[11px] text-slate-400">
              Secure starter infrastructure generated from supported Azure service nodes.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close architecture to code"
            className="cursor-pointer rounded-lg p-2 text-slate-400 hover:bg-slate-800 hover:text-white"
          >
            <X className="h-4 w-4" />
          </button>
        </header>

        <div className="flex items-center justify-between gap-4 border-b border-slate-800 px-5 py-3">
          <div className="flex rounded-xl border border-slate-700 bg-slate-950 p-1">
            {FORMATS.map((option) => (
              <button
                key={option.id}
                type="button"
                onClick={() => setFormat(option.id)}
                aria-pressed={format === option.id}
                className={`cursor-pointer rounded-lg px-3 py-1.5 text-[10px] font-semibold ${
                  format === option.id
                    ? "bg-cyan-400 text-slate-950"
                    : "text-slate-400 hover:bg-slate-800 hover:text-white"
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>
          <div className="text-right">
            <p className="text-xs font-semibold text-white">
              {result.supportedNodes}/{result.totalServiceNodes} services mapped
            </p>
            <p className="text-[9px] text-slate-500">{result.filename}</p>
          </div>
        </div>

        <div className="grid min-h-0 flex-1 grid-cols-[minmax(0,1fr)_17rem]">
          <pre
            data-testid="generated-code"
            className="m-0 overflow-auto bg-slate-950 p-5 text-[11px] leading-relaxed text-slate-200"
          >
            <code>{result.output}</code>
          </pre>
          <aside className="overflow-y-auto border-l border-slate-800 p-4">
            <h2 className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-500">
              Generation report
            </h2>
            {result.warnings.length > 0 ? (
              <ul className="mt-3 space-y-2">
                {result.warnings.map((warning) => (
                  <li
                    key={warning}
                    className="flex gap-2 rounded-xl border border-amber-400/20 bg-amber-400/5 p-2.5 text-[10px] leading-relaxed text-amber-100"
                  >
                    <TriangleAlert className="mt-0.5 h-3 w-3 shrink-0 text-amber-300" />
                    {warning}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-3 flex items-center gap-2 text-[10px] text-emerald-300">
                <Check className="h-3.5 w-3.5" />
                All service nodes have mappings.
              </p>
            )}
            <p className="mt-4 text-[9px] leading-relaxed text-slate-500">
              Review names, SKUs, regions, networking, role assignments, diagnostics, policy,
              quotas, and service-specific settings before deployment.
            </p>
          </aside>
        </div>

        <footer className="flex items-center justify-between border-t border-slate-800 px-5 py-3">
          <p className="text-[9px] text-slate-500">
            No credentials are generated or stored.
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={copy}
              className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-slate-700 px-3 py-2 text-[10px] font-semibold text-slate-200 hover:bg-slate-800"
            >
              {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
              {copied ? "Copied" : "Copy"}
            </button>
            <button
              type="button"
              onClick={download}
              className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg bg-cyan-400 px-3 py-2 text-[10px] font-bold text-slate-950 hover:bg-cyan-300"
            >
              <Download className="h-3.5 w-3.5" />
              Download {result.filename}
            </button>
          </div>
        </footer>
      </div>
    </div>
  );
}
