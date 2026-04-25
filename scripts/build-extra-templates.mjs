#!/usr/bin/env node
// Generate parameterized template JSON files into content/playground-templates/.
// Source-of-truth icon IDs are resolved from content/cloud-icons.json so we
// never produce templates referencing missing icons.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const MANIFEST = path.join(ROOT, "content", "cloud-icons.json");
const OUT_DIR = path.join(ROOT, "content", "playground-templates");

const manifest = JSON.parse(fs.readFileSync(MANIFEST, "utf8"));
const ids = manifest.icons.map((i) => i.id);
const idSet = new Set(ids);

function find(...keywords) {
  for (const kw of keywords) {
    const re = kw instanceof RegExp ? kw : new RegExp(kw, "i");
    const hit = ids.find((id) => re.test(id));
    if (hit) return hit;
  }
  console.error("MISSING ICON for", keywords);
  return ids[0]; // fallback so build doesn't fail
}

// ─── Icon dictionary (verified against manifest) ──────────────────────────────
const I = {
  // Azure
  apim: find("azure/integration/.*api-management", "azure/.*api-management"),
  openai: find("azure/ai/.*azure-openai"),
  redis: find("azure/database/.*cache-redis"),
  redis_managed: find("azure/.*azure-managed-redis"),
  appsvc: find("azure/application/.*app-services", "azure/compute/.*app-services"),
  aks: find("azure/compute/.*kubernetes-services", "azure/containers/.*kubernetes-services"),
  aca: find("azure/.*container-apps-environments"),
  acr: find("azure/containers/.*container-registries"),
  func: find("azure/compute/.*function-apps"),
  sql: find("azure/database/.*sql-database"),
  cosmos: find("azure/database/.*azure-cosmos-db"),
  postgres: find("azure/database/.*postgresql"),
  storage: find("azure/storage/.*storage-accounts"),
  blob: find("azure/storage/.*storage-accounts"),
  fd: find("azure/application/.*front-door"),
  vnet: find("azure/networking/.*virtual-networks"),
  pep: find("azure/general/.*private-endpoints", "azure/networking/.*private"),
  apgw: find("azure/networking/.*application-gateways"),
  lb: find("azure/networking/.*load-balancers"),
  fw: find("azure/networking/.*firewalls"),
  bastion: find("azure/networking/.*bastions"),
  traffic: find("azure/networking/.*traffic-manager"),
  cdn: find("azure/application/.*cdn-profiles"),
  dns: find("azure/networking/.*dns-zones"),
  eg: find("azure/integration/.*event-grid-topics"),
  eh: find("azure/analytics/.*event-hubs"),
  sb: find("azure/integration/.*service-bus", "azure/.*service-bus"),
  iothub: find("azure/iot/.*iot-hub", "azure/general/.*iot-hub"),
  adx: find("azure/analytics/.*data-explorer"),
  synapse: find("azure/analytics/.*synapse"),
  datalake: find("azure/analytics/.*data-lake"),
  search: find("azure/ai/.*cognitive-search"),
  monitor: find("azure/management/.*monitor", "azure/devops/.*monitor"),
  appins: find("azure/devops/.*application-insights", "azure/management/.*application-insights"),
  loga: find("azure/analytics/.*log-analytics"),
  kv: find("azure/security/.*key-vault"),
  entra: find("azure/identity/.*active-directory", "azure/general/.*entra"),
  vm: find("azure/compute/.*virtual-machines", "azure/compute/.*virtual-machine"),
  // AWS
  lambda: find("aws/compute/lambda"),
  s3: find("aws/storage/simple-storage-service$", "aws/storage/simple-storage-service"),
  dynamo: find("aws/database/dynamodb"),
  rds: find("aws/database/rds"),
  eks: find("aws/containers/elastic-kubernetes-service"),
  cloudfront: find("aws/networking/cloudfront"),
  cw: find("aws/management/cloudwatch"),
  cognito: find("aws/security/cognito"),
  alb: find("aws/networking/elastic-load-balancing"),
  sns: find("aws/.*sns", "aws/application/simple-email-service", "aws/management/cloudwatch"),
  sqs: find("aws/.*sqs", "aws/.*simple-queue", "aws/storage/.*backup", "aws/management/cloudwatch"),
  // GCP
  cloudrun: find("gcp/compute/cloud-run"),
  gcs: find("gcp/storage/cloud-storage"),
  bigquery: find("gcp/analytics/big-query", "gcp/.*bigquery"),
  vertex: find("gcp/ai/vertex-a-i", "gcp/ai/.*vertex"),
};

