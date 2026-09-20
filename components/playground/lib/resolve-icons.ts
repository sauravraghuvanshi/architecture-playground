import type { IconManifestEntry } from "./types";
import { iconProvider, resolveServiceIcon } from "../../../lib/service-identity.ts";

export function resolveIconId(
  askedId: string,
  icons: IconManifestEntry[],
  iconsById: Map<string, IconManifestEntry>,
  cloud?: string,
): string | undefined {
  const exact = iconsById.get(askedId);
  if (exact) return iconProvider(exact) !== "unknown" && (!cloud || iconProvider(exact) === cloud) ? exact.id : undefined;
  return resolveServiceIcon({ iconId: askedId, cloud }, icons)?.id;
}

/** Resolve identities atomically. The caller must surface errors before applying a graph. */
export function resolveGraphIcons(
  graph: { nodes: Array<{ id?: string; type: string; data: unknown }> },
  icons: IconManifestEntry[],
  iconsById: Map<string, IconManifestEntry>,
): string[] {
  const errors: string[] = [];
  const changes: Array<{ data: { iconId?: string; cloud?: string }; icon: IconManifestEntry }> = [];
  for (const node of graph.nodes) {
    if (node.type !== "service") continue;
    if (!node.data || typeof node.data !== "object") {
      errors.push(`Service "${node.id ?? "unknown"}" has invalid identity metadata.`);
      continue;
    }
    const data = node.data as { iconId?: string; cloud?: string };
    const asked = typeof data.iconId === "string" ? data.iconId : "";
    const declared = typeof data.cloud === "string" ? data.cloud : undefined;
    const resolved = resolveIconId(asked, icons, iconsById, declared);
    const icon = resolved ? iconsById.get(resolved) : undefined;
    if (!icon) {
      errors.push(`Service "${node.id ?? "unknown"}": "${asked || "(missing ID)"}" has no unambiguous ${declared ?? "provider-safe"} catalog identity. No substitute was chosen.`);
    } else changes.push({ data, icon });
  }
  if (errors.length === 0) {
    for (const { data, icon } of changes) {
      data.iconId = icon.id;
      data.cloud = icon.cloud;
    }
  }
  return errors;
}
