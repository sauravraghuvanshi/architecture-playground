import { parseArchitectureDocument } from "./architecture-document.ts";
import type { ArchPayload } from "./architecture-model.ts";
import { azureResourceKind, SERVICE_CATALOG } from "./service-identity.ts";

const SERVICE_CORRECTIONS: Readonly<Record<string, { iconId: string; label: string }>> = {
  "azure/application/app-service-management": { iconId: "azure/application/application-service", label: "Azure App Service" },
};

export function inspectDeploymentEligibility(payload: ArchPayload) {
  return payload.nodes.flatMap((node) => {
    if (node.kind === "group" || node.kind === "shape" || !("iconId" in node)) return [];
    const kind = azureResourceKind(node.iconId, node.semantics?.provider);
    const catalog = SERVICE_CATALOG.find((icon) => icon.id === node.iconId);
    const suggested = !kind && node.semantics?.provider !== "aws" && node.semantics?.provider !== "gcp"
      ? SERVICE_CORRECTIONS[node.iconId] : undefined;
    return [{
      nodeId: node.id, label: node.label, iconId: node.iconId,
      catalogLabel: catalog?.label ?? node.iconId, kind,
      ...(suggested ? { suggested } : {}),
    }];
  });
}

export function deploymentEligibilityMessage(payload: ArchPayload): string {
  const rows = inspectDeploymentEligibility(payload);
  if (!rows.length) return "The diagram has only boundaries or generic shapes. Add an Azure service from Cloud & primitives before generating deployment code.";
  const details = rows.filter((row) => !row.kind).slice(0, 8).map((row) =>
    `"${row.label}" uses "${row.catalogLabel}" (${row.iconId}). ${row.suggested
      ? `Confirm ${row.suggested.label} using the service correction in Code & deploy.`
      : "This specific catalog product has no supported deployment mapping; its display name does not change its service identity."}`);
  return `No supported Azure deployment service is selected. ${details.join(" ")}`;
}

/** An explicit user correction, never a label-based automatic product substitution. */
export function correctDeploymentService(payload: ArchPayload, nodeId: string, iconId: string): ArchPayload {
  const checked = parseArchitectureDocument(payload);
  const row = inspectDeploymentEligibility(checked).find((item) => item.nodeId === nodeId);
  if (!row?.suggested || row.suggested.iconId !== iconId) throw new Error("This service correction is not available for the selected component.");
  const icon = SERVICE_CATALOG.find((item) => item.id === iconId);
  if (!icon || !azureResourceKind(icon.id, "azure")) throw new Error("The replacement is not a supported Azure deployment service.");
  return parseArchitectureDocument({
    ...checked,
    nodes: checked.nodes.map((node) => node.id === nodeId ? {
      ...node, iconId: icon.id, iconPath: icon.path, semantics: { ...node.semantics, provider: "azure" },
    } : node),
  });
}
