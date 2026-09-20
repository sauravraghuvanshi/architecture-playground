/**
 * promptToArchitecture — heuristic prompt-to-graph generator.
 *
 * No LLM call: we tokenize the prompt, match keywords against the icon manifest
 * (label / id / category), assign each match to an architectural "tier"
 * (frontend → gateway → compute → data → observability), then lay tiers out as
 * columns and connect workload tiers with `flow`-styled edges. Operational
 * dependencies are dashed, separate from the request sequence. Secure or
 * production Azure prompts also receive proposed controls and review notes.
 *
 * Why deterministic + heuristic for now:
 *   - Predictable & free (no Azure OpenAI dependency on first paint).
 *   - User can edit immediately — every node is real, every edge is real.
 *   - Replaceable later by `/api/ai/generate-arch` without changing the
 *     consumer signature.
 */
import type { IconLite } from "@/components/diagrammatic/shared/types";
import { resolveServiceIcon, type ServiceProvider } from "./service-identity.ts";
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
 * Product IDs and provider-specific proposals below resolve these requirements;
 * catalog fragments never choose feature icons or change cloud providers.
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
  { tier: "compute", needles: ["azure functions", "function app", "lambda", "function", "functions", "serverless"], match: "function" },
  { tier: "compute", needles: ["container app environment", "container apps environment", "container app", "aca", "container apps"], match: "container apps" },
  { tier: "compute", needles: ["kubernetes", "aks", "eks", "gke", "k8s"], match: "kubernetes" },
  { tier: "compute", needles: ["app service plans", "app service plan", "app service", "web app"], match: "app service" },
  { tier: "compute", needles: ["vm", "virtual machine", "ec2", "compute engine"], match: "virtual machine" },
  { tier: "compute", needles: ["fargate", "ecs"], match: "container" },
  { tier: "compute", needles: ["cloud run"], match: "cloud run" },
  { tier: "compute", needles: ["vertex ai", "vertex"], match: "vertex" },

  // messaging
  { tier: "messaging", needles: ["kafka", "event hub", "eventhub", "event hubs"], match: "event hubs" },
  { tier: "messaging", needles: ["service bus queue", "service bus topic", "service bus", "sqs", "queue"], match: "service bus" },
  { tier: "messaging", needles: ["event grid", "eventbridge", "pub/sub", "pubsub"], match: "event grid" },
  { tier: "messaging", needles: ["webhook", "signalr", "websocket"], match: "signalr" },

  // data
  { tier: "data", needles: ["postgresql", "postgres", "mysql", "azure sql server", "sql server", "sql database", "sql", "rds", "azure sql", "cloud sql"], match: "sql database" },
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
  { tier: "ops", needles: ["key vault managed hsm", "managed hsm", "key vault", "secrets manager", "secret manager"], match: "key vault" },
  { tier: "ops", needles: ["identity", "entra", "azure active directory", "active directory", "iam", "cognito"], match: "azure active directory" },
];

interface Picked {
  tier: Tier;
  icon: IconLite;
}

export interface PromptDiagnostics {
  unmatched: string[];
  assumptions: string[];
}

