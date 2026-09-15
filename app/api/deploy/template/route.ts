import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { aiRateLimit } from "@/lib/ai-rate-limit";
import { readBoundedJson, RequestBodyError } from "@/lib/request-json";
import { generateArmTemplate } from "@/components/diagrammatic/csa/architecture-codegen";
import { parseArchitectureDocument } from "@/lib/architecture-document";
import { azureOnlyDeploymentPayload, parseArmTemplate } from "@/lib/deployment-assistance";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const requestSchema = z.discriminatedUnion("source", [
  z.object({ source: z.literal("foundry-agent"), consent: z.literal(true), armTemplate: z.unknown() }).strict(),
  z.object({ source: z.literal("offline"), consent: z.literal(true), payload: z.unknown() }).strict(),
]);

interface StoredTemplate {
  template: Record<string, unknown>;
  expiresAt: number;
}

const globalTemplateStore = globalThis as typeof globalThis & {
  diagrammaticDeploymentTemplates?: Map<string, StoredTemplate>;
};
const templateStore =
  globalTemplateStore.diagrammaticDeploymentTemplates ??
  new Map<string, StoredTemplate>();
globalTemplateStore.diagrammaticDeploymentTemplates = templateStore;

const TEMPLATE_TTL_MS = 10 * 60 * 1000;
const PUBLIC_TEMPLATE_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "Cache-Control": "no-store, max-age=0",
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "no-referrer",
};

function pruneExpired(now: number) {
  for (const [token, stored] of templateStore) {
    if (stored.expiresAt <= now) templateStore.delete(token);
  }
}

function publicBaseUrl(request: Request): URL | null {
  const configured = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  let base: URL;
  try {
    base = new URL(configured || request.url);
  } catch {
    return null;
  }
  const publiclyReachable =
    base.protocol === "https:" &&
    !base.username && !base.password &&
    !/^(localhost|127\.|0\.|10\.|192\.168\.|169\.254\.|172\.(1[6-9]|2\d|3[01])\.|\[)/i.test(base.hostname) &&
    !/\.(local|internal|localhost)$/i.test(base.hostname) &&
    base.hostname.includes(".");
  return publiclyReachable ? base : null;
}

export async function POST(request: Request) {
  const rate = aiRateLimit(request);
  if (!rate.ok) {
    return NextResponse.json(
      { error: "Rate limit exceeded", retryAfter: rate.retryAfterSec },
      { status: 429, headers: { "Retry-After": String(rate.retryAfterSec) } }
    );
  }
  const baseUrl = publicBaseUrl(request);
  if (!baseUrl) {
    return NextResponse.json(
      {
        error:
          "Azure Portal deployment requires NEXT_PUBLIC_SITE_URL to be a public HTTPS Diagrammatic URL.",
      },
      { status: 400 }
    );
  }

  let input: unknown;
  try {
    input = await readBoundedJson(request, 1_000_000);
  } catch (error) {
    if (!(error instanceof RequestBodyError)) throw error;
    return NextResponse.json({ error: error.message }, { status: error.status });
  }
  const parsed = requestSchema.safeParse(input);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Select a generation source and explicitly consent to publishing the reviewed template." },
      { status: 400 }
    );
  }

  let template;
  let warnings: string[] = [];
  try {
    if (parsed.data.source === "offline") {
      const selected = azureOnlyDeploymentPayload(parseArchitectureDocument(parsed.data.payload));
      const generated = generateArmTemplate(selected.payload);
      if (generated.supportedNodes === 0) return NextResponse.json({ error: "No Azure services have offline deployment mappings." }, { status: 400 });
      template = parseArmTemplate(generated.template);
      warnings = [...selected.warnings, ...generated.warnings];
    } else {
      template = parseArmTemplate(parsed.data.armTemplate);
    }
  } catch {
    return NextResponse.json({ error: "The reviewed ARM template or architecture is invalid or unsupported. Nothing was published." }, { status: 400 });
  }

  const now = Date.now();
  pruneExpired(now);
  if (templateStore.size >= 100) {
    return NextResponse.json(
      { error: "Deployment handoff is busy. Please retry after existing links expire." },
      { status: 503, headers: { "Retry-After": "60" } }
    );
  }
  const token = randomUUID().replace(/-/g, "");
  const expiresAt = now + TEMPLATE_TTL_MS;
  templateStore.set(token, { template, expiresAt });

  const templateUrl = new URL("/api/deploy/template", baseUrl);
  templateUrl.searchParams.set("token", token);
  const portalUrl =
    "https://portal.azure.com/#create/Microsoft.Template/uri/" +
    encodeURIComponent(templateUrl.toString());

  return NextResponse.json({
    portalUrl,
    expiresAt: new Date(expiresAt).toISOString(),
    warnings: [...warnings, "This bearer link is publicly readable for 10 minutes. The broker is instance-local: restarts or routing to another instance can invalidate the link. Download and upload the ARM template manually if Portal cannot retrieve it."],
  }, { headers: { "Cache-Control": "no-store" } });
}

export async function GET(request: Request) {
  const token = new URL(request.url).searchParams.get("token");
  if (!token || !/^[a-f0-9]{32}$/.test(token)) {
    return NextResponse.json({ error: "Invalid deployment template token." }, { status: 400, headers: PUBLIC_TEMPLATE_HEADERS });
  }
  const now = Date.now();
  pruneExpired(now);
  const stored = templateStore.get(token);
  if (!stored) {
    return NextResponse.json(
      { error: "Deployment template link is invalid or expired." },
      { status: 404, headers: PUBLIC_TEMPLATE_HEADERS }
    );
  }
  return NextResponse.json(stored.template, {
    headers: PUBLIC_TEMPLATE_HEADERS,
  });
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: PUBLIC_TEMPLATE_HEADERS });
}
