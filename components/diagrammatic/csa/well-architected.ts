import { azureResourceKind } from "../../../lib/service-identity.ts";

export type WafPillarId =
  | "reliability"
  | "security"
  | "cost-optimization"
  | "operational-excellence"
  | "performance-efficiency";

export interface WafQuestion {
  id: string;
  text: string;
  recommendation: string;
}

export interface WafPillar {
  id: WafPillarId;
  title: string;
  objective: string;
  sourceUrl: string;
  questions: WafQuestion[];
}

export const WAF_PILLARS: WafPillar[] = [
  {
    id: "reliability",
    title: "Reliability",
    objective: "Remain available, recover from failures, and meet recovery targets.",
    sourceUrl: "https://learn.microsoft.com/azure/well-architected/reliability/",
    questions: [
      {
        id: "rel-targets",
        text: "SLOs, availability targets, RTO, and RPO are documented and tested.",
        recommendation: "Define measurable reliability targets and validate them through exercises.",
      },
      {
        id: "rel-redundancy",
        text: "Critical components avoid single points of failure across fault boundaries.",
        recommendation: "Use appropriate zone, region, data, and dependency redundancy.",
      },
      {
        id: "rel-recovery",
        text: "Failure detection, self-healing, backup, restore, and disaster recovery are exercised.",
        recommendation: "Automate safe recovery and regularly test degraded and disaster scenarios.",
      },
    ],
  },
  {
    id: "security",
    title: "Security",
    objective: "Protect confidentiality, integrity, and availability through zero-trust controls.",
    sourceUrl: "https://learn.microsoft.com/azure/well-architected/security/",
    questions: [
      {
        id: "sec-identity",
        text: "Managed identity, least privilege, MFA, and privileged-access controls are used.",
        recommendation: "Remove embedded credentials and enforce least-privilege identity controls.",
      },
      {
        id: "sec-network",
        text: "Ingress, egress, private access, segmentation, and threat protection are explicit.",
        recommendation: "Apply defense in depth to every network trust boundary.",
      },
      {
        id: "sec-data",
        text: "Data classification, encryption, key management, logging, and incident response are defined.",
        recommendation: "Map data sensitivity to preventive, detective, and response controls.",
      },
    ],
  },
  {
    id: "cost-optimization",
    title: "Cost Optimization",
    objective: "Deliver business value while controlling waste and financial risk.",
    sourceUrl: "https://learn.microsoft.com/azure/well-architected/cost-optimization/",
    questions: [
      {
        id: "cost-model",
        text: "A workload cost model, budget, ownership, and unit economics are defined.",
        recommendation: "Connect cloud spend to workload demand, owners, and business outcomes.",
      },
      {
        id: "cost-demand",
        text: "Resources scale with demand and idle or overprovisioned capacity is identified.",
        recommendation: "Rightsize, autoscale, schedule, and decommission based on measured utilization.",
      },
      {
        id: "cost-optimize",
        text: "Commitment discounts, storage lifecycle, licensing, and architecture tradeoffs are reviewed.",
        recommendation: "Run recurring optimization reviews and record accepted cost tradeoffs.",
      },
    ],
  },
  {
    id: "operational-excellence",
    title: "Operational Excellence",
    objective: "Run, observe, release, and improve the workload safely and repeatably.",
    sourceUrl: "https://learn.microsoft.com/azure/well-architected/operational-excellence/",
    questions: [
      {
        id: "ops-iac",
        text: "Infrastructure, configuration, policy, and releases are automated and version controlled.",
        recommendation: "Use reviewed deployment pipelines and immutable, repeatable artifacts.",
      },
      {
        id: "ops-observe",
        text: "Health models, logs, metrics, traces, alerts, dashboards, and ownership are defined.",
        recommendation: "Design observability around user journeys and actionable service health.",
      },
      {
        id: "ops-response",
        text: "Runbooks, incident response, rollback, post-incident learning, and change safety are practiced.",
        recommendation: "Exercise operational response and feed learning back into engineering.",
      },
    ],
  },
  {
    id: "performance-efficiency",
    title: "Performance Efficiency",
    objective: "Meet demand and latency targets efficiently as conditions change.",
    sourceUrl: "https://learn.microsoft.com/azure/well-architected/performance-efficiency/",
    questions: [
      {
        id: "perf-targets",
        text: "Latency, throughput, concurrency, saturation, and user-experience targets are measurable.",
        recommendation: "Define performance requirements and observe them at workload boundaries.",
      },
      {
        id: "perf-scale",
        text: "Scaling, partitioning, caching, asynchronous work, and load shedding are intentional.",
        recommendation: "Match scaling and data patterns to realistic demand and failure conditions.",
      },
      {
        id: "perf-test",
        text: "Representative load, stress, soak, and capacity tests inform production limits.",
        recommendation: "Continuously test capacity assumptions and tune the highest-impact bottlenecks.",
      },
    ],
  },
];

