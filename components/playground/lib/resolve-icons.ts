/**
 * Resolves AI-hallucinated iconIds to actual icon manifest entries.
 *
 * The AI tends to invent short, predictable iconIds like
 * "azure/compute/app-service" or "aws/database/dynamodb", but the real
 * manifest entries are messy historical IDs like
 * "azure/application/10035-icon-service-app-services" or
 * "aws/database/dynamodb-on-outposts". Rather than pollute the AI prompt
 * with the full 977-entry catalog, we accept its short slugs and fuzzy-
 * match them to a real iconId here.
 *
 * Algorithm:
 *   1. Exact match by id  → return as-is
 *   2. Token-overlap match: split the AI iconId into tokens (cloud + slug
 *      words) and find the manifest entry with the highest token overlap
 *      score. Bias matches that share the same cloud provider.
 *   3. If nothing scores above zero, fall back to a sensible per-cloud
 *      placeholder (e.g. azure/application/app-services).
 */
import type { IconManifestEntry } from "./types";

const FALLBACKS: Record<string, string> = {
  azure: "azure/compute/virtual-machine",
  aws: "aws/compute/ec2",
  gcp: "gcp/compute/compute-engine",
};

const STOPWORDS = new Set([
  "the", "a", "an", "of", "for", "on", "in", "and", "service", "services",
  "icon", "azure", "aws", "gcp", "google", "cloud", "amazon", "microsoft",
]);

function tokenize(s: string): string[] {
  return s
    .toLowerCase()
    .replace(/^\d+-/, "")           // strip leading "10035-" style prefix
    .replace(/^icon-service-/, "")  // strip "icon-service-" prefix
    .split(/[/\-_\s]+/)
    .filter((t) => t.length > 1 && !STOPWORDS.has(t));
}

function scoreMatch(askTokens: string[], iconId: string, iconLabel: string): number {
  const candTokens = new Set([...tokenize(iconId), ...tokenize(iconLabel)]);
  let score = 0;
  for (const t of askTokens) {
    if (candTokens.has(t)) score += 2;
    // partial token match (e.g. "openai" inside "azure-openai-service")
    else if ([...candTokens].some((c) => c.includes(t) || t.includes(c))) score += 1;
  }
  return score;
}

export function resolveIconId(
  askedId: string,
  icons: IconManifestEntry[],
  iconsById: Map<string, IconManifestEntry>
): string {
  if (!askedId) return FALLBACKS.azure;
  if (iconsById.has(askedId)) return askedId;

  // Detect the cloud the AI was hinting at.
  const askedLower = askedId.toLowerCase();
  let cloud: "azure" | "aws" | "gcp" = "azure";
  if (askedLower.startsWith("aws/") || askedLower.includes("aws-")) cloud = "aws";
  else if (askedLower.startsWith("gcp/") || askedLower.includes("gcp-") || askedLower.includes("google-")) cloud = "gcp";

  const askTokens = tokenize(askedId);
  if (askTokens.length === 0) return FALLBACKS[cloud];

  let best: { id: string; score: number } | null = null;
  for (const ic of icons) {
    const cloudBoost = ic.cloud === cloud ? 1 : 0;
    const score = scoreMatch(askTokens, ic.id, ic.label) + cloudBoost;
    if (score > 0 && (!best || score > best.score)) {
      best = { id: ic.id, score };
    }
  }
  return best?.id ?? FALLBACKS[cloud];
}

/**
 * Run resolveIconId across every service node in a graph, mutating in place.
 * Returns the same graph for chaining convenience.
 */
export function resolveGraphIcons(
  graph: { nodes: Array<{ type: string; data: unknown }> },
  icons: IconManifestEntry[],
  iconsById: Map<string, IconManifestEntry>
): void {
  for (const n of graph.nodes) {
    if (n.type !== "service") continue;
    const data = n.data as { iconId?: string; cloud?: string };
    const askedId = data.iconId ?? "";
    const resolved = resolveIconId(askedId, icons, iconsById);
    if (resolved !== askedId) {
      data.iconId = resolved;
      const ic = iconsById.get(resolved);
      if (ic && ic.cloud !== data.cloud) data.cloud = ic.cloud;
    }
  }
}
