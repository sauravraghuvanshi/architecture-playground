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
  { tier: "compute", needles: ["cloud run"], match: "cloud run" },
  { tier: "compute", needles: ["vertex ai", "vertex"], match: "vertex" },

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
  { tier: "data", needles: ["bigquery", "big query"], match: "bigquery" },

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

function findBestIcon(icons: IconLite[], term: string): IconLite | undefined {
  const normalizedTerm = lower(term).replaceAll("/", " ").replace(/\s+/g, " ").trim();
  const tokenPattern = new RegExp(
    `(^|[^a-z0-9])${normalizedTerm.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replaceAll(" ", "[ -]?")}([^a-z0-9]|$)`,
    "i"
  );
  return icons
    .filter((icon) => tokenPattern.test(icon.label) || tokenPattern.test(icon.id.replaceAll("/", " ")))
    .sort((a, b) => {
      const aLabel = lower(a.label);
      const bLabel = lower(b.label);
      const score = (label: string) =>
        label === normalizedTerm ? 0 : label.startsWith(normalizedTerm) ? 1 : label.includes(normalizedTerm) ? 2 : 3;
      return score(aLabel) - score(bLabel) || a.label.length - b.label.length || a.label.localeCompare(b.label);
    })[0];
}

function pickIcons(prompt: string, icons: IconLite[]): Picked[] {
  const p = lower(prompt);
  const picked: Picked[] = [];
  const seen = new Set<string>();
  const mentionedProviders = [
    /\bazure\b|\bmicrosoft\b/.test(p) ? "azure" : null,
    /\baws\b|\bamazon\b/.test(p) ? "aws" : null,
    /\bgcp\b|\bgoogle cloud\b|\bgoogle\b/.test(p) ? "gcp" : null,
  ].filter((provider): provider is string => provider !== null);
  const provider = mentionedProviders.length === 1 ? mentionedProviders[0] : null;
  const candidates = provider ? icons.filter((icon) => icon.cloud === provider) : icons;

  for (const rule of KEYWORDS) {
    const matchedNeedles = rule.needles.filter((needle) => p.includes(needle));
    if (!matchedNeedles.length) continue;
    // Prefer the provider's product name from the prompt (for example Lambda
    // or Cloud Run), then fall back to the cloud-neutral match fragment.
    const matchedTerms = matchedNeedles.sort((a, b) => b.length - a.length);
    const searchTerms =
      rule.match === "sql database" && matchedTerms.some((term) => term === "sql" || term === "azure sql")
        ? [rule.match, ...matchedTerms]
        : [...matchedTerms, rule.match];
    const icon = searchTerms
      .map((term) => findBestIcon(candidates, term))
      .find((candidate) => candidate !== undefined);
    if (!icon) continue;
    const key = `${rule.tier}:${icon.id}`;
    if (seen.has(key)) continue;
    seen.add(key);
    picked.push({ tier: rule.tier, icon });
  }

  return picked;
}

const COL_W = 280;
const ROW_H = 170;
const NODE_W = 120;
const NODE_H = 120;
const ORIGIN_X = 80;
const ORIGIN_Y = 80;
const GROUP_PAD_X = 30;
const GROUP_PAD_TOP = 50;
const GROUP_PAD_BOTTOM = 30;

const TIER_DISPLAY: Record<Tier, string> = {
  edge: "Edge",
  frontend: "Frontend",
  gateway: "Gateway",
  compute: "Compute",
  messaging: "Messaging",
  data: "Data",
  ops: "Ops",
};

/**
 * Produce an ArchPayload from a free-form prompt + the icon manifest.
 * Returns `null` if no keywords matched (caller can fall back to an empty
 * canvas rather than a single mystery node).
 *
 * Phase-3: now emits ONE group per tier and parents its icon nodes into
 * it. Children use parent-relative coords.
 */
export function promptToArchitecture(
  prompt: string,
  icons: IconLite[],
  opts: { animateEdges?: boolean } = {}
): ArchPayload | null {
  const picked = pickIcons(prompt, icons);
  if (!picked.length) return null;

  const byTier = new Map<Tier, IconLite[]>();
  for (const t of TIER_ORDER) byTier.set(t, []);
  for (const p of picked) byTier.get(p.tier)!.push(p.icon);

  const usedTiers = TIER_ORDER.filter((t) => (byTier.get(t)!.length ?? 0) > 0);

  const nodes: ArchNode[] = [];
  const tierToNodeIds = new Map<Tier, string[]>();

  usedTiers.forEach((tier, colIdx) => {
    const list = byTier.get(tier)!;
    const groupId = `g_${tier}`;
    const groupX = ORIGIN_X + colIdx * COL_W;
    const groupY = ORIGIN_Y;
    const groupW = NODE_W + GROUP_PAD_X * 2;
    const groupH = GROUP_PAD_TOP + list.length * ROW_H + GROUP_PAD_BOTTOM - (ROW_H - NODE_H);

    nodes.push({
      kind: "group",
      id: groupId,
      label: TIER_DISPLAY[tier],
      tier: TIER_DISPLAY[tier],
      x: groupX,
      y: groupY,
      width: groupW,
      height: groupH,
    });

    const ids: string[] = [];
    list.forEach((icon, rowIdx) => {
      const id = `n_${tier}_${rowIdx}_${Math.random().toString(36).slice(2, 6)}`;
      nodes.push({
        kind: "icon",
        id,
        label: icon.label,
        iconId: icon.id,
        iconPath: icon.path,
        // parent-relative
        x: GROUP_PAD_X,
        y: GROUP_PAD_TOP + rowIdx * ROW_H,
        width: NODE_W,
        height: NODE_H,
        parentId: groupId,
      });
      ids.push(id);
    });
    tierToNodeIds.set(tier, ids);
  });

  const edges: ArchEdge[] = [];
  const edgeStyle: ArchEdgeStyle = opts.animateEdges === false ? "solid" : "flow";
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
          label: usedTiers[i] === "messaging" ? "Async" : "HTTPS",
          step: edges.length + 1,
        });
      }
    }
  }

  return { nodes, edges };
}