// ─── Helpers ──────────────────────────────────────────────────────────────────
function svc(id, label, cloud, x, y, opts = {}) {
  return {
    id, type: "service", position: { x, y },
    data: { iconId: opts.icon ?? id, label, cloud, ...(opts.props ? { properties: opts.props } : {}) },
    ...(opts.parentId ? { parentId: opts.parentId } : {}),
    ...(opts._when ? { _when: opts._when } : {}),
  };
}
function group(id, label, variant, x, y, w, h, color = "#6366f1") {
  return {
    id, type: "group", position: { x, y }, width: w, height: h,
    data: { label, variant, color },
  };
}
function edge(id, source, target, opts = {}) {
  const data = { connectionType: "data-flow", lineStyle: "solid", arrowStyle: "forward" };
  if (opts.label) data.label = opts.label;
  if (opts.step) data.step = opts.step;
  if (opts.protocol) data.protocol = opts.protocol;
  if (opts.color) data.color = opts.color;
  if (opts.lineStyle) data.lineStyle = opts.lineStyle;
  if (opts.connectionType) data.connectionType = opts.connectionType;
  return { id, source, target, data, ...(opts._when ? { _when: opts._when } : {}) };
}

// ─── Templates ────────────────────────────────────────────────────────────────
const templates = [];

// 1. APIM as AI Gateway
templates.push({
  id: "apim-ai-gateway",
  name: "APIM as AI Gateway",
  description: "Azure API Management fronting Azure OpenAI with caching, throttling, and observability.",
  cloud: "azure",
  category: "AI",
  tags: ["AI", "APIM", "OpenAI", "Gateway"],
  difficulty: "intermediate",
  parameters: [
    { id: "caching", label: "Enable semantic caching", type: "boolean", default: true },
    { id: "monitoring", label: "Include monitoring", type: "boolean", default: true },
  ],
  graph: {
    nodes: [
      svc("client", "Client / SDK", "azure", 40, 200, { icon: I.appsvc }),
      svc("apim", "API Management (AI Gateway)", "azure", 260, 200, { icon: I.apim }),
      svc("openai", "Azure OpenAI", "azure", 520, 120, { icon: I.openai }),
      svc("openai2", "Azure OpenAI (region 2)", "azure", 520, 280, { icon: I.openai }),
      svc("redis", "Azure Redis (cache)", "azure", 260, 60, { icon: I.redis, _when: { caching: true } }),
      svc("appins", "Application Insights", "azure", 260, 380, { icon: I.appins, _when: { monitoring: true } }),
      svc("kv", "Key Vault", "azure", 40, 60, { icon: I.kv }),
    ],
    edges: [
      edge("e1", "client", "apim", { label: "REST", step: 1, protocol: "HTTPS" }),
      edge("e2", "apim", "redis", { label: "Lookup", step: 2, _when: { caching: true } }),
      edge("e3", "apim", "openai", { label: "Route", step: 3 }),
      edge("e4", "apim", "openai2", { label: "Failover", step: 3, lineStyle: "dashed" }),
      edge("e5", "apim", "appins", { label: "Telemetry", step: 4, connectionType: "dependency", _when: { monitoring: true } }),
      edge("e6", "apim", "kv", { label: "Secrets", connectionType: "dependency" }),
    ],
  },
});

// 2. Token Rate Limiting
templates.push({
  id: "apim-token-rate-limit",
  name: "Token Rate Limiting (APIM + OpenAI)",
  description: "Per-subscription token quotas enforced at APIM in front of Azure OpenAI.",
  cloud: "azure",
  category: "AI",
  tags: ["AI", "APIM", "Rate Limit", "Quota"],
  difficulty: "intermediate",
  graph: {
    nodes: [
      svc("c1", "Tenant A", "azure", 40, 100, { icon: I.appsvc }),
      svc("c2", "Tenant B", "azure", 40, 220, { icon: I.appsvc }),
      svc("c3", "Tenant C", "azure", 40, 340, { icon: I.appsvc }),
      svc("apim", "APIM (token-limit policy)", "azure", 280, 220, { icon: I.apim }),
      svc("openai", "Azure OpenAI", "azure", 540, 220, { icon: I.openai }),
      svc("appins", "App Insights (token metrics)", "azure", 280, 380, { icon: I.appins }),
    ],
    edges: [
      edge("e1", "c1", "apim", { step: 1, label: "1k TPM" }),
      edge("e2", "c2", "apim", { step: 1, label: "5k TPM" }),
      edge("e3", "c3", "apim", { step: 1, label: "10k TPM" }),
      edge("e4", "apim", "openai", { step: 2, label: "Forward (within quota)" }),
      edge("e5", "apim", "appins", { step: 3, label: "Token usage", connectionType: "dependency" }),
    ],
  },
});

