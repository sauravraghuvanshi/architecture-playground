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
  const confirmed = new Set(confirmedQuestionIds);
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
