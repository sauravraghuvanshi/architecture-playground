"use client";

import { useEffect, useRef, useState } from "react";
import { Loader2, ScanLine, X } from "lucide-react";
import type { ArchPayload } from "../modes/architecture/ArchitectureCanvas";
import { ARCHITECTURE_IMAGE_MAX_BYTES } from "@/lib/architecture-review";
import { conversionSourceSchema, parseWhiteboardConversionResponse, type ConversionIcon, type ConversionSourceNode, type WhiteboardConversion } from "@/lib/whiteboard-conversion";
import { AiPrivacyNotice } from "./AiPrivacyNotice";

export interface WhiteboardConvertModalProps {
  open: boolean;
  onClose: () => void;
  onResult: (payload: ArchPayload) => void | Promise<void>;
  getImage: () => Promise<Blob>;
  icons: readonly ConversionIcon[];
  getSourceNodes?: () => ConversionSourceNode[];
}

function readPng(blob: Blob, signal: AbortSignal): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    const abort = () => reader.abort();
    const cleanup = () => signal.removeEventListener("abort", abort);
    reader.onload = () => {
      cleanup();
      if (typeof reader.result === "string") resolve(reader.result);
      else reject(new Error("Whiteboard export could not be read."));
    };
    reader.onerror = () => { cleanup(); reject(new Error("Whiteboard export could not be read.")); };
    reader.onabort = () => { cleanup(); reject(new DOMException("Cancelled", "AbortError")); };
    signal.throwIfAborted();
    signal.addEventListener("abort", abort, { once: true });
    reader.readAsDataURL(blob);
  });
}

export default function WhiteboardConvertModal(props: WhiteboardConvertModalProps) {
  return props.open ? <ConversionDialog {...props} /> : null;
}