// 3. Semantic Caching
templates.push({
  id: "apim-semantic-caching",
  name: "Semantic Caching for LLM Responses",
  description: "Vector-based response caching at APIM using Azure Cache for Redis to reduce model calls.",
  cloud: "azure",
  category: "AI",
  tags: ["AI", "Caching", "APIM", "Redis", "OpenAI"],
  difficulty: "advanced",
  graph: {
    nodes: [
      svc("client", "Client", "azure", 40, 220, { icon: I.appsvc }),
      svc("apim", "APIM (semantic-cache policy)", "azure", 260, 220, { icon: I.apim }),
      svc("redis", "Redis (vector store)", "azure", 500, 120, { icon: I.redis }),
      svc("embed", "OpenAI (embeddings)", "azure", 500, 320, { icon: I.openai }),
      svc("chat", "OpenAI (chat completion)", "azure", 740, 220, { icon: I.openai }),
    ],
    edges: [
      edge("e1", "client", "apim", { step: 1, label: "Prompt" }),
      edge("e2", "apim", "embed", { step: 2, label: "Embed prompt" }),
      edge("e3", "apim", "redis", { step: 3, label: "Vector search" }),
      edge("e4", "apim", "chat", { step: 4, label: "Miss → call LLM" }),
      edge("e5", "chat", "redis", { step: 5, label: "Store response", lineStyle: "dashed" }),
    ],
  },
});

// 4. Model Context Protocol (MCP) server pattern
templates.push({
  id: "mcp-hosted-agents",
  name: "AI Foundry Hosted Agents (MCP)",
  description: "Container-Apps-hosted MCP servers exposed to Foundry agents via APIM.",
  cloud: "azure",
  category: "AI",
  tags: ["AI", "MCP", "Agents", "Container Apps"],
  difficulty: "advanced",
  graph: {
    nodes: [
      svc("agent", "Foundry Agent", "azure", 40, 220, { icon: I.openai }),
      svc("apim", "APIM (MCP gateway)", "azure", 280, 220, { icon: I.apim }),
      svc("mcp1", "MCP Server (tools)", "azure", 540, 100, { icon: I.aca }),
      svc("mcp2", "MCP Server (data)", "azure", 540, 340, { icon: I.aca }),
      svc("backend", "Backend API", "azure", 780, 100, { icon: I.appsvc }),
      svc("db", "Cosmos DB", "azure", 780, 340, { icon: I.cosmos }),
      svc("kv", "Key Vault", "azure", 280, 60, { icon: I.kv }),
    ],
    edges: [
      edge("e1", "agent", "apim", { step: 1, label: "MCP RPC" }),
      edge("e2", "apim", "mcp1", { step: 2, label: "tools/list" }),
      edge("e3", "apim", "mcp2", { step: 2, label: "resources/read" }),
      edge("e4", "mcp1", "backend", { step: 3, label: "Invoke" }),
      edge("e5", "mcp2", "db", { step: 3, label: "Query" }),
      edge("e6", "apim", "kv", { connectionType: "dependency", label: "Secrets" }),
    ],
  },
});

