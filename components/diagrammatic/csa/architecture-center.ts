export type ArchitectureCenterItemKind = "pattern" | "principle";

export interface ArchitectureCenterItem {
  id: string;
  kind: ArchitectureCenterItemKind;
  title: string;
  summary: string;
  guidance: string[];
  tradeoffs: string[];
  tags: string[];
  sourceUrl: string;
  sourceLabel: string;
  prompt?: string;
}

export const ARCHITECTURE_CENTER_ITEMS: ArchitectureCenterItem[] = [
  {
    id: "n-tier",
    kind: "pattern",
    title: "N-tier",
    summary:
      "Separate presentation, business, and data responsibilities into horizontal tiers with controlled network boundaries.",
    guidance: [
      "Use for traditional business domains with stable dependencies and clear layer ownership.",
      "Place a global edge and WAF in front of the presentation tier.",
      "Keep data services private and restrict east-west traffic between tiers.",
    ],
    tradeoffs: [
      "Layer coupling can slow independent releases.",
      "Extra network hops can increase latency and operational overhead.",
    ],
    tags: ["web", "enterprise", "networking", "migration"],
    sourceUrl: "https://learn.microsoft.com/azure/architecture/guide/architecture-styles/n-tier",
    sourceLabel: "Azure Architecture Center: N-tier style",
    prompt:
      "Enterprise N-tier Azure web application with Azure Front Door and WAF, App Service presentation tier, API Management, App Service business tier, Azure SQL Database, Key Vault, private networking, and Application Insights",
  },
  {
    id: "web-queue-worker",
    kind: "pattern",
    title: "Web-Queue-Worker",
    summary:
      "Decouple request handling from long-running or resource-intensive work through a durable message queue.",
    guidance: [
      "Use when HTTP requests can acknowledge work before processing completes.",
      "Scale the front end and workers independently from queue depth and demand.",
      "Design workers for idempotency, retries, poison messages, and observability.",
    ],
    tradeoffs: [
      "Introduces eventual consistency and asynchronous failure modes.",
      "Requires correlation, dead-letter handling, and end-to-end tracing.",
    ],
    tags: ["async", "messaging", "scale", "resilience"],
    sourceUrl:
      "https://learn.microsoft.com/azure/architecture/guide/architecture-styles/web-queue-worker",
    sourceLabel: "Azure Architecture Center: Web-Queue-Worker style",
    prompt:
      "Azure Web-Queue-Worker architecture with Front Door, App Service web frontend, Service Bus queue, Azure Functions workers, Blob Storage, Cosmos DB, Key Vault, and Application Insights",
  },
  {
    id: "microservices",
    kind: "pattern",
    title: "Microservices",
    summary:
      "Decompose a complex domain into independently deployable services aligned to bounded business capabilities.",
    guidance: [
      "Use for complex domains that need independent ownership, deployment, and scaling.",
      "Keep data ownership within each service boundary and integrate through explicit APIs or events.",
      "Automate deployment, telemetry, resilience, and contract governance from the start.",
    ],
    tradeoffs: [
      "Distributed systems add network, consistency, testing, and operational complexity.",
      "A small or weakly partitioned domain can become a distributed monolith.",
    ],
    tags: ["containers", "domain-driven design", "apis", "events"],
    sourceUrl:
      "https://learn.microsoft.com/azure/architecture/guide/architecture-styles/microservices",
    sourceLabel: "Azure Architecture Center: Microservices style",
    prompt:
      "Azure microservices platform with Front Door and WAF, API Management, AKS, Container Registry, Service Bus, Cosmos DB, Key Vault, Azure Monitor, and Application Insights",
  },
  {
    id: "event-driven",
    kind: "pattern",
    title: "Event-driven architecture",
    summary:
      "Publish immutable events so producers and consumers can evolve and scale with minimal direct coupling.",
    guidance: [
      "Use for real-time reactions, fan-out integration, and independently evolving consumers.",
      "Choose Event Grid for discrete notifications and Event Hubs for high-volume streams.",
      "Define event contracts, ordering expectations, idempotency, replay, and failure handling.",
    ],
    tradeoffs: [
      "System behavior is harder to trace than a synchronous request chain.",
      "Duplicate, late, or out-of-order events must be expected and handled.",
    ],
    tags: ["events", "integration", "streaming", "serverless"],
    sourceUrl:
      "https://learn.microsoft.com/azure/architecture/guide/architecture-styles/event-driven",
    sourceLabel: "Azure Architecture Center: Event-driven style",
    prompt:
      "Azure event-driven architecture with API Management, Event Grid, Event Hubs, Azure Functions, Service Bus, Cosmos DB, Blob Storage, and Application Insights",
  },
  {
    id: "big-data",
    kind: "pattern",
    title: "Big data",
    summary:
      "Combine batch and streaming ingestion with scalable storage, processing, governance, and serving layers.",
    guidance: [
      "Use when data volume, velocity, or variety exceeds traditional database processing.",
      "Separate raw, enriched, and curated data zones with explicit governance.",
      "Design for lineage, access control, data quality, cost controls, and workload isolation.",
    ],
    tradeoffs: [
      "Multiple processing paths can duplicate logic and increase platform cost.",
      "Weak governance quickly creates an inaccessible or untrusted data swamp.",
    ],
    tags: ["analytics", "data lake", "streaming", "governance"],
    sourceUrl: "https://learn.microsoft.com/azure/architecture/guide/architecture-styles/big-data",
    sourceLabel: "Azure Architecture Center: Big data style",
    prompt:
      "Azure governed data platform with Event Hubs, Data Factory, Data Lake Storage, Databricks, Synapse Analytics, Purview, Key Vault, and Azure Monitor",
  },
  {
    id: "cqrs",
    kind: "pattern",
    title: "CQRS",
    summary:
      "Use separate models for commands and queries when write invariants and read projections have different needs.",
    guidance: [
      "Use when read and write workloads need independent models, optimization, or scale.",
      "Keep command validation and business invariants in the write path.",
      "Make projection lag, replay, reconciliation, and observability explicit.",
    ],
    tradeoffs: [
      "Eventual consistency changes the user experience and error model.",
      "Separate models increase development, testing, and operational complexity.",
    ],
    tags: ["data", "domain-driven design", "messaging", "scale"],
    sourceUrl: "https://learn.microsoft.com/azure/architecture/patterns/cqrs",
    sourceLabel: "Azure Architecture Center: CQRS pattern",
    prompt:
      "Azure CQRS architecture with API Management, App Service command API, Service Bus, Azure Functions projection workers, Azure SQL write model, Cosmos DB read model, Key Vault, and Application Insights",
  },
  {
    id: "self-healing",
    kind: "principle",
    title: "Design for self-healing",
    summary:
      "Detect failures, recover automatically where safe, and preserve enough telemetry for operators to understand what happened.",
    guidance: [
      "Use health probes, bounded retries, circuit breakers, queue-based load leveling, and automated failover.",
      "Make operations idempotent and isolate repeated failures through dead-letter or quarantine paths.",
    ],
    tradeoffs: ["Aggressive retries can amplify an outage; always use backoff, jitter, and limits."],
    tags: ["reliability", "resilience", "operations"],
    sourceUrl: "https://learn.microsoft.com/azure/architecture/guide/design-principles/self-healing",
    sourceLabel: "Azure Architecture Center: Design for self-healing",
  },
  {
    id: "managed-services",
    kind: "principle",
    title: "Prefer managed services",
    summary:
      "Use Azure-managed capabilities where they satisfy requirements so teams can focus on workload outcomes instead of undifferentiated operations.",
    guidance: [
      "Evaluate service limits, portability, networking, identity, backup, and recovery before selecting a managed service.",
      "Use infrastructure as code and policy so managed services remain repeatable and governed.",
    ],
    tradeoffs: ["Managed services can introduce platform constraints, service-specific skills, and switching cost."],
    tags: ["operations", "platform", "cost"],
    sourceUrl:
      "https://learn.microsoft.com/azure/architecture/guide/design-principles/managed-services",
    sourceLabel: "Azure Architecture Center: Use managed services",
  },
  {
    id: "scale-out",
    kind: "principle",
    title: "Scale out",
    summary:
      "Add stateless instances and partition demand instead of relying only on increasingly large individual nodes.",
    guidance: [
      "Externalize session state and make compute instances disposable.",
      "Use autoscale signals tied to user demand, queue depth, latency, or saturation.",
    ],
    tradeoffs: ["Horizontal scale requires coordination, partitioning, and distributed-state discipline."],
    tags: ["performance", "scale", "availability"],
    sourceUrl: "https://learn.microsoft.com/azure/architecture/guide/design-principles/scale-out",
    sourceLabel: "Azure Architecture Center: Scale out",
  },
  {
    id: "decouple",
    kind: "principle",
    title: "Decouple components",
    summary:
      "Reduce temporal and deployment coupling through stable APIs, messaging, events, and clear ownership boundaries.",
    guidance: [
      "Use queues when consumers can process later and events when multiple consumers react independently.",
      "Version contracts and keep failure handling at integration boundaries.",
    ],
    tradeoffs: ["Decoupling moves complexity into contracts, consistency, tracing, and message operations."],
    tags: ["integration", "messaging", "domain boundaries"],
    sourceUrl:
      "https://learn.microsoft.com/azure/architecture/guide/design-principles/decouple-components",
    sourceLabel: "Azure Architecture Center: Decouple components",
  },
  {
    id: "security",
    kind: "principle",
    title: "Design for security",
    summary:
      "Apply zero-trust assumptions, least privilege, defense in depth, secure defaults, and continuous verification.",
    guidance: [
      "Prefer managed identity and RBAC over secrets and shared keys.",
      "Use private connectivity, segmentation, encryption, logging, and centralized policy.",
    ],
    tradeoffs: ["Security controls must be designed with operability and recovery to avoid unsafe bypasses."],
    tags: ["security", "identity", "networking", "governance"],
    sourceUrl: "https://learn.microsoft.com/azure/architecture/guide/design-principles/security",
    sourceLabel: "Azure Architecture Center: Design for security",
  },
  {
    id: "evolution",
    kind: "principle",
    title: "Design for evolution",
    summary:
      "Expect requirements, scale, dependencies, and team boundaries to change throughout the workload lifecycle.",
    guidance: [
      "Favor independently replaceable components, backward-compatible contracts, and automated delivery.",
      "Record architecture decisions and validate assumptions through telemetry.",
    ],
    tradeoffs: ["Excess abstraction for hypothetical change creates cost without useful flexibility."],
    tags: ["architecture", "delivery", "maintainability"],
    sourceUrl: "https://learn.microsoft.com/azure/architecture/guide/design-principles/design-for-evolution",
    sourceLabel: "Azure Architecture Center: Design for evolution",
  },
];

export function filterArchitectureCenterItems(
  items: ArchitectureCenterItem[],
  kind: ArchitectureCenterItemKind,
  query: string
): ArchitectureCenterItem[] {
  const normalized = query.trim().toLowerCase();
  return items.filter((item) => {
    if (item.kind !== kind) return false;
    if (!normalized) return true;
    return [
      item.title,
      item.summary,
      ...item.guidance,
      ...item.tradeoffs,
      ...item.tags,
    ].some((value) => value.toLowerCase().includes(normalized));
  });
}