function ConversionDialog({ onClose, onResult, getImage, icons, getSourceNodes }: WhiteboardConvertModalProps) {
  const [busy, setBusy] = useState(false);
  const [applying, setApplying] = useState(false);
  const [error, setError] = useState("");
  const [preview, setPreview] = useState<WhiteboardConversion | null>(null);
  const [consent, setConsent] = useState(false);
  const controller = useRef<AbortController | null>(null);
  const dialog = useRef<HTMLDivElement>(null);
  const closeButton = useRef<HTMLButtonElement>(null);
  const closeRef = useRef(onClose);
  const committing = useRef(false);
  const mounted = useRef(true);
  useEffect(() => { closeRef.current = onClose; }, [onClose]);

  function cancel() {
    if (committing.current) return;
    controller.current?.abort();
    controller.current = null;
    onClose();
  }

  useEffect(() => {
    mounted.current = true;
    const previousFocus = document.activeElement;
    closeButton.current?.focus();
    const keydown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        if (committing.current) return;
        controller.current?.abort();
        controller.current = null;
        closeRef.current();
      }
      if (event.key === "Tab") {
        const elements = dialog.current?.querySelectorAll<HTMLElement>("button:not(:disabled), input:not(:disabled), [tabindex='0']");
        if (!elements?.length) return;
        const first = elements[0];
        const last = elements[elements.length - 1];
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
      }
    };
    document.addEventListener("keydown", keydown);
    return () => {
      mounted.current = false;
      controller.current?.abort();
      controller.current = null;
      document.removeEventListener("keydown", keydown);
      if (previousFocus instanceof HTMLElement && previousFocus.isConnected) previousFocus.focus();
    };
  }, []);

  async function analyze() {
    if (committing.current) return;
    controller.current?.abort();
    const run = new AbortController();
    controller.current = run;
    setBusy(true);
    setError("");
    setPreview(null);
    setConsent(false);
    try {
      const sourceNodes = conversionSourceSchema.parse(getSourceNodes?.() ?? []);
      const blob = await getImage();
      run.signal.throwIfAborted();
      if (blob.type !== "image/png" || blob.size === 0 || blob.size > ARCHITECTURE_IMAGE_MAX_BYTES) {
        throw new Error("Whiteboard export must be a non-empty PNG no larger than 5 MiB. Reduce the drawing area and retry.");
      }
      const dataUrl = await readPng(blob, run.signal);
      run.signal.throwIfAborted();
      const response = await fetch("/api/ai/convert", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image: { name: "whiteboard.png", mimeType: "image/png", dataUrl }, sourceNodes }),
        signal: run.signal,
        cache: "no-store",
      });
      if (!response.ok) {
        throw new Error(response.status === 429
          ? "Rate limit exceeded. Wait a minute before retrying."
          : response.status === 503
            ? "Configure an Azure OpenAI vision-capable chat deployment to convert Whiteboard."
            : "Conversion failed or returned an invalid diagram. Clarify the drawing and retry. Nothing was changed.");
      }
      const result: unknown = await response.json();
      const validated = parseWhiteboardConversionResponse(result, icons);
      if (!run.signal.aborted && controller.current === run) setPreview(validated);
    } catch (failure) {
      if (!run.signal.aborted && controller.current === run) {
        setError(failure instanceof Error && !("issues" in failure)
          ? failure.message : "Conversion returned an invalid architecture. Nothing was changed.");
      }
    } finally {
      if (controller.current === run) { controller.current = null; setBusy(false); }
    }
  }

  async function apply() {
    if (!preview || !consent || busy || committing.current) return;
    committing.current = true;
    setApplying(true);
    setError("");
    try {
      await onResult(preview.payload);
      if (mounted.current) onClose();
    } catch (cause) {
      if (mounted.current) setError(cause instanceof Error ? cause.message : "The architecture document could not be created. Your Whiteboard is unchanged.");
    } finally {
      committing.current = false;
      if (mounted.current) setApplying(false);
    }
  }

  const groups = preview?.payload.nodes.filter((node) => node.kind === "group").length ?? 0;
  const iconCount = preview?.payload.nodes.filter((node) => node.kind !== "shape" && node.kind !== "group").length ?? 0;
  const labels = new Map(preview?.payload.nodes.map((node) => [node.id, node.label]));

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 p-4" onMouseDown={(event) => { if (event.target === event.currentTarget) cancel(); }}>
      <div ref={dialog} role="dialog" aria-modal="true" aria-labelledby="whiteboard-convert-title" className="flex max-h-[90vh] w-full max-w-2xl flex-col rounded-2xl border border-cyan-400/25 bg-[#0b1424] text-slate-100 shadow-2xl">
        <header className="flex items-center justify-between border-b border-white/10 p-5">
          <h2 id="whiteboard-convert-title" className="flex items-center gap-2 font-semibold"><ScanLine size={20} className="text-cyan-300" />Convert Whiteboard to architecture</h2>
          <button ref={closeButton} onClick={cancel} disabled={applying} aria-label="Close conversion" className="rounded p-2 text-slate-400 hover:bg-white/10 disabled:opacity-40"><X size={18} /></button>
        </header>
        <div className="space-y-4 overflow-y-auto p-5">
          <AiPrivacyNotice capability="chat" />
          <p className="text-sm text-slate-300">Analyze the current Whiteboard as a PNG using your configured Azure OpenAI vision deployment. Explicit service identities, when available, accompany the image so renamed services keep their official icons. Unknown services remain generic shapes. The conversion does not save the image to files, browser storage, or application logs. Your original Whiteboard is unchanged.</p>
          <p className="text-xs text-slate-400">Only send content you are authorized to process. The configured Azure service&apos;s data handling policies apply. AI may miss or misread evidence; check every component and connection before creating a document.</p>
          <p role="note" aria-label="Conversion document behavior" className="rounded-lg border border-cyan-300/25 bg-cyan-300/10 p-3 text-sm text-cyan-100">Creates a separate architecture document, not a replacement or merge. Your Whiteboard and any existing architecture are preserved in My diagrams. Analysis can be cancelled; once you choose Create, saving must finish before closing.</p>
          {busy && <p role="status" className="flex items-center gap-2 text-sm text-cyan-300"><Loader2 size={16} className="animate-spin" />Analyzing visible diagram evidence...</p>}
          {applying && <p role="status" className="flex items-center gap-2 text-sm text-cyan-300"><Loader2 size={16} className="animate-spin" />Saving the new architecture document. Please wait; this committed action cannot be cancelled.</p>}
          {error && <p role="alert" className="rounded-lg border border-red-400/25 bg-red-400/10 p-3 text-sm text-red-200">{error}</p>}
          {preview && <section aria-label="Conversion preview" className="space-y-3">
            <h3 className="font-semibold text-cyan-200">Architecture preview</h3>
            <p className="text-sm">{preview.payload.nodes.length} nodes: {iconCount} service icons, {groups} groups, {preview.payload.nodes.length - iconCount - groups} generic shapes. {preview.payload.edges.length} connections.</p>
            <ul className="max-h-44 space-y-1 overflow-auto rounded-lg bg-black/20 p-3 text-sm" aria-label="Preview components">
              {preview.payload.nodes.map((node) => <li key={node.id}>
                <span className="font-medium">{node.label}</span> <span className="text-slate-400">({node.kind ?? "icon"}{"iconId" in node ? `: ${node.iconId}` : ""})</span>
                {"parentId" in node && node.parentId && <span className="text-slate-400"> in {labels.get(node.parentId)}</span>}
                {"subtitle" in node && node.subtitle && <span className="block text-xs text-slate-400">{node.subtitle}</span>}
              </li>)}
            </ul>
            <ul className="max-h-36 space-y-1 overflow-auto text-sm text-slate-300" aria-label="Preview connections">
              {preview.payload.edges.map((edge) => <li key={edge.id}>{labels.get(edge.source)} &rarr; {labels.get(edge.target)}{edge.label ? `: ${edge.label}` : ""}{edge.style ? ` (${edge.style})` : ""}{edge.step ? ` [step ${edge.step}]` : ""}</li>)}
            </ul>
            {preview.warnings.length > 0 && <div className="rounded-lg border border-amber-300/20 bg-amber-300/5 p-3 text-sm text-amber-100">
              <h4 className="font-semibold">Uncertainties to verify</h4>
              <ul className="max-h-32 list-inside list-disc overflow-auto">{preview.warnings.map((warning, index) => <li key={index}>{warning}</li>)}</ul>
            </div>}
            <label className="flex items-start gap-3 rounded-lg border border-cyan-300/20 p-3 text-sm">
              <input type="checkbox" checked={consent} disabled={applying} onChange={(event) => setConsent(event.target.checked)} className="mt-1 accent-cyan-400" />
              I reviewed this preview and agree to create a separate architecture document. My existing diagrams will be preserved.
            </label>
          </section>}
        </div>
        <footer className="flex justify-end gap-2 border-t border-white/10 p-4">
          <button onClick={cancel} disabled={applying} className="rounded-lg px-4 py-2 text-sm text-slate-300 hover:bg-white/10 disabled:opacity-40">Cancel</button>
          <button onClick={analyze} disabled={busy || applying} className="rounded-lg border border-cyan-300/30 px-4 py-2 text-sm text-cyan-200 disabled:opacity-40">{preview ? "Analyze again" : "Analyze Whiteboard"}</button>
          {preview && <button onClick={apply} disabled={!consent || busy || applying} className="rounded-lg bg-cyan-300 px-4 py-2 text-sm font-semibold text-slate-950 disabled:opacity-40">Create architecture document</button>}
        </footer>
      </div>
    </div>
  );
}
