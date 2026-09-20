"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowUpRight,
  FileJson,
  FileText,
  ImageUp,
  Loader2,
  Network,
  ShieldCheck,
  TriangleAlert,
  X,
} from "lucide-react";
import type { ArchPayload } from "../modes/architecture/ArchitectureCanvas";
import {
  ARCHITECTURE_IMAGE_MAX_BYTES,
  ARCHITECTURE_IMAGE_MIME_TYPES,
  ARCHITECTURE_REVIEW_DISCLAIMER,
  ARCHITECTURE_REVIEW_MAX_REQUEST_BYTES,
  rankArchitectureReviewFindings,
  parseArchitectureReview,
  type ArchitectureReview,
} from "@/lib/architecture-review";
import { WafDiagramScorecard } from "./CsaGuidancePanel";
import { assessDiagramWellArchitected, type WafDiagramAssessment } from "./well-architected";
import { parseArchitectureDocument } from "@/lib/architecture-document";

interface Props {
  open: boolean;
  payload: ArchPayload;
  /** Compatibility name: pass the Foundry review-agent status, never the chat-model status. */
  aiConfigured?: boolean;
  reviewAgentConfigured?: boolean;
  onClose: () => void;
}

type ReviewSource = "canvas" | "description" | "image" | "import";

interface ReviewImage {
  name: string;
  mimeType: (typeof ARCHITECTURE_IMAGE_MIME_TYPES)[number];
  dataUrl: string;
}

const SOURCE_OPTIONS: Array<{ id: ReviewSource; label: string; icon: typeof Network }> = [
  { id: "canvas", label: "Current canvas", icon: Network },
  { id: "description", label: "Describe", icon: FileText },
  { id: "image", label: "Upload diagram", icon: ImageUp },
  { id: "import", label: "Import JSON", icon: FileJson },
];

