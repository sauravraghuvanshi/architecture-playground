"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { CloudUpload, Copy, Download, ExternalLink, Loader2, X } from "lucide-react";
import type { ArchPayload } from "../modes/architecture/ArchitectureCanvas";
import { generateArchitectureCode, generateArmTemplate, type ArchitectureCodeFormat } from "./architecture-codegen";
import { azureOnlyDeploymentPayload, DEPLOYMENT_DISCLAIMER, parseArmTemplate, parseDeploymentDraft, type ArmTemplate } from "@/lib/deployment-assistance";
import { FOUNDRY_PRIVACY_NOTICE } from "@/lib/foundry-contract";
import { engineeringValidationSchema, type EngineeringValidation } from "@/lib/engineering-validation-contract";
import type { ArtifactMapping } from "@/lib/engineering-coverage";
import { AiPrivacyNotice } from "../shared/AiPrivacyNotice";
import { AI_LOCAL_CLEAR_NOTICE } from "@/lib/ai-privacy-contract";
import { useDialogFocus } from "../shared/useDialogFocus";
import { deploymentEligibilityMessage, inspectDeploymentEligibility } from "@/lib/deployment-eligibility";

interface Props {
  open: boolean;
  payload: ArchPayload;
  onClose: () => void;
  intent?: "code" | "deploy";
  onCorrectService?: (nodeId: string, iconId: string) => void;
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
  resourceMappings?: ArtifactMapping[];
  validation?: EngineeringValidation;
}

const FORMATS = [
  { id: "bicep", label: "Bicep", filename: "main.bicep" },
  { id: "terraform", label: "Terraform", filename: "main.tf" },
  { id: "azure-cli", label: "Azure CLI", filename: "deploy.sh" },
  { id: "powershell", label: "PowerShell", filename: "deploy.ps1" },
] as const;

export function AzureDeployModal({ open, ...props }: Props) {
  if (!open || typeof document === "undefined") return null;
  return <DeploymentSession key={JSON.stringify(props.payload)} {...props} />;
}

