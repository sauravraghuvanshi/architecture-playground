"use client";

import { useMemo, useState } from "react";
import {
  ArrowUpRight,
  CheckCircle2,
  CloudUpload,
  ExternalLink,
  Loader2,
  ShieldCheck,
  TriangleAlert,
  X,
} from "lucide-react";
import type { ArchPayload } from "../modes/architecture/ArchitectureCanvas";
import { generateArmTemplate } from "./architecture-codegen";

interface Props {
  open: boolean;
  payload: ArchPayload;
  onClose: () => void;
}

export function AzureDeployModal({ open, payload, onClose }: Props) {
  const [confirmed, setConfirmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const generated = useMemo(() => generateArmTemplate(payload), [payload]);

  if (!open) return null;

  const openDeployment = async () => {
    setError("");
    const portal = window.open("about:blank", "_blank");
    if (!portal) {
      setError("Allow pop-ups for Diagrammatic, then try again.");
      return;
    }
    portal.opener = null;
    setBusy(true);
    try {
      const response = await fetch("/api/deploy/template", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ payload }),
      });
      const result = (await response.json()) as { portalUrl?: string; error?: string };
      if (!response.ok || !result.portalUrl) {
        throw new Error(result.error ?? `Deployment handoff failed (${response.status}).`);
      }
      portal.location.href = result.portalUrl;
    } catch (deploymentError) {
      portal.close();
      setError(
        deploymentError instanceof Error
          ? deploymentError.message
          : "Unable to open Azure deployment."
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Deploy architecture to Azure"
      className="fixed inset-0 z-[110] flex items-center justify-center bg-slate-950/80 p-5 backdrop-blur-sm"
    >
      <div className="w-[min(42rem,96vw)] overflow-hidden rounded-3xl border border-slate-700 bg-[#08111f] shadow-2xl">
        <header className="flex items-start justify-between border-b border-slate-800 px-5 py-4">
          <div>
            <div className="flex items-center gap-2 text-base font-semibold text-white">
              <CloudUpload className="h-5 w-5 text-sky-300" />
              Deploy architecture to Azure
            </div>
            <p className="mt-1 text-[11px] text-slate-400">
              Secure handoff to Azure Portal Review + Create.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close Azure deployment"
            className="cursor-pointer rounded-lg p-2 text-slate-400 hover:bg-slate-800 hover:text-white"
          >
            <X className="h-4 w-4" />
          </button>
        </header>

        <div className="space-y-4 p-5">
          <section className="grid grid-cols-3 gap-2">
            {[
              ["Mapped services", `${generated.supportedNodes}/${generated.totalServiceNodes}`],
              ["Credential access", "None"],
              ["Template lifetime", "10 minutes"],
            ].map(([label, value]) => (
              <div key={label} className="rounded-xl border border-slate-800 bg-slate-950/60 p-3">
                <p className="text-[9px] uppercase tracking-wide text-slate-500">{label}</p>
                <p className="mt-1 text-xs font-semibold text-white">{value}</p>
              </div>
            ))}
          </section>

          <section className="rounded-2xl border border-sky-400/20 bg-sky-400/5 p-4">
            <h2 className="flex items-center gap-2 text-xs font-semibold text-sky-200">
              <ShieldCheck className="h-4 w-4" />
              Azure remains the control plane
            </h2>
            <ol className="mt-3 space-y-2 text-[10px] leading-relaxed text-slate-300">
              <li className="flex gap-2"><CheckCircle2 className="mt-0.5 h-3 w-3 shrink-0 text-sky-300" />Diagrammatic publishes a random, short-lived ARM template URL.</li>
              <li className="flex gap-2"><CheckCircle2 className="mt-0.5 h-3 w-3 shrink-0 text-sky-300" />Azure Portal handles sign-in, subscription, resource group, parameters, policy, and validation.</li>
              <li className="flex gap-2"><CheckCircle2 className="mt-0.5 h-3 w-3 shrink-0 text-sky-300" />You review the What-If-equivalent deployment summary and select Create in Azure Portal.</li>
            </ol>
          </section>

          {generated.warnings.length > 0 && (
            <section className="rounded-2xl border border-amber-400/20 bg-amber-400/5 p-3">
              <h2 className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wide text-amber-300">
                <TriangleAlert className="h-3.5 w-3.5" />
                Coverage warnings
              </h2>
              <ul className="mt-2 space-y-1 text-[10px] leading-relaxed text-amber-100">
                {generated.warnings.map((warning) => <li key={warning}>• {warning}</li>)}
              </ul>
            </section>
          )}

          <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-slate-700 bg-slate-950/60 p-3">
            <input
              type="checkbox"
              checked={confirmed}
              onChange={(event) => setConfirmed(event.target.checked)}
              className="mt-0.5 accent-sky-400"
            />
            <span className="text-[10px] leading-relaxed text-slate-300">
              I reviewed the generated code and warnings. I understand this opens Azure Portal
              for final parameter, policy, cost, and deployment confirmation.
            </span>
          </label>

          {error && (
            <p role="alert" className="rounded-xl border border-rose-400/20 bg-rose-400/5 p-3 text-[10px] text-rose-100">
              {error}
            </p>
          )}
        </div>

        <footer className="flex items-center justify-between border-t border-slate-800 px-5 py-4">
          <a
            href="https://learn.microsoft.com/azure/azure-resource-manager/templates/deploy-to-azure-button"
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 text-[9px] font-semibold text-slate-500 hover:text-sky-300"
          >
            How Deploy to Azure works
            <ArrowUpRight className="h-3 w-3" />
          </a>
          <button
            type="button"
            onClick={openDeployment}
            disabled={!confirmed || busy || generated.supportedNodes === 0}
            className="inline-flex cursor-pointer items-center gap-2 rounded-xl bg-sky-400 px-4 py-2.5 text-[11px] font-bold text-slate-950 hover:bg-sky-300 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <ExternalLink className="h-4 w-4" />}
            {busy ? "Preparing Azure Portal" : "Open Azure Review + Create"}
          </button>
        </footer>
      </div>
    </div>
  );
}
