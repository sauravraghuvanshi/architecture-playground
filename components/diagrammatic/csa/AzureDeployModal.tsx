"use client";

import { useEffect, useRef, useState } from "react";
import { CloudUpload, Copy, Download, ExternalLink, Loader2, X } from "lucide-react";
import type { ArchPayload } from "../modes/architecture/ArchitectureCanvas";
import { generateArchitectureCode, generateArmTemplate, type ArchitectureCodeFormat } from "./architecture-codegen";
import { azureOnlyDeploymentPayload, DEPLOYMENT_DISCLAIMER, parseArmTemplate, parseDeploymentDraft, type ArmTemplate } from "@/lib/deployment-assistance";
import { FOUNDRY_PRIVACY_NOTICE } from "@/lib/foundry-contract";

interface Props {
  open: boolean;
  payload: ArchPayload;
  onClose: () => void;
  intent?: "code" | "deploy";
}

interface Preview {
  source: "foundry-agent" | "offline";
  format: ArchitectureCodeFormat;
  code: string;
  armTemplate?: ArmTemplate;
  warnings: string[];
  assumptions: string[];
  filename?: string;
  companionBicep?: string;
}

const FORMATS = [
  { id: "bicep", label: "Bicep", filename: "main.bicep" },
  { id: "terraform", label: "Terraform", filename: "main.tf" },
  { id: "azure-cli", label: "Azure CLI", filename: "deploy.sh" },
  { id: "powershell", label: "PowerShell", filename: "deploy.ps1" },
] as const;

export function AzureDeployModal({ open, ...props }: Props) {
  if (!open) return null;
  return <DeploymentSession key={JSON.stringify(props.payload)} {...props} />;
}

