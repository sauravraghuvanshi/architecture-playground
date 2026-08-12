export type LandingZoneIac = "bicep" | "terraform";
export type LandingZoneVcs = "github" | "azure-devops";

export interface LandingZoneDesignArea {
  id: string;
  title: string;
  summary: string;
  questions: string[];
  sourceUrl: string;
}

export interface LandingZoneRecommendation {
  title: string;
  summary: string;
  acceleratorUrl: string;
  steps: Array<{ phase: string; title: string; detail: string }>;
}

export const LANDING_ZONE_DESIGN_AREAS: LandingZoneDesignArea[] = [
  {
    id: "billing-tenancy",
    title: "Azure billing and tenant",
    summary: "Align the Microsoft Entra tenant, billing scope, and subscription ownership model.",
    questions: [
      "Who owns tenant-wide settings and billing scopes?",
      "How will subscriptions be requested, funded, and retired?",
    ],
    sourceUrl:
      "https://learn.microsoft.com/azure/cloud-adoption-framework/ready/landing-zone/design-area/azure-billing-microsoft-entra-tenant",
  },
  {
    id: "identity-access",
    title: "Identity and access management",
    summary: "Establish privileged access, workload identity, emergency access, and least-privilege RBAC.",
    questions: [
      "Which teams own platform and workload administration?",
      "How are privileged roles activated, reviewed, and monitored?",
    ],
    sourceUrl:
      "https://learn.microsoft.com/azure/cloud-adoption-framework/ready/landing-zone/design-area/identity-access",
  },
  {
    id: "resource-organization",
    title: "Resource organization",
    summary: "Design management groups, subscriptions, resource groups, naming, and tagging boundaries.",
    questions: [
      "Which policy and access boundaries require separate subscriptions?",
      "How will platform, sandbox, and workload estates be organized?",
    ],
    sourceUrl:
      "https://learn.microsoft.com/azure/cloud-adoption-framework/ready/landing-zone/design-area/resource-org",
  },
  {
    id: "networking",
    title: "Network topology and connectivity",
    summary: "Choose connectivity, DNS, ingress, egress, hybrid, and segmentation patterns.",
    questions: [
      "Is the target topology hub-and-spoke, Virtual WAN, or intentionally isolated?",
      "Where are shared ingress, egress, DNS, and inspection services operated?",
    ],
    sourceUrl:
      "https://learn.microsoft.com/azure/cloud-adoption-framework/ready/landing-zone/design-area/network-topology-and-connectivity",
  },
  {
    id: "security",
    title: "Security",
    summary: "Define the platform controls for posture management, threat protection, and incident response.",
    questions: [
      "Which Defender for Cloud plans and security baselines are required?",
      "How do platform alerts integrate with the security operations model?",
    ],
    sourceUrl:
      "https://learn.microsoft.com/azure/cloud-adoption-framework/ready/landing-zone/design-area/security",
  },
  {
    id: "management",
    title: "Management",
    summary: "Centralize inventory, telemetry, operations, backup, resilience, and service health.",
    questions: [
      "What telemetry and retention are mandatory across every subscription?",
      "Who owns backup, recovery, patching, and platform health response?",
    ],
    sourceUrl:
      "https://learn.microsoft.com/azure/cloud-adoption-framework/ready/landing-zone/design-area/management",
  },
  {
    id: "governance",
    title: "Governance",
    summary: "Translate organizational risks into policy, compliance, cost, and resource consistency controls.",
    questions: [
      "Which controls are audit-only first, and which must deny deployment?",
      "How are policy exemptions approved, time-bounded, and reviewed?",
    ],
    sourceUrl:
      "https://learn.microsoft.com/azure/cloud-adoption-framework/ready/landing-zone/design-area/governance",
  },
  {
    id: "platform-automation",
    title: "Platform automation and DevOps",
    summary: "Use version-controlled infrastructure, deployment pipelines, testing, and safe change promotion.",
    questions: [
      "Which repository and pipeline platform owns the landing zone code?",
      "How are changes tested and promoted across platform environments?",
    ],
    sourceUrl:
      "https://learn.microsoft.com/azure/cloud-adoption-framework/ready/landing-zone/design-area/platform-automation-devops",
  },
];

export const LANDING_ZONE_BLUEPRINT_PROMPT =
  "Azure enterprise landing zone platform with management groups, Azure Policy, hub virtual network, Azure Firewall, VPN Gateway, Private DNS, Log Analytics, Microsoft Defender for Cloud, Key Vault, and separate application landing zone spokes";

export function getLandingZoneRecommendation(
  iac: LandingZoneIac,
  vcs: LandingZoneVcs
): LandingZoneRecommendation {
  const language = iac === "bicep" ? "Bicep" : "Terraform";
  const repository = vcs === "github" ? "GitHub" : "Azure DevOps";
  return {
    title: `${language} + ${repository}`,
    summary:
      `Use the Azure Landing Zones IaC Accelerator with Azure Verified Modules for ${language}, ` +
      `bootstrapped into ${repository} with deployment environments and pipelines.`,
    acceleratorUrl:
      iac === "bicep" ? "https://aka.ms/alz/acc/bicep" : "https://aka.ms/alz/acc/tf",
    steps: [
      {
        phase: "Phase 0",
        title: "Plan",
        detail: `Confirm ${language}, ${repository}, operating model, design areas, and subscription strategy.`,
      },
      {
        phase: "Phase 1",
        title: "Prerequisites",
        detail: "Prepare tenant permissions, deployment identities, subscriptions, and repository access.",
      },
      {
        phase: "Phase 2",
        title: "Bootstrap",
        detail: `Run the accelerator bootstrap to create the ${repository} environments, identities, and pipelines.`,
      },
      {
        phase: "Phase 3",
        title: "Run",
        detail: "Customize verified modules, review the plan, and promote the platform landing zone through CI/CD.",
      },
    ],
  };
}
