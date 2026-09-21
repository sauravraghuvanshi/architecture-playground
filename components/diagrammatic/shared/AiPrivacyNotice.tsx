"use client";

import { useEffect, useState } from "react";
import { aiPrivacySchema, type AiCapability, type AiPrivacy } from "@/lib/ai-privacy-contract";

export function AiPrivacyNotice({ capability, active = true }: { capability: AiCapability; active?: boolean }) {
  const [privacy, setPrivacy] = useState<AiPrivacy | null>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    if (!active) return;
    const controller = new AbortController();
    void fetch("/api/ai/privacy", { cache: "no-store", signal: controller.signal }).then(async (response) => {
      if (!response.ok) throw new Error("Destination disclosure unavailable. Verify the server configuration before sending sensitive content.");
      const parsed = aiPrivacySchema.safeParse(await response.json());
      if (!parsed.success) throw new Error("Destination disclosure is invalid. Verify configuration before sending sensitive content.");
      if (!controller.signal.aborted) { setPrivacy(parsed.data); setError(""); }
    }).catch((cause) => {
      if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : "Destination disclosure unavailable.");
    });
    return () => controller.abort();
  }, [active]);
  if (!active) return null;
  const destination = privacy?.destinations[capability];
  return <section aria-label={`AI privacy: ${capability}`} className="my-3 space-y-1 rounded-lg border border-slate-500/40 bg-slate-500/5 p-3 text-[11px] leading-relaxed">
    <p className="font-semibold">AI destination and data handling</p>
    {error ? <p role="alert">{error}</p> : destination ? <>
      <p>{destination.configured
        ? <>Configured destination: <span className="break-all font-mono">{destination.origin}</span> ({destination.transport})</>
        : "No valid destination is configured for this capability. No implicit demo destination is used."}</p>
      <p>{destination.data}</p>
      <p>{destination.retention}</p>
    </> : <p role="status">Checking the server-configured destination. Only send content you are authorized to process.</p>}
    <p>Actions send data only when you request AI processing. Do not include secrets.</p>
  </section>;
}
