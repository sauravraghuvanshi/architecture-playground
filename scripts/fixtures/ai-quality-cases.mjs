import { readFile } from "node:fs/promises";
import { goldenDatasetSchema } from "../../lib/ai-evaluation-contract.ts";
import {
  generationRequestSchema, parseGuidedArchitecture, recordGenerationIntent,
} from "../../lib/ai-mode-prompts.ts";
import { parseArchitectureDocument } from "../../lib/architecture-document.ts";
import {
  architectureReviewRequestSchema, parseGeneratedArchitectureReview,
} from "../../lib/architecture-review.ts";
import { findReviewGuidance } from "../../lib/review-guidance.ts";
import { SERVICE_CATALOG } from "../../lib/service-identity.ts";
import {
  conversionSourceSchema, parseWhiteboardConversionResponse,
} from "../../lib/whiteboard-conversion.ts";
import { validateEvidenceImage } from "../../lib/review-image-server.ts";
import {
  deploymentRequestSchema, engineeringArtifactInputSchema, parseArmTemplate, parseDeploymentDraft,
} from "../../lib/deployment-assistance.ts";
import {
  generateArchitectureCode, generateArmTemplate,
} from "../../components/diagrammatic/csa/architecture-codegen.ts";

// Synthetic, independently specified requirements. References are parser fixtures,
// not model captures, measured model quality, or deployment evidence.
const images = new URL("../../content/ai-evaluation/images/", import.meta.url);

function service(id, iconId, label, x = 40, y = 120, width = 240, height = 90) {
  const icon = SERVICE_CATALOG.find((entry) => entry.id === iconId);
  if (!icon) throw new Error(`Unknown golden service identity: ${iconId}`);
  return { id, kind: "icon", iconId, iconPath: icon.path, label, x, y, width, height };
}

function shape(id, label, kind, x, y = 120) {
  return { id, kind: "shape", shape: kind, label, x, y, width: 240, height: 90 };
}

function edge(id, source, target, label) {
  return { id, source, target, label };
}

function generationReference(title, nodes, edges, advice, input) {
  const result = parseGuidedArchitecture({
    metadata: { name: title, description: "Hand-authored synthetic reference, not a model response." },
    nodes: nodes.map(([id, iconId, label, cloud, x, y]) => ({
      id, type: "service", position: { x, y }, data: { iconId, label, cloud },
    })),
    edges: edges.map(([id, source, target, label]) => ({
      id, source, target,
      data: { label, connectionType: "data-flow", lineStyle: "solid", arrowStyle: "forward" },
    })),
    designAssistance: advice,
  }, SERVICE_CATALOG);
  result.graph = recordGenerationIntent(result.graph, generationRequestSchema.parse(input));
  return result;
}

