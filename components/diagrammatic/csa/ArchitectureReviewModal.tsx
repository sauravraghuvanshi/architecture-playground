"use client";

import { useState } from "react";
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
  type ArchitectureReview,
} from "@/lib/architecture-review";

interface Props {
  open: boolean;
  payload: ArchPayload;
  aiConfigured: boolean;
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
  aiConfigured,
  onClose,
}: Props) {
  const [source, setSource] = useState<ReviewSource>("canvas");
  const [description, setDescription] = useState("");
  const [importedPayload, setImportedPayload] = useState<ArchPayload | null>(null);
  const [importName, setImportName] = useState("");
  const [reviewImage, setReviewImage] = useState<ReviewImage | null>(null);
  const [imageContext, setImageContext] = useState("");
  const [review, setReview] = useState<ArchitectureReview | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  if (!open) return null;

  const importJson = async (file: File) => {
    setError("");
    try {
      const parsed = JSON.parse(await file.text()) as
        | ArchPayload
        | { payload?: ArchPayload };
      const candidate =
        "payload" in parsed && parsed.payload ? parsed.payload : (parsed as ArchPayload);
      if (!Array.isArray(candidate.nodes) || !Array.isArray(candidate.edges)) {
        throw new Error("The JSON file must contain nodes and edges arrays.");
      }
      setImportedPayload(candidate);
      setImportName(file.name);
    } catch (importError) {
      setImportedPayload(null);
      setImportName("");
      setError(importError instanceof Error ? importError.message : "Unable to import JSON.");
    }
  };

  const importImage = async (file: File) => {
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
    setError("");
    setReview(null);
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
    try {
      const response = await fetch("/api/ai/review", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          source,
          description: source === "description" ? description.trim() : undefined,
          ...(source === "image"
            ? {
                description: imageContext.trim() || undefined,
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
      setReview(result.review);
    } catch (reviewError) {
      setError(reviewError instanceof Error ? reviewError.message : "Architecture review failed.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Azure architecture review"
      className="fixed inset-0 z-[110] flex items-center justify-center bg-slate-950/80 p-5 backdrop-blur-sm"
    >
      <div className="flex h-[min(52rem,92vh)] w-[min(78rem,96vw)] flex-col overflow-hidden rounded-3xl border border-slate-700 bg-[#08111f] shadow-2xl">
        <header className="flex items-start justify-between border-b border-slate-800 px-5 py-4">
          <div>
            <div className="flex items-center gap-2 text-base font-semibold text-white">
              <ShieldCheck className="h-5 w-5 text-emerald-300" />
              Azure architecture review
            </div>
            <p className="mt-1 text-[11px] text-slate-400">
              LLM-assisted review across Architecture Center, Landing Zones, CAF, and WAF.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close Azure architecture review"
            className="cursor-pointer rounded-lg p-2 text-slate-400 hover:bg-slate-800 hover:text-white"
          >
            <X className="h-4 w-4" />
          </button>
        </header>

        <div className="grid min-h-0 flex-1 grid-cols-[20rem_minmax(0,1fr)]">
          <aside className="overflow-y-auto border-r border-slate-800 p-4">
            <div className="space-y-1">
              {SOURCE_OPTIONS.map((option) => {
                const Icon = option.icon;
                return (
                  <button
                    key={option.id}
                    type="button"
                    onClick={() => {
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
                  <label className="block">
                    <span className="text-[10px] font-semibold text-slate-300">
                      Customer context (recommended)
                    </span>
                    <textarea
                      value={imageContext}
                      onChange={(event) => setImageContext(event.target.value)}
                      rows={6}
                      placeholder="Add business criticality, users, regions, data classification, RTO/RPO, expected scale, compliance, and known constraints."
                      className="mt-2 w-full resize-none rounded-xl border border-slate-700 bg-slate-950 p-3 text-[11px] leading-relaxed text-white outline-none focus:border-emerald-400/60"
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
                    className="sr-only"
                    onChange={(event) => {
                      const file = event.target.files?.[0];
                      if (file) void importJson(file);
                    }}
                  />
                </label>
              )}
            </div>

            {!aiConfigured && (
              <p className="mt-4 rounded-xl border border-amber-400/20 bg-amber-400/5 p-3 text-[10px] leading-relaxed text-amber-100">
                Azure OpenAI is not configured for this deployment. Configure the server-side chat
                settings to run a review.
              </p>
            )}
            {error && (
              <p role="alert" className="mt-4 rounded-xl border border-rose-400/20 bg-rose-400/5 p-3 text-[10px] leading-relaxed text-rose-100">
                {error}
              </p>
            )}
            <button
              type="button"
              onClick={submit}
              disabled={busy || !aiConfigured}
              className="mt-4 inline-flex w-full cursor-pointer items-center justify-center gap-2 rounded-xl bg-emerald-400 px-3 py-2.5 text-[11px] font-bold text-slate-950 hover:bg-emerald-300 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
              {busy ? "Reviewing architecture" : "Run architecture review"}
            </button>
          </aside>

          <main className="overflow-y-auto p-5">
            {!review ? (
              <div className="grid h-full place-items-center">
                <div className="max-w-md text-center">
                  <ShieldCheck className="mx-auto h-10 w-10 text-slate-700" />
                  <h2 className="mt-3 text-sm font-semibold text-slate-300">
                    Cross-framework Azure review
                  </h2>
                  <p className="mt-2 text-[11px] leading-relaxed text-slate-500">
                    Findings distinguish observed evidence from assumptions and link back to
                    first-party Microsoft guidance.
                  </p>
                </div>
              </div>
            ) : (
              <ReviewResult review={review} />
            )}
          </main>
        </div>
      </div>
    </div>
  );
}

function ReviewResult({ review }: { review: ArchitectureReview }) {
  const postureClass =
    review.posture === "strong"
      ? "text-emerald-300"
      : review.posture === "mixed"
        ? "text-amber-300"
        : "text-rose-300";
  return (
    <div>
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
        {review.findings.map((finding) => (
          <article key={finding.id} className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="flex flex-wrap items-center gap-2">
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
    </div>
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
