export type CafMethodologyId =
  | "strategy"
  | "plan"
  | "ready"
  | "adopt"
  | "govern"
  | "secure"
  | "manage";

export interface CafMethodology {
  id: CafMethodologyId;
  order: number;
  title: string;
  type: "foundational" | "operational";
  outcome: string;
  actions: string[];
  sourceUrl: string;
}

export const CAF_METHODOLOGIES: CafMethodology[] = [
  {
    id: "strategy",
    order: 1,
    title: "Strategy",
    type: "foundational",
    outcome: "Cloud adoption aligned to measurable business goals.",
    actions: [
      "Document motivations, business outcomes, and executive sponsorship.",
      "Define financial, agility, sustainability, security, and resilience success measures.",
    ],
    sourceUrl: "https://learn.microsoft.com/azure/cloud-adoption-framework/strategy/",
  },
  {
    id: "plan",
    order: 2,
    title: "Plan",
    type: "foundational",
    outcome: "An actionable adoption plan, operating model, skills plan, and workload backlog.",
    actions: [
      "Create a rationalized digital-estate inventory and workload priorities.",
      "Define the cloud operating model, accountable teams, skills gaps, timeline, and cost estimate.",
    ],
    sourceUrl: "https://learn.microsoft.com/azure/cloud-adoption-framework/plan/",
  },
  {
    id: "ready",
    order: 3,
    title: "Ready",
    type: "foundational",
    outcome: "An Azure environment prepared for platform and application workloads.",
    actions: [
      "Establish tenant, billing, platform landing zone, and application landing zone decisions.",
      "Automate identity, connectivity, management, governance, security, and subscription vending.",
    ],
    sourceUrl: "https://learn.microsoft.com/azure/cloud-adoption-framework/ready/",
  },
  {
    id: "adopt",
    order: 4,
    title: "Adopt",
    type: "foundational",
    outcome: "Migrated, modernized, or cloud-native workloads meeting business needs.",
    actions: [
      "Select migrate, modernize, rearchitect, rebuild, replace, retain, or retire per workload.",
      "Deliver iteratively with workload architecture, testing, cutover, and benefits realization.",
    ],
    sourceUrl: "https://learn.microsoft.com/azure/cloud-adoption-framework/adopt/",
  },
  {
    id: "govern",
    order: 5,
    title: "Govern",
    type: "operational",
    outcome: "Cloud risks controlled through policy, cost, compliance, and resource consistency.",
    actions: [
      "Assess risks and define governance disciplines, ownership, policies, and exemptions.",
      "Monitor compliance and evolve controls as the estate and risk profile change.",
    ],
    sourceUrl: "https://learn.microsoft.com/azure/cloud-adoption-framework/govern/",
  },
  {
    id: "secure",
    order: 6,
    title: "Secure",
    type: "operational",
    outcome: "Workloads protected through organizational, people, process, and technology controls.",
    actions: [
      "Establish a security strategy, roles, security operations, and posture management.",
      "Apply zero trust, identity, network, data, application, and infrastructure controls.",
    ],
    sourceUrl: "https://learn.microsoft.com/azure/cloud-adoption-framework/secure/",
  },
  {
    id: "manage",
    order: 7,
    title: "Manage",
    type: "operational",
    outcome: "Workloads administered and optimized against business commitments.",
    actions: [
      "Define service commitments, operations baselines, ownership, and escalation paths.",
      "Continuously improve reliability, performance, cost, security, and operational efficiency.",
    ],
    sourceUrl: "https://learn.microsoft.com/azure/cloud-adoption-framework/manage/",
  },
];

export interface CafProgress {
  completed: number;
  total: number;
  percentage: number;
  next: CafMethodology | null;
}

export function getCafProgress(completedIds: readonly CafMethodologyId[]): CafProgress {
  const completed = new Set(completedIds);
  const next = CAF_METHODOLOGIES.find((methodology) => !completed.has(methodology.id)) ?? null;
  return {
    completed: completed.size,
    total: CAF_METHODOLOGIES.length,
    percentage: Math.round((completed.size / CAF_METHODOLOGIES.length) * 100),
    next,
  };
}