function generationCases() {
  const web = {
    id: "generation-azure-web-data", kind: "generation", title: "Azure App Service with data and secret roles",
    input: {
      mode: "architecture",
      prompt: "Draw exactly three Azure services: Azure App Service labeled Orders API, Azure SQL Database labeled Orders data, and Azure Key Vault labeled Runtime secrets. Orders API sends orders to Orders data on an arrow labeled SQL, and requests secrets from Runtime secrets on an arrow labeled secrets. Do not substitute an App Service operation or feature icon.",
      businessConstraints: { recovery: "RTO 30 minutes and RPO 5 minutes are design targets, not proven capabilities." },
    },
    expected: {
      nodes: [
        { key: "api", identities: ["azure/application/application-service"], label: "Orders API" },
        { key: "data", identities: ["azure/data/sql-database"], label: "Orders data" },
        { key: "secrets", identities: ["azure/security/key-vault"], label: "Runtime secrets" },
      ],
      connections: [{ source: "api", target: "data", label: "SQL" }, { source: "api", target: "secrets", label: "secrets" }],
      providers: ["azure"],
    },
  };
  const multi = {
    id: "generation-three-provider-events", kind: "generation", title: "Preserve three providers in an event pipeline",
    input: {
      mode: "architecture",
      prompt: "Draw only AWS Lambda labeled Event producer, Azure Event Hubs labeled Event bridge, and GCP BigQuery labeled Analytics sink. Event producer -> Event bridge is labeled publish. Event bridge -> Analytics sink is labeled export. Preserve each requested cloud provider; this is not a cloud migration.",
      businessConstraints: { dataResidency: "Confirm approved locations in each provider before moving event data." },
    },
    expected: {
      nodes: [
        { key: "producer", identities: ["aws/compute/lambda"], label: "Event producer" },
        { key: "bridge", identities: ["azure/application/event-hub"], label: "Event bridge" },
        { key: "sink", identities: ["gcp/analytics/big-query"], label: "Analytics sink" },
      ],
      connections: [{ source: "producer", target: "bridge", label: "publish" }, { source: "bridge", target: "sink", label: "export" }],
      providers: ["aws", "azure", "gcp"],
    },
  };
  const roles = {
    id: "generation-distinct-app-roles", kind: "generation", title: "Two App Service roles must not collapse",
    input: {
      mode: "architecture",
      prompt: "Create exactly two separate Azure App Service nodes labeled Checkout API and Fulfillment API, plus Azure Service Bus labeled Orders queue. Checkout API -> Orders queue is labeled enqueue. Orders queue -> Fulfillment API is labeled deliver. The two APIs are distinct roles of the same service; preserve both labels and the directed chain.",
      businessConstraints: { scale: "Peak demand is unknown; do not claim that a particular SKU will meet it." },
    },
    expected: {
      nodes: [
        { key: "checkout", identities: ["azure/application/application-service"], label: "Checkout API" },
        { key: "queue", identities: ["azure/data/service-bus"], label: "Orders queue" },
        { key: "fulfillment", identities: ["azure/application/application-service"], label: "Fulfillment API" },
      ],
      connections: [{ source: "checkout", target: "queue", label: "enqueue" }, { source: "queue", target: "fulfillment", label: "deliver" }],
      providers: ["azure"],
    },
  };
  const reverse = {
    id: "generation-export-data-direction", kind: "generation", title: "Data movement direction is not request direction",
    input: {
      mode: "architecture",
      prompt: "Draw a data export with exactly Azure SQL Database labeled Source records, Azure Functions labeled Export worker, and Azure Storage Account labeled Archive store. Arrows represent movement of records, NOT queries: Source records -> Export worker labeled rows, then Export worker -> Archive store labeled archive. Put Source records on the right and Archive store on the left. Do not reverse the SQL-to-worker arrow.",
      businessConstraints: { budget: "Keep the diagram to these three logical services; pricing has not been measured." },
    },
    expected: {
      nodes: [
        { key: "source", identities: ["azure/data/sql-database"], label: "Source records" },
        { key: "worker", identities: ["azure/application/function-app"], label: "Export worker" },
        { key: "archive", identities: ["azure/storage/storage-account"], label: "Archive store" },
      ],
      connections: [{ source: "source", target: "worker", label: "rows" }, { source: "worker", target: "archive", label: "archive" }],
      providers: ["azure"],
    },
  };
  return [
    { task: web, reference: generationReference(web.title, [
      ["web-api", "azure/application/application-service", "Orders API", "azure", 40, 120],
      ["web-db", "azure/data/sql-database", "Orders data", "azure", 390, 50],
      ["web-vault", "azure/security/key-vault", "Runtime secrets", "azure", 390, 260],
    ], [["web-sql", "web-api", "web-db", "SQL"], ["web-secret", "web-api", "web-vault", "secrets"]], {
      assumptions: ["Recovery objectives are requirements; no backup configuration or restore test is supplied."],
      recommendations: ["Use workload identity for database and secret access, then verify least-privilege assignments."],
      tradeoffs: ["Recovery redundancy increases cost and operational work; the service icons do not select a redundancy tier."],
      nextSteps: ["Measure a restore and failover exercise against the 30-minute RTO and 5-minute RPO."],
    }, web.input) },
    { task: multi, reference: generationReference(multi.title, [
      ["event-lambda", "aws/compute/lambda", "Event producer", "aws", 40, 120],
      ["event-hub", "azure/application/event-hub", "Event bridge", "azure", 390, 120],
      ["event-query", "gcp/analytics/big-query", "Analytics sink", "gcp", 740, 120],
    ], [["event-publish", "event-lambda", "event-hub", "publish"], ["event-export", "event-hub", "event-query", "export"]], {
      assumptions: ["The requested cross-provider path is intentional and contains no deployed identity or residency evidence."],
      recommendations: ["Approve event classifications, transfer locations and identity boundaries separately for all three providers."],
      tradeoffs: ["Cross-provider transfers add egress costs, latency and separate operational responsibilities."],
      nextSteps: ["Verify data-transfer approval, delivery semantics and failure handling with all three service owners."],
    }, multi.input) },
    { task: roles, reference: generationReference(roles.title, [
      ["role-checkout", "azure/application/application-service", "Checkout API", "azure", 40, 120],
      ["role-bus", "azure/data/service-bus", "Orders queue", "azure", 390, 120],
      ["role-fulfillment", "azure/application/application-service", "Fulfillment API", "azure", 740, 120],
    ], [["role-enqueue", "role-checkout", "role-bus", "enqueue"], ["role-deliver", "role-bus", "role-fulfillment", "deliver"]], {
      assumptions: ["Checkout and fulfillment are distinct applications; hosting plans and peak demand are unspecified."],
      recommendations: ["Make fulfillment idempotent and define dead-letter ownership for failed deliveries."],
      tradeoffs: ["Queue decoupling absorbs bursts but adds eventual consistency and message-operating overhead."],
      nextSteps: ["Measure enqueue and consumer throughput and test duplicate, delayed and dead-lettered orders."],
    }, roles.input) },
    { task: reverse, reference: generationReference(reverse.title, [
      ["export-sql", "azure/data/sql-database", "Source records", "azure", 740, 120],
      ["export-function", "azure/application/function-app", "Export worker", "azure", 390, 120],
      ["export-storage", "azure/storage/storage-account", "Archive store", "azure", 40, 120],
    ], [["export-rows", "export-sql", "export-function", "rows"], ["export-archive", "export-function", "export-storage", "archive"]], {
      assumptions: ["Arrows describe record movement, not the caller direction of a database query."],
      recommendations: ["Checkpoint exported batches and use an idempotent archive naming scheme."],
      tradeoffs: ["Larger batches reduce request overhead but increase retry work and the age of archived data."],
      nextSteps: ["Measure export volume, retry correctness and storage retention cost without inferring deployment from this draft."],
    }, reverse.input) },
  ];
}