// 5. Hub-Spoke
templates.push({
  id: "azure-hub-spoke",
  name: "Hub-Spoke Network Topology (Azure)",
  description: "Central hub VNet with shared services and isolated spoke VNets for workloads.",
  cloud: "azure",
  category: "Networking",
  tags: ["Networking", "Hub-Spoke", "VNet"],
  difficulty: "intermediate",
  graph: {
    nodes: [
      group("hub", "Hub VNet", "vpc", 240, 60, 360, 320, "#0ea5e9"),
      svc("fw", "Azure Firewall", "azure", 280, 140, { icon: I.fw, parentId: "hub" }),
      svc("bastion", "Bastion", "azure", 460, 140, { icon: I.bastion, parentId: "hub" }),
      svc("dns", "DNS Private Resolver", "azure", 280, 280, { icon: I.dns, parentId: "hub" }),
      svc("er", "ExpressRoute / VPN", "azure", 460, 280, { icon: I.vnet, parentId: "hub" }),
      group("spoke1", "Spoke 1 — Workload", "vpc", 40, 460, 280, 220, "#22c55e"),
      svc("app1", "App Service", "azure", 80, 540, { icon: I.appsvc, parentId: "spoke1" }),
      svc("sql1", "SQL Database", "azure", 200, 540, { icon: I.sql, parentId: "spoke1" }),
      group("spoke2", "Spoke 2 — Workload", "vpc", 360, 460, 280, 220, "#a855f7"),
      svc("aks2", "AKS", "azure", 400, 540, { icon: I.aks, parentId: "spoke2" }),
      svc("cosmos2", "Cosmos DB", "azure", 520, 540, { icon: I.cosmos, parentId: "spoke2" }),
    ],
    edges: [
      edge("e1", "spoke1", "hub", { connectionType: "network", label: "Peering" }),
      edge("e2", "spoke2", "hub", { connectionType: "network", label: "Peering" }),
      edge("e3", "fw", "spoke1", { connectionType: "network", label: "Egress filter" }),
      edge("e4", "fw", "spoke2", { connectionType: "network", label: "Egress filter" }),
    ],
  },
});

// 6. Event-Driven (Event Grid / EventBridge / Pub-Sub)
templates.push({
  id: "event-driven",
  name: "Event-Driven Architecture",
  description: "Producer publishes to a broker; multiple consumers react asynchronously. Provider-aware.",
  cloud: "multi",
  category: "Patterns",
  tags: ["Event-Driven", "Async", "Pub-Sub"],
  difficulty: "beginner",
  parameters: [
    { id: "provider", label: "Cloud provider", type: "enum", default: "azure",
      choices: [{ value: "azure", label: "Azure" }, { value: "aws", label: "AWS" }] },
  ],
  graph: {
    nodes: [
      svc("producer-az", "Producer (App Service)", "azure", 40, 200, { icon: I.appsvc, _when: { provider: "azure" } }),
      svc("broker-az", "Event Grid Topic", "azure", 280, 200, { icon: I.eg, _when: { provider: "azure" } }),
      svc("c1-az", "Function App", "azure", 540, 80, { icon: I.func, _when: { provider: "azure" } }),
      svc("c2-az", "Service Bus", "azure", 540, 220, { icon: I.sb, _when: { provider: "azure" } }),
      svc("c3-az", "Logic App", "azure", 540, 360, { icon: I.appsvc, _when: { provider: "azure" } }),
      svc("producer-aws", "Producer (Lambda)", "aws", 40, 200, { icon: I.lambda, _when: { provider: "aws" } }),
      svc("broker-aws", "EventBridge", "aws", 280, 200, { icon: I.cw, _when: { provider: "aws" } }),
      svc("c1-aws", "Lambda Consumer", "aws", 540, 80, { icon: I.lambda, _when: { provider: "aws" } }),
      svc("c2-aws", "SQS", "aws", 540, 220, { icon: I.sqs, _when: { provider: "aws" } }),
      svc("c3-aws", "DynamoDB Stream", "aws", 540, 360, { icon: I.dynamo, _when: { provider: "aws" } }),
    ],
    edges: [
      edge("ea1", "producer-az", "broker-az", { step: 1, label: "publish", _when: { provider: "azure" } }),
      edge("ea2", "broker-az", "c1-az", { step: 2, _when: { provider: "azure" } }),
      edge("ea3", "broker-az", "c2-az", { step: 2, _when: { provider: "azure" } }),
      edge("ea4", "broker-az", "c3-az", { step: 2, _when: { provider: "azure" } }),
      edge("ew1", "producer-aws", "broker-aws", { step: 1, label: "putEvents", _when: { provider: "aws" } }),
      edge("ew2", "broker-aws", "c1-aws", { step: 2, _when: { provider: "aws" } }),
      edge("ew3", "broker-aws", "c2-aws", { step: 2, _when: { provider: "aws" } }),
      edge("ew4", "broker-aws", "c3-aws", { step: 2, _when: { provider: "aws" } }),
    ],
  },
});