function DeploymentSession({ payload, onClose, intent = "deploy" }: Omit<Props, "open">) {
  const [format, setFormat] = useState<ArchitectureCodeFormat>("bicep");
  const [context, setContext] = useState("");
  const [preview, setPreview] = useState<Preview | null>(null);
  const [confirmed, setConfirmed] = useState(false);
  const [busy, setBusy] = useState<"generate" | "publish" | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [showArm, setShowArm] = useState(false);
  const abort = useRef<AbortController | null>(null);
  const popup = useRef<Window | null>(null);
  useEffect(() => () => {
    abort.current?.abort();
    popup.current?.close();
  }, []);

  const reset = () => {
    abort.current?.abort();
    popup.current?.close();
    popup.current = null;
    abort.current = null;
    setBusy(null);
    setPreview(null);
    setConfirmed(false);
    setError("");
    setNotice("");
    setShowArm(false);
  };

  const generate = async () => {
    reset();
    const controller = new AbortController();
    abort.current = controller;
    setBusy("generate");
    try {
      const response = await fetch("/api/ai/deploy", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ payload, format, context }), signal: controller.signal,
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? `Foundry generation failed (${response.status}).`);
      const parsed = parseDeploymentDraft(result, payload, format);
      if (!controller.signal.aborted) setPreview(parsed);
    } catch (generationError) {
      if (!controller.signal.aborted) setError(generationError instanceof Error ? generationError.message : "Unable to generate deployment code.");
    } finally {
      if (abort.current === controller) { abort.current = null; setBusy(null); }
    }
  };

  const offline = () => {
    reset();
    try {
      const selected = azureOnlyDeploymentPayload(payload);
      const code = generateArchitectureCode(selected.payload, format);
      if (code.supportedNodes === 0) {
        setError(["No supported Azure service identities were found. No draft or deployment artifact was generated.", ...selected.warnings, ...code.warnings].join(" "));
        return;
      }
      const generated = generateArmTemplate(selected.payload);
      let armTemplate: ArmTemplate | undefined;
      const warnings = [...new Set([...selected.warnings, ...code.warnings, ...generated.warnings])];
      if (generated.supportedNodes > 0) {
        try {
          armTemplate = parseArmTemplate(generated.template);
        } catch {
          warnings.push("The offline ARM template is outside the supported safe handoff subset. Code export remains available for manual review; Portal publishing is disabled.");
        }
      }
      setPreview({
        source: "offline", format, code: code.output, armTemplate, warnings,
        filename: code.filename,
        ...(format === "powershell" || format === "azure-cli" ? { companionBicep: generateArchitectureCode(selected.payload, "bicep").output } : {}),
        assumptions: ["Explicitly selected deterministic offline starter mappings. No Foundry agent was called; this is not runtime AI generation."],
      });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Offline generation failed. No artifact was generated.");
    }
  };

  const text = showArm && preview?.armTemplate ? JSON.stringify(preview.armTemplate, null, 2) : preview?.code ?? "";
  const download = (arm = false, companion = false) => {
    if (!preview || (arm && !preview.armTemplate)) return;
    if (companion && !preview.companionBicep) return;
    const content = companion ? preview.companionBicep! : arm ? JSON.stringify(preview.armTemplate, null, 2) : preview.code;
    const url = URL.createObjectURL(new Blob([content], { type: arm ? "application/json" : "text/plain;charset=utf-8" }));
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = companion ? "main.bicep" : arm ? "azuredeploy.json" : preview.filename ?? FORMATS.find((item) => item.id === preview.format)!.filename;
    anchor.click();
    URL.revokeObjectURL(url);
  };
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setNotice("Copied preview.");
    } catch {
      setError("Clipboard access failed. Download the file instead.");
    }
  };

  const publish = async () => {
    if (!confirmed || !preview?.armTemplate || busy) {
      setError("Generate and review an ARM template, then confirm publication before continuing.");
      return;
    }
    const portal = window.open("about:blank", "_blank");
    if (!portal) { setError("Allow pop-ups, or download and upload the template manually."); return; }
    portal.opener = null;
    popup.current = portal;
    const controller = new AbortController();
    abort.current = controller;
    setBusy("publish");
    setError("");
    try {
      const body = preview.source === "foundry-agent"
        ? { source: preview.source, consent: true, armTemplate: preview.armTemplate }
        : { source: preview.source, consent: true, payload };
      const response = await fetch("/api/deploy/template", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body), signal: controller.signal,
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? `Portal handoff failed (${response.status}).`);
      if (typeof result.portalUrl !== "string" || !result.portalUrl.startsWith("https://portal.azure.com/#create/Microsoft.Template/uri/")) {
        throw new Error("The handoff returned an invalid Azure Portal URL.");
      }
      if (controller.signal.aborted) return;
      portal.location.href = result.portalUrl;
      popup.current = null;
      setNotice("Azure Portal opened. Review parameters, policy and cost there; nothing has been deployed. If download fails, use the manual upload steps below.");
    } catch (publishError) {
      portal.close();
      popup.current = null;
      if (!controller.signal.aborted) setError(publishError instanceof Error ? publishError.message : "Portal handoff failed. Use manual upload.");
    } finally {
      if (abort.current === controller) { abort.current = null; setBusy(null); }
    }
  };

  const title = intent === "code" ? "Architecture to code" : "Deploy architecture to Azure";
  return (
    <div role="dialog" aria-modal="true" aria-label={title} className="fixed inset-0 z-[110] flex items-center justify-center bg-slate-950/80 p-5 backdrop-blur-sm">
      <div className="flex max-h-[92vh] w-[min(70rem,96vw)] flex-col overflow-hidden rounded-3xl border border-slate-700 bg-[#08111f] text-slate-200 shadow-2xl">
        <header className="flex items-start justify-between border-b border-slate-800 px-5 py-4">
          <div>
            <h1 className="flex items-center gap-2 text-base font-semibold text-white"><CloudUpload className="h-5 w-5 text-sky-300" />{title}</h1>
            <p className="mt-1 text-xs text-slate-400">Foundry agent generation → preview → optional Azure Portal handoff. No automatic deployment.</p>
          </div>
          <button type="button" onClick={onClose} aria-label={intent === "code" ? "Close architecture to code" : "Close Azure deployment"} className="rounded-lg p-2 hover:bg-slate-800"><X className="h-4 w-4" /></button>
        </header>
        <div className="space-y-4 overflow-y-auto p-5">
          <section className="space-y-3" aria-label="Generate deployment draft">
            <p className="text-xs text-slate-400">{FOUNDRY_PRIVACY_NOTICE}</p>
            <div className="flex flex-wrap gap-2">
              {FORMATS.map((option) => <button key={option.id} type="button" aria-pressed={format === option.id} onClick={() => { reset(); setFormat(option.id); }} className={`rounded-lg border px-3 py-2 text-xs ${format === option.id ? "border-sky-300 text-sky-200" : "border-slate-700"}`}>{option.label}</button>)}
            </div>
            <label className="block text-xs">Deployment constraints (optional)
              <textarea aria-label="Deployment constraints" value={context} maxLength={2000} onChange={(event) => { reset(); setContext(event.target.value); }} placeholder="Region, budget, identity/network requirements, recovery targets. No secrets." className="mt-1 block w-full rounded-lg border border-slate-700 bg-slate-950 p-2" />
            </label>
            <div className="flex flex-wrap gap-3">
              <button type="button" onClick={generate} disabled={!!busy || !payload.nodes.length} className="flex items-center gap-2 rounded-lg bg-sky-400 px-4 py-2 text-xs font-semibold text-slate-950 disabled:opacity-50">{busy === "generate" && <Loader2 className="h-4 w-4 animate-spin" />}Generate with Foundry agent</button>
              <button type="button" onClick={offline} disabled={!!busy} className="rounded-lg border border-slate-600 px-3 py-2 text-xs disabled:opacity-50">Use offline starter export (no AI)</button>
              {busy === "generate" && <button type="button" onClick={() => { reset(); setNotice("Generation cancelled."); }} className="text-xs underline">Cancel generation</button>}
            </div>
          </section>
          {error && <p role="alert" className="rounded-lg border border-rose-500/40 bg-rose-500/10 p-3 text-xs">{error}</p>}
          {notice && <p role="status" className="text-xs text-sky-200">{notice}</p>}
          {preview && <>
            <section aria-label="Deployment preview" className="space-y-3 border-t border-slate-700 pt-4">
              <h2 className="text-sm font-semibold">{preview.source === "foundry-agent" ? "Runtime Foundry agent draft" : "Offline deterministic starter - not AI"}</h2>
              <p className="text-xs text-amber-200">{DEPLOYMENT_DISCLAIMER}</p>
              {preview.source === "offline" && preview.format === "powershell" && (
                <p role="note" className="rounded-lg border border-sky-400/30 bg-sky-400/10 p-3 text-xs">
                  Offline PowerShell preview only. Download preview.ps1 and its companion main.bicep into the same folder and review both.
                  Use an existing resource group and explicitly matching subscription. This script cannot deploy resources;
                  -Confirm authorizes only preview, not deployment. Other formats and Foundry scripts remain unverified drafts.
                </p>
              )}
              {preview.source === "offline" && preview.format === "azure-cli" && (
                <p role="note" className="rounded-lg border border-amber-400/30 bg-amber-400/10 p-3 text-xs">
                  Download deploy.sh and the matching main.bicep together. The CLI script previews by default against an existing group and matching subscription.
                  Running with --deploy is an explicit resource-write action after What-If. PowerShell remains preview-only.
                </p>
              )}
              <div className="flex gap-2">
                <button type="button" aria-pressed={!showArm} onClick={() => setShowArm(false)} className="rounded border border-slate-600 px-3 py-1 text-xs">Generated code</button>
                <button type="button" aria-pressed={showArm} onClick={() => setShowArm(true)} disabled={!preview.armTemplate} className="rounded border border-slate-600 px-3 py-1 text-xs disabled:opacity-50">ARM template for Portal</button>
                <button type="button" onClick={copy} className="ml-auto flex items-center gap-1 text-xs"><Copy className="h-3 w-3" />Copy preview</button>
              </div>
              <pre data-testid={showArm ? "generated-arm-template" : "generated-code"} className="max-h-72 overflow-auto rounded-lg bg-slate-950 p-4 text-[11px]"><code>{text}</code></pre>
              <div className="grid gap-3 sm:grid-cols-2">
                <div><h3 className="text-xs font-semibold">Warnings / validation required</h3><ul className="mt-1 list-inside list-disc space-y-1 text-xs text-amber-100">{preview.warnings.map((value, index) => <li key={index}>{value}</li>)}</ul></div>
                <div><h3 className="text-xs font-semibold">Assumptions</h3><ul className="mt-1 list-inside list-disc space-y-1 text-xs text-slate-300">{preview.assumptions.map((value, index) => <li key={index}>{value}</li>)}</ul></div>
              </div>
              <div className="flex flex-wrap gap-3">
                <button type="button" onClick={() => download()} className="flex items-center gap-1 rounded border border-slate-600 px-3 py-2 text-xs"><Download className="h-3 w-3" />Download code</button>
                {preview.companionBicep && <button type="button" onClick={() => download(false, true)} className="rounded border border-slate-600 px-3 py-2 text-xs">Download companion Bicep</button>}
                <button type="button" onClick={() => download(true)} disabled={!preview.armTemplate} className="rounded border border-slate-600 px-3 py-2 text-xs disabled:opacity-50">Download ARM template</button>
              </div>
            </section>
            <section aria-label="Azure Portal handoff" className="space-y-3 border-t border-slate-700 pt-4">
              <h2 className="text-sm font-semibold">Optional Azure upload</h2>
              <p className="text-xs text-slate-400">Portal must reach this app over public HTTPS. App Service Easy Auth, private networking, restarts or multiple app instances can prevent token-link downloads even when application CORS is correct.</p>
              <label className="flex items-start gap-2 text-xs"><input type="checkbox" checked={confirmed} disabled={!preview.armTemplate || !!busy} onChange={(event) => setConfirmed(event.target.checked)} className="mt-0.5 accent-sky-400" /><span>I reviewed the generated code, ARM template and warnings. I consent to publishing the ARM template at a public bearer link for 10 minutes. Anyone with that link can read it. Azure Portal requires my separate final deployment and cost approval.</span></label>
              <button type="button" onClick={publish} disabled={!confirmed || !preview.armTemplate || !!busy} className="flex items-center gap-2 rounded-lg bg-sky-400 px-4 py-2 text-xs font-semibold text-slate-950 disabled:opacity-50">{busy === "publish" ? <Loader2 className="h-4 w-4 animate-spin" /> : <ExternalLink className="h-4 w-4" />}Open Azure Review + Create</button>
              <p className="text-xs text-slate-300">If Portal cannot download the link: download the ARM template above, open <a href="https://portal.azure.com/#create/Microsoft.Template" target="_blank" rel="noreferrer" className="text-sky-300 underline">Deploy a custom template</a>, choose &quot;Build your own template in the editor&quot; → &quot;Load file&quot;, and upload azuredeploy.json. Review parameters, run What-If separately, and approve Create only when ready.</p>
            </section>
          </>}
        </div>
      </div>
    </div>
  );
}