async function conversionCases() {
  const cases = [
    {
      image: "azure-web-data.png",
      task: {
        id: "conversion-azure-web-data", kind: "conversion", title: "Transcribe generic client and canonical Azure services",
        input: { sourceNodes: [] },
        expected: {
          nodes: [
            { key: "client", identities: ["shape:rectangle"], label: "Client" },
            { key: "app", identities: ["azure/application/application-service"], label: "Azure App Service" },
            { key: "sql", identities: ["azure/data/sql-database"], label: "Azure SQL Database" },
          ],
          connections: [{ source: "client", target: "app", label: "HTTPS" }, { source: "app", target: "sql", label: "SQL" }],
          providers: ["azure"],
        },
      },
      reference: {
        payload: { nodes: [
          shape("image-client", "Client", "rectangle", 40),
          service("image-app", "azure/application/application-service", "Azure App Service", 390),
          service("image-sql", "azure/data/sql-database", "Azure SQL Database", 740),
        ], edges: [
          edge("image-https", "image-client", "image-app", "HTTPS"),
          edge("image-query", "image-app", "image-sql", "SQL"),
        ] },
        warnings: [],
      },
    },
    {
      image: "three-provider-events.png",
      task: {
        id: "conversion-three-provider-events", kind: "conversion", title: "Read providers from original text-only diagram",
        input: { sourceNodes: [] },
        expected: {
          nodes: [
            { key: "aws", identities: ["aws/compute/lambda"], label: "AWS Lambda" },
            { key: "azure", identities: ["azure/application/event-hub"], label: "Azure Event Hubs" },
            { key: "gcp", identities: ["gcp/analytics/big-query"], label: "GCP BigQuery" },
          ],
          connections: [{ source: "aws", target: "azure", label: "publish" }, { source: "azure", target: "gcp", label: "export" }],
          providers: ["aws", "azure", "gcp"],
        },
      },
      reference: {
        payload: { nodes: [
          service("image-aws", "aws/compute/lambda", "AWS Lambda", 40),
          service("image-azure", "azure/application/event-hub", "Azure Event Hubs", 390),
          service("image-gcp", "gcp/analytics/big-query", "GCP BigQuery", 740),
        ], edges: [
          edge("image-publish", "image-aws", "image-azure", "publish"),
          edge("image-export", "image-azure", "image-gcp", "export"),
        ] },
        warnings: [],
      },
    },
    {
      image: "right-to-left-archive.png",
      task: {
        id: "conversion-right-to-left-archive", kind: "conversion", title: "Arrowheads override left-to-right reading order",
        input: { sourceNodes: [] },
        expected: {
          nodes: [
            { key: "archive", identities: ["azure/storage/storage-account-blob"], label: "Azure Blob Storage" },
            { key: "writer", identities: ["azure/application/function-app"], label: "Azure Functions" },
          ],
          connections: [{ source: "writer", target: "archive", label: "archive" }],
          providers: ["azure"],
        },
      },
      reference: {
        payload: { nodes: [
          service("image-archive", "azure/storage/storage-account-blob", "Azure Blob Storage", 60, 120, 260),
          service("image-writer", "azure/application/function-app", "Azure Functions", 580, 120, 260),
        ], edges: [edge("image-backward", "image-writer", "image-archive", "archive")] },
        warnings: [],
      },
    },
    {
      image: "explicit-source-identities.png",
      task: {
        id: "conversion-explicit-source-identities", kind: "conversion", title: "Explicit Whiteboard IDs survive misleading renamed labels",
        input: { sourceNodes: [
          { id: "wb-web", iconId: "azure/application/application-service", cloud: "azure", label: "AWS Lambda", x: 40, y: 120, width: 240, height: 90 },
          { id: "wb-worker", iconId: "aws/compute/lambda", cloud: "aws", label: "Azure App Service", x: 390, y: 120, width: 240, height: 90 },
        ] },
        expected: {
          nodes: [
            { key: "renamed-web", identities: ["azure/application/application-service"], label: "AWS Lambda" },
            { key: "renamed-worker", identities: ["aws/compute/lambda"], label: "Azure App Service" },
            { key: "audit", identities: ["shape:document"], label: "Audit log" },
          ],
          connections: [{ source: "renamed-web", target: "renamed-worker", label: "invoke" }, { source: "renamed-worker", target: "audit", label: "append" }],
          providers: ["azure", "aws"],
        },
      },
      reference: {
        payload: { nodes: [
          service("wb-web", "azure/application/application-service", "AWS Lambda", 40),
          service("wb-worker", "aws/compute/lambda", "Azure App Service", 390),
          shape("wb-audit", "Audit log", "document", 740),
        ], edges: [
          edge("wb-invoke", "wb-web", "wb-worker", "invoke"),
          edge("wb-append", "wb-worker", "wb-audit", "append"),
        ] },
        warnings: [],
      },
    },
  ];
  return Promise.all(cases.map(async ({ image, task, reference }) => ({
    task: { ...task, input: { ...task.input, image: {
      name: image, mimeType: "image/png",
      dataUrl: `data:image/png;base64,${(await readFile(new URL(image, images))).toString("base64")}`,
    } } },
    reference,
  })));
}

