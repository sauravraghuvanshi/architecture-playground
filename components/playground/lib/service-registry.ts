/**
 * Service registry — maps icon IDs to rich ServiceDefinition metadata.
 *
 * Design decisions:
 *   - Runtime-only: ServiceDefinition is NOT persisted on nodes. Nodes store
 *     only `iconId`, `label`, `cloud`. The registry resolves full metadata on
 *     demand (like `iconPath` today).
 *   - Auto-generated: the registry is built from the icon manifest at runtime,
 *     so it stays in sync without a separate build step.
 *   - Extensible: additional properties (SKU, tier, description) can be added
 *     to the category-level defaults or per-service overrides.
 *   - Unknown fallback: if an icon ID is not in the manifest, the registry
 *     returns a generic fallback rather than throwing.
 */
import type { CloudProvider, IconManifestEntry, ServiceDefinition } from "./types";

// ---------------------------------------------------------------------------
// Category descriptions (enriches bare manifest data)
// ---------------------------------------------------------------------------

const CATEGORY_DESCRIPTIONS: Record<string, string> = {
  ai: "Artificial Intelligence and Machine Learning services",
  analytics: "Data analytics and business intelligence",
  application: "Application hosting and platform services",
  compute: "Virtual machines, containers, and serverless compute",
  data: "Databases and data storage services",
  database: "Managed database services",
  deployment: "CI/CD, infrastructure as code, and deployment tools",
  "developer-tools": "Development and debugging tools",
  devops: "DevOps and automation services",
  "end-user-computing": "Desktop and workspace services",
  general: "General-purpose and utility services",
  identity: "Identity, access management, and security",
  integration: "Application integration and messaging",
  iot: "Internet of Things services",
  management: "Monitoring, governance, and operations",
  media: "Media processing and streaming",
  migration: "Migration and transfer services",
  networking: "Virtual networks, load balancers, CDN, and DNS",
  security: "Security, compliance, and threat protection",
  storage: "Object storage, file storage, and archival",
};

// ---------------------------------------------------------------------------
// Registry class
// ---------------------------------------------------------------------------

export class ServiceRegistry {
  private readonly byId = new Map<string, ServiceDefinition>();
  private readonly byCategory = new Map<string, ServiceDefinition[]>();
  private readonly byProvider = new Map<string, ServiceDefinition[]>();

  constructor(icons: IconManifestEntry[]) {
    for (const icon of icons) {
      const def: ServiceDefinition = {
        serviceId: icon.id,
        displayName: icon.label,
        category: icon.categoryLabel,
        provider: icon.cloud as CloudProvider,
        icon: icon.path,
        description: CATEGORY_DESCRIPTIONS[icon.category],
      };

      this.byId.set(icon.id, def);

      // Index by category.
      const catKey = icon.category;
      if (!this.byCategory.has(catKey)) this.byCategory.set(catKey, []);
      this.byCategory.get(catKey)!.push(def);

      // Index by provider.
      const providerKey = icon.cloud;
      if (!this.byProvider.has(providerKey)) this.byProvider.set(providerKey, []);
      this.byProvider.get(providerKey)!.push(def);
    }
  }

  /** Look up a service by its canonical icon ID.  Returns undefined if unknown. */
  get(iconId: string): ServiceDefinition | undefined {
    return this.byId.get(iconId);
  }

  /** Look up with a generic fallback for unknown IDs. */
  getOrFallback(iconId: string): ServiceDefinition {
    return this.byId.get(iconId) ?? {
      serviceId: iconId,
      displayName: iconId.split("/").pop() ?? iconId,
      category: "Unknown",
      provider: "generic",
      icon: "",
      description: "Unknown service — icon may have been removed from the manifest.",
    };
  }

  /** All services in a category. */
  getByCategory(category: string): ServiceDefinition[] {
    return this.byCategory.get(category) ?? [];
  }

  /** All services for a cloud provider. */
  getByProvider(provider: CloudProvider): ServiceDefinition[] {
    return this.byProvider.get(provider) ?? [];
  }

  /** All known category names. */
  get categories(): string[] {
    return Array.from(this.byCategory.keys()).sort();
  }

  /** All known provider names. */
  get providers(): CloudProvider[] {
    return Array.from(this.byProvider.keys()).sort() as CloudProvider[];
  }

  /** Total number of registered services. */
  get size(): number {
    return this.byId.size;
  }

  /** Check if a service ID exists in the registry. */
  has(iconId: string): boolean {
    return this.byId.has(iconId);
  }
}

// ---------------------------------------------------------------------------
// Singleton factory — called once with the icon manifest from page.tsx
// ---------------------------------------------------------------------------

let _instance: ServiceRegistry | null = null;

export function createServiceRegistry(icons: IconManifestEntry[]): ServiceRegistry {
  _instance = new ServiceRegistry(icons);
  return _instance;
}

export function getServiceRegistry(): ServiceRegistry | null {
  return _instance;
}
