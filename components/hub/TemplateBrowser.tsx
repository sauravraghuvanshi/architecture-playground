"use client";

import Link from "next/link";
import { useState } from "react";
import { motion } from "framer-motion";
import { Search } from "lucide-react";

type Template = {
  id: string;
  title: string;
  blurb: string;
  cloud: "aws" | "azure" | "gcp" | "any";
  category: string;
  accent: string;
};

// Curated starter set; full library lands when /api/templates is wired.
const TEMPLATES: Template[] = [
  { id: "azure-3tier", title: "3-tier web app on Azure", blurb: "App Service · Azure SQL · Front Door", cloud: "azure", category: "Web", accent: "from-sky-500 to-cyan-500" },
  { id: "aws-serverless-images", title: "Serverless image pipeline", blurb: "S3 · Lambda · CloudFront · DynamoDB", cloud: "aws", category: "Serverless", accent: "from-orange-500 to-rose-500" },
  { id: "gcp-event-driven", title: "Event-driven orders", blurb: "Pub/Sub · Cloud Run · Firestore · BigQuery", cloud: "gcp", category: "Event-driven", accent: "from-emerald-500 to-teal-500" },
  { id: "azure-aks-microservices", title: "AKS microservices", blurb: "AKS · APIM · Cosmos · Service Bus", cloud: "azure", category: "Microservices", accent: "from-indigo-500 to-violet-500" },
  { id: "aws-data-lakehouse", title: "Data lakehouse", blurb: "S3 · Glue · Athena · Redshift · QuickSight", cloud: "aws", category: "Data", accent: "from-violet-500 to-fuchsia-500" },
  { id: "azure-ai-rag", title: "AI RAG pipeline", blurb: "Azure OpenAI · AI Search · Functions · Cosmos", cloud: "azure", category: "AI", accent: "from-fuchsia-500 to-pink-500" },
  { id: "gcp-streaming-iot", title: "Streaming IoT", blurb: "Pub/Sub · Dataflow · BigQuery · Looker", cloud: "gcp", category: "Streaming", accent: "from-amber-500 to-orange-500" },
  { id: "multi-region-active", title: "Multi-region active-active", blurb: "Front Door · Azure SQL HA · Cosmos multi-write", cloud: "azure", category: "HA / DR", accent: "from-blue-500 to-indigo-500" },
  { id: "k8s-c4", title: "C4 container view", blurb: "Person · System · Container · Component", cloud: "any", category: "C4", accent: "from-pink-500 to-rose-500" },
  { id: "oauth-pkce", title: "OAuth 2.0 PKCE flow", blurb: "Sequence: client · authz · token", cloud: "any", category: "Sequence", accent: "from-emerald-500 to-teal-500" },
  { id: "ecommerce-er", title: "E-commerce schema", blurb: "ER: customers · orders · items · payments", cloud: "any", category: "ER", accent: "from-lime-500 to-green-500" },
  { id: "sprint-kanban", title: "Sprint board", blurb: "Backlog · Doing · Review · Done", cloud: "any", category: "Kanban", accent: "from-amber-500 to-orange-500" },
];

const CLOUDS: Array<{ id: Template["cloud"] | "all"; label: string }> = [
  { id: "all", label: "All" },
  { id: "azure", label: "Azure" },
  { id: "aws", label: "AWS" },
  { id: "gcp", label: "GCP" },
  { id: "any", label: "Generic" },
];

export function TemplateBrowser() {
  const [cloud, setCloud] = useState<Template["cloud"] | "all">("all");
  const [q, setQ] = useState("");

  const filtered = TEMPLATES.filter((t) => {
    if (cloud !== "all" && t.cloud !== cloud) return false;
    if (q && !`${t.title} ${t.blurb} ${t.category}`.toLowerCase().includes(q.toLowerCase()))
      return false;
    return true;
  });

  return (
    <section className="py-6">
      <div className="flex items-baseline justify-between mb-4 flex-wrap gap-3">
        <div>
          <h2 className="text-base font-bold text-slate-900">Templates</h2>
          <p className="text-xs text-slate-500 mt-0.5">{filtered.length} battle-tested starting points</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Filter…"
              className="pl-8 pr-3 py-1.5 text-xs bg-white border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-violet-300 transition-colors w-40"
            />
          </div>
          <div className="flex items-center gap-0.5 p-0.5 bg-slate-100 rounded-md">
            {CLOUDS.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => setCloud(c.id)}
                className={`px-2.5 py-1 text-[11px] font-semibold rounded transition-colors cursor-pointer ${
                  cloud === c.id ? "bg-white text-slate-900 shadow-sm" : "text-slate-600 hover:text-slate-900"
                }`}
              >
                {c.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
        {filtered.map((t, i) => (
          <motion.div
            key={t.id}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: i * 0.02 }}
            whileHover={{ y: -2 }}
          >
            <Link
              href={`/diagrammatic?template=${t.id}`}
              className="group block rounded-xl border border-slate-200 bg-white hover:border-slate-300 hover:shadow-md transition-all overflow-hidden cursor-pointer"
            >
              <div className={`relative h-24 bg-gradient-to-br ${t.accent} overflow-hidden`}>
                <div className="absolute inset-0 bg-[linear-gradient(to_right,rgba(255,255,255,0.15)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.15)_1px,transparent_1px)] bg-[size:14px_14px]" />
                <span className="absolute top-2 left-2 px-1.5 py-0.5 text-[9px] uppercase tracking-wider font-bold text-white/90 bg-black/20 rounded">
                  {t.cloud === "any" ? t.category : t.cloud.toUpperCase()}
                </span>
              </div>
              <div className="p-3">
                <div className="text-sm font-semibold text-slate-900 group-hover:text-violet-700 transition-colors">
                  {t.title}
                </div>
                <p className="mt-1 text-xs text-slate-500 line-clamp-2">{t.blurb}</p>
              </div>
            </Link>
          </motion.div>
        ))}
      </div>
    </section>
  );
}