function finding(guidanceId, fields) {
  const guidance = findReviewGuidance(guidanceId);
  if (!guidance) throw new Error(`Unknown golden guidance: ${guidanceId}`);
  return { id: guidanceId, ...fields, framework: guidance.framework, sourceUrl: guidance.url, guidanceIds: [guidanceId] };
}

function reviewCases() {
  return [
    {
      task: {
        id: "review-recovery-network-unknowns", kind: "review", title: "Do not mistake a service drawing for recovery or network controls",
        input: {
          source: "canvas",
          payload: { nodes: [
            shape("public-users", "Public callers", "internet", 40),
            service("orders-api", "azure/application/application-service", "Orders API", 390),
            service("orders-db", "azure/data/sql-database", "Orders data", 740),
          ], edges: [
            edge("public-https", "public-users", "orders-api", "HTTPS"),
            edge("orders-query", "orders-api", "orders-db", "SQL"),
          ] },
          context: "Synthetic design only. RTO 30 minutes and RPO 5 minutes are requested targets. No region, zone, backup, restore test, route, firewall, endpoint or release-pipeline configuration is supplied. Assess recovery, network boundaries and safe release evidence without asserting missing controls are deployed or absent.",
        },
        expected: {
          requiredGuidanceIds: ["waf-redundancy", "waf-network-boundaries", "waf-oe11-safe-deployments"],
          unknownGuidanceIds: ["waf-redundancy", "waf-network-boundaries", "waf-oe11-safe-deployments"],
        },
      },
      reference: { review: {
        summary: "The public API and SQL path are visible, but the requested recovery targets, network enforcement and safe-release process are not verified.",
        posture: "mixed", score: 45,
        strengths: ["The diagram distinguishes the caller, API and data roles with named connections."],
        assumptions: ["A single drawn icon is not proof of a single deployed instance or the absence of redundancy."],
        findings: [
          finding("waf-redundancy", {
            title: "Recovery and failure capacity remain unknown", severity: "high", evidenceStatus: "unknown",
            evidence: "orders-api and orders-db are shown; the context supplies recovery targets but no zone, capacity or recovery-test evidence.",
            recommendation: "Select redundancy for the critical order path and demonstrate recovery against the stated RTO and RPO.",
            nodeIds: ["orders-api", "orders-db"], edgeIds: ["orders-query"],
            guidanceRationale: "RE:05 connects critical-flow targets and failure modes to redundancy and surviving capacity; two service icons alone cannot establish those properties.",
            remediation: {
              steps: ["Record failure modes and deployed redundancy options for the API and database.", "Run a controlled recovery exercise and measure data loss and recovery time."],
              validation: "Supply effective service/zone settings and timed failover or restore results against RTO 30 minutes and RPO 5 minutes.",
              tradeoff: "Additional replicas and recovery capacity increase spend and operational complexity.",
            },
          }),
          finding("waf-network-boundaries", {
            title: "Trust boundaries need configuration evidence", severity: "high", evidenceStatus: "unknown",
            evidence: "public-https and orders-query identify logical flows but do not describe endpoint exposure, routes, DNS or access controls.",
            recommendation: "Classify ingress and internal flows, then prove allowed and denied access across each boundary.",
            nodeIds: ["public-users", "orders-api", "orders-db"], edgeIds: ["public-https", "orders-query"],
            guidanceRationale: "SE:06 applies isolation and filtering to classified flows; a drawn connection neither proves public exposure nor proves network isolation.",
            remediation: {
              steps: ["Document the trust classification and intended exposure of both flows.", "Review effective routes and endpoint policies with DNS and connectivity tests."],
              validation: "Provide deployed firewall or equivalent endpoint policies and access-test results from both authorized and unauthorized networks.",
              tradeoff: "Private connectivity and filtering require DNS, routing and operational maintenance.",
            },
          }),
          finding("waf-oe11-safe-deployments", {
            title: "Release health gates and recovery are not evidenced", severity: "medium", evidenceStatus: "unknown",
            evidence: "The API is present but the context explicitly provides no release-pipeline configuration.",
            recommendation: "Use progressive exposure with observation windows, health checks and tested recovery.",
            nodeIds: ["orders-api"], edgeIds: [],
            guidanceRationale: "OE:11 requires release processes and health evidence; the existence of App Service is not evidence of safe deployment practices.",
            remediation: {
              steps: ["Define a staged release with measurable health gates and halt conditions.", "Exercise recovery for normal and emergency releases."],
              validation: "Provide versioned pipeline gates, observation timing, deployment telemetry and a successful halt/recovery record.",
              tradeoff: "Progressive exposure takes time and temporary parallel capacity but limits the affected user population.",
            },
          }),
        ],
      } },
    },
    {
      task: {
        id: "review-landing-zone-ownership", kind: "review", title: "Landing-zone choices and platform/workload accountability",
        input: {
          source: "import",
          payload: { nodes: [
            service("platform-hub", "azure/networking/virtual-network", "Shared network", 40),
            service("team-app", "azure/application/application-service", "Workload API", 390),
          ], edges: [edge("platform-transit", "platform-hub", "team-app", "workload connectivity")] },
          context: "Synthetic enterprise sketch for branch connectivity and two Azure regions. Platform and workload teams are distinct, but no effective routes, RBAC/PIM assignments, subscription inventory, policy inheritance or operations responsibility matrix is supplied. Evaluate ALZ topology, access and subscription governance plus CAF operations ownership. Do not infer that Virtual WAN is universally required.",
        },
        expected: {
          requiredGuidanceIds: ["alz-network-topology", "alz-identity-access", "alz-subscription-governance", "caf-cloud-operations-ownership"],
          unknownGuidanceIds: ["alz-network-topology", "alz-identity-access", "alz-subscription-governance", "caf-cloud-operations-ownership"],
        },
      },
      reference: { review: {
        summary: "Platform and workload roles are named, but connectivity operations, delegated access, subscription governance and accountable owners need evidence.",
        posture: "mixed", score: 40,
        strengths: ["The sketch separates shared connectivity from workload hosting."],
        assumptions: ["Region and branch requirements are stated intent, not deployed topology."],
        findings: [
          finding("alz-network-topology", {
            title: "Choose topology from connectivity and operating needs", severity: "medium", evidenceStatus: "unknown",
            evidence: "platform-hub connects to team-app; the context describes branches and two regions without routes or site inventory.",
            recommendation: "Compare managed Virtual WAN and customer-managed topology using transit, routing control and branch-scale requirements.",
            nodeIds: ["platform-hub", "team-app"], edgeIds: ["platform-transit"],
            guidanceRationale: "The ALZ topology article frames Virtual WAN versus customer-managed design as a requirements-based choice, not a universal requirement.",
            remediation: {
              steps: ["Inventory branches, regions and required transit paths.", "Assign routing operations and validate effective connectivity."],
              validation: "Provide site requirements, deployed peerings or gateways, effective routes and end-to-end reachability tests.",
              tradeoff: "Managed transit can reduce operations but changes cost and routing control.",
            },
          }),
          finding("alz-identity-access", {
            title: "Workload autonomy needs bounded delegated access", severity: "high", evidenceStatus: "unknown",
            evidence: "The teams are named but no effective role assignments, privileged activation policy or access tests are supplied.",
            recommendation: "Delegate narrowly scoped workload access within platform boundaries and review time-bound privileged access.",
            nodeIds: ["platform-hub", "team-app"], edgeIds: [],
            guidanceRationale: "ALZ identity guidance distinguishes Entra tenant roles from resource RBAC and asks for scoped administration, not inferred permissions from diagram groupings.",
            remediation: {
              steps: ["Inventory inherited roles and distinguish tenant from resource administration.", "Test workload operator access without cross-boundary platform administration."],
              validation: "Provide effective assignments, memberships, activation policies and authorized/denied access-test records.",
              tradeoff: "Tighter delegation reduces standing privilege but requires reliable emergency access and role lifecycle operations.",
            },
          }),
          finding("alz-subscription-governance", {
            title: "Subscription ownership and inherited policy are unknown", severity: "medium", evidenceStatus: "unknown",
            evidence: "No subscription inventory or policy hierarchy accompanies the shared network and workload service.",
            recommendation: "Define platform/workload governance boundaries, subscription owners and a repeatable provisioning path.",
            nodeIds: ["platform-hub", "team-app"], edgeIds: [],
            guidanceRationale: "ALZ subscription guidance uses subscriptions for ownership, billing and isolation; two regions do not by themselves require two subscriptions.",
            remediation: {
              steps: ["Record subscription purpose, owner and management-group placement.", "Review inherited policy, exemptions and automated provisioning outputs."],
              validation: "Provide an owned subscription inventory, hierarchy, policy evaluation and provisioning/remediation records.",
              tradeoff: "More boundaries improve isolation but increase policy, quota and lifecycle management.",
            },
          }),
          finding("caf-cloud-operations-ownership", {
            title: "Platform and workload incident responsibilities need owners", severity: "high", evidenceStatus: "unknown",
            evidence: "The context names two teams but explicitly lacks a responsibility matrix, alert routing and operational runbooks.",
            recommendation: "Name owners for routing, workload changes, incidents and continuity; exercise cross-team handoffs.",
            nodeIds: ["platform-hub", "team-app"], edgeIds: ["platform-transit"],
            guidanceRationale: "CAF operations readiness requires an explicit operating model and practical responsibilities; a shared service does not establish who handles incidents.",
            remediation: {
              steps: ["Publish platform/workload responsibilities and escalation ownership.", "Test an incident crossing the network and application boundary."],
              validation: "Provide a versioned responsibility matrix, runbooks, alert recipients and an exercise record showing the named teams performed their duties.",
              tradeoff: "Shared operations reduces duplication but introduces handoff coordination and escalation dependencies.",
            },
          }),
        ],
      } },
    },
    {
      task: {
        id: "review-retries-and-capacity", kind: "review", title: "Observed retry configuration versus unknown isolation and capacity",
        input: {
          source: "canvas",
          payload: { nodes: [
            { ...service("order-caller", "azure/application/application-service", "Order caller", 40),
              semantics: { provider: "azure", properties: { retryAttempts: "unbounded", retryDelayMilliseconds: 0 } } },
            service("payment-worker", "azure/application/function-app", "Payment worker", 390),
          ], edges: [edge("charge-call", "order-caller", "payment-worker", "charge")] },
          context: "Synthetic supplied configuration: Order caller retries charge failures indefinitely with zero delay. Charge changes payment state. No idempotency safeguard, breaker threshold/state telemetry, demand forecast, target latency, quota or load-test evidence is supplied. Treat configuration fields as supplied evidence, not proof of observed runtime outages.",
        },
        expected: {
          requiredGuidanceIds: ["aac-retry", "aac-circuit-breaker", "waf-pe02-capacity-planning"],
          unknownGuidanceIds: ["aac-circuit-breaker", "waf-pe02-capacity-planning"],
        },
      },
      reference: { review: {
        summary: "The supplied unbounded retry setting warrants correction; breaker behavior and sustainable demand remain unverified.",
        posture: "high-risk", score: 35,
        strengths: ["The caller and payment dependency are explicitly identified."],
        assumptions: ["The synthetic configuration is input evidence; no incident, outage or duplicated payment is claimed to have occurred."],
        findings: [
          finding("aac-retry", {
            title: "Bound retries and protect payment idempotency", severity: "high", evidenceStatus: "observed",
            evidence: "order-caller declares retryAttempts=unbounded and retryDelayMilliseconds=0 for the charge-call dependency in the supplied configuration.",
            recommendation: "Classify transient errors, bound attempts and elapsed time, use suitable delays and protect the state-changing charge operation with idempotency.",
            nodeIds: ["order-caller", "payment-worker"], edgeIds: ["charge-call"],
            guidanceRationale: "The Retry pattern applies to plausibly transient failures and requires bounds plus side-effect safety; repeated immediate charge attempts can amplify dependency failures.",
            remediation: {
              steps: ["Inspect SDK and application retries and eliminate compounded retry layers.", "Implement a bounded policy and idempotency guard, surfacing exhausted retries."],
              validation: "Fault tests must demonstrate bounded latency, correct retryable-error classification and no duplicate payment side effects.",
              tradeoff: "Fewer retries can expose failures sooner; longer delays improve recovery opportunity at the cost of latency.",
            },
          }),
          finding("aac-circuit-breaker", {
            title: "Dependency isolation is unknown", severity: "high", evidenceStatus: "unknown",
            evidence: "No breaker configuration or closed/open/half-open telemetry is supplied for charge-call.",
            recommendation: "Determine whether existing platform isolation suffices; otherwise coordinate a breaker with the bounded retry policy.",
            nodeIds: ["order-caller", "payment-worker"], edgeIds: ["charge-call"],
            guidanceRationale: "Circuit Breaker addresses persistent failure and caller resource exhaustion, unlike retries for transient faults; absence of configuration in the sketch is not proof of an absent breaker.",
            remediation: {
              steps: ["Document thresholds, open duration and limited recovery probes.", "Test sustained failure and recovery with retries enabled."],
              validation: "Show suppressed calls while open and controlled probes during recovery, with no retry path bypassing isolation.",
              tradeoff: "Isolation protects the caller but temporarily rejects work that might otherwise succeed.",
            },
          }),
          finding("waf-pe02-capacity-planning", {
            title: "Peak demand and failure headroom are unmeasured", severity: "medium", evidenceStatus: "unknown",
            evidence: "The two services have no stated demand forecast, performance objective, scaling limits or representative load test.",
            recommendation: "Set throughput and latency targets, forecast peak demand and test scaling constraints including retry amplification.",
            nodeIds: ["order-caller", "payment-worker"], edgeIds: ["charge-call"],
            guidanceRationale: "PE:02 connects measured demand or justified assumptions to capacity and quotas; a serverless icon does not establish unlimited sustainable throughput.",
            remediation: {
              steps: ["Record normal/peak demand and latency objectives.", "Test representative workloads against deployed SKUs, quotas and scaling limits."],
              validation: "Provide utilization, throughput and latency results under normal demand, bursts and dependency failure.",
              tradeoff: "Reserved headroom costs more, while aggressive scaling assumptions can miss burst requirements.",
            },
          }),
        ],
      } },
    },
    {
      task: {
        id: "review-cost-risk-accountability", kind: "review", title: "Cost estimates are not cost operations or an owned risk register",
        input: {
          source: "description",
          description: "Synthetic Azure analytics pilot using a storage account and SQL database. A one-time pricing estimate exists, but no actual/amortized cost exports, allocation rules, budgets, notification recipients, dated risk register or accountable treatment owners are supplied. The team plans wider rollout. Review cost-data operations and cloud-risk assessment, preserving unknowns.",
          context: "No structured diagram or resource IDs are supplied. Do not invent node or edge references, actual spending, compliance findings or control-test results.",
        },
        expected: {
          requiredGuidanceIds: ["waf-co03-cost-data", "caf-cloud-risk-assessment"],
          unknownGuidanceIds: ["waf-co03-cost-data", "caf-cloud-risk-assessment"],
        },
      },
      reference: { review: {
        summary: "The pilot has a stated cost estimate, not evidence of ongoing cost accountability or an owned and reviewed risk process.",
        posture: "mixed", score: 50,
        strengths: ["The pilot explicitly recognizes cost and wider-rollout decisions as review topics."],
        assumptions: ["No actual spending, budget breach or unmitigated incident can be inferred from this description."],
        findings: [
          finding("waf-co03-cost-data", {
            title: "Estimates do not establish ongoing cost visibility", severity: "medium", evidenceStatus: "unknown",
            evidence: "The description supplies a one-time estimate but no dated cost data, allocations, budgets or alert recipients.",
            recommendation: "Collect actual and amortized costs daily, assign accountable cost owners and route budget, forecast and anomaly notifications to investigation.",
            nodeIds: [], edgeIds: [],
            guidanceRationale: "CO:03 concerns collection and review of actual cost information and actionable notifications; a pricing estimate cannot establish these operational controls.",
            remediation: {
              steps: ["Configure cost exports and accountable allocation rules.", "Set budgets and notification recipients with an investigation process."],
              validation: "Provide reconciled dated exports, owner allocations, budget/forecast settings and a tested notification-to-investigation record.",
              tradeoff: "Detailed attribution and frequent review improve accountability but add reporting and ownership maintenance.",
            },
          }),
          finding("caf-cloud-risk-assessment", {
            title: "Rollout risk treatments need accountable owners", severity: "high", evidenceStatus: "unknown",
            evidence: "Wider rollout is planned without a supplied dated risk register, probability/impact rationale or treatment ownership.",
            recommendation: "Assess risks with relevant stakeholders, prioritize likelihood and impact and assign treatment owners and due dates before rollout decisions.",
            nodeIds: [], edgeIds: [],
            guidanceRationale: "CAF risk assessment calls for a maintained stakeholder-reviewed risk register and accountable treatment; absence of that evidence does not certify either compliance or noncompliance.",
            remediation: {
              steps: ["Inventory workload risks with security, finance and operations stakeholders.", "Assign treatment owners and schedule periodic and change-triggered reassessments."],
              validation: "Provide a dated register, prioritization rationale, named owners, target dates and reassessment or control-test records.",
              tradeoff: "Formal review adds coordination effort but makes risk acceptance and treatment decisions traceable.",
            },
          }),
        ],
      } },
    },
  ];
}

