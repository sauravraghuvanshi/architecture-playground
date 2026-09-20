import type { PlaygroundGraph, ServiceNodeData } from "./types";
import { generateArchitectureCode } from "../../diagrammatic/csa/architecture-codegen.ts";

export type IacFramework = "bicep" | "terraform";

interface EmitResult {
  output: string;
  warnings: string[];
}

/** Both editors use the same identity, naming, prerequisite and configuration model. */
export function emitIac(graph: PlaygroundGraph, framework: IacFramework): EmitResult {
  try {
    const nodes = graph.nodes.filter((node) => node.type === "service").map((node) => {
      const data = node.data as ServiceNodeData;
      return { id: node.id, kind: "icon" as const, label: data.label || node.id, iconId: data.iconId, cloud: data.cloud };
    });
    const result = generateArchitectureCode({ nodes, edges: graph.edges }, framework);
    return { output: result.output, warnings: result.warnings };
  } catch (error) {
    return { output: "", warnings: [error instanceof Error ? error.message : "The architecture could not be converted safely. No artifact was generated."] };
  }
}

export function emitBicep(graph: PlaygroundGraph): EmitResult {
  return emitIac(graph, "bicep");
}

export function emitTerraform(graph: PlaygroundGraph): EmitResult {
  return emitIac(graph, "terraform");
}