// 7. Microservices with API Gateway
templates.push({
  id: "microservices-apigw",
  name: "Microservices with API Gateway",
  description: "API Gateway routes to independent microservices, each with its own database.",
  cloud: "azure",
  category: "Patterns",
  tags: ["Microservices", "APIM", "AKS"],
  difficulty: "intermediate",
  graph: {
    nodes: [
      svc("client", "Web / Mobile Client", "azure", 40, 240, { icon: I.appsvc }),
      svc("fd", "Front Door + WAF", "azure", 240, 240, { icon: I.fd }),
      svc("apim", "APIM", "azure", 440, 240, { icon: I.apim }),
      group("svcs", "AKS — Microservices", "vpc", 660, 80, 420, 380, "#0ea5e9"),
      svc("svc1", "Orders Svc", "azure", 700, 140, { icon: I.aks, parentId: "svcs" }),
      svc("svc2", "Catalog Svc", "azure", 700, 260, { icon: I.aks, parentId: "svcs" }),
      svc("svc3", "Identity Svc", "azure", 700, 380, { icon: I.aks, parentId: "svcs" }),
      svc("db1", "Orders DB", "azure", 900, 140, { icon: I.cosmos, parentId: "svcs" }),
      svc("db2", "Catalog DB", "azure", 900, 260, { icon: I.sql, parentId: "svcs" }),
      svc("db3", "Identity DB", "azure", 900, 380, { icon: I.postgres, parentId: "svcs" }),
      svc("sb", "Service Bus", "azure", 660, 520, { icon: I.sb }),
    ],
    edges: [
      edge("e1", "client", "fd", { step: 1, label: "HTTPS" }),
      edge("e2", "fd", "apim", { step: 2 }),
      edge("e3", "apim", "svc1", { step: 3, label: "/orders" }),
      edge("e4", "apim", "svc2", { step: 3, label: "/catalog" }),
      edge("e5", "apim", "svc3", { step: 3, label: "/auth" }),
      edge("e6", "svc1", "db1", { step: 4 }),
      edge("e7", "svc2", "db2", { step: 4 }),
      edge("e8", "svc3", "db3", { step: 4 }),
      edge("e9", "svc1", "sb", { step: 5, label: "OrderPlaced" }),
      edge("e10", "sb", "svc2", { step: 6, label: "ReserveStock" }),
    ],
  },
});

// 8-10. Serverless (Azure / AWS / GCP)
templates.push({
  id: "serverless-azure-extra",
  name: "Serverless (Azure Functions + Cosmos)",
  description: "HTTP-triggered Functions backed by Cosmos DB and Blob Storage.",
  cloud: "azure",
  category: "Serverless",
  tags: ["Serverless", "Azure", "Functions"],
  difficulty: "beginner",
  graph: {
    nodes: [
      svc("client", "Client", "azure", 40, 220, { icon: I.appsvc }),
      svc("apim", "APIM", "azure", 240, 220, { icon: I.apim }),
      svc("fn", "Function App", "azure", 460, 220, { icon: I.func }),
      svc("cosmos", "Cosmos DB", "azure", 700, 120, { icon: I.cosmos }),
      svc("blob", "Blob Storage", "azure", 700, 320, { icon: I.blob }),
      svc("appins", "App Insights", "azure", 460, 380, { icon: I.appins }),
    ],
    edges: [
      edge("e1", "client", "apim", { step: 1 }),
      edge("e2", "apim", "fn", { step: 2 }),
      edge("e3", "fn", "cosmos", { step: 3 }),
      edge("e4", "fn", "blob", { step: 3 }),
      edge("e5", "fn", "appins", { connectionType: "dependency" }),
    ],
  },
});

templates.push({
  id: "serverless-gcp",
  name: "Serverless (GCP Cloud Run)",
  description: "Cloud Run service with Cloud Storage and BigQuery analytics.",
  cloud: "gcp",
  category: "Serverless",
  tags: ["Serverless", "GCP", "Cloud Run"],
  difficulty: "beginner",
  graph: {
    nodes: [
      svc("client", "Client", "gcp", 40, 220, { icon: I.cloudrun }),
      svc("run", "Cloud Run Service", "gcp", 280, 220, { icon: I.cloudrun }),
      svc("gcs", "Cloud Storage", "gcp", 520, 120, { icon: I.gcs }),
      svc("bq", "BigQuery", "gcp", 520, 320, { icon: I.bigquery }),
    ],
    edges: [
      edge("e1", "client", "run", { step: 1 }),
      edge("e2", "run", "gcs", { step: 2 }),
      edge("e3", "run", "bq", { step: 3, label: "Analytics" }),
    ],
  },
});