function terraformReferences() {
  // Explicit same-named parameters keep the two languages independently inspectable.
  const header = `terraform {
  required_version = ">= 1.7.0"
  required_providers {
    azurerm = {
      source = "hashicorp/azurerm"
      version = "~> 5.6"
    }
  }
}
provider "azurerm" {
  subscription_id = var.subscriptionId
  features {}
}
variable "subscriptionId" { type = string }
variable "resourceGroupName" { type = string }
variable "location" { type = string }
`;
  const scope = {
    subscriptionId: { type: "string" },
    resourceGroupName: { type: "string" },
    location: { type: "string" },
  };
  return {
    "iac-storage-terraform": {
      code: `${header}
variable "storageName" { type = string }
resource "azurerm_storage_account" "archive" {
  name = var.storageName
  resource_group_name = var.resourceGroupName
  location = var.location
  account_kind = "StorageV2"
  account_tier = "Standard"
  account_replication_type = "ZRS"
  min_tls_version = "TLS1_2"
  https_traffic_only_enabled = true
  shared_access_key_enabled = false
  public_network_access = "Disabled"
  allow_nested_items_to_be_public = false
}
`,
      armTemplate: {
        $schema: "https://schema.management.azure.com/schemas/2019-04-01/deploymentTemplate.json#",
        contentVersion: "1.0.0.0",
        parameters: { ...scope, storageName: { type: "string", minLength: 3, maxLength: 24 } },
        resources: [{
          type: "Microsoft.Storage/storageAccounts", apiVersion: "2023-05-01",
          name: "[parameters('storageName')]", location: "[parameters('location')]",
          kind: "StorageV2", sku: { name: "Standard_ZRS" },
          properties: {
            supportsHttpsTrafficOnly: true, minimumTlsVersion: "TLS1_2",
            allowSharedKeyAccess: false, allowBlobPublicAccess: false, publicNetworkAccess: "Disabled",
          },
        }],
      },
    },
    "iac-network-terraform": {
      code: `${header}
variable "networkName" { type = string }
resource "azurerm_virtual_network" "workload" {
  name = var.networkName
  resource_group_name = var.resourceGroupName
  location = var.location
  address_space = ["10.42.0.0/16"]
}
`,
      armTemplate: {
        $schema: "https://schema.management.azure.com/schemas/2019-04-01/deploymentTemplate.json#",
        contentVersion: "1.0.0.0",
        parameters: { ...scope, networkName: { type: "string" } },
        resources: [{
          type: "Microsoft.Network/virtualNetworks", apiVersion: "2023-11-01",
          name: "[parameters('networkName')]", location: "[parameters('location')]",
          properties: { addressSpace: { addressPrefixes: ["10.42.0.0/16"] } },
        }],
      },
    },
  };
}

