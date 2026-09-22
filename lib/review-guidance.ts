export type ReviewFramework = "Azure Architecture Center" | "Azure Landing Zones" | "Cloud Adoption Framework" | "Well-Architected Framework";
export interface ReviewGuidance {
  id: string;
  framework: ReviewFramework;
  title: string;
  url: string;
  summary: string;
  applicability: string;
  validationEvidence: string;
}

export const REVIEW_GUIDANCE_VERSION = "2026-09-22.1";
export const REVIEW_GUIDANCE_REVIEWED_AT = "2026-09-22";

// Original summaries of the linked first-party guidance, not customer evidence.
export const REVIEW_GUIDANCE: readonly ReviewGuidance[] = [
  {
    id: "aac-retry", framework: "Azure Architecture Center", title: "Retry pattern",
    url: "https://learn.microsoft.com/en-us/azure/architecture/patterns/retry",
    summary: "Retry plausibly transient failures with bounded attempts and delays suited to latency requirements. Account for idempotency and existing SDK retries, avoid compounded retry layers, and surface exhausted retries as failures.",
    applicability: "Remote calls where a repeat could succeed after a short interruption, not business-logic errors or persistently inadequate capacity.",
    validationEvidence: "Effective application/SDK policies, retryable-error classification, limits, delays, timeouts and idempotency safeguards; fault tests proving bounded latency and no duplicate side effects.",
  },
  {
    id: "aac-circuit-breaker", framework: "Azure Architecture Center", title: "Circuit Breaker pattern",
    url: "https://learn.microsoft.com/en-us/azure/architecture/patterns/circuit-breaker",
    summary: "Stop requests to a persistently failing dependency once a defined threshold is reached, then allow limited recovery probes. Coordinate retries with breaker state so repeated attempts do not undermine isolation.",
    applicability: "Dependencies whose failures or slowness could exhaust caller resources or cascade; avoid duplicating sufficient platform isolation mechanisms.",
    validationEvidence: "Failure windows, thresholds, open duration, probe limits and retry interaction; telemetry and fault tests of closed/open/half-open transitions, suppressed calls and recovery.",
  },
  {
    id: "alz-network-topology", framework: "Azure Landing Zones", title: "Define an Azure network topology",
    url: "https://learn.microsoft.com/en-us/azure/cloud-adoption-framework/ready/azure-best-practices/define-an-azure-network-topology",
    summary: "Choose managed Virtual WAN or a customer-managed topology from regional connectivity, branch scale, transit needs and required routing control. Neither option is universally preferable.",
    applicability: "Landing-zone connectivity, especially multiregion, branch-office and hybrid environments.",
    validationEvidence: "Region/site inventory and connectivity requirements; deployed hubs, peerings, VPN/ExpressRoute connections and effective routes; reachability tests and a routing-operations owner.",
  },
  {
    id: "alz-identity-access", framework: "Azure Landing Zones", title: "Landing zone identity and access management",
    url: "https://learn.microsoft.com/en-us/azure/cloud-adoption-framework/ready/landing-zone/design-area/identity-access-landing-zones",
    summary: "Delegate workload administration within platform-defined boundaries using narrowly scoped RBAC and just-enough access. Distinguish Entra tenant roles from Azure resource roles and use time-bound privileged access where appropriate.",
    applicability: "Platform/application landing zones, shared services and automated subscription provisioning.",
    validationEvidence: "Effective and inherited role assignments, memberships and custom roles; PIM activation policies and audit records; access tests proving intended autonomy without cross-boundary administration.",
  },
  {
    id: "alz-subscription-governance", framework: "Azure Landing Zones", title: "Subscription considerations and recommendations",
    url: "https://learn.microsoft.com/en-us/azure/cloud-adoption-framework/ready/landing-zone/design-area/resource-org-subscriptions",
    summary: "Use subscriptions as governance, ownership, billing, isolation and scale boundaries beneath appropriate common management-group policies. Separate platform responsibilities and automate provisioning without assuming every region requires a separate subscription.",
    applicability: "Enterprise subscription organization, environment isolation, platform/workload separation and subscription vending.",
    validationEvidence: "Subscription inventory, hierarchy, owners, inherited Policy/RBAC and exemptions; provisioning outputs, quota/utilization records and policy-remediation evidence.",
  },
  {
    id: "caf-cloud-risk-assessment", framework: "Cloud Adoption Framework", title: "Assess cloud risks",
    url: "https://learn.microsoft.com/en-us/azure/cloud-adoption-framework/govern/assess-cloud-risks",
    summary: "Identify risks with relevant stakeholders, prioritize probability and impact, and assign accountable treatment owners. Maintain a risk register and reassess it periodically and after material changes or incidents.",
    applicability: "Cloud governance across security, compliance, operations, cost, data, resources and AI.",
    validationEvidence: "Dated inventory and risk register with rationale, treatment, owners and target dates; stakeholder reviews, control tests, audits/incidents and reassessment records.",
  },
  {
    id: "caf-cloud-operations-ownership", framework: "Cloud Adoption Framework", title: "Ready your Azure cloud operations",
    url: "https://learn.microsoft.com/en-us/azure/cloud-adoption-framework/manage/ready-cloud-operations",
    summary: "Divide management responsibilities explicitly between platform and workload teams, with named owners for the chosen operating model. Maintain accessible change, continuity and maintenance procedures aligned with operational practice.",
    applicability: "Centralized, shared or decentralized Azure operations.",
    validationEvidence: "Responsibility matrix, owners, procedures and versioned runbooks; deployed alert routing/automation; change, incident and exercise records showing teams can perform their responsibilities.",
  },
  {
    id: "waf-co03-cost-data", framework: "Well-Architected Framework", title: "CO:03 - Collect and review cost data",
    url: "https://learn.microsoft.com/en-us/azure/well-architected/cost-optimization/collect-review-cost-data",
    summary: "Collect daily actual and amortized costs, attribute spending to accountable owners, and compare trends and forecasts with budgets. Automate budget, forecast and anomaly notifications that lead to investigation.",
    applicability: "Cloud expenditure including shared resources and reservation or savings-plan commitments.",
    validationEvidence: "Cost exports and dated datasets, allocation rules, budgets and alert recipients; reconciled reports and notification/investigation history. Pricing estimates alone are insufficient.",
  },
  {
    id: "waf-oe11-safe-deployments", framework: "Well-Architected Framework", title: "OE:11 - Safe deployment practices",
    url: "https://learn.microsoft.com/en-us/azure/well-architected/operational-excellence/safe-deployments",
    summary: "Release small changes through consistent automated processes with progressive exposure and health checks before advancing. Provide meaningful observation time, stop on degradation, and prepare recovery for routine and emergency changes.",
    applicability: "Production application, infrastructure, configuration and feature-flag changes.",
    validationEvidence: "Pipeline stages, traffic allocation, health gates and observation periods; deployment/usage telemetry, halt/recovery controls, tested recovery records and emergency-release procedures.",
  },
  {
    id: "waf-pe02-capacity-planning", framework: "Well-Architected Framework", title: "PE:02 - Capacity planning",
    url: "https://learn.microsoft.com/en-us/azure/well-architected/performance-efficiency/capacity-planning",
    summary: "Forecast normal and peak demand from measured behavior or justified estimates and translate it into resource requirements. Account for service, SKU and scaling limits, validating capacity before anticipated demand changes.",
    applicability: "New workloads, growth, seasonal peaks, launches, campaigns and changing usage.",
    validationEvidence: "Performance objectives and demand assumptions; utilization, throughput and latency history; deployed SKUs, quotas/scaling limits and representative load tests against stated targets.",
  },
  {
    id: "waf-redundancy", framework: "Well-Architected Framework",
    title: "RE:05 - Design for redundancy",
    url: "https://learn.microsoft.com/azure/well-architected/reliability/redundancy",
    summary: "Choose redundancy for each critical flow from its reliability targets and failure modes. Retain capacity to handle failed instances, and weigh additional cost, latency and operational complexity.",
    applicability: "Critical flows with single dependencies, unclear failure tolerance or unknown spare capacity.",
    validationEvidence: "Service/SKU and zone configuration, capacity under failure, and measured failover/recovery tests against agreed targets.",
  },
  {
    id: "waf-network-boundaries", framework: "Well-Architected Framework",
    title: "SE:06 - Networking and connectivity",
    url: "https://learn.microsoft.com/azure/well-architected/security/networking",
    summary: "Classify ingress, egress and internal flows, then apply isolation and filtering at their trust boundaries. A network boundary in a drawing does not prove that its controls are deployed.",
    applicability: "Public endpoints, multi-tier workloads, or network flows whose trust and access requirements are unclear.",
    validationEvidence: "Actual routes, firewall/NSG policies, endpoint exposure and DNS/access tests from allowed and denied networks.",
  },
];

export function findReviewGuidance(id: string): ReviewGuidance | undefined {
  return REVIEW_GUIDANCE.find((entry) => entry.id === id);
}