export interface WafAssessment {
  confirmed: number;
  total: number;
  percentage: number;
  pillarScores: Record<WafPillarId, number>;
  gaps: Array<{ pillar: string; text: string; recommendation: string }>;
}

export function assessWellArchitected(confirmedQuestionIds: readonly string[]): WafAssessment {
  const validIds = new Set(WAF_PILLARS.flatMap((pillar) => pillar.questions.map((question) => question.id)));
  const confirmed = new Set(confirmedQuestionIds.filter((id) => validIds.has(id)));
  const total = WAF_PILLARS.reduce((sum, pillar) => sum + pillar.questions.length, 0);
  const pillarScores = {} as Record<WafPillarId, number>;
  const gaps: WafAssessment["gaps"] = [];

  for (const pillar of WAF_PILLARS) {
    const met = pillar.questions.filter((question) => confirmed.has(question.id)).length;
    pillarScores[pillar.id] = Math.round((met / pillar.questions.length) * 100);
    for (const question of pillar.questions) {
      if (!confirmed.has(question.id)) {
        gaps.push({
          pillar: pillar.title,
          text: question.text,
          recommendation: question.recommendation,
        });
      }
    }
  }
  return {
    confirmed: confirmed.size,
    total,
    percentage: Math.round((confirmed.size / total) * 100),
    pillarScores,
    gaps,
  };
}

/** Accepts serialized canvas payloads and untrusted imported JSON, never React Flow state. */
export interface WafDiagramPayload {
  nodes: readonly unknown[];
  edges: readonly unknown[];
}

export type WafEvidenceStatus = "observed" | "unknown" | "risk";

export interface WafDiagramFinding {
  id: string;
  pillar: WafPillarId;
  title: string;
  status: WafEvidenceStatus;
  priority: "high" | "medium" | "low";
  evidence: string;
  nodeIds: string[];
  edgeIds: string[];
  recommendation: string;
  playbook: { steps: string[]; validation: string; tradeoff: string };
  sourceUrl: string;
}

export interface WafDiagramAssessment {
  version: "waf-diagram-v1";
  fingerprint: string;
  score: number;
  pillarScores: Record<WafPillarId, number>;
  findings: WafDiagramFinding[];
  observed: number;
  unknown: number;
  serviceCount: number;
  warnings: string[];
  snapshot: { nodes: Record<string, string>; edges: Record<string, string> };
}

export interface WafAssessmentDiff {
  changed: boolean;
  scoreDelta: number;
  pillarDeltas: Record<WafPillarId, number>;
  addedNodeIds: string[];
  removedNodeIds: string[];
  changedNodeIds: string[];
  addedEdgeIds: string[];
  removedEdgeIds: string[];
  changedEdgeIds: string[];
  improvedFindingIds: string[];
  regressedFindingIds: string[];
}

interface EvidenceNode {
  id: string;
  kind: string;
  label: string;
  iconId: string;
  parentId: string;
  subtitle: string;
  provider: string;
}

interface EvidenceEdge {
  id: string;
  source: string;
  target: string;
  label: string;
}

type Signal =
  | "workload" | "distribution" | "backup" | "secrets" | "private"
  | "budget" | "autoscale" | "monitor" | "delivery" | "cache" | "queue";