function iacCases() {
  // These type lists are authored requirements, never inferred from emitter output.
  const tasks = [
    {
      id: "iac-app-service-bicep", kind: "iac", title: "Bicep web application with its supporting hosting plan",
      input: {
        format: "bicep",
        payload: { nodes: [service("iac-web", "azure/application/application-service", "Catalog API")], edges: [] },
        context: "Draft only this App Service and its required plan. Retain the input node mapping for both resources. No deployment, application code or workload data-plane permission is requested.",
      },
      expected: { format: "bicep", resourceTypes: ["Microsoft.Web/serverfarms", "Microsoft.Web/sites"] },
    },
    {
      id: "iac-sql-bicep", kind: "iac", title: "Bicep SQL database with Entra-only logical server",
      input: {
        format: "bicep",
        payload: { nodes: [service("iac-sql", "azure/data/sql-database", "Ledger database")], edges: [] },
        context: "Draft the SQL database and logical server with parameterized Entra administrator identity, not a literal password. Both resources must map to iac-sql. Do not infer network connectivity.",
      },
      expected: { format: "bicep", resourceTypes: ["Microsoft.Sql/servers", "Microsoft.Sql/servers/databases"] },
    },
    {
      id: "iac-storage-terraform", kind: "iac", title: "Terraform keyless storage-account draft",
      input: {
        format: "terraform",
        payload: { nodes: [service("iac-storage", "azure/storage/storage-account", "Synthetic archive")], edges: [] },
        context: "Draft only the Azure storage account with TLS and shared-key access disabled. Parameterize deployment scope and unique naming. Do not create containers, role assignments, sample data or executable scripts.",
      },
      expected: { format: "terraform", resourceTypes: ["Microsoft.Storage/storageAccounts"] },
    },
    {
      id: "iac-network-terraform", kind: "iac", title: "Terraform virtual network without inferred connectivity",
      input: {
        format: "terraform",
        payload: { nodes: [service("iac-network", "azure/networking/virtual-network", "Workload network")], edges: [] },
        context: "Draft only this virtual network with address space 10.42.0.0/16. Map it to iac-network. Parameterize location and naming. Do not infer subnets, peerings, gateways, routes or that any workload already has private connectivity.",
      },
      expected: { format: "terraform", resourceTypes: ["Microsoft.Network/virtualNetworks"] },
    },
  ];
  const terraform = terraformReferences();
  return tasks.map((task) => {
    const payload = parseArchitectureDocument(task.input.payload);
    const artifact = task.input.format === "terraform" ? terraform[task.id] : {
      armTemplate: generateArmTemplate(payload).template,
      code: generateArchitectureCode(payload, task.input.format).output,
    };
    const armTemplate = parseArmTemplate(artifact.armTemplate);
    return {
      task,
      reference: {
        format: task.input.format,
        code: artifact.code,
        armTemplate,
        resourceMappings: armTemplate.resources.map((resource) => ({
          nodeId: payload.nodes[0].id, resourceType: resource.type, resourceName: resource.name,
        })),
      },
    };
  });
}