const PRODUCTS: Record<string, { cloud: ServiceProvider; id: string }> = {
  "front door": { cloud: "azure", id: "azure/networking/azure-front-door" },
  frontdoor: { cloud: "azure", id: "azure/networking/azure-front-door" },
  cloudfront: { cloud: "aws", id: "aws/networking/cloudfront" },
  route53: { cloud: "aws", id: "aws/networking/route-53" },
  "route 53": { cloud: "aws", id: "aws/networking/route-53" },
  "app service": { cloud: "azure", id: "azure/application/application-service" },
  "app service plan": { cloud: "azure", id: "azure/application/app-service-plan" },
  "app service plans": { cloud: "azure", id: "azure/application/app-service-plan" },
  "api management": { cloud: "azure", id: "azure/management/api-management-service" },
  apim: { cloud: "azure", id: "azure/management/api-management-service" },
  "container app": { cloud: "azure", id: "azure/application/container-app" },
  "container apps": { cloud: "azure", id: "azure/application/container-app" },
  "container app environment": { cloud: "azure", id: "azure/application/container-app-environment" },
  "container apps environment": { cloud: "azure", id: "azure/application/container-app-environment" },
  aca: { cloud: "azure", id: "azure/application/container-app" },
  aks: { cloud: "azure", id: "azure/compute/container-kubernetes-service" },
  eks: { cloud: "aws", id: "aws/containers/elastic-kubernetes-service" },
  gke: { cloud: "gcp", id: "gcp/containers/g-k-e" },
  lambda: { cloud: "aws", id: "aws/compute/lambda" },
  "azure functions": { cloud: "azure", id: "azure/application/function-app" },
  "function app": { cloud: "azure", id: "azure/application/function-app" },
  ec2: { cloud: "aws", id: "aws/compute/ec2" },
  "compute engine": { cloud: "gcp", id: "gcp/compute/compute-engine" },
  ecs: { cloud: "aws", id: "aws/containers/elastic-container-service" },
  fargate: { cloud: "aws", id: "aws/compute/fargate" },
  "cloud run": { cloud: "gcp", id: "gcp/compute/cloud-run" },
  "vertex ai": { cloud: "gcp", id: "gcp/ai/vertex-a-i" },
  vertex: { cloud: "gcp", id: "gcp/ai/vertex-a-i" },
  "event hub": { cloud: "azure", id: "azure/application/event-hub" },
  "event hubs": { cloud: "azure", id: "azure/application/event-hub" },
  eventhub: { cloud: "azure", id: "azure/application/event-hub" },
  "service bus": { cloud: "azure", id: "azure/data/service-bus" },
  "service bus queue": { cloud: "azure", id: "azure/data/service-bus-queue" },
  "service bus topic": { cloud: "azure", id: "azure/data/service-bus-topic" },
  sqs: { cloud: "aws", id: "aws/integration/sqs" },
  "event grid": { cloud: "azure", id: "azure/application/event-grid-topic" },
  eventbridge: { cloud: "aws", id: "aws/integration/eventbridge" },
  "pub/sub": { cloud: "gcp", id: "gcp/integration/pub-sub" },
  pubsub: { cloud: "gcp", id: "gcp/integration/pub-sub" },
  signalr: { cloud: "azure", id: "azure/application/signalr" },
  "azure sql": { cloud: "azure", id: "azure/data/sql-database" },
  "azure sql server": { cloud: "azure", id: "azure/data/sql-server" },
  rds: { cloud: "aws", id: "aws/database/rds" },
  "cloud sql": { cloud: "gcp", id: "gcp/database/cloud-s-q-l" },
  cosmos: { cloud: "azure", id: "azure/data/azure-cosmos-db" },
  dynamodb: { cloud: "aws", id: "aws/database/dynamodb" },
  firestore: { cloud: "gcp", id: "gcp/database/firestore" },
  elasticache: { cloud: "aws", id: "aws/database/elasticache" },
  s3: { cloud: "aws", id: "aws/storage/simple-storage-service" },
  gcs: { cloud: "gcp", id: "gcp/storage/cloud-storage" },
  synapse: { cloud: "azure", id: "azure/data/azure-synapse-analytics" },
  databricks: { cloud: "azure", id: "azure/data/azure-databricks" },
  bigquery: { cloud: "gcp", id: "gcp/analytics/big-query" },
  "big query": { cloud: "gcp", id: "gcp/analytics/big-query" },
  "azure openai": { cloud: "azure", id: "azure/ai/azure-openai" },
  "application insights": { cloud: "azure", id: "azure/management/application-insights" },
  "app insights": { cloud: "azure", id: "azure/management/application-insights" },
  cloudwatch: { cloud: "aws", id: "aws/management/cloudwatch" },
  stackdriver: { cloud: "gcp", id: "gcp/management/stackdriver" },
  "log analytics": { cloud: "azure", id: "azure/management/log-analytics-workspace" },
  "key vault": { cloud: "azure", id: "azure/security/key-vault" },
  "key vault managed hsm": { cloud: "azure", id: "azure/security/azure-key-vault-managed-hsm" },
  "secrets manager": { cloud: "aws", id: "aws/security/secrets-manager" },
  "secret manager": { cloud: "gcp", id: "gcp/security/secret-manager" },
  entra: { cloud: "azure", id: "azure/identity/azure-active-directory" },
  "azure active directory": { cloud: "azure", id: "azure/identity/azure-active-directory" },
  iam: { cloud: "aws", id: "aws/security/identity-and-access-management" },
  cognito: { cloud: "aws", id: "aws/security/cognito" },
};

