/**
 * promptToArchitecture — heuristic prompt-to-graph generator.
 *
 * No LLM call: we tokenize the prompt, match keywords against the icon manifest
 * (label / id / category), assign each match to an architectural "tier"
 * (frontend → gateway → compute → data → observability), then lay tiers out as
 * columns and connect adjacent tiers with `flow`-styled edges so the result
 * animates out of the box.
 *
 * Why deterministic + heuristic for now:
 *   - Predictable & free (no Azure OpenAI dependency on first paint).
 *   - User can edit immediately — every node is real, every edge is real.
 *   - Replaceable later by `/api/ai/generate-arch` without changing the
 *     consumer signature.
 */
import type { IconLite } from "@/components/diagrammatic/shared/types";
import type {
  ArchPayload,
  ArchNode,
  ArchEdge,
  ArchEdgeStyle,
} from "@/components/diagrammatic/modes/architecture/ArchitectureCanvas";

type Tier = "edge" | "frontend" | "gateway" | "compute" | "messaging" | "data" | "ops";

const TIER_ORDER: Tier[] = ["edge", "frontend", "gateway", "compute", "messaging", "data", "ops"];

/**
 * Keyword → tier and preferred icon-label fragment. The fragment is matched
 * case-insensitively against `IconLite.label` (and `id` as fallback). The
 * first manifest icon to match wins; we de-dupe by tier+iconId so we don't
 * spawn the same service twice.
 */
const KEYWORDS: { tier: Tier; needles: string[]; match: string }[] = [
  // edge / cdn
  { tier: "edge", needles: ["cdn", "cloudfront", "front door", "frontdoor", "edge"], match: "cdn" },
  { tier: "edge", needles: ["dns", "route53", "route 53"], match: "dns" },
  { tier: "edge", needles: ["waf", "firewall"], match: "firewall" },

  // frontend
  { tier: "frontend", needles: ["react", "next", "nextjs", "vue", "angular", "spa", "single-page", "frontend", "front end", "ui", "web app"], match: "app service" },
  { tier: "frontend", needles: ["mobile", "ios", "android"], match: "app service" },
  { tier: "frontend", needles: ["static site", "static web"], match: "static" },

  // gateway / api
  { tier: "gateway", needles: ["api gateway", "apim", "api management"], match: "api management" },
  { tier: "gateway", needles: ["load balancer", "alb", "nlb"], match: "load balancer" },
  { tier: "gateway", needles: ["ingress", "nginx"], match: "load balancer" },

  // compute
  { tier: "compute", needles: ["lambda", "function", "functions", "serverless"], match: "function" },
  { tier: "compute", needles: ["container app", "aca", "container apps"], match: "container apps" },
  { tier: "compute", needles: ["kubernetes", "aks", "eks", "gke", "k8s"], match: "kubernetes" },
  { tier: "compute", needles: ["app service", "web app"], match: "app service" },
  { tier: "compute", needles: ["vm", "virtual machine", "ec2", "compute engine"], match: "virtual machine" },
  { tier: "compute", needles: ["fargate", "ecs"], match: "container" },

  // messaging
  { tier: "messaging", needles: ["kafka", "event hub", "eventhub", "event hubs"], match: "event hubs" },
  { tier: "messaging", needles: ["service bus", "sqs", "queue"], match: "service bus" },
  { tier: "messaging", needles: ["event grid", "eventbridge", "pub/sub", "pubsub"], match: "event grid" },
  { tier: "messaging", needles: ["webhook", "signalr", "websocket"], match: "signalr" },

  // data
  { tier: "data", needles: ["postgres", "mysql", "sql", "rds", "azure sql", "cloud sql"], match: "sql database" },
  { tier: "data", needles: ["cosmos", "dynamodb", "firestore", "nosql"], match: "cosmos" },
  { tier: "data", needles: ["redis", "cache", "memcache", "elasticache"], match: "redis" },
  { tier: "data", needles: ["s3", "blob", "object storage", "gcs"], match: "blob storage" },
  { tier: "data", needles: ["data lake", "lakehouse", "synapse", "databricks"], match: "synapse" },
  { tier: "data", needles: ["search", "cognitive search", "elasticsearch"], match: "search" },

  // ai
  { tier: "compute", needles: ["openai", "azure openai", "llm", "gpt", "ai foundry", "ai studio"], match: "openai" },
  { tier: "compute", needles: ["embedding", "vector", "rag"], match: "openai" },

  // ops
  { tier: "ops", needles: ["monitor", "app insights", "application insights", "cloudwatch", "stackdriver"], match: "monitor" },
  { tier: "ops", needles: ["log analytics", "loki"], match: "log" },
  { tier: "ops", needles: ["key vault", "secrets manager", "secret manager"], match: "key vault" },
  { tier: "ops", needles: ["identity", "entra", "active directory", "iam", "cognito"], match: "active directory" },
];

