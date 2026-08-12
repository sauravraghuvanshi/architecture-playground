import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { aiRateLimit } from "@/lib/ai-rate-limit";
import { generateArmTemplate } from "@/components/diagrammatic/csa/architecture-codegen";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const requestSchema = z.object({
  payload: z.object({
    nodes: z
      .array(
        z
          .object({
            id: z.string().min(1).max(200),
            kind: z.enum(["icon", "group", "shape"]).optional(),
            label: z.string().min(1).max(300),
            iconId: z.string().max(500).optional(),
          })
          .passthrough()
      )
      .min(1)
      .max(500),
    edges: z
      .array(
        z
          .object({
            id: z.string().min(1).max(200),
            source: z.string().min(1).max(200),
            target: z.string().min(1).max(200),
            label: z.string().max(300).optional(),
          })
          .passthrough()
      )
      .max(1000),
  }),
});

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

function pruneExpired(now: number) {
  for (const [token, stored] of templateStore) {
    if (stored.expiresAt <= now) templateStore.delete(token);
  }
}

function publicBaseUrl(request: Request): URL | null {
  const configured = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  const base = new URL(configured || request.url);
  const publiclyReachable =
    base.protocol === "https:" &&
    base.hostname !== "localhost" &&
    base.hostname !== "127.0.0.1";
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
    input = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }
  const parsed = requestSchema.safeParse(input);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid deployment request." },
      { status: 400 }
    );
  }

  const generated = generateArmTemplate(parsed.data.payload);
  if (generated.supportedNodes === 0) {
    return NextResponse.json(
      { error: "The architecture has no Azure services with deployment mappings." },
      { status: 400 }
    );
  }

  const now = Date.now();
  pruneExpired(now);
  const token = randomUUID().replace(/-/g, "");
  const expiresAt = now + TEMPLATE_TTL_MS;
  templateStore.set(token, { template: generated.template, expiresAt });

  const templateUrl = new URL("/api/deploy/template", baseUrl);
  templateUrl.searchParams.set("token", token);
  const portalUrl =
    "https://portal.azure.com/#create/Microsoft.Template/uri/" +
    encodeURIComponent(templateUrl.toString());

  return NextResponse.json({
    portalUrl,
    expiresAt: new Date(expiresAt).toISOString(),
    supportedNodes: generated.supportedNodes,
    totalServiceNodes: generated.totalServiceNodes,
    warnings: generated.warnings,
  });
}

export async function GET(request: Request) {
  const token = new URL(request.url).searchParams.get("token");
  if (!token || !/^[a-f0-9]{32}$/.test(token)) {
    return NextResponse.json({ error: "Invalid deployment template token." }, { status: 400 });
  }
  const now = Date.now();
  pruneExpired(now);
  const stored = templateStore.get(token);
  if (!stored) {
    return NextResponse.json(
      { error: "Deployment template link is invalid or expired." },
      { status: 404 }
    );
  }
  return NextResponse.json(stored.template, {
    headers: {
      "Cache-Control": "private, no-store, max-age=0",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