const PROPOSALS: Record<ServiceProvider, Record<string, string>> = {
  azure: {
    dns: "azure/networking/dns-zone-public", firewall: "azure/security/azure-firewall",
    "app service": "azure/application/application-service", static: "azure/application/static-web-app",
    "api management": "azure/management/api-management-service", "load balancer": "azure/networking/load-balancer",
    function: "azure/application/function-app", kubernetes: "azure/compute/container-kubernetes-service",
    "virtual machine": "azure/compute/virtual-machine", "service bus": "azure/data/service-bus",
    "sql database": "azure/data/sql-database", cosmos: "azure/data/azure-cosmos-db",
    redis: "azure/networking/azure-cache-for-redis", "blob storage": "azure/storage/storage-account-blob",
    search: "azure/ai/cognitive-services-search", openai: "azure/ai/azure-openai",
    monitor: "azure/management/azure-monitor", log: "azure/management/log-analytics-workspace",
    "azure active directory": "azure/identity/azure-active-directory",
  },
  aws: {
    cdn: "aws/networking/cloudfront", dns: "aws/networking/route-53",
    "load balancer": "aws/networking/elastic-load-balancing", function: "aws/compute/lambda",
    kubernetes: "aws/containers/elastic-kubernetes-service", "virtual machine": "aws/compute/ec2",
    container: "aws/containers/elastic-container-service", "sql database": "aws/database/rds",
    redis: "aws/database/elasticache", "blob storage": "aws/storage/simple-storage-service",
    monitor: "aws/management/cloudwatch", "azure active directory": "aws/security/identity-and-access-management",
  },
  gcp: {
    "virtual machine": "gcp/compute/compute-engine", kubernetes: "gcp/containers/g-k-e",
    "sql database": "gcp/database/cloud-s-q-l", "blob storage": "gcp/storage/cloud-storage",
  },
};

function lower(s: string): string {
  return s.toLowerCase();
}

function phraseMatches(prompt: string, term: string): Array<{ term: string; start: number; end: number }> {
  const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replaceAll(" ", "[ -]+");
  return [...prompt.matchAll(new RegExp(`(^|[^a-z0-9])(${escaped})(?=$|[^a-z0-9])`, "gi"))].map((match) => ({
    term, start: match.index + match[1].length, end: match.index + match[1].length + match[2].length,
  }));
}

function selectedMentions(prompt: string, terms: string[]): ReturnType<typeof phraseMatches> {
  const occurrences = terms.flatMap((term) => phraseMatches(prompt, term))
    .sort((left, right) => Number(!!PRODUCTS[right.term]) - Number(!!PRODUCTS[left.term]) || (right.end - right.start) - (left.end - left.start));
  const chosen: typeof occurrences = [];
  for (const occurrence of occurrences) {
    if (!chosen.some((other) => occurrence.start < other.end && occurrence.end > other.start)) chosen.push(occurrence);
  }
  return chosen;
}