export async function loadGoldenBenchmark() {
  const cases = [...generationCases(), ...await conversionCases(), ...reviewCases(), ...iacCases()];
  for (const { task, reference } of cases) {
    if (task.kind === "generation") {
      generationRequestSchema.parse(task.input);
      parseGuidedArchitecture({ ...reference.graph, designAssistance: reference.designAssistance }, SERVICE_CATALOG);
    } else if (task.kind === "conversion") {
      const request = architectureReviewRequestSchema.parse({ source: "image", image: task.input.image });
      conversionSourceSchema.parse(task.input.sourceNodes);
      await validateEvidenceImage(request.image);
      reference.payload = parseWhiteboardConversionResponse(reference, SERVICE_CATALOG).payload;
    } else if (task.kind === "review") {
      const request = architectureReviewRequestSchema.parse(task.input);
      parseGeneratedArchitectureReview(JSON.stringify(reference.review), request.payload);
    } else {
      deploymentRequestSchema.parse(task.input);
      engineeringArtifactInputSchema.parse(reference);
      parseDeploymentDraft({
        ...reference, assumptions: ["Hand-authored or trusted offline emitter reference; no model or deployment was invoked."], warnings: [],
      }, parseArchitectureDocument(task.input.payload), task.expected.format);
    }
  }
  const dataset = goldenDatasetSchema.parse({
    schemaVersion: 1, id: "diagrammatic-cloud-ai", version: "2026-09-22.1",
    description: "Sixteen independently hand-authored synthetic tasks: four each for generation, PNG conversion, grounded review and IaC. Expected roles, directed flows, guidance requirements and resource types are specified independently of reference outputs. Text-only artwork is original. References exercise production contracts and offline emitters; they are explicitly NOT model-quality, provider-performance or deployment evidence.",
    tasks: cases.map(({ task }) => task),
  });
  return { dataset, referenceOutputs: Object.fromEntries(cases.map(({ task, reference }) => [task.id, reference])) };
}