function DeploymentSession({ payload, onClose, intent = "deploy", onCorrectService }: Omit<Props, "open">) {
  const [format, setFormat] = useState<ArchitectureCodeFormat>("bicep");
  const [context, setContext] = useState("");
  const [preview, setPreview] = useState<Preview | null>(null);
  const [confirmed, setConfirmed] = useState(false);
  const [busy, setBusy] = useState<"generate" | "publish" | null>(null);
  const [error, setError] = useState("");
  const [diagnostics, setDiagnostics] = useState<string[]>([]);
  const [notice, setNotice] = useState("");
  const [showArm, setShowArm] = useState(false);
  const abort = useRef<AbortController | null>(null);
  const popup = useRef<Window | null>(null);
  const eligibility = inspectDeploymentEligibility(payload);
  const supportedCount = eligibility.filter((row) => row.kind).length;
  const close = () => {
    abort.current?.abort();
    popup.current?.close();
    onClose();
  };
  const dialog = useDialogFocus({ open: true, onClose: close });
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
    setDiagnostics([]);
    setNotice("");
    setShowArm(false);
  };

  const generate = async () => {
    reset();
    if (!supportedCount) { setError(deploymentEligibilityMessage(payload)); return; }
    const controller = new AbortController();
    abort.current = controller;
    setBusy("generate");
    try {
      const response = await fetch("/api/ai/deploy", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ payload, format, context }), signal: controller.signal,
      });
      const result = await response.json();
      if (controller.signal.aborted || abort.current !== controller) return;
      if (!response.ok) {
        if (Array.isArray(result.diagnostics)) setDiagnostics(result.diagnostics.slice(0, 8).flatMap((item: unknown) =>
          item && typeof item === "object" && "message" in item && typeof item.message === "string" ? [item.message.slice(0, 500)] : []));
        throw new Error(result.error ?? `Foundry generation failed (${response.status}).`);
      }
      const parsed = parseDeploymentDraft(result, payload, format);
      const checked = engineeringValidationSchema.safeParse(result.validation);
      if (!checked.success) throw new Error("The independent validation report is missing or invalid. Refresh and regenerate; no usable draft was accepted.");
      const validation = checked.data;
      if (validation.status === "failed") throw new Error("Artifact validation failed. No usable draft or publication was accepted.");
      if (!controller.signal.aborted) setPreview({ ...parsed, validation });
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
  const downloadValidation = () => {
    if (!preview?.validation) return;
    const url = URL.createObjectURL(new Blob([JSON.stringify(preview.validation, null, 2)], { type: "application/json" }));
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "validation-report.json";
    anchor.click();
    URL.revokeObjectURL(url);
  };
  const publicationAllowed = Boolean(preview?.armTemplate && (preview.source === "offline" || preview.validation?.canPublish));

  const publish = async () => {
    if (!confirmed || !publicationAllowed || !preview?.armTemplate || busy ||
        (preview.source === "foundry-agent" && !preview.resourceMappings)) {
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
        ? { source: preview.source, consent: true, payload, artifact: {
          format: preview.format, code: preview.code, armTemplate: preview.armTemplate, resourceMappings: preview.resourceMappings,
        } }
        : { source: preview.source, consent: true, payload };
      const response = await fetch("/api/deploy/template", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body), signal: controller.signal,
      });
      const result = await response.json();
      if (controller.signal.aborted || abort.current !== controller) return;
      if (!response.ok) {
        const validation = engineeringValidationSchema.safeParse(result.validation);
        if (validation.success) setPreview((current) => current ? { ...current, validation: validation.data } : current);
        throw new Error(result.error ?? `Portal handoff failed (${response.status}).`);
      }
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
  return createPortal(
    <div className="fixed inset-0 z-[110] flex items-center justify-center bg-slate-950/80 p-4 backdrop-blur-sm">
      <div ref={dialog} tabIndex={-1} role="dialog" aria-modal="true" aria-label={title} className="flex max-h-[calc(100dvh-2rem)] w-full max-w-[70rem] flex-col overflow-hidden rounded-3xl border border-slate-700 bg-[#08111f] text-slate-200 shadow-2xl">
        <header className="flex shrink-0 items-start justify-between border-b border-slate-800 px-5 py-4">
          <div>
            <h1 className="flex items-center gap-2 text-base font-semibold text-white"><CloudUpload className="h-5 w-5 text-sky-300" />{title}</h1>
            <p className="mt-1 text-xs text-slate-400">Foundry agent generation → preview → optional Azure Portal handoff. No automatic deployment.</p>
          </div>
          <button type="button" onClick={close} aria-label={intent === "code" ? "Close architecture to code" : "Close Azure deployment"} className="rounded-lg p-2 hover:bg-slate-800"><X className="h-4 w-4" /></button>
        </header>
        <div className="min-h-0 space-y-4 overflow-y-auto p-5">
          <section className="space-y-3" aria-label="Generate deployment draft">
            <p className="text-xs text-slate-400">{FOUNDRY_PRIVACY_NOTICE}</p>
            <AiPrivacyNotice capability="deployment" />
            <div className="text-[10px] text-slate-400">
              <button type="button" onClick={() => { reset(); setContext(""); }} className="mb-1 rounded border border-slate-600 px-2 py-1 text-slate-200">Clear AI session</button>
              <p>{AI_LOCAL_CLEAR_NOTICE}</p>
            </div>
            <section aria-label="Deployment service readiness" className="space-y-2 rounded-lg border border-slate-700 p-3 text-xs">
              <h2 className="font-semibold">Deployment service readiness</h2>
              <p className="text-slate-300">{supportedCount} of {eligibility.length} service icons have supported Azure deployment mappings. Diagram structure checks do not establish deployment coverage.</p>
              {eligibility.filter((row) => !row.kind).map((row) => <div key={row.nodeId} className="rounded border border-amber-400/30 bg-amber-400/5 p-2">
                <p><strong>{row.label}</strong> uses the catalog symbol <strong>{row.catalogLabel}</strong>; it is not mapped to a deployable resource.</p>
                {row.suggested && onCorrectService ? <>
                  <p className="mt-1 text-slate-400">If this component is an App Service application, confirm the service identity. Its name, connections and position are preserved; Undo can revert the correction.</p>
                  <button type="button" disabled={!!busy} className="mt-2 rounded border border-sky-400 px-2 py-1 text-sky-200 disabled:opacity-50"
                    onClick={() => {
                      reset();
                      try { if (row.suggested) onCorrectService(row.nodeId, row.suggested.iconId); }
                      catch (cause) { setError(cause instanceof Error ? cause.message : "The service identity could not be corrected."); }
                    }}>Use {row.suggested.label} for {row.label}</button>
                </> : <p className="mt-1 text-slate-400">This icon can remain in the diagram, but it is omitted or marked unsupported in generated artifacts. Use a supported service icon for deployable resources.</p>}
              </div>)}
              {!supportedCount && <p role="note" className="text-amber-200">{deploymentEligibilityMessage(payload)}</p>}
            </section>
            <div className="flex flex-wrap gap-2">
              {FORMATS.map((option) => <button key={option.id} type="button" aria-pressed={format === option.id} onClick={() => { reset(); setFormat(option.id); }} className={`rounded-lg border px-3 py-2 text-xs ${format === option.id ? "border-sky-300 text-sky-200" : "border-slate-700"}`}>{option.label}</button>)}
            </div>
            <label className="block text-xs">Deployment constraints (optional)
              <textarea aria-label="Deployment constraints" value={context} maxLength={2000} onChange={(event) => { reset(); setContext(event.target.value); }} placeholder="Region, budget, identity/network requirements, recovery targets. No secrets." className="mt-1 block w-full rounded-lg border border-slate-700 bg-slate-950 p-2" />
            </label>
            <div className="flex flex-wrap gap-3">
              <button type="button" onClick={generate} disabled={!!busy || !supportedCount} className="flex items-center gap-2 rounded-lg bg-sky-400 px-4 py-2 text-xs font-semibold text-slate-950 disabled:opacity-50">{busy === "generate" && <Loader2 className="h-4 w-4 animate-spin" />}Generate with Foundry agent</button>
              <button type="button" onClick={offline} disabled={!!busy} className="rounded-lg border border-slate-600 px-3 py-2 text-xs disabled:opacity-50">Use offline starter export (no AI)</button>
              {busy === "generate" && <button type="button" onClick={() => { reset(); setNotice("Generation cancelled."); }} className="text-xs underline">Cancel generation</button>}
            </div>
          </section>
          {error && <p role="alert" className="rounded-lg border border-rose-500/40 bg-rose-500/10 p-3 text-xs">{error}</p>}
          {!!diagnostics.length && <ul aria-label="Artifact validation errors" className="list-inside list-disc space-y-1 text-xs text-rose-200">{diagnostics.map((detail, index) => <li key={index}>{detail}</li>)}</ul>}
          {notice && <p role="status" className="text-xs text-sky-200">{notice}</p>}
          {preview && <>
            <section aria-label="Deployment preview" className="space-y-3 border-t border-slate-700 pt-4">
              <h2 className="text-sm font-semibold">{preview.source === "foundry-agent" ? "Runtime Foundry agent draft" : "Offline deterministic starter - not AI"}</h2>
              <p className="text-xs text-amber-200">{DEPLOYMENT_DISCLAIMER}</p>
              {preview.validation && <section aria-label="Engineering validation report" className="space-y-3 rounded-lg border border-slate-700 p-3">
                <h3 className="text-sm font-semibold">{preview.validation.canPublish ? "Supported static checks passed" : "Review-only draft - checks remain unverified"}</h3>
                <p className="text-xs text-amber-200">{preview.validation.disclaimer}</p>
                <p className="text-[10px] text-slate-400">Profile {preview.validation.profile} · Parser {preview.validation.parser.name} {preview.validation.parser.version} · Artifact {preview.validation.artifactHash.slice(0, 12)}</p>
                <ul className="space-y-2 text-xs">{preview.validation.checks.map((check) => <li key={check.id}>
                  <strong className={check.status === "passed" ? "text-emerald-300" : check.status === "failed" ? "text-rose-300" : "text-amber-200"}>{check.id}: {check.status}</strong>
                  <p className="text-slate-300">{check.summary}</p>
                  {!!check.details.length && <details className="mt-1 text-slate-400"><summary className="cursor-pointer">Details</summary><ul className="ml-4 list-disc">{check.details.map((detail, index) => <li key={index}>{detail}</li>)}</ul></details>}
                </li>)}</ul>
                <div className="max-h-48 overflow-auto">
                  <table className="w-full text-left text-[11px]"><caption className="pb-2 text-left font-semibold">Diagram-to-resource coverage</caption>
                    <thead><tr><th className="p-1">Component</th><th className="p-1">Coverage</th><th className="p-1">Declared resources / limitation</th></tr></thead>
                    <tbody>{preview.validation.coverage.map((row) => <tr key={row.nodeId} className="border-t border-slate-800">
                      <td className="p-1 align-top">{row.label || row.nodeId}</td><td className="p-1 align-top">{row.status}</td>
                      <td className="p-1 align-top"><p>{row.resourceTypes.join(", ")}</p><p className="text-slate-400">{row.reason}</p></td>
                    </tr>)}</tbody>
                  </table>
                </div>
                <button type="button" onClick={downloadValidation} className="rounded border border-slate-600 px-3 py-2 text-xs">Download validation report</button>
              </section>}
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
              <div className="flex flex-wrap gap-2">
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
              {!publicationAllowed && <p className="text-xs text-amber-200">Automatic Portal handoff is disabled until the supported static checks pass. Download is for independent engineering review, not deployment approval.</p>}
              <label className="flex items-start gap-2 text-xs"><input type="checkbox" checked={confirmed} disabled={!publicationAllowed || !!busy} onChange={(event) => setConfirmed(event.target.checked)} className="mt-0.5 accent-sky-400" /><span>I reviewed the generated code, ARM template and warnings. I consent to publishing the ARM template at a public bearer link for 10 minutes. Anyone with that link can read it. Azure Portal requires my separate final deployment and cost approval.</span></label>
              <button type="button" onClick={publish} disabled={!confirmed || !publicationAllowed || !!busy} className="flex items-center gap-2 rounded-lg bg-sky-400 px-4 py-2 text-xs font-semibold text-slate-950 disabled:opacity-50">{busy === "publish" ? <Loader2 className="h-4 w-4 animate-spin" /> : <ExternalLink className="h-4 w-4" />}Open Azure Review + Create</button>
              <p className="text-xs text-slate-300">If Portal cannot download the link: download the ARM template above, open <a href="https://portal.azure.com/#create/Microsoft.Template" target="_blank" rel="noreferrer" className="text-sky-300 underline">Deploy a custom template</a>, choose &quot;Build your own template in the editor&quot; → &quot;Load file&quot;, and upload azuredeploy.json. Review parameters, run What-If separately, and approve Create only when ready.</p>
            </section>
          </>}
        </div>
      </div>
    </div>,
    document.body
  );
}