function pickIcons(prompt: string, icons: IconLite[]): { picked: Picked[]; diagnostics: PromptDiagnostics } {
  const p = lower(prompt);
  const picked: Picked[] = [];
  const seen = new Set<string>();
  const unmatched = new Set<string>();
  const assumptions = new Set<string>();
  const mentionedProviders = [
    /\bazure\b/.test(p) ? "azure" : null,
    /\baws\b|\bamazon web services\b/.test(p) ? "aws" : null,
    /\bgcp\b|\bgoogle cloud\b/.test(p) ? "gcp" : null,
  ].filter((provider): provider is ServiceProvider => provider !== null);
  const provider = mentionedProviders.length === 1 ? mentionedProviders[0] : null;
  const requestedProducts = selectedMentions(p, Object.keys(PRODUCTS)).map(({ term }) => PRODUCTS[term]);
  const providerConflict = !!provider && requestedProducts.some((product) => product.cloud !== provider);
  const explicitlyRequested = new Set(requestedProducts.filter((product) => !provider || product.cloud === provider).map((product) => product.id));

  for (const rule of KEYWORDS) {
    const chosen = selectedMentions(p, rule.needles);
    const specific = chosen.some((match) => PRODUCTS[match.term]);
    const terms = [...new Set(chosen.map((match) => match.term))].filter((term) => {
      const separate = !specific || PRODUCTS[term] || (provider && resolveServiceIcon({ label: term, cloud: provider }, icons));
      if (!separate) assumptions.add(`"${term}" is not modeled separately from the named product; confirm its configuration and coverage.`);
      return separate;
    });
    for (const term of terms) {
      const product = PRODUCTS[term];
      if (product && provider && product.cloud !== provider) {
        unmatched.add(`"${term}" belongs to ${product.cloud.toUpperCase()}, not the requested ${provider.toUpperCase()}; no cross-cloud substitute was added.`);
        continue;
      }
      let icon: IconLite | undefined;
      if (product) icon = icons.find((item) => item.id === product.id && item.cloud === product.cloud);
      else if (provider) {
        icon = resolveServiceIcon({ label: term, cloud: provider }, icons);
        // Engine names and branded products must not fall through to a different service.
        if (!icon && !["postgres", "postgresql", "mysql", "sql server", "managed hsm", "kafka", "ai foundry", "ai studio", "active directory"].includes(term)) {
          const proposal = term === "waf"
            ? provider === "azure" ? "azure/security/waf-policy" : provider === "aws" ? "aws/security/waf" : undefined
            : PROPOSALS[provider][rule.match];
          if (!providerConflict || (proposal && explicitlyRequested.has(proposal))) {
            icon = icons.find((item) => item.id === proposal && item.cloud === provider);
            if (icon && !explicitlyRequested.has(icon.id)) assumptions.add(`"${term}" is represented by a proposed ${icon.label}; confirm the service and configuration.`);
          }
        }
      }
      if (!icon) {
        unmatched.add(`"${term}" has no unambiguous ${product?.cloud.toUpperCase() ?? provider?.toUpperCase() ?? "provider-specific"} catalog selection; add or clarify it manually.`);
        continue;
      }
      if (seen.has(icon.id)) continue;
      seen.add(icon.id);
      picked.push({ tier: rule.tier, icon });
    }
  }

  return { picked, diagnostics: { unmatched: [...unmatched], assumptions: [...assumptions] } };
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
 * Emits one group per tier with parent-relative child coordinates. Explicit
 * simple templates keep their scope; guidedDesign can override inferred intent.
 */
export function promptToArchitecture(
  prompt: string,
  icons: IconLite[],
  opts: { animateEdges?: boolean; guidedDesign?: boolean } = {}
): ArchPayload | null {
  return buildPromptArchitecture(prompt, icons, opts).payload;
}

export function buildPromptArchitecture(
  prompt: string,
  icons: IconLite[],
  opts: { animateEdges?: boolean; guidedDesign?: boolean } = {},
): { payload: ArchPayload | null; diagnostics: PromptDiagnostics } {
  if (prompt.length > 8000) return {
    payload: null,
    diagnostics: { unmatched: ["The prompt exceeds 8,000 characters. Shorten it before generating a draft."], assumptions: [] },
  };
  const azureOnly = /\bazure\b/i.test(prompt) && !/\baws\b|\bamazon web services\b|\bgcp\b|\bgoogle cloud\b/i.test(prompt);
  const guided = opts.guidedDesign ?? (azureOnly && /\b(secure|enterprise|production|resilient|compliance|landing zone|business)\b/i.test(prompt));
  const selection = pickIcons(prompt, icons);
  let picked = selection.picked;
  if (guided && azureOnly) {
    if (!picked.length && !selection.diagnostics.unmatched.length && /\b(app|application|platform|system|portal|workload|solution)\b/i.test(prompt)) {
      picked = pickIcons("Azure App Service and Azure SQL", icons).picked;
      if (picked.length) selection.diagnostics.assumptions.push("App Service and Azure SQL are proposed starting services, not explicit requirements.");
    }
    if (picked.length) {
      const controls = pickIcons("Azure Active Directory, Key Vault, and Monitor", icons).picked;
      for (const control of controls) {
        if (!picked.some((item) => item.icon.id === control.icon.id)) picked.push(control);
      }
    }
  }
  if (!picked.length) return { payload: null, diagnostics: selection.diagnostics };

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
      const id = `n_${tier}_${rowIdx}`;
      nodes.push({
        kind: "icon",
        id,
        label: icon.id === "azure/application/application-service" ? "Azure App Service"
          : guided && icon.id === "azure/identity/azure-active-directory" ? "Microsoft Entra ID" : icon.label,
        iconId: icon.id,
        iconPath: icon.path,
        // parent-relative
        x: GROUP_PAD_X,
        y: GROUP_PAD_TOP + rowIdx * ROW_H,
        width: NODE_W,
        height: NODE_H,
        parentId: groupId,
        ...(guided && azureOnly && tier === "ops" ? { subtitle: "Proposed shared control - validate configuration and ownership." } : {}),
      });
      ids.push(id);
    });
    tierToNodeIds.set(tier, ids);
  });

  const edges: ArchEdge[] = [];
  const edgeStyle: ArchEdgeStyle = opts.animateEdges === false ? "solid" : "flow";
  const flowTiers = usedTiers.filter((tier) => tier !== "ops");
  for (let i = 0; i < flowTiers.length - 1; i++) {
    const fromIds = tierToNodeIds.get(flowTiers[i]) ?? [];
    const toIds = tierToNodeIds.get(flowTiers[i + 1]) ?? [];
    for (const a of fromIds) {
      for (const b of toIds) {
        edges.push({
          id: `e_${a}_${b}`,
          source: a,
          target: b,
          style: edgeStyle,
          label: flowTiers[i] === "messaging" ? "Async" : "HTTPS",
          step: edges.length + 1,
        });
      }
    }
  }

  // Control-plane dependencies are not stages in the animated request path.
  const workloadIds = tierToNodeIds.get("compute") ?? tierToNodeIds.get("frontend") ?? tierToNodeIds.get("data") ?? [];
  for (const source of workloadIds) {
    for (const target of tierToNodeIds.get("ops") ?? []) {
      edges.push({ id: `e_${source}_${target}`, source, target, style: "dashed", label: "Operational dependency (proposed)" });
    }
  }

  if (guided && azureOnly) {
    const notes = [
      ["Identity and security", "Proposed: Entra ID, managed identities and least-privilege RBAC. Validate network isolation, TLS, secrets and threat protection."],
      ["Operations and governance", "Proposed: telemetry, actionable alerts, ownership, Azure Policy, subscription boundaries and repeatable IaC. Reuse shared landing-zone services."],
      ["Reliability and recovery", "Define SLO, RTO and RPO; assess zone redundancy and backups. Test restore and failover. Multi-region depends on residency, cost and business need."],
      ["Business tradeoffs", "Confirm budget, demand, data residency and regulatory obligations. Estimate service and operations costs; validate scaling under load."],
      ["Guided draft - not deployed", "Suggested design only. Icons do not prove configuration, availability or compliance. Review assumptions and validate with workload owners before deployment."],
    ];
    const y = ORIGIN_Y + Math.max(...nodes.filter((node) => node.kind === "group").map((node) => node.height ?? 0)) + 70;
    nodes.push({ kind: "group", id: "g_design_guidance", label: "Design review checkpoints (proposed)", x: ORIGIN_X, y, width: 1100, height: 460 });
    notes.forEach(([label, subtitle], index) => {
      nodes.push({
        kind: "shape", shape: "document", id: `design_note_${index}`, label, subtitle,
        parentId: "g_design_guidance", x: 30 + (index % 3) * 350, y: 60 + Math.floor(index / 3) * 190,
        width: 320, height: 160,
      });
    });
  }

  return { payload: { nodes, edges }, diagnostics: selection.diagnostics };
}