// Match service identity, not prose: a label such as "no backup" is not backup evidence.
const SIGNAL_SLUGS: Record<Signal, readonly string[]> = {
  workload: ["app-service", "app-services", "application-service", "function-app", "function-apps", "functions", "kubernetes-services", "container-kubernetes-service", "aks", "container-app", "container-apps", "virtual-machine", "virtual-machines", "virtual-machine-scale-set", "virtual-machine-scale-sets", "sql-database", "sql-databases", "cosmos-db", "azure-cosmos-db", "storage-account", "storage-accounts", "api-management", "openai", "azure-openai"],
  distribution: ["front-door", "front-doors", "azure-front-door", "load-balancer", "load-balancers", "application-gateway", "application-gateways", "traffic-manager-profile", "traffic-manager-profiles"],
  backup: ["backup", "azure-backup", "recovery-services", "recovery-services-vault", "recovery-services-vaults", "backup-vault", "backup-vaults", "app-service-backup"],
  secrets: ["key-vault", "key-vaults", "managed-identity", "managed-identities"],
  private: ["private-link", "private-endpoint", "private-endpoints"],
  budget: ["cost-management", "cost-management-and-billing", "budget", "budgets"],
  autoscale: ["autoscale", "autoscale-settings", "virtual-machine-scale-set", "virtual-machine-scale-sets", "app-scale-out", "app-service-scale-out", "function-app-scale-out", "api-management-scale-out-auto-scale"],
  monitor: ["monitor", "azure-monitor", "application-insights", "log-analytics-workspace", "log-analytics-workspaces", "log-analytics"],
  delivery: ["azure-devops", "devops", "pipelines", "azure-pipelines"],
  cache: ["cache-redis", "cache-for-redis", "azure-cache-for-redis", "redis", "cdn-profile", "cdn-profiles", "cdn"],
  queue: ["service-bus", "service-bus-queue", "service-bus-queues", "event-hub", "event-hubs", "event-grid-topic", "event-grid-topics", "storage-account-queue", "queues"],
};

interface DiagramRule {
  id: string;
  pillar: WafPillarId;
  title: string;
  signal: Signal;
  recommendation: string;
  validation: string;
  tradeoff: string;
}

const DIAGRAM_RULES: readonly DiagramRule[] = [
  { id: "rel-distribution", pillar: "reliability", title: "Traffic distribution path", signal: "distribution", recommendation: "Model ingress and its workload connections; choose redundancy from the workload SLO and failure model.", validation: "Inspect origin count, zones, health probes and failover settings in IaC, then exercise failover against RTO/RPO.", tradeoff: "Extra replicas and regions increase cost and operational complexity; a routing icon alone proves neither redundancy nor failover." },
  { id: "rel-backup", pillar: "reliability", title: "Recovery dependency", signal: "backup", recommendation: "Identify stateful dependencies, document backup scope, and connect recovery services where applicable.", validation: "Verify supported backup policies and perform a restore test with measured RTO and RPO.", tradeoff: "Retention and replicas add cost; not every managed service uses a separate backup vault." },
  { id: "sec-secrets", pillar: "security", title: "Identity or secrets dependency", signal: "secrets", recommendation: "Model workload identity and secret access; prefer managed identity with least-privilege roles.", validation: "Inspect role assignments, disable unnecessary credentials, and test denied access as well as allowed access.", tradeoff: "A Key Vault connection does not prove managed identity, RBAC, rotation, or that secrets are absent from code." },
  { id: "sec-private", pillar: "security", title: "Private access path", signal: "private", recommendation: "Model private endpoints and trust boundaries for sensitive dependencies where the threat model requires them.", validation: "Verify DNS, public-access settings, routing and authorized connectivity from each trust boundary.", tradeoff: "Private networking adds DNS and operating costs; public endpoints can be appropriate with other controls." },
  { id: "cost-budget", pillar: "cost-optimization", title: "Cost management dependency", signal: "budget", recommendation: "Identify cost ownership, budgets, alert recipients and workload scope in the design.", validation: "Check billing scope and alert delivery; compare measured unit cost with the approved budget.", tradeoff: "Budgets alert rather than cap spending; an icon provides no evidence of savings." },
  { id: "cost-demand", pillar: "cost-optimization", title: "Demand-based capacity pattern", signal: "autoscale", recommendation: "Model demand-based capacity and idle-resource policies using measured utilization.", validation: "Inspect scaling limits, schedules and SKU support; compare costs before and after representative load.", tradeoff: "Scaling can raise spend or introduce cold starts; do not assume a managed service is configured to autoscale." },
  { id: "ops-observe-path", pillar: "operational-excellence", title: "Observability dependency", signal: "monitor", recommendation: "Connect telemetry collection to workload components and identify an operational owner.", validation: "Verify instrumentation, diagnostic settings and actionable alerts with a synthetic failure.", tradeoff: "Monitoring icons do not prove logs or alerts are enabled; ingestion and retention have costs." },
  { id: "ops-delivery", pillar: "operational-excellence", title: "Automated delivery dependency", signal: "delivery", recommendation: "Model reviewed, repeatable deployment paths and rollback ownership.", validation: "Inspect pipeline permissions and approvals, then rehearse a failed deployment and rollback.", tradeoff: "Automation needs maintenance and scoped identities; a pipeline icon does not prove safe releases." },
  { id: "perf-cache", pillar: "performance-efficiency", title: "Caching or content delivery path", signal: "cache", recommendation: "Model caching for a measured hot path only when latency and consistency requirements justify it.", validation: "Load test hit rate, latency, invalidation and cache-failure behavior against explicit targets.", tradeoff: "Caching increases cost and consistency complexity and is not necessary for every workload." },
  { id: "perf-queue", pillar: "performance-efficiency", title: "Asynchronous integration path", signal: "queue", recommendation: "Model asynchronous work where buffering or decoupling supports throughput requirements.", validation: "Test backlog, consumer capacity, retries, dead-letter handling and end-to-end latency.", tradeoff: "Messaging adds latency and delivery semantics; an edge does not prove consumer scaling or idempotency." },
];