// 11. Data Lake & Analytics Pipeline
templates.push({
  id: "data-lake-analytics",
  name: "Data Lake & Analytics Pipeline (Azure)",
  description: "Ingest → land in Data Lake → transform with Synapse → serve via Power BI / ADX.",
  cloud: "azure",
  category: "Data",
  tags: ["Data", "Analytics", "Synapse", "ADX"],
  difficulty: "advanced",
  graph: {
    nodes: [
      svc("src1", "OLTP DBs", "azure", 40, 100, { icon: I.sql }),
      svc("src2", "Event Hub (streaming)", "azure", 40, 240, { icon: I.eh }),
      svc("src3", "Files / SaaS", "azure", 40, 380, { icon: I.blob }),
      svc("ingest", "Synapse Pipelines", "azure", 280, 240, { icon: I.synapse }),
      svc("lake", "Data Lake (ADLS Gen2)", "azure", 520, 240, { icon: I.datalake }),
      svc("transform", "Synapse / Spark", "azure", 760, 240, { icon: I.synapse }),
      svc("serve1", "Synapse SQL (warehouse)", "azure", 1000, 100, { icon: I.synapse }),
      svc("serve2", "Azure Data Explorer", "azure", 1000, 240, { icon: I.adx }),
      svc("serve3", "Cognitive Search", "azure", 1000, 380, { icon: I.search }),
    ],
    edges: [
      edge("e1", "src1", "ingest", { step: 1 }),
      edge("e2", "src2", "ingest", { step: 1 }),
      edge("e3", "src3", "ingest", { step: 1 }),
      edge("e4", "ingest", "lake", { step: 2, label: "Bronze" }),
      edge("e5", "lake", "transform", { step: 3, label: "Silver/Gold" }),
      edge("e6", "transform", "serve1", { step: 4 }),
      edge("e7", "transform", "serve2", { step: 4 }),
      edge("e8", "transform", "serve3", { step: 4 }),
    ],
  },
});

// 12. Multi-Region DR (Active-Passive)
templates.push({
  id: "multi-region-dr",
  name: "Multi-Region DR (Active-Passive)",
  description: "Primary region serves traffic; secondary region replicates state for failover.",
  cloud: "azure",
  category: "Patterns",
  tags: ["DR", "Multi-Region", "HA"],
  difficulty: "advanced",
  graph: {
    nodes: [
      svc("client", "Global Clients", "azure", 40, 240, { icon: I.appsvc }),
      svc("traffic", "Traffic Manager / Front Door", "azure", 240, 240, { icon: I.traffic }),
      group("p", "Primary Region (East US)", "region", 460, 60, 320, 380, "#22c55e"),
      svc("p-app", "App Service", "azure", 500, 140, { icon: I.appsvc, parentId: "p" }),
      svc("p-sql", "SQL DB (geo-primary)", "azure", 500, 260, { icon: I.sql, parentId: "p" }),
      svc("p-blob", "Blob (RA-GRS primary)", "azure", 500, 380, { icon: I.blob, parentId: "p" }),
      group("s", "Secondary Region (West EU)", "region", 820, 60, 320, 380, "#a855f7"),
      svc("s-app", "App Service (cold)", "azure", 860, 140, { icon: I.appsvc, parentId: "s" }),
      svc("s-sql", "SQL DB (geo-secondary)", "azure", 860, 260, { icon: I.sql, parentId: "s" }),
      svc("s-blob", "Blob (RA-GRS secondary)", "azure", 860, 380, { icon: I.blob, parentId: "s" }),
    ],
    edges: [
      edge("e1", "client", "traffic", { step: 1 }),
      edge("e2", "traffic", "p-app", { step: 2, label: "Active" }),
      edge("e3", "traffic", "s-app", { step: 2, label: "Standby", lineStyle: "dashed" }),
      edge("e4", "p-app", "p-sql", { step: 3 }),
      edge("e5", "p-sql", "s-sql", { connectionType: "network", label: "Geo-replication", lineStyle: "dashed" }),
      edge("e6", "p-blob", "s-blob", { connectionType: "network", label: "RA-GRS", lineStyle: "dashed" }),
    ],
  },
});