interface Picked {
  tier: Tier;
  icon: IconLite;
}

function lower(s: string): string {
  return s.toLowerCase();
}

function pickIcons(prompt: string, icons: IconLite[]): Picked[] {
  const p = lower(prompt);
  const picked: Picked[] = [];
  const seen = new Set<string>();

  for (const rule of KEYWORDS) {
    if (!rule.needles.some((n) => p.includes(n))) continue;
    // Find the first icon whose label/id contains the match fragment.
    const needle = rule.match;
    const icon = icons.find(
      (i) => lower(i.label).includes(needle) || lower(i.id).includes(needle)
    );
    if (!icon) continue;
    const key = `${rule.tier}:${icon.id}`;
    if (seen.has(key)) continue;
    seen.add(key);
    picked.push({ tier: rule.tier, icon });
  }

  return picked;
}

const COL_W = 220;
const ROW_H = 170;
const NODE_W = 120;
const NODE_H = 120;
const ORIGIN_X = 80;
const ORIGIN_Y = 80;

/**
 * Produce an ArchPayload from a free-form prompt + the icon manifest.
 * Returns `null` if no keywords matched (caller can fall back to an empty
 * canvas rather than a single mystery node).
 */
export function promptToArchitecture(
  prompt: string,
  icons: IconLite[],
  opts: { animateEdges?: boolean } = {}
): ArchPayload | null {
  const picked = pickIcons(prompt, icons);
  if (!picked.length) return null;

  // Group by tier in canonical column order.
  const byTier = new Map<Tier, IconLite[]>();
  for (const t of TIER_ORDER) byTier.set(t, []);
  for (const p of picked) byTier.get(p.tier)!.push(p.icon);

  // Drop empty tiers so column indices are dense (no gaps in the layout).
  const usedTiers = TIER_ORDER.filter((t) => (byTier.get(t)!.length ?? 0) > 0);

  const nodes: ArchNode[] = [];
  const tierToNodeIds = new Map<Tier, string[]>();

  usedTiers.forEach((tier, colIdx) => {
    const list = byTier.get(tier)!;
    const ids: string[] = [];
    list.forEach((icon, rowIdx) => {
      const id = `n_${tier}_${rowIdx}_${Math.random().toString(36).slice(2, 6)}`;
      nodes.push({
        id,
        label: icon.label,
        iconId: icon.id,
        iconPath: icon.path,
        x: ORIGIN_X + colIdx * COL_W,
        y: ORIGIN_Y + rowIdx * ROW_H,
        width: NODE_W,
        height: NODE_H,
      });
      ids.push(id);
    });
    tierToNodeIds.set(tier, ids);
  });

  const edges: ArchEdge[] = [];
  const edgeStyle: ArchEdgeStyle = opts.animateEdges === false ? "solid" : "flow";
  // Connect every node in tier N to every node in tier N+1.
  for (let i = 0; i < usedTiers.length - 1; i++) {
    const fromIds = tierToNodeIds.get(usedTiers[i]) ?? [];
    const toIds = tierToNodeIds.get(usedTiers[i + 1]) ?? [];
    for (const a of fromIds) {
      for (const b of toIds) {
        edges.push({
          id: `e_${a}_${b}`,
          source: a,
          target: b,
          style: edgeStyle,
        });
      }
    }
  }

  return { nodes, edges };
}