export function ArchitectureReviewModal({
  open,
  payload,
  aiConfigured = false,
  reviewAgentConfigured = aiConfigured,
  onClose,
}: Props) {
  const [source, setSource] = useState<ReviewSource>("canvas");
  const [description, setDescription] = useState("");
  const [importedPayload, setImportedPayload] = useState<ArchPayload | null>(null);
  const [importName, setImportName] = useState("");
  const [reviewImage, setReviewImage] = useState<ReviewImage | null>(null);
  const [businessContext, setBusinessContext] = useState("");
  const [review, setReview] = useState<ArchitectureReview | null>(null);
  const [reviewPayloadSnapshot, setReviewPayloadSnapshot] = useState<ArchPayload | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [reviewFingerprint, setReviewFingerprint] = useState("");
  const [baselines, setBaselines] = useState<Record<"canvas" | "import", WafDiagramAssessment | null>>({
    canvas: null,
    import: null,
  });
  const requestId = useRef(0);
  const activeRequest = useRef<AbortController | null>(null);
  const evidencePayload = source === "canvas" ? payload : source === "import" ? importedPayload : null;
  const baselineSource = source === "canvas" || source === "import" ? source : null;
  const diagramAssessment = useMemo(
    () => evidencePayload ? assessDiagramWellArchitected(evidencePayload) : null,
    [evidencePayload]
  );
  const evidenceFingerprint = useMemo(() => JSON.stringify({
    source, description, businessContext, image: source === "image" ? reviewImage?.dataUrl : null,
    diagram: evidencePayload,
  }), [source, description, businessContext, reviewImage, evidencePayload]);
  const staleReview = review && reviewFingerprint !== evidenceFingerprint;
  useEffect(() => {
    if (!open) activeRequest.current?.abort();
    return () => activeRequest.current?.abort();
  }, [open]);

  // Capture on first viewing, not while a closed modal's canvas is still hydrating.
  if (open && baselineSource && diagramAssessment && baselines[baselineSource] === null) {
    setBaselines({ ...baselines, [baselineSource]: diagramAssessment });
  }

  if (!open) return null;

  const importJson = async (file: File) => {
    activeRequest.current?.abort();
    requestId.current += 1;
    setBusy(false);
    setReview(null);
    setError("");
    try {
      if (file.size > ARCHITECTURE_REVIEW_MAX_REQUEST_BYTES) throw new Error("Architecture JSON must be 7.2 MB or smaller.");
      const parsed: unknown = JSON.parse(await file.text());
      const candidate = parseArchitectureDocument(
        typeof parsed === "object" && parsed !== null && "payload" in parsed ? parsed.payload : parsed
      );
      setImportedPayload(candidate);
      setImportName(file.name);
    } catch (importError) {
      setImportedPayload(null);
      setImportName("");
      setError(importError instanceof Error ? importError.message : "Unable to import JSON.");
    }
  };

  const importImage = async (file: File) => {
    activeRequest.current?.abort();
    requestId.current += 1;
    setBusy(false);
    setReview(null);
    setError("");
    if (
      !ARCHITECTURE_IMAGE_MIME_TYPES.includes(
        file.type as (typeof ARCHITECTURE_IMAGE_MIME_TYPES)[number]
      )
    ) {
      setReviewImage(null);
      setError("Upload a PNG, JPEG, or WebP architecture diagram.");
      return;
    }
    if (file.size > ARCHITECTURE_IMAGE_MAX_BYTES) {
      setReviewImage(null);
      setError("Architecture images must be 5 MiB or smaller.");
      return;
    }
    try {
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () =>
          typeof reader.result === "string"
            ? resolve(reader.result)
            : reject(new Error("Unable to read image."));
        reader.onerror = () => reject(reader.error ?? new Error("Unable to read image."));
        reader.readAsDataURL(file);
      });
      setReviewImage({
        name: file.name,
        mimeType: file.type as ReviewImage["mimeType"],
        dataUrl,
      });
    } catch (imageError) {
      setReviewImage(null);
      setError(imageError instanceof Error ? imageError.message : "Unable to read image.");
    }
  };

  const submit = async () => {
    const currentRequestId = ++requestId.current;
    setError("");
    setReview(null);
    if (!reviewAgentConfigured) {
      setError("The Foundry review agent is unavailable. Use the offline WAF scorecard while it is configured.");
      return;
    }
    const reviewPayload =
      source === "canvas" ? payload : source === "import" ? importedPayload : undefined;
    if (source === "description" && !description.trim()) {
      setError("Describe the architecture before starting the review.");
      return;
    }
    if (source === "import" && !reviewPayload) {
      setError("Import a Diagrammatic JSON file before starting the review.");
      return;
    }
    if (source === "image" && !reviewImage) {
      setError("Upload an architecture image before starting the review.");
      return;
    }
    if (source === "canvas" && payload.nodes.length === 0) {
      setError("Add architecture services to the canvas before starting the review.");
      return;
    }

    setBusy(true);
    activeRequest.current?.abort();
    const controller = new AbortController();
    activeRequest.current = controller;
    try {
      const response = await fetch("/api/ai/review", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: controller.signal,
        body: JSON.stringify({
          source,
          description: source === "description" ? description.trim() : undefined,
          context: businessContext.trim() || undefined,
          ...(source === "image"
            ? {
                image: reviewImage,
              }
            : {}),
          payload: reviewPayload,
        }),
      });
      const result = (await response.json()) as {
        review?: ArchitectureReview;
        error?: string;
      };
      if (!response.ok || !result.review) {
        throw new Error(result.error ?? `Review failed (${response.status}).`);
      }
      if (requestId.current !== currentRequestId || controller.signal.aborted) return;
      setReview(parseArchitectureReview(JSON.stringify(result.review)));
      setReviewPayloadSnapshot(reviewPayload ?? null);
      setReviewFingerprint(evidenceFingerprint);
    } catch (reviewError) {
      if (requestId.current === currentRequestId && !controller.signal.aborted) {
        setError(reviewError instanceof Error ? reviewError.message : "Architecture review failed.");
      }
    } finally {
      if (requestId.current === currentRequestId) {
        setBusy(false);
        activeRequest.current = null;
      }
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Review my architecture"
      className="fixed inset-0 z-[110] flex items-center justify-center bg-slate-950/80 p-5 backdrop-blur-sm"
    >
      <div className="flex h-[min(52rem,92vh)] w-[min(78rem,96vw)] flex-col overflow-hidden rounded-3xl border border-slate-700 bg-[#08111f] shadow-2xl">
        <header className="flex items-start justify-between border-b border-slate-800 px-5 py-4">
          <div>
            <div className="flex items-center gap-2 text-base font-semibold text-white">
              <ShieldCheck className="h-5 w-5 text-cyan-300" />
              Review my architecture
            </div>
            <p className="mt-1 text-[11px] text-slate-400">
              Your services, evidence gaps, and prioritized next steps across all five Well-Architected pillars.
            </p>
          </div>
          <button
            type="button"
            onClick={() => {
              activeRequest.current?.abort();
              onClose();
            }}
            aria-label="Close architecture review"
            className="cursor-pointer rounded-lg p-2 text-slate-400 hover:bg-slate-800 hover:text-white"
          >
            <X className="h-4 w-4" />
          </button>
        </header>

        <div className="grid min-h-0 flex-1 grid-cols-1 md:grid-cols-[20rem_minmax(0,1fr)]">
          <aside className="overflow-y-auto border-r border-slate-800 p-4">
            <div className="space-y-1">
              {SOURCE_OPTIONS.map((option) => {
                const Icon = option.icon;
                return (
                  <button
                    key={option.id}
                    type="button"
                    onClick={() => {
                      activeRequest.current?.abort();
                      requestId.current += 1;
                      setBusy(false);
                      setSource(option.id);
                      setReview(null);
                      setError("");
                    }}
                    aria-pressed={source === option.id}
                    className={`flex w-full cursor-pointer items-center gap-2 rounded-xl border px-3 py-2 text-left text-[11px] font-semibold ${
                      source === option.id
                        ? "border-emerald-400/40 bg-emerald-400/10 text-emerald-200"
                        : "border-transparent text-slate-400 hover:bg-slate-900 hover:text-white"
                    }`}
                  >
                    <Icon className="h-3.5 w-3.5" />
                    {option.label}
                  </button>
                );
              })}
            </div>

            <div className="mt-4 border-t border-slate-800 pt-4">
              {source === "canvas" && (
                <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-3">
                  <p className="text-xs font-semibold text-white">Active architecture</p>
                  <p className="mt-1 text-[10px] text-slate-400">
                    {payload.nodes.length} nodes · {payload.edges.length} connections
                  </p>
                </div>
              )}
              {source === "description" && (
                <label className="block">
                  <span className="text-[10px] font-semibold text-slate-300">
                    Architecture description
                  </span>
                  <textarea
                    value={description}
                    maxLength={12000}
                    onChange={(event) => setDescription(event.target.value)}
                    rows={12}
                    placeholder="Explain business criticality, users, regions, Azure services, data flows, identity, networking, deployment, operations, RTO/RPO, and constraints."
                    className="mt-2 w-full resize-none rounded-xl border border-slate-700 bg-slate-950 p-3 text-[11px] leading-relaxed text-white outline-none focus:border-emerald-400/60"
                  />
                </label>
              )}
              {source === "image" && (
                <div className="space-y-3">
                  <label className="block cursor-pointer rounded-xl border border-dashed border-slate-600 bg-slate-950/60 p-4 text-center transition hover:border-emerald-400/60">
                    {reviewImage ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={reviewImage.dataUrl}
                        alt={`Architecture diagram preview: ${reviewImage.name}`}
                        className="mx-auto max-h-40 max-w-full rounded-lg border border-slate-700 bg-white object-contain"
                      />
                    ) : (
                      <ImageUp className="mx-auto h-6 w-6 text-slate-400" />
                    )}
                    <span className="mt-2 block text-[10px] font-semibold text-slate-300">
                      {reviewImage?.name || "Choose PNG, JPEG, or WebP"}
                    </span>
                    <span className="mt-1 block text-[9px] text-slate-500">
                      Maximum 5 MiB · not persisted
                    </span>
                    <input
                      type="file"
                      accept="image/png,image/jpeg,image/webp"
                      aria-label="Upload architecture diagram image"
                      className="sr-only"
                      onChange={(event) => {
                        const file = event.target.files?.[0];
                        if (file) void importImage(file);
                      }}
                    />
                  </label>
                </div>
              )}
              {source === "import" && (
                <label className="block cursor-pointer rounded-xl border border-dashed border-slate-600 bg-slate-950/60 p-4 text-center hover:border-emerald-400/60">
                  <FileJson className="mx-auto h-5 w-5 text-slate-400" />
                  <span className="mt-2 block text-[10px] font-semibold text-slate-300">
                    {importName || "Choose Diagrammatic JSON"}
                  </span>
                  <input
                    type="file"
                    accept=".json,application/json"
                    aria-label="Import architecture for review"
                    className="sr-only"
                    onChange={(event) => {
                      const file = event.target.files?.[0];
                      if (file) void importJson(file);
                    }}
                  />
                </label>
              )}
            </div>

            <label className="mt-4 block">
              <span className="text-[10px] font-semibold text-slate-300">Your business context (recommended)</span>
              <textarea
                value={businessContext}
                onChange={(event) => setBusinessContext(event.target.value)}
                maxLength={6000}
                rows={5}
                placeholder="Add business criticality, users, regions, data classification, RTO/RPO, expected scale, compliance, and known constraints."
                className="mt-2 w-full resize-none rounded-xl border border-slate-700 bg-slate-950 p-3 text-[11px] leading-relaxed text-white outline-none focus:border-cyan-400/60"
              />
            </label>
            <div role="status" className={`mt-4 rounded-xl border p-3 text-[10px] leading-relaxed ${reviewAgentConfigured ? "border-cyan-400/25 bg-cyan-400/5 text-cyan-100" : "border-amber-400/20 bg-amber-400/5 text-amber-100"}`}>
              <p className="font-semibold">{reviewAgentConfigured ? "Foundry review agent configured" : "Foundry review agent unavailable"}</p>
              <p className="mt-1">{reviewAgentConfigured
                ? "Your selected evidence is sent to the configured Foundry agent. Runtime access is checked when you run the review."
                : "No model fallback is used. The offline WAF scorecard still works for canvas and imported diagrams."}</p>
            </div>
            {error && (
              <p role="alert" className="mt-4 rounded-xl border border-rose-400/20 bg-rose-400/5 p-3 text-[10px] leading-relaxed text-rose-100">
                {error}
              </p>
            )}
            <button
              type="button"
              onClick={submit}
              disabled={busy || !reviewAgentConfigured}
              className="mt-4 inline-flex w-full cursor-pointer items-center justify-center gap-2 rounded-xl bg-cyan-400 px-3 py-2.5 text-[11px] font-bold text-slate-950 hover:bg-cyan-300 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
              {busy ? "Reviewing with Foundry agent" : "Run Foundry review"}
            </button>
            {busy && (
              <button type="button" onClick={() => {
                activeRequest.current?.abort();
                setError("Architecture review cancelled.");
              }} className="mt-2 w-full cursor-pointer rounded-xl border border-slate-700 p-2 text-xs text-slate-300">
                Cancel review
              </button>
            )}
          </aside>

          <main className="overflow-y-auto p-5">
            {staleReview && (
              <p role="status" className="mb-4 rounded-xl border border-amber-400/30 p-3 text-xs text-amber-200">
                Your architecture or business context changed since this review. Offline WAF scores reflect the current diagram; run the Foundry review again for updated advice.
              </p>
            )}
            {!review ? (
              <div className="mb-5 rounded-2xl border border-slate-800 p-5">
                <div className="max-w-md text-center">
                  <ShieldCheck className="mx-auto h-10 w-10 text-slate-700" />
                  <h2 className="mt-3 text-sm font-semibold text-slate-300">
                    A review of your architecture, not a generic checklist
                  </h2>
                  <p className="mt-2 text-[11px] leading-relaxed text-slate-500">
                    Choose your evidence and add your business constraints. The Foundry agent
                    ranks recommendations for your workload; offline scores below only assess depicted patterns.
                  </p>
                </div>
              </div>
            ) : (
              <ReviewResult review={review} payload={reviewPayloadSnapshot} />
            )}
            {evidencePayload && diagramAssessment && baselineSource && (
              <section className="mt-5 border-t border-slate-700 pt-4" aria-label="Offline WAF scorecard">
                <h2 className="mb-2 text-sm font-semibold text-cyan-200">Offline WAF scorecard and remediation playbooks</h2>
                <p className="mb-3 text-[10px] text-slate-400">Computed locally from your diagram. No agent invocation or deployed configuration verification.</p>
                <WafDiagramScorecard
                  key={source}
                  payload={evidencePayload}
                  baseline={baselines[baselineSource] ?? diagramAssessment}
                  onBaselineChange={(baseline) => setBaselines((current) => ({ ...current, [baselineSource]: baseline }))}
                />
              </section>
            )}
          </main>
        </div>
      </div>
    </div>
  );
}

