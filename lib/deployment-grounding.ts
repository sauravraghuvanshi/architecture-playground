import type { ArchPayload } from "./architecture-model.ts";
import { generateArchitectureCode, generateArmTemplate } from "../components/diagrammatic/csa/architecture-codegen.ts";

export const DEPLOYMENT_REFERENCE_MAX_BYTES = 64_000;
export const DEPLOYMENT_REFERENCE_MAX_SERVICES = 24;

export function buildDeploymentReference(payload: ArchPayload, availableBytes = DEPLOYMENT_REFERENCE_MAX_BYTES) {
  const omitted = (reason: "service-limit" | "byte-limit" | "no-supported-services" | "resource-limit") => ({
    source: "deterministic-offline-emitter" as const, status: "omitted" as const, reason,
    limitation: "No partial reference was supplied. Preserve the complete original diagram/context and disclose unsupported services and prerequisites.",
  });
  if (payload.nodes.filter((node) => node.kind !== "shape" && node.kind !== "group").length > DEPLOYMENT_REFERENCE_MAX_SERVICES) {
    return omitted("service-limit");
  }
  if (availableBytes <= 0) return omitted("byte-limit");
  const arm = generateArmTemplate(payload);
  if (!arm.supportedNodes) return omitted("no-supported-services");
  if (arm.resourceMappings.length > 100) return omitted("resource-limit");
  const bicep = generateArchitectureCode(payload, "bicep");
  const mapped = new Set(arm.resourceMappings.map((mapping) => mapping.nodeId));
  const template = arm.template;
  const reference = {
    source: "deterministic-offline-emitter" as const,
    status: "reference-only" as const,
    format: "bicep" as const,
    purpose: "Canonical Bicep/ARM starting point for model synthesis, not model output, an offline fallback, an executed deployment or a validation result. The requested output format remains the top-level format.",
    code: bicep.output,
    armTemplate: template,
    resourceMappings: arm.resourceMappings,
    warnings: [...new Set([...arm.warnings, ...bicep.warnings])],
    assumptions: [
      "The model must reconcile this starter with the unchanged diagram, context and declared semantics; explicitly disclose unsupported requirements rather than silently adopting defaults.",
      "Supporting resources are inferred starter prerequisites. A shared App Service plan is mapped to the first related node in stable ID order; this ownership is not a diagram assertion.",
      "Diagram edges and business labels do not implement agents, orchestrators, human approval or data-plane access. No application code, image, model deployment or document index is supplied.",
      "Required parameters remain external inputs without invented IDs, image defaults or credentials. Existing resource availability, image suitability, networking, permissions, policy, quota and deployment behavior are unverified.",
      "Independent parsers and engineering checks still validate the returned model artifact. Reference inclusion confers no passed checks or publication eligibility.",
    ],
    annotations: payload.nodes.filter((node) => node.kind === "shape" || node.kind === "group")
      .map((node) => ({ nodeId: node.id, kind: node.kind, label: node.label, status: "non-provisionable-annotation" as const })),
    unsupportedServices: payload.nodes.filter((node) => node.kind !== "shape" && node.kind !== "group" && !mapped.has(node.id))
      .map((node) => ({ nodeId: node.id, iconId: "iconId" in node ? node.iconId : undefined, label: node.label, status: "unsupported" as const })),
    requiredParameters: Object.entries(template.parameters as Record<string, { type: string; defaultValue?: unknown; metadata?: { description?: string } }>)
      .filter(([, parameter]) => !Object.hasOwn(parameter, "defaultValue"))
      .map(([name, parameter]) => ({ name, type: parameter.type, description: parameter.metadata?.description ?? "Explicit external input required." })),
  };
  return new TextEncoder().encode(JSON.stringify(reference)).byteLength <= Math.min(availableBytes, DEPLOYMENT_REFERENCE_MAX_BYTES)
    ? reference : omitted("byte-limit");
}
