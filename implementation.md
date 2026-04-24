# Architecture Playground — Enterprise Implementation Roadmap

> Transform the basic drag-and-drop playground into an enterprise-grade cloud architecture
> design tool — a serious alternative to [Cloudairy](https://cloudairy.com/), built on
> Next.js 16, React 19, React Flow, and Azure.

**Author:** Saurav Raghuvanshi (Digital Cloud Solution Architect @ Microsoft)
**Created:** 2026-04-24
**Status:** Draft — Living Document

---

## Table of Contents

1. [Vision & Goals](#1-vision--goals)
2. [Current State Assessment](#2-current-state-assessment)
3. [Competitive Landscape](#3-competitive-landscape)
4. [Architecture Patterns to Support](#4-architecture-patterns-to-support)
5. [Technical Architecture](#5-technical-architecture)
6. [Implementation Phases](#6-implementation-phases)
   - [Phase 0: Semantic Graph Model & Foundation](#phase-0-semantic-graph-model--foundation)
   - [Phase 1: Icon Library & Palette Overhaul](#phase-1-icon-library--palette-overhaul)
   - [Phase 2: Advanced Canvas & Editing](#phase-2-advanced-canvas--editing)
   - [Phase 3: Cloud Persistence, Auth & Projects](#phase-3-cloud-persistence-auth--projects)
   - [Phase 4: Template Engine & Architecture Gallery](#phase-4-template-engine--architecture-gallery)
   - [Phase 5: Export / Import Ecosystem](#phase-5-export--import-ecosystem)
   - [Phase 6: AI-Powered Features](#phase-6-ai-powered-features)
   - [Phase 7: Collaboration & Version History](#phase-7-collaboration--version-history)
   - [Phase 8: Enterprise & Platform Features](#phase-8-enterprise--platform-features)
7. [Performance & Scalability](#7-performance--scalability)
8. [Testing Strategy](#8-testing-strategy)
9. [Deployment & Infrastructure](#9-deployment--infrastructure)
10. [Success Metrics](#10-success-metrics)

---

## 1. Vision & Goals

### Vision

Build the **open-source, AI-powered cloud architecture design platform** that solution
architects, DevOps engineers, and cloud teams use daily to design, validate, collaborate
on, and export production-ready architecture diagrams — with first-class support for
Azure, AWS, and GCP.

### Goals

| # | Goal | Measure |
|---|------|---------|
| G1 | **Comprehensive icon library** | 2,700+ service icons across Azure/AWS/GCP with categorized search |
| G2 | **Enterprise-grade editing** | Layers, swimlanes, groups, orthogonal edges, snap, alignment, bulk ops |
| G3 | **Rich template gallery** | 50+ architecture templates from AI-Gateway labs, Jumpstart, and industry patterns |
| G4 | **AI-powered generation** | Generate diagrams from text prompts; describe/review existing architectures |
| G5 | **Multi-format export** | PNG, SVG, PDF, JSON, draw.io XML, Mermaid, and curated IaC (Bicep/Terraform) |
| G6 | **Cloud collaboration** | Auth, cloud save, share links, comments, version history, real-time co-editing |
| G7 | **Enterprise-ready** | SSO, RBAC, tenant isolation, audit logs, API access, custom branding |

### Non-Goals (Out of Scope for V1)

- Full IDE / code editing (not competing with VS Code)
- General-purpose diagramming (not Figma/Miro — focused on cloud architecture)
- Universal IaC reverse-engineering from arbitrary diagrams
- Native mobile app

---

## 2. Current State Assessment

### What We Have (Baseline)

| Capability | Current State | Gap |
|-----------|---------------|-----|
| **Icons** | 106 icons (36 Azure, 36 AWS, 34 GCP) | Need 2,700+ with categories |
| **Node types** | Service, Group, StickyNote | Need Text, Image, Icon, Swimlane, Zone |
| **Edge types** | 1 (Bezier with label) | Need orthogonal, step, straight + arrow variants |
| **Palette** | 3 cloud tabs, flat search | Need categorized tree, favorites, recents, custom |
| **Canvas** | React Flow with drag/drop | Need layers, minimap controls, rulers, snap/grid |
| **Export** | PNG, JSON, GIF | Need SVG, PDF, draw.io, Mermaid, IaC |
| **Templates** | 4 static JSON files | Need 50+ parameterized templates with gallery |
| **Persistence** | localStorage only (10 slots) | Need cloud DB, projects, version history |
| **Collaboration** | None | Need auth, sharing, comments, real-time |
| **AI** | None | Need prompt-to-diagram, review, describe |
| **State** | Snapshot undo/redo (50 cap) | Need operation-based history, CRDT |
| **Schema** | Flat typed objects | Need semantic resource model with metadata |

### Available Assets

- **V-4.5 Microsoft Icon Set:** 2,262 Azure SVGs across 16 categories (AI, Application, Compute, Data, Deployment, Dynamics 365, Endpoint, Generic, Identity, IoT, Management, Networking, Office365, Security, Storage, Workload)
- **AI-Gateway Labs:** 45+ lab architectures covering APIM, AI Foundry, MCP, agents, security, monitoring, load balancing, and more
- **Jumpstart Architectures:** Azure Arc, cloud-to-edge, IoT pipelines, GitOps CI/CD, observability stacks, industry scenarios (retail/manufacturing/healthcare)
- **Sample Presentations:** Detailed architecture slides with component-level breakdowns

---

## 3. Competitive Landscape

### Cloudairy Feature Map

| Feature | Cloudairy | Architecture Playground (Current) | Target |
|---------|-----------|----------------------------------|--------|
| AI diagram generation | ✅ Text → diagram | ❌ | ✅ Phase 6 |
| IaC export | ✅ Terraform/CFN/Bicep | ❌ | ✅ Phase 5 (curated) |
| Real-time collaboration | ✅ Multi-user co-editing | ❌ | ✅ Phase 7 |
| Template library | ✅ 100+ templates | 4 templates | ✅ Phase 4 (50+) |
| Animated diagrams | ✅ Flow animation + GIF/MP4 | ✅ Sequence player + GIF | ✅ Enhance |
| Cloud providers | ✅ AWS/Azure/GCP | ✅ AWS/Azure/GCP | ✅ Expand |
| Auto-layout | ✅ Smart algorithms | ❌ | ✅ Phase 2 |
| Version control | ✅ Full history | ❌ | ✅ Phase 7 |
| Comments/annotations | ✅ Inline | ❌ | ✅ Phase 7 |
| Multiple diagram types | ✅ Flowchart/UML/ER/Sequence | ❌ (architecture only) | 🔶 Architecture focus |
| Export formats | ✅ PNG/SVG/PDF/HTML | PNG/JSON/GIF | ✅ Phase 5 |
| SSO/enterprise | ✅ SOC2/GDPR/ISO | ❌ | ✅ Phase 8 |
| Pricing | $8/user/month | Free (open-source) | Free + Enterprise tier |

### Our Differentiators

1. **Open-source** — No vendor lock-in; self-hostable
2. **Azure-first with deep patterns** — 45+ real-world Azure architecture templates from Microsoft's own labs
3. **Architecture-focused** — Not trying to be everything; deep on cloud architecture
4. **Built by a DCSA** — Understands what solution architects actually need
5. **Sequence animation** — Already have animated request flow playback (unique)
6. **Embeddable** — Can embed diagrams in docs, presentations, and wikis

---

## 4. Architecture Patterns to Support

### From AI-Gateway Labs (Azure-Samples/AI-Gateway)

| Category | Architectures | Key Services |
|----------|--------------|--------------|
| **AI Gateway & Routing** | APIM as AI Gateway, model routing, backend pool load balancing | APIM, Azure OpenAI, AI Foundry |
| **AI Agents** | AI Agent Service, Foundry hosted agents, OpenAI agents, MCP agents | Azure Functions, Container Apps, AI Foundry |
| **MCP (Model Context Protocol)** | MCP server access, private MCP, MCP registry, A2A agents | APIM, AI Foundry, Front Door, Private Link |
| **Security & Access** | Access controlling (OAuth/JWT/API keys), private connectivity, content safety | Entra ID, Managed Identity, Private Link |
| **Observability & Cost** | Built-in logging, token metrics, token rate limiting, FinOps framework | App Insights, Log Analytics, APIM policies |
| **AI Capabilities** | Function calling, vector search, semantic caching, image generation, session awareness | Azure AI Search, Redis, Cosmos DB |
| **Production Patterns** | Zero-to-production, backend pool with Terraform | APIM, Bicep, Terraform |

### From Jumpstart / Arc Scenarios

| Category | Architectures | Key Services |
|----------|--------------|--------------|
| **Cloud-to-Edge** | AKS Edge Essentials, Arc-enabled K8s, IoT telemetry pipelines | AKS, Azure Arc, IoT Hub, ADX |
| **Hybrid Infrastructure** | ArcBox (Full/ITOps/DevOps/DataOps), HCIBox, Arc-enabled servers | Azure Arc, HCI, Azure Monitor |
| **Industry (Retail)** | Contoso Supermarket (PoS, freezer monitoring, checkout queue AI) | AKS EE, Cosmos DB, PostgreSQL, ADX |
| **Industry (Manufacturing)** | Contoso Robotics, Contoso Electronics | Azure Arc, AKS, AI at Edge |
| **CI/CD & GitOps** | GitHub Actions → ACR → Helm → Flux → staging/canary/prod | GitHub Actions, ACR, Flux, Helm |
| **Observability** | Prometheus/Grafana stacks, Azure Monitor, Defender for Cloud | Prometheus, Grafana, Log Analytics |

### Classic Cloud Architecture Patterns

| Pattern | Description |
|---------|-------------|
| **3-Tier Web App** | Frontend → API → Database (per cloud) |
| **Microservices** | API Gateway → Service Mesh → Containers → Data stores |
| **Event-Driven** | Event producers → Event Grid/EventBridge/Pub-Sub → Consumers |
| **Serverless** | API Gateway → Functions/Lambda → Managed data |
| **Hub-Spoke Network** | Hub VNet (firewall/VPN) → Spoke VNets (workloads) |
| **Data Lake / Analytics** | Ingest → Store → Process → Serve → Visualize |
| **DR / Multi-Region** | Primary region → Traffic Manager → Secondary region |
| **Zero Trust** | Identity → Device → Network → App → Data protection layers |

---

## 5. Technical Architecture

### High-Level System Design

```
┌─────────────────────────────────────────────────────────────────┐
│                        Frontend (Next.js 16)                     │
│  ┌──────────┐ ┌──────────┐ ┌─────────┐ ┌────────┐ ┌─────────┐ │
│  │  Canvas   │ │  Palette │ │Inspector│ │Toolbar │ │Templates│ │
│  │(ReactFlow)│ │(Categoriz│ │(Props   │ │(Actions│ │(Gallery │ │
│  │          │ │  Search) │ │ Editor) │ │ Bar)   │ │ Browse) │ │
│  └──────────┘ └──────────┘ └─────────┘ └────────┘ └─────────┘ │
│  ┌──────────────────────────────────────────────────────────────┐│
│  │              Semantic Graph Model (Core Domain)               ││
│  │   Resources · Connections · Groups · Metadata · Constraints   ││
│  └──────────────────────────────────────────────────────────────┘│
│  ┌──────────┐ ┌──────────┐ ┌─────────┐ ┌────────┐ ┌─────────┐ │
│  │  History  │ │  Export  │ │  AI     │ │  Sync  │ │  Auth   │ │
│  │(Undo/Redo│ │(Multi-fmt│ │(OpenAI) │ │(CRDT)  │ │(NextAuth│ │
│  │  Ops)    │ │  Engine) │ │         │ │        │ │ /Entra) │ │
│  └──────────┘ └──────────┘ └─────────┘ └────────┘ └─────────┘ │
└─────────────────────────────────────────────────────────────────┘
                              │
                    ┌─────────┴──────────┐
                    │    API Routes       │
                    │  (Next.js API / tRPC)│
                    └─────────┬──────────┘
                              │
          ┌───────────┬───────┴───────┬──────────┐
          │           │               │          │
   ┌──────┴──┐ ┌─────┴─────┐ ┌──────┴──┐ ┌────┴────┐
   │PostgreSQL│ │Azure Blob │ │Azure    │ │ Entra   │
   │(Projects │ │(Icons,    │ │OpenAI   │ │ ID      │
   │ Diagrams │ │Exports)   │ │(AI Gen) │ │(SSO)    │
   │ History) │ │           │ │         │ │         │
   └──────────┘ └───────────┘ └─────────┘ └─────────┘
```

### Semantic Graph Model (Core Innovation)

The most critical architectural decision: every node isn't just "an icon with a label" —
it carries **typed resource metadata** that enables IaC export, AI understanding, cost
estimation, and validation.

```typescript
// Core domain types (Phase 0)
interface ArchitectureResource {
  id: string;
  type: ResourceType;           // 'service' | 'group' | 'zone' | 'text' | 'image'
  provider: CloudProvider;      // 'azure' | 'aws' | 'gcp' | 'generic'
  service: ServiceDefinition;   // typed service info (SKU, tier, region, etc.)
  position: Position;
  size?: Dimensions;
  label: string;
  description?: string;
  metadata: Record<string, unknown>;  // extensible properties
  parentId?: string;            // group containment
  tags: string[];
  layer: string;                // layer assignment
}

interface ArchitectureConnection {
  id: string;
  sourceId: string;
  targetId: string;
  type: ConnectionType;         // 'data-flow' | 'network' | 'dependency' | 'sequence'
  protocol?: string;            // 'HTTPS' | 'gRPC' | 'AMQP' | 'MQTT' | etc.
  label?: string;
  sequence?: number;
  bandwidth?: string;
  style: EdgeStyle;
  metadata: Record<string, unknown>;
}

interface ServiceDefinition {
  serviceId: string;            // canonical ID: 'azure/compute/vm', 'aws/lambda', etc.
  displayName: string;
  category: string;             // 'Compute', 'Networking', 'AI', etc.
  icon: string;                 // icon path
  sku?: string;
  tier?: string;
  region?: string;
  properties: Record<string, unknown>;
}

interface ArchitectureDiagram {
  id: string;
  name: string;
  description: string;
  version: number;
  schema: number;               // schema version for migrations
  resources: ArchitectureResource[];
  connections: ArchitectureConnection[];
  layers: Layer[];
  viewport: Viewport;
  metadata: DiagramMetadata;
  createdAt: string;
  updatedAt: string;
}
```

---

## 6. Implementation Phases

---

### Phase 0: Semantic Graph Model & Foundation

**Goal:** Replace flat graph types with a rich, typed domain model that supports
metadata, constraints, and schema evolution. This is the foundation everything else
builds on.

**Why First:** IaC export, AI features, validation, and cost estimation all need
nodes to be **typed resources with metadata**, not just positioned icons. Without
this, later phases require major rework.

#### Tasks

- [ ] **P0-01** Design `ArchitectureResource` / `ArchitectureConnection` / `ArchitectureDiagram` types
- [ ] **P0-02** Create a service registry mapping `serviceId` → icon, category, provider, properties schema
- [ ] **P0-03** Build schema versioning and migration system for saved diagrams
- [ ] **P0-04** Migrate existing `PlaygroundGraph` to new `ArchitectureDiagram` model
- [ ] **P0-05** Update `validate.ts` to use Zod schemas for the new model
- [ ] **P0-06** Add `ConnectionType` enum: data-flow, network, dependency, sequence, custom
- [ ] **P0-07** Add `Layer` model: id, name, visible, locked, color, order
- [ ] **P0-08** Backward-compatible migration for existing localStorage saves and templates
- [ ] **P0-09** Update all components to use new model (adapter pattern during transition)

#### Acceptance Criteria

- Existing diagrams and templates load without data loss
- New model supports typed services with metadata
- Schema version bumps trigger automatic migration
- All existing tests still pass

---

### Phase 1: Icon Library & Palette Overhaul

**Goal:** Expand from 106 icons to 2,700+ with categorized browsing, search, and
intelligent organization.

#### Icon Ingestion

- [ ] **P1-01** Import V-4.5 Azure icons: 2,262 SVGs across 16 categories (AI, Application, Compute, Data, Deployment, Dynamics 365, Endpoint, Generic, Identity, IoT, Management, Networking, Office365, Security, Storage, Workload)
- [ ] **P1-02** Source AWS Architecture Icons (~300 SVGs) from [AWS Architecture Icons](https://aws.amazon.com/architecture/icons/)
- [ ] **P1-03** Source GCP icons (~200 SVGs) from [Google Cloud Icons](https://cloud.google.com/icons)
- [ ] **P1-04** Build automated icon manifest generator that reads categorized directories
- [ ] **P1-05** SVG optimization pipeline (SVGO) to reduce bundle size
- [ ] **P1-06** Generate icon sprite sheets for performance

#### Palette Redesign

- [ ] **P1-07** Categorized tree view (provider → category → service)
- [ ] **P1-08** Global search across all providers and categories
- [ ] **P1-09** Favorites system (star icons, persisted per user)
- [ ] **P1-10** Recently used section (last 20 icons)
- [ ] **P1-11** Lazy loading / virtualized list for 2,700+ icons
- [ ] **P1-12** Icon preview tooltip with service name, category, and description
- [ ] **P1-13** Collapsible provider sections with icon count badges
- [ ] **P1-14** "Generic" tab for cloud-agnostic shapes (user, database, server, internet, etc.)

#### Essential Editing Primitives

- [ ] **P1-15** Multiple edge styles: orthogonal (right-angle), step, straight, bezier (existing)
- [ ] **P1-16** Edge arrow variants: none, forward, backward, bidirectional
- [ ] **P1-17** Edge line styles: solid, dashed, dotted
- [ ] **P1-18** Keyboard shortcuts panel (accessible via `?`)
- [ ] **P1-19** Multi-select with Shift+Click and rubber-band selection
- [ ] **P1-20** Bulk operations: delete, align, distribute, group, change layer

#### Acceptance Criteria

- 2,700+ icons load without performance degradation
- Palette search returns results within 50ms
- All edge styles render correctly and persist
- Existing diagrams upgrade seamlessly

---

### Phase 2: Advanced Canvas & Editing

**Goal:** Professional-grade diagramming features that match enterprise expectations.

#### Canvas Enhancements

- [ ] **P2-01** Minimap with click-to-navigate and viewport indicator
- [ ] **P2-02** Grid with snap-to-grid (configurable size: 10/20/50px)
- [ ] **P2-03** Alignment guides (smart guides showing when elements align)
- [ ] **P2-04** Auto-layout algorithms: hierarchical (top-down), force-directed, tree
- [ ] **P2-05** Zoom controls: zoom to fit, zoom to selection, zoom slider, scroll zoom
- [ ] **P2-06** Canvas background options: dots, grid, lines, none

#### Node Enhancements

- [ ] **P2-07** New node type: **Swimlane** — horizontal/vertical container with header, used for teams, regions, VPCs
- [ ] **P2-08** New node type: **TextBlock** — rich text annotation with markdown support
- [ ] **P2-09** New node type: **ImageNode** — user-uploaded image (logo, screenshot)
- [ ] **P2-10** Group collapse/expand with content summary when collapsed
- [ ] **P2-11** Group auto-resize to fit children with padding
- [ ] **P2-12** Group nested depth support (groups inside groups)
- [ ] **P2-13** Custom port/anchor points on nodes (not just the 4 cardinal handles)
- [ ] **P2-14** Node resize handles for all resizable types
- [ ] **P2-15** Node status indicators (healthy, warning, error — for live architectures)

#### Editing Tools

- [ ] **P2-16** Right-click context menu (node: edit, duplicate, delete, group, layer, lock; canvas: paste, add note, auto-layout)
- [ ] **P2-17** Command palette (Ctrl+K) with fuzzy search for all actions
- [ ] **P2-18** Layers panel: create/rename/reorder layers, toggle visibility/lock per layer
- [ ] **P2-19** Copy/paste within and across diagrams (clipboard API)
- [ ] **P2-20** Duplicate selection (Ctrl+D)
- [ ] **P2-21** Find/replace on canvas (search node labels, edge labels)
- [ ] **P2-22** Ruler guides (draggable from edges for precise alignment)
- [ ] **P2-23** Operation-based undo/redo (replace snapshot history with granular ops)

#### Inspector Enhancements

- [ ] **P2-24** Inspector tabs: Properties, Style, Metadata, Connections
- [ ] **P2-25** Connection inspector: protocol, bandwidth, latency, cost annotations
- [ ] **P2-26** Service properties panel (SKU, tier, region, configuration specific to service type)
- [ ] **P2-27** Bulk property editing when multiple nodes selected

#### Acceptance Criteria

- Auto-layout produces clean, readable diagrams for 20+ node graphs
- Context menu is comprehensive and discoverable
- Layers can be toggled independently without data loss
- Command palette finds all available actions

---

### Phase 3: Cloud Persistence, Auth & Projects

**Goal:** Move from browser-only to cloud-backed with user accounts and project
management. This unblocks sharing, collaboration, and enterprise features.

**Why Before Templates:** Templates, sharing, comments, and version history all need a
backend. Building more single-player features first risks rework.

#### Authentication

- [ ] **P3-01** NextAuth.js integration with multiple providers
- [ ] **P3-02** GitHub OAuth provider (primary — our users are developers)
- [ ] **P3-03** Microsoft Entra ID provider (enterprise SSO)
- [ ] **P3-04** Google OAuth provider
- [ ] **P3-05** Email magic-link fallback
- [ ] **P3-06** User profile page (name, avatar, settings)
- [ ] **P3-07** Guest mode: continue using locally without auth (existing behavior)

#### Cloud Persistence

- [ ] **P3-08** PostgreSQL database (Azure Database for PostgreSQL Flexible Server)
- [ ] **P3-09** Database schema: users, projects, diagrams, versions, shares, comments
- [ ] **P3-10** tRPC or Next.js Server Actions API layer
- [ ] **P3-11** Auto-save to cloud (debounced, with conflict detection)
- [ ] **P3-12** Offline support: localStorage cache + sync on reconnect
- [ ] **P3-13** Azure Blob Storage for exported images and uploaded assets

#### Project Management

- [ ] **P3-14** Project model: name, description, diagrams[], collaborators[], created/updated
- [ ] **P3-15** Dashboard: list projects, recent diagrams, search, sort
- [ ] **P3-16** Folder organization within projects
- [ ] **P3-17** Diagram thumbnails (auto-generated PNG preview)
- [ ] **P3-18** Duplicate diagram / project
- [ ] **P3-19** Archive and delete with soft-delete / trash

#### Sharing

- [ ] **P3-20** Share via server-generated short links (not URL-encoded state)
- [ ] **P3-21** Permission levels: view, comment, edit
- [ ] **P3-22** Password-protected shares
- [ ] **P3-23** Embed mode: iframe-embeddable read-only view with `?embed=true`
- [ ] **P3-24** Public gallery: opt-in publish diagrams to a public showcase

#### Acceptance Criteria

- Users can sign in, create projects, and save diagrams to the cloud
- Diagrams persist across devices and browsers
- Share links work for unauthenticated viewers
- Guest mode preserves existing localStorage behavior
- Offline → online sync works without data loss

---

### Phase 4: Template Engine & Architecture Gallery

**Goal:** Build a rich, searchable template gallery with 50+ architecture patterns
sourced from AI-Gateway labs, Jumpstart scenarios, and classic cloud patterns.

#### Template System

- [ ] **P4-01** Template spec format: metadata (name, description, category, tags, difficulty, author, provider, services used) + parameterized graph
- [ ] **P4-02** Template parameters: variables that customize the generated diagram (e.g., `regions: 1|2|3`, `database: SQL|Cosmos|PostgreSQL`, `provider: azure|aws`)
- [ ] **P4-03** Template rendering engine: resolve parameters → generate concrete diagram
- [ ] **P4-04** Template gallery page with card grid, search, category filters, provider filters
- [ ] **P4-05** Template preview: interactive thumbnail + full-screen preview before use
- [ ] **P4-06** "Use this template" → creates new diagram from template
- [ ] **P4-07** "Save as template" from any diagram (user-created templates)

#### AI-Gateway Lab Templates

Convert each lab architecture into a reusable template:

- [ ] **P4-08** APIM as AI Gateway (core pattern)
- [ ] **P4-09** Backend Pool Load Balancing (multi-model routing)
- [ ] **P4-10** Token Rate Limiting (throttling/quotas)
- [ ] **P4-11** Semantic Caching (Redis + APIM)
- [ ] **P4-12** Access Controlling (OAuth/JWT/API keys)
- [ ] **P4-13** Private Connectivity (Front Door + Private Link + APIM)
- [ ] **P4-14** AI Foundry Hosted Agents (Container Apps + MCP)
- [ ] **P4-15** Model Context Protocol (MCP server access patterns)
- [ ] **P4-16** Built-in Logging & Token Metrics (observability)
- [ ] **P4-17** Content Safety (guardrails + moderation)
- [ ] **P4-18** Function Calling (tools + orchestration)
- [ ] **P4-19** Vector Search (Azure AI Search integration)
- [ ] **P4-20** Zero-to-Production (complete deployment pipeline)
- [ ] **P4-21** AI Agent Service (multi-agent orchestration)
- [ ] **P4-22** Realtime Audio (WebSocket + streaming)

#### Jumpstart / Hybrid Templates

- [ ] **P4-23** Azure Arc — ArcBox Full (hybrid management)
- [ ] **P4-24** Cloud-to-Edge with AKS Edge Essentials
- [ ] **P4-25** IoT Telemetry Pipeline (MQTT → IoT Hub → ADX)
- [ ] **P4-26** GitOps CI/CD (GitHub Actions → ACR → Flux → AKS)
- [ ] **P4-27** Contoso Supermarket — PoS Architecture
- [ ] **P4-28** Contoso Supermarket — Freezer Monitoring
- [ ] **P4-29** Observability Stack (Prometheus + Grafana + Azure Monitor)
- [ ] **P4-30** Azure Stack HCI — HCIBox Architecture

#### Classic Cloud Architecture Templates

- [ ] **P4-31** 3-Tier Web App (Azure / AWS / GCP variants)
- [ ] **P4-32** Microservices with API Gateway
- [ ] **P4-33** Event-Driven Architecture (Event Grid / EventBridge / Pub/Sub)
- [ ] **P4-34** Serverless (Functions/Lambda/Cloud Functions)
- [ ] **P4-35** Hub-Spoke Network Topology
- [ ] **P4-36** Data Lake & Analytics Pipeline
- [ ] **P4-37** Multi-Region DR / Active-Passive
- [ ] **P4-38** Zero Trust Architecture
- [ ] **P4-39** Container Orchestration (AKS / EKS / GKE)
- [ ] **P4-40** Multi-Cloud Data Flow

#### Acceptance Criteria

- 50+ templates available in the gallery
- Template parameters generate valid, customized diagrams
- Users can save their own diagrams as templates
- Gallery search returns relevant results by name, tag, category, provider

---

### Phase 5: Export / Import Ecosystem

**Goal:** Comprehensive import/export supporting industry-standard formats and
curated IaC generation for supported architectures.

#### Export Formats

- [ ] **P5-01** SVG export (scalable, embeddable)
- [ ] **P5-02** PDF export (single-page and multi-page for large diagrams)
- [ ] **P5-03** High-res PNG export (configurable DPI: 1x/2x/4x)
- [ ] **P5-04** draw.io XML export (for teams using draw.io/diagrams.net)
- [ ] **P5-05** Mermaid markdown export (for embedding in docs/README)
- [ ] **P5-06** Improved GIF export: configurable frame rate, resolution, no 96-frame cap
- [ ] **P5-07** MP4 video export of sequence animation
- [ ] **P5-08** Embed code generator (iframe snippet for blogs/wikis)

#### Import Formats

- [ ] **P5-09** draw.io XML import (critical for migration from competing tools)
- [ ] **P5-10** Improved JSON import with version migration
- [ ] **P5-11** Visio import (.vsdx) — stretch goal; complex but high-value for enterprise
- [ ] **P5-12** Image import (add reference screenshots to diagrams)

#### Infrastructure as Code Export (Curated)

> **Design Decision:** IaC export is NOT generic "diagram → code". It works only for
> **typed, template-backed architectures** where the semantic model has sufficient
> metadata (SKU, tier, region, naming, dependencies). Curated support, not universal.

- [ ] **P5-13** IaC export framework: service registry → resource mapping → template rendering
- [ ] **P5-14** Azure Bicep export for supported patterns (3-tier, APIM gateway, AKS, Functions)
- [ ] **P5-15** Terraform HCL export for supported patterns
- [ ] **P5-16** ARM template export (JSON)
- [ ] **P5-17** Export validation: check for missing required properties before generating
- [ ] **P5-18** "Export as IaC" button with provider/format selector and preview
- [ ] **P5-19** Generated code includes comments mapping back to diagram components

#### Acceptance Criteria

- SVG/PDF/PNG exports are high-fidelity representations of the canvas
- draw.io round-trip: export → import → export produces equivalent output
- IaC export produces valid, deployable code for curated patterns
- IaC export clearly indicates unsupported components

---

### Phase 6: AI-Powered Features

**Goal:** AI integration that makes architects more productive — not gimmicky, but
genuinely useful for design, documentation, and review.

**Approach:** Start narrow with template-backed generation, expand to freeform as the
semantic model matures.

#### AI Architecture Generation

- [ ] **P6-01** Azure OpenAI integration (GPT-4o / GPT-4.1) via API route
- [ ] **P6-02** Prompt-to-diagram: "Design a 3-tier web app on Azure with AKS, PostgreSQL, and Front Door" → generates typed diagram using template patterns
- [ ] **P6-03** Smart prompt bar in the toolbar with suggested prompts
- [ ] **P6-04** Iterative refinement: "Add a caching layer" / "Make it multi-region" / "Add monitoring"
- [ ] **P6-05** Provider-aware: understands Azure/AWS/GCP service equivalents
- [ ] **P6-06** Prompt history and saved prompts

#### AI Architecture Understanding

- [ ] **P6-07** "Describe this architecture" — generates a markdown description from the diagram
- [ ] **P6-08** "Explain this to a..." — adjust explanation level (exec, architect, developer, student)
- [ ] **P6-09** Architecture documentation generator (full doc with component descriptions, data flows, dependencies)
- [ ] **P6-10** Architecture diff: compare two diagrams and describe changes

#### AI Architecture Review

- [ ] **P6-11** Best practices checker: analyze diagram against Well-Architected Framework pillars (reliability, security, cost, ops, performance)
- [ ] **P6-12** Security review: flag missing network segmentation, public endpoints, missing identity
- [ ] **P6-13** Resilience review: flag single points of failure, missing DR, no multi-region
- [ ] **P6-14** Suggested improvements: AI recommends adding missing components (monitoring, caching, CDN, etc.)
- [ ] **P6-15** Cost estimation: rough monthly cost based on Azure/AWS pricing for identified services

#### AI Editing Assistance

- [ ] **P6-16** Natural language editing: "Connect the API Gateway to the backend service" / "Move the database into the private subnet group"
- [ ] **P6-17** Auto-complete connections: suggest likely connections based on service types
- [ ] **P6-18** Smart naming: auto-generate descriptive labels for services based on context

#### Acceptance Criteria

- AI generation produces valid, renderable diagrams for common architectures
- Generated diagrams use correct service icons and logical groupings
- Architecture review catches obvious issues (no monitoring, public DB, no auth)
- AI features are optional — tool works fully without them

---

### Phase 7: Collaboration & Version History

**Goal:** Multi-user collaboration with real-time co-editing, comments, and full
version history.

#### Version History

- [ ] **P7-01** Automatic version snapshots on save (with diff from previous)
- [ ] **P7-02** Version timeline viewer (visual timeline of diagram evolution)
- [ ] **P7-03** Version comparison: side-by-side diff highlighting added/removed/changed elements
- [ ] **P7-04** Restore to any previous version
- [ ] **P7-05** Named versions (manual milestone saves: "v1.0 — initial design")

#### Comments & Annotations

- [ ] **P7-06** Comment on specific nodes/edges (anchored to elements)
- [ ] **P7-07** Canvas-level comments (pinned to coordinates)
- [ ] **P7-08** Comment threads with replies
- [ ] **P7-09** @mention team members in comments
- [ ] **P7-10** Resolve/unresolve comment threads
- [ ] **P7-11** Comment notification system (in-app + email)

#### Real-Time Collaboration

- [ ] **P7-12** Yjs CRDT for conflict-free real-time sync
- [ ] **P7-13** WebSocket server (or Yjs provider: y-websocket / Liveblocks / PartyKit)
- [ ] **P7-14** Cursor presence: see collaborators' cursors and selections
- [ ] **P7-15** User avatar indicators showing who's viewing/editing
- [ ] **P7-16** Conflict resolution for simultaneous edits
- [ ] **P7-17** Awareness indicators: who's editing what node

#### Acceptance Criteria

- 2+ users can edit the same diagram simultaneously without conflicts
- Version history preserves every meaningful change
- Comments are anchored to the correct elements even after moves/edits
- Collaboration works across different browsers and devices

---

### Phase 8: Enterprise & Platform Features

**Goal:** Features required for enterprise adoption: SSO, RBAC, audit, API, branding,
and extensibility.

#### Identity & Access

- [ ] **P8-01** SAML SSO integration (enterprise identity providers)
- [ ] **P8-02** SCIM user provisioning
- [ ] **P8-03** Role-Based Access Control: Owner, Admin, Editor, Viewer, Commenter
- [ ] **P8-04** Organization/team workspaces with member management
- [ ] **P8-05** Project-level permissions (private, team, public)

#### Administration

- [ ] **P8-06** Admin dashboard: user management, usage analytics, storage quotas
- [ ] **P8-07** Audit logging: who did what, when (create, edit, share, delete, export)
- [ ] **P8-08** Data retention policies and automatic cleanup
- [ ] **P8-09** Backup and restore (automated daily backups)
- [ ] **P8-10** Rate limiting and abuse prevention

#### Presentation & Documentation

- [ ] **P8-11** Presentation mode: full-screen walkthrough with slide transitions per sequence step
- [ ] **P8-12** Architecture Decision Records (ADRs) linked to diagrams
- [ ] **P8-13** Diagram changelog (auto-generated from version history)
- [ ] **P8-14** Custom branding: organization logo, colors, watermark on exports

#### API & Extensibility

- [ ] **P8-15** REST API for programmatic diagram CRUD
- [ ] **P8-16** Webhook notifications (diagram created, updated, shared, commented)
- [ ] **P8-17** CLI tool for CI/CD integration (generate/export diagrams in pipelines)
- [ ] **P8-18** Plugin system: custom node types, custom export formats, custom validators
- [ ] **P8-19** Custom icon upload: organization-specific icon libraries
- [ ] **P8-20** Integration with Azure DevOps Wikis, GitHub Pages, Confluence

#### Acceptance Criteria

- Enterprise SSO works with major IdPs (Entra ID, Okta, OneLogin)
- RBAC prevents unauthorized access/edits
- Audit log captures all significant actions
- API enables headless diagram generation and export

---

## 7. Performance & Scalability

### Performance Budgets

| Metric | Target |
|--------|--------|
| Initial page load (LCP) | < 2 seconds |
| Palette search response | < 50ms for 2,700+ icons |
| Canvas interaction (60fps) | No jank with 200+ nodes |
| Auto-save latency | < 500ms debounced |
| Export (PNG) | < 3 seconds |
| Export (SVG/PDF) | < 5 seconds |
| AI generation response | < 10 seconds |

### Optimization Strategies

- **Icon lazy loading:** Load only the current category; prefetch adjacent categories
- **Palette virtualization:** Virtual scroll for long icon lists (react-window or @tanstack/virtual)
- **SVG sprite sheets:** Combine frequently used icons into sprite sheets
- **Canvas virtualization:** React Flow handles this natively; configure `onlyRenderVisibleElements`
- **Web Workers:** Heavy operations (GIF encoding, IaC generation, validation) in workers
- **Image CDN:** Serve icons from Azure CDN with aggressive caching
- **Bundle splitting:** Dynamic imports for AI, export, and collaboration modules
- **Skeleton loading:** Show placeholder UI while heavy components load
- **IndexedDB cache:** Cache icons and templates locally for offline support

---

## 8. Testing Strategy

### Test Pyramid

| Level | Tool | Coverage Target |
|-------|------|----------------|
| **Unit** | Node.js built-in test runner | Semantic model, validators, sequence, history, export utils |
| **Component** | React Testing Library | Node/edge renderers, palette search, inspector forms |
| **Integration** | Playwright | Canvas interactions, template load, export flows, auth flows |
| **E2E** | Playwright | Full user journeys: sign in → create → edit → export → share |
| **Visual** | Playwright screenshots | Regression detection for canvas rendering |
| **Performance** | Lighthouse CI | Core Web Vitals in CI pipeline |
| **API** | Supertest / Playwright | API routes: CRUD, auth, export |

### Test Infrastructure

- [ ] Set up Playwright for component testing
- [ ] Add visual regression testing with screenshot comparison
- [ ] Add Lighthouse CI to the GitHub Actions pipeline
- [ ] Test matrix: Chrome, Firefox, Safari (desktop)
- [ ] Load testing for collaboration: simulate 10 concurrent editors

---

## 9. Deployment & Infrastructure

### Current

- Next.js standalone output → zip → Azure Kudu zipdeploy
- Single Azure App Service

### Target (Phase 3+)

```
                    ┌─────────────────┐
                    │  Azure Front Door│
                    │  (CDN + WAF)     │
                    └────────┬────────┘
                             │
                    ┌────────┴────────┐
                    │  Azure Container│
                    │  Apps (Next.js) │
                    │  (auto-scale)   │
                    └────────┬────────┘
                             │
          ┌──────────┬───────┴──────┬──────────┐
          │          │              │           │
  ┌───────┴──┐ ┌────┴─────┐ ┌─────┴───┐ ┌────┴─────┐
  │PostgreSQL│ │Azure Blob│ │Azure    │ │Redis     │
  │Flexible  │ │Storage   │ │OpenAI   │ │(sessions │
  │Server    │ │(assets)  │ │(AI gen) │ │+ cache)  │
  └──────────┘ └──────────┘ └─────────┘ └──────────┘
```

### CI/CD Pipeline

```
Push → Lint → Type Check → Unit Tests → Build → E2E Tests → Deploy Staging → Smoke Test → Deploy Production
```

---

## 10. Success Metrics

### Phase 0-2 (Foundation) — "Professional Diagramming"

- [ ] 2,700+ icons load and search < 50ms
- [ ] 10+ node/edge style combinations
- [ ] Auto-layout produces clean results
- [ ] Zero regressions from current functionality

### Phase 3-4 (Cloud + Templates) — "Useful Product"

- [ ] User can sign up, create, save, and share a diagram
- [ ] 50+ templates in the gallery
- [ ] draw.io import works for common diagrams
- [ ] 100 registered users

### Phase 5-6 (AI + Export) — "Competitive Product"

- [ ] AI generates valid diagrams from prompts 80% of the time
- [ ] IaC export produces deployable Bicep for 10+ patterns
- [ ] SVG/PDF exports are publication-quality
- [ ] 1,000 registered users

### Phase 7-8 (Collaboration + Enterprise) — "Enterprise Ready"

- [ ] Real-time collaboration with < 100ms sync latency
- [ ] SSO works with Entra ID, Okta
- [ ] API enables headless diagram creation
- [ ] 10 enterprise teams using the platform

---

## Appendix A: Service Registry Categories

The service registry maps every cloud service to a canonical ID, enabling AI understanding,
IaC export, and cross-cloud equivalence mapping.

### Azure (from V-4.5 icon stencils)

| Category | Icon Count | Examples |
|----------|-----------|----------|
| AI | 68 | Azure OpenAI, AI Foundry, Cognitive Services, ML, Bot Service |
| Application | 170 | App Service, Functions, Container Apps, Logic Apps, API Management |
| Compute | 141 | VMs, VMSS, AKS, Batch, Service Fabric, Container Instances |
| Data | 104 | Cosmos DB, SQL Database, PostgreSQL, MySQL, Synapse, ADX |
| Deployment | 47 | ARM, Bicep, DevOps, GitHub Actions, Container Registry |
| Identity | 39 | Entra ID, Managed Identity, Key Vault, Conditional Access |
| IoT | 31 | IoT Hub, IoT Central, Digital Twins, Edge, Sphere |
| Management | 182 | Monitor, Policy, Advisor, Cost Management, Automation |
| Networking | 101 | VNet, Load Balancer, Front Door, Application Gateway, DNS |
| Security | 48 | Defender, Sentinel, Firewall, DDoS Protection, WAF |
| Storage | 44 | Blob, Files, Queue, Table, Data Lake, Managed Disks |

### AWS (~300 target)

| Category | Examples |
|----------|----------|
| Compute | EC2, Lambda, ECS, EKS, Fargate, Batch |
| Database | RDS, DynamoDB, Aurora, ElastiCache, Redshift |
| Networking | VPC, ELB, CloudFront, Route 53, API Gateway |
| AI/ML | SageMaker, Bedrock, Comprehend, Rekognition |
| Storage | S3, EBS, EFS, Glacier |
| Security | IAM, Cognito, WAF, GuardDuty, KMS |

### GCP (~200 target)

| Category | Examples |
|----------|----------|
| Compute | Compute Engine, GKE, Cloud Run, Cloud Functions |
| Database | Cloud SQL, Firestore, Spanner, Bigtable, BigQuery |
| Networking | VPC, Cloud Load Balancing, Cloud CDN, Cloud DNS |
| AI/ML | Vertex AI, Gemini, Vision AI, Natural Language |
| Storage | Cloud Storage, Persistent Disk, Filestore |

---

## Appendix B: Template Catalog (Target: 50+)

### AI & Intelligent Apps (from AI-Gateway)

1. APIM as AI Gateway
2. Multi-Model Load Balancing
3. Token Rate Limiting & Quotas
4. Semantic Caching with Redis
5. AI Foundry Model Gateway
6. AI Foundry Hosted Agents
7. MCP Server Access Pattern
8. MCP Agent-to-Agent Communication
9. AI Content Safety & Guardrails
10. Function Calling Orchestration
11. Vector Search with Azure AI Search
12. Session-Aware AI Gateway
13. Private AI Connectivity (Private Link + Front Door)
14. AI Access Control (OAuth + JWT + API Keys)
15. Zero-to-Production AI Deployment

### Hybrid & Edge (from Jumpstart)

16. Azure Arc Hybrid Management (ArcBox)
17. AKS Edge Essentials Cloud-to-Edge
18. IoT Telemetry Pipeline (MQTT → IoT Hub → ADX)
19. GitOps CI/CD (Actions → ACR → Flux → AKS)
20. Contoso Supermarket — Retail PoS
21. Contoso Supermarket — Freezer Monitoring
22. Observability Stack (Prometheus + Grafana + Monitor)
23. Azure Stack HCI (HCIBox)
24. Arc-enabled Server Management
25. Manufacturing Edge AI

### Classic Cloud Patterns

26. 3-Tier Web App (Azure)
27. 3-Tier Web App (AWS)
28. 3-Tier Web App (GCP)
29. Microservices with Service Mesh
30. Event-Driven Architecture (Azure)
31. Event-Driven Architecture (AWS)
32. Serverless API (Azure Functions)
33. Serverless API (AWS Lambda)
34. Hub-Spoke Network Topology
35. Data Lake & Analytics Pipeline
36. Multi-Region Active-Passive DR
37. Multi-Region Active-Active
38. Zero Trust Architecture
39. AKS Production Cluster
40. EKS Production Cluster
41. GKE Production Cluster
42. Multi-Cloud Data Flow
43. API-First Architecture
44. CQRS + Event Sourcing
45. Strangler Fig Migration

### Industry Solutions

46. Healthcare HIPAA-Compliant Architecture
47. Financial Services — Regulated Cloud
48. Retail — Omnichannel Platform
49. Manufacturing — IIoT Platform
50. SaaS Multi-Tenant Architecture

---

*This is a living document. Update as implementation progresses and priorities shift.*