function ReviewResult({ review, payload }: { review: ArchitectureReview; payload: ArchPayload | null }) {
  const postureClass =
    review.posture === "strong"
      ? "text-emerald-300"
      : review.posture === "mixed"
        ? "text-amber-300"
        : "text-rose-300";
  return (
    <section aria-label="Your personalized review">
      <h2 className="mb-3 text-base font-semibold text-white">Your prioritized architecture review</h2>
      <p className="mb-3 text-[10px] leading-relaxed text-slate-400">{ARCHITECTURE_REVIEW_DISCLAIMER}</p>
      <div className="flex items-start justify-between gap-5 rounded-2xl border border-slate-800 bg-slate-900/70 p-4">
        <div>
          <p className="text-[9px] font-bold uppercase tracking-[0.16em] text-slate-500">
            Executive summary
          </p>
          <p className="mt-2 text-xs leading-relaxed text-slate-300">{review.summary}</p>
        </div>
        <div className="shrink-0 text-right">
          <p className={`text-3xl font-semibold ${postureClass}`}>{review.score}</p>
          <p className={`text-[9px] font-bold uppercase tracking-wide ${postureClass}`}>
            {review.posture}
          </p>
          <p className="mt-1 text-[9px] text-slate-500">Agent advisory score</p>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3">
        <SummaryList title="Strengths" values={review.strengths} />
        <SummaryList title="Assumptions to confirm" values={review.assumptions} warning />
      </div>

      <h2 className="mt-5 text-[10px] font-bold uppercase tracking-[0.16em] text-slate-500">
        Prioritized findings
      </h2>
      <div className="mt-2 space-y-3">
        {rankArchitectureReviewFindings(review).map((finding, index) => (
          <article key={finding.id} className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-[10px] font-bold text-cyan-200">#{index + 1}</span>
                  <span className={`rounded-full px-2 py-0.5 text-[8px] font-bold uppercase ${
                    finding.severity === "critical" || finding.severity === "high"
                      ? "bg-rose-400/10 text-rose-300"
                      : finding.severity === "medium"
                        ? "bg-amber-400/10 text-amber-300"
                        : "bg-sky-400/10 text-sky-300"
                  }`}>
                    {finding.severity}
                  </span>
                  <span className="text-[9px] font-semibold text-cyan-300">{finding.framework}</span>
                  {finding.pillar && <span className="text-[9px] text-slate-500">· {finding.pillar}</span>}
                </div>
                <h3 className="mt-2 text-sm font-semibold text-white">{finding.title}</h3>
                <p className="mt-1 text-[10px] text-slate-400">
                  {finding.evidenceStatus === "observed" ? "Observed in submitted evidence; not deployment-verified" : "Unknown or unverified evidence"}
                </p>
              </div>
              <a
                href={finding.sourceUrl}
                target="_blank"
                rel="noreferrer"
                aria-label={`Official guidance for ${finding.title}`}
                className="shrink-0 text-slate-500 hover:text-cyan-300"
              >
                <ArrowUpRight className="h-4 w-4" />
              </a>
            </div>
            <p className="mt-2 text-[10px] text-cyan-200">
              Affected nodes: {finding.nodeIds?.length
                ? finding.nodeIds.map((id) => `${payload?.nodes.find((node) => node.id === id)?.label || id} [${id}]`).join(", ")
                : "No node-specific evidence supplied"}
              {" "}· Connections: {finding.edgeIds?.join(", ") || "Not specified"}
            </p>
            {finding.remediation && (
              <section className="mt-3 rounded-xl border border-cyan-400/20 p-3 text-[10px] leading-relaxed text-slate-300">
                <h4 className="font-semibold text-cyan-200">Your remediation playbook</h4>
                <ol className="mt-2 list-decimal space-y-1 pl-4">{finding.remediation.steps.map((step, stepIndex) => <li key={stepIndex}>{step}</li>)}</ol>
                <p className="mt-2"><strong>Validate:</strong> {finding.remediation.validation}</p>
                <p className="mt-1"><strong>Tradeoff:</strong> {finding.remediation.tradeoff}</p>
              </section>
            )}
            <div className="mt-3 grid gap-3 lg:grid-cols-2">
              <div className="rounded-xl border border-slate-800 bg-slate-950/50 p-3">
                <p className="text-[8px] font-bold uppercase tracking-wide text-slate-500">Evidence</p>
                <p className="mt-1 text-[10px] leading-relaxed text-slate-400">{finding.evidence}</p>
              </div>
              <div className="rounded-xl border border-cyan-400/15 bg-cyan-400/5 p-3">
                <p className="text-[8px] font-bold uppercase tracking-wide text-cyan-300">Recommendation</p>
                <p className="mt-1 text-[10px] leading-relaxed text-slate-300">{finding.recommendation}</p>
              </div>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

function SummaryList({
  title,
  values,
  warning = false,
}: {
  title: string;
  values: string[];
  warning?: boolean;
}) {
  return (
    <section className={`rounded-2xl border p-3 ${
      warning ? "border-amber-400/20 bg-amber-400/5" : "border-emerald-400/20 bg-emerald-400/5"
    }`}>
      <h2 className={`text-[9px] font-bold uppercase tracking-[0.14em] ${
        warning ? "text-amber-300" : "text-emerald-300"
      }`}>
        {warning && <TriangleAlert className="mr-1 inline h-3 w-3" />}
        {title}
      </h2>
      <ul className="mt-2 space-y-1 text-[10px] leading-relaxed text-slate-400">
        {values.map((value) => <li key={value}>• {value}</li>)}
      </ul>
    </section>
  );
}