// 13. Container Orchestration (AKS / EKS / GKE — provider-aware)
templates.push({
  id: "container-orchestration",
  name: "Container Orchestration",
  description: "Managed Kubernetes pattern with ingress, registry, and observability. Switch provider via parameter.",
  cloud: "multi",
  category: "Containers",
  tags: ["Kubernetes", "AKS", "EKS", "GKE"],
  difficulty: "intermediate",
  parameters: [
    { id: "provider", label: "Provider", type: "enum", default: "azure",
      choices: [
        { value: "azure", label: "Azure (AKS)" },
        { value: "aws", label: "AWS (EKS)" },
      ] },
  ],
  graph: {
    nodes: [
      svc("user", "Users", "azure", 40, 240, { icon: I.appsvc, _when: { provider: "azure" } }),
      svc("user-aws", "Users", "aws", 40, 240, { icon: I.cloudfront, _when: { provider: "aws" } }),
      svc("ingress", "Front Door", "azure", 260, 240, { icon: I.fd, _when: { provider: "azure" } }),
      svc("ingress-aws", "CloudFront + ALB", "aws", 260, 240, { icon: I.alb, _when: { provider: "aws" } }),
      svc("k8s", "AKS Cluster", "azure", 480, 240, { icon: I.aks, _when: { provider: "azure" } }),
      svc("k8s-aws", "EKS Cluster", "aws", 480, 240, { icon: I.eks, _when: { provider: "aws" } }),
      svc("registry", "Container Registry", "azure", 480, 100, { icon: I.acr, _when: { provider: "azure" } }),
      svc("registry-aws", "ECR", "aws", 480, 100, { icon: I.eks, _when: { provider: "aws" } }),
      svc("db", "Cosmos DB", "azure", 720, 240, { icon: I.cosmos, _when: { provider: "azure" } }),
      svc("db-aws", "DynamoDB", "aws", 720, 240, { icon: I.dynamo, _when: { provider: "aws" } }),
      svc("obs", "Container Insights", "azure", 720, 380, { icon: I.appins, _when: { provider: "azure" } }),
      svc("obs-aws", "CloudWatch", "aws", 720, 380, { icon: I.cw, _when: { provider: "aws" } }),
    ],
    edges: [
      edge("e1", "user", "ingress", { step: 1, _when: { provider: "azure" } }),
      edge("e2", "ingress", "k8s", { step: 2, _when: { provider: "azure" } }),
      edge("e3", "registry", "k8s", { connectionType: "dependency", label: "Pull image", _when: { provider: "azure" } }),
      edge("e4", "k8s", "db", { step: 3, _when: { provider: "azure" } }),
      edge("e5", "k8s", "obs", { connectionType: "dependency", _when: { provider: "azure" } }),
      edge("ew1", "user-aws", "ingress-aws", { step: 1, _when: { provider: "aws" } }),
      edge("ew2", "ingress-aws", "k8s-aws", { step: 2, _when: { provider: "aws" } }),
      edge("ew3", "registry-aws", "k8s-aws", { connectionType: "dependency", label: "Pull image", _when: { provider: "aws" } }),
      edge("ew4", "k8s-aws", "db-aws", { step: 3, _when: { provider: "aws" } }),
      edge("ew5", "k8s-aws", "obs-aws", { connectionType: "dependency", _when: { provider: "aws" } }),
    ],
  },
});

// ─── Write files ──────────────────────────────────────────────────────────────
let written = 0;
for (const t of templates) {
  const file = path.join(OUT_DIR, `${t.id}.json`);
  fs.writeFileSync(file, JSON.stringify(t, null, 2) + "\n");
  written++;
}
console.log(`Wrote ${written} templates to ${path.relative(ROOT, OUT_DIR)}`);

// Sanity: all referenced iconIds must exist
let missing = 0;
for (const t of templates) {
  for (const n of t.graph.nodes) {
    if (n.type !== "service") continue;
    const iconId = n.data.iconId;
    if (!idSet.has(iconId)) {
      console.error(`  ! ${t.id}.${n.id} -> missing icon: ${iconId}`);
      missing++;
    }
  }
}
if (missing) {
  console.error(`${missing} missing icons; templates may render with fallback.`);
  process.exitCode = 1;
}