const record = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);
const text = (value: unknown): string => typeof value === "string" ? value : "";
const ordered = (values: Iterable<string>): string[] => [...new Set(values)].sort();
const matchesSignal = (node: EvidenceNode, signal: Signal): boolean => {
  if (node.kind !== "icon" || !node.iconId.startsWith("azure/") || (node.provider && node.provider !== "azure")) return false;
  const slug = node.iconId.split("/").at(-1) ?? "";
  if (signal === "workload") {
    const kind = azureResourceKind(node.iconId, node.provider || undefined);
    if (kind === "search" || kind === "container-apps") return true;
    if (["container-app", "container-apps"].includes(slug)) return false;
  }
  return SIGNAL_SLUGS[signal].includes(slug);
};

export const WAF_DIAGRAM_METHODOLOGY =
  "Each pillar scores three equally weighted checks: two connected diagram patterns and one deployment-validation check. Observed diagram patterns earn credit; unknowns earn none. Deployment validation remains unknown from a canvas, so diagram-only scores cannot exceed 67/100. Missing evidence is not proof of a defect. Scores are discovery indicators, not an official Azure assessment, compliance certification, or proof of deployed controls.";

export function assessDiagramWellArchitected(payload: WafDiagramPayload): WafDiagramAssessment {
  const warnings: string[] = [];
  const nodes: EvidenceNode[] = [];
  const edges: EvidenceEdge[] = [];
  const nodeCounts = new Map<string, number>();
  const edgeCounts = new Map<string, number>();
  for (const value of payload.nodes) {
    if (record(value) && text(value.id)) nodeCounts.set(text(value.id), (nodeCounts.get(text(value.id)) ?? 0) + 1);
  }
  for (const value of payload.edges) {
    if (record(value) && text(value.id)) edgeCounts.set(text(value.id), (edgeCounts.get(text(value.id)) ?? 0) + 1);
  }
  for (const value of payload.nodes) {
    if (!record(value) || !text(value.id) || nodeCounts.get(text(value.id)) !== 1) {
      warnings.push("A node has a missing or duplicate ID and was excluded from assessment.");
      continue;
    }
    nodes.push({
      id: text(value.id), kind: text(value.kind) || "icon",
      label: text(value.label), iconId: text(value.iconId),
      parentId: text(value.parentId), subtitle: text(value.subtitle),
      provider: record(value.semantics) && text(value.semantics.provider)
        ? text(value.cloud) && text(value.cloud) !== text(value.semantics.provider) ? "conflicting" : text(value.semantics.provider)
        : text(value.cloud),
    });
  }
  nodes.sort((a, b) => a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
  const nodeMap = new Map(nodes.map((node) => [node.id, node]));
  for (const value of payload.edges) {
    if (!record(value) || !text(value.id) || edgeCounts.get(text(value.id)) !== 1) {
      warnings.push("An edge has a missing or duplicate ID and was excluded from assessment.");
      continue;
    }
    edges.push({ id: text(value.id), source: text(value.source), target: text(value.target), label: text(value.label) });
  }
  edges.sort((a, b) => a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
  const validEdges = edges.filter((edge) => edge.source !== edge.target && nodeMap.has(edge.source) && nodeMap.has(edge.target));
  const invalidEdges = edges.filter((edge) => !validEdges.includes(edge));
  const services = nodes.filter((node) => node.kind === "icon" && node.iconId);
  const workload = nodes.filter((node) => matchesSignal(node, "workload"));
  if (!services.length) warnings.push("No service icons to assess. Add architecture services and connections.");
  else if (!workload.length) warnings.push("No supported Azure workload service was recognized; unsupported services remain unknown.");
  const unsupported = services.filter((node) => !(Object.keys(SIGNAL_SLUGS) as Signal[]).some((signal) => matchesSignal(node, signal)));
  if (unsupported.length) warnings.push(`Unrecognized service IDs (not assessed): ${unsupported.map((node) => node.id).join(", ")}.`);
  const findings: WafDiagramFinding[] = DIAGRAM_RULES.map((rule) => {
    const candidates = nodes.filter((node) => matchesSignal(node, rule.signal));
    const candidateIds = new Set(candidates.map((node) => node.id));
    const workloadIds = new Set(workload.map((node) => node.id));
    const connections = validEdges.filter((edge) =>
      (candidateIds.has(edge.source) && workloadIds.has(edge.target)) ||
      (candidateIds.has(edge.target) && workloadIds.has(edge.source))
    );
    const nodeIds = ordered(connections.flatMap((edge) => [edge.source, edge.target]));
    const observed = connections.length > 0;
    const pillar = WAF_PILLARS.find((value) => value.id === rule.pillar)!;
    return {
      id: rule.id, pillar: rule.pillar, title: rule.title,
      status: observed ? "observed" : "unknown",
      priority: observed ? "low" : rule.pillar === "security" || rule.pillar === "reliability" ? "high" : "medium",
      evidence: observed
        ? `Depicted service connections: ${connections.map((edge) => `${edge.id}: ${nodeMap.get(edge.source)!.label || edge.source} [${edge.source}] -> ${nodeMap.get(edge.target)!.label || edge.target} [${edge.target}]`).join("; ")}. Configuration and runtime behavior are not verified.`
        : candidates.length
          ? `Service icon(s) ${candidates.map((node) => `${node.label || node.id} [${node.id}]`).join(", ")} are present, but no direct connection to a recognized workload is depicted. Actual coverage is unknown.`
          : "No recognized connected pattern is depicted. This is an evidence gap, not a claim that the control is absent or required.",
      nodeIds: observed ? nodeIds : candidates.map((node) => node.id),
      edgeIds: connections.map((edge) => edge.id),
      recommendation: rule.recommendation,
      playbook: {
        steps: ["Confirm applicability and workload requirements with the owner before changing infrastructure.", rule.recommendation, "Update the canvas with the actual service IDs and explicit workload connections; reassess the diagram."],
        validation: rule.validation, tradeoff: rule.tradeoff,
      },
      sourceUrl: pillar.sourceUrl,
    };
  });
  for (const pillar of WAF_PILLARS) {
    findings.push({
      id: `${pillar.id}-validation`, pillar: pillar.id, title: `${pillar.title} deployment validation`,
      status: "unknown", priority: "medium", nodeIds: workload.map((node) => node.id), edgeIds: [],
      evidence: "A canvas cannot verify deployed settings, policies, business targets or test results. Labels and questionnaire answers are not assessed evidence.",
      recommendation: pillar.questions[0].recommendation,
      playbook: {
        steps: ["Agree measurable workload requirements and applicability.", pillar.questions[0].recommendation, "Review IaC and deployed configuration with the owner; retain dated test evidence outside this diagram assessment."],
        validation: pillar.questions[0].text,
        tradeoff: "Balance this pillar against the other four; do not add services only to increase diagram coverage.",
      },
      sourceUrl: pillar.sourceUrl,
    });
  }
  if (invalidEdges.length) findings.push({
    id: "ops-invalid-edges", pillar: "operational-excellence", title: "Invalid diagram connections",
    status: "risk", priority: "high", nodeIds: [],
    edgeIds: invalidEdges.map((edge) => edge.id),
    evidence: `These diagram edges have missing endpoints or self-connections: ${invalidEdges.map((edge) => edge.id).join(", ")}. They were excluded; this is a diagram defect, not a deployed outage.`,
    recommendation: "Repair or remove invalid connections so the diagram accurately communicates dependencies.",
    playbook: { steps: ["Locate each listed edge.", "Reconnect to distinct existing service nodes or remove obsolete edges.", "Reassess the updated canvas."], validation: "Every edge references two distinct existing nodes.", tradeoff: "Removing an edge can hide a real dependency; confirm the intended path with its owner." },
    sourceUrl: WAF_PILLARS.find((pillar) => pillar.id === "operational-excellence")!.sourceUrl,
  });
  const priorities = { high: 0, medium: 1, low: 2 };
  findings.sort((a, b) => priorities[a.priority] - priorities[b.priority] || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  const pillarScores: Record<WafPillarId, number> = {
    reliability: 0, security: 0, "cost-optimization": 0,
    "operational-excellence": 0, "performance-efficiency": 0,
  };
  for (const pillar of WAF_PILLARS) {
    const observed = findings.filter((finding) => finding.pillar === pillar.id && finding.status === "observed").length;
    pillarScores[pillar.id] = Math.round(observed / 3 * 100);
  }
  const snapshot = {
    nodes: Object.fromEntries(nodes.map((node) => [node.id, JSON.stringify(node)])),
    edges: Object.fromEntries(edges.map((edge) => [edge.id, JSON.stringify(edge)])),
  };
  return {
    version: "waf-diagram-v1", fingerprint: JSON.stringify({ snapshot, warnings: ordered(warnings) }),
    score: Math.round(WAF_PILLARS.reduce((sum, pillar) => sum + pillarScores[pillar.id], 0) / 5),
    pillarScores, findings, observed: findings.filter((finding) => finding.status === "observed").length,
    unknown: findings.filter((finding) => finding.status === "unknown").length,
    serviceCount: services.length, warnings: ordered(warnings), snapshot,
  };
}

export function diffWafAssessments(previous: WafDiagramAssessment, current: WafDiagramAssessment): WafAssessmentDiff {
  const changedIds = (before: Record<string, string>, after: Record<string, string>) => ({
    added: Object.keys(after).filter((id) => !Object.hasOwn(before, id)).sort(),
    removed: Object.keys(before).filter((id) => !Object.hasOwn(after, id)).sort(),
    changed: Object.keys(after).filter((id) => Object.hasOwn(before, id) && before[id] !== after[id]).sort(),
  });
  const nodes = changedIds(previous.snapshot.nodes, current.snapshot.nodes);
  const edges = changedIds(previous.snapshot.edges, current.snapshot.edges);
  const pillarDeltas = { ...current.pillarScores };
  for (const pillar of WAF_PILLARS) pillarDeltas[pillar.id] -= previous.pillarScores[pillar.id];
  const before = new Map(previous.findings.map((finding) => [finding.id, finding.status]));
  return {
    changed: previous.fingerprint !== current.fingerprint, scoreDelta: current.score - previous.score, pillarDeltas,
    addedNodeIds: nodes.added, removedNodeIds: nodes.removed, changedNodeIds: nodes.changed,
    addedEdgeIds: edges.added, removedEdgeIds: edges.removed, changedEdgeIds: edges.changed,
    improvedFindingIds: current.findings.filter((finding) => finding.status === "observed" && before.get(finding.id) !== "observed").map((finding) => finding.id),
    regressedFindingIds: current.findings.filter((finding) => finding.status !== "observed" && before.get(finding.id) === "observed").map((finding) => finding.id),
  };
}
