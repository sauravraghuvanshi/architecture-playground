/**
 * Additional export formats: SVG (vector), high-DPI PNG, Mermaid markdown.
 *
 * SVG/PNG use html-to-image (already a dep) to render the React Flow viewport.
 * Mermaid emits a `flowchart LR` graph from the persisted PlaygroundGraph
 * without needing the live DOM.
 */
"use client";

import { toSvg, toPng } from "html-to-image";
import type { PlaygroundGraph, ServiceNodeData, GroupNodeData, StickyNodeData } from "./types";

const REACT_FLOW_CHROME_FILTER = (node: HTMLElement | Element) => {
  if (!(node instanceof Element)) return true;
  if (node.classList?.contains("react-flow__minimap")) return false;
  if (node.classList?.contains("react-flow__controls")) return false;
  if (node.classList?.contains("react-flow__attribution")) return false;
  return true;
};

function triggerDownload(href: string, filename: string) {
  const a = document.createElement("a");
  a.href = href;
  a.download = filename;
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  a.remove();
}

export async function exportSvg(viewportEl: HTMLElement, filename = "architecture.svg") {
  const dataUrl = await toSvg(viewportEl, {
    cacheBust: true,
    backgroundColor: "#ffffff",
    filter: REACT_FLOW_CHROME_FILTER,
  });
  triggerDownload(dataUrl, filename);
}

/**
 * High-DPI PNG export. Accepts a pixel-ratio multiplier (1, 2, or 4).
 */
export async function exportPngHighDpi(
  viewportEl: HTMLElement,
  pixelRatio: 1 | 2 | 4 = 2,
  filename = "architecture.png"
) {
  const dataUrl = await toPng(viewportEl, {
    cacheBust: true,
    pixelRatio,
    backgroundColor: "#ffffff",
    filter: REACT_FLOW_CHROME_FILTER,
  });
  triggerDownload(dataUrl, filename);
}

/**
 * Emit a Mermaid `flowchart LR` representation of the graph. Service node
 * labels and edge labels are escaped to keep mermaid happy.
 */
export function exportMermaid(graph: PlaygroundGraph, filename = "architecture.mmd") {
  const text = toMermaid(graph);
  const blob = new Blob([text], { type: "text/markdown" });
  const url = URL.createObjectURL(blob);
  triggerDownload(url, filename);
  setTimeout(() => URL.revokeObjectURL(url), 1500);
}

function safeId(id: string): string {
  return id.replace(/[^a-zA-Z0-9_]/g, "_");
}

function escapeMermaidLabel(s: string): string {
  return (s || "").replace(/"/g, '\\"');
}

export function toMermaid(graph: PlaygroundGraph): string {
  const lines: string[] = ["flowchart LR"];
  // Optional metadata header
  if (graph.metadata?.name) {
    lines.unshift(`%% ${graph.metadata.name}`);
  }
  // Group nodes by parent for subgraph rendering
  const childrenByParent = new Map<string, string[]>();
  for (const n of graph.nodes) {
    if (n.parentId) {
      const arr = childrenByParent.get(n.parentId) ?? [];
      arr.push(n.id);
      childrenByParent.set(n.parentId, arr);
    }
  }
  const renderedInSubgraph = new Set<string>();

  function renderNode(id: string): string {
    const n = graph.nodes.find((x) => x.id === id);
    if (!n) return "";
    if (n.type === "service") {
      const d = n.data as ServiceNodeData;
      return `  ${safeId(id)}["${escapeMermaidLabel(d.label || id)}"]`;
    }
    if (n.type === "sticky") {
      const d = n.data as StickyNodeData;
      return `  ${safeId(id)}>${escapeMermaidLabel(d.label || "note")}]`;
    }
    return `  ${safeId(id)}["${escapeMermaidLabel((n.data as GroupNodeData).label || id)}"]`;
  }

  for (const n of graph.nodes) {
    if (n.type !== "group") continue;
    const data = n.data as GroupNodeData;
    lines.push(`  subgraph ${safeId(n.id)}["${escapeMermaidLabel(data.label || n.id)}"]`);
    const kids = childrenByParent.get(n.id) ?? [];
    for (const childId of kids) {
      const ln = renderNode(childId);
      if (ln) lines.push("  " + ln.trimStart());
      renderedInSubgraph.add(childId);
    }
    lines.push("  end");
  }

  // Top-level (non-grouped) nodes
  for (const n of graph.nodes) {
    if (n.type === "group") continue;
    if (renderedInSubgraph.has(n.id)) continue;
    const ln = renderNode(n.id);
    if (ln) lines.push(ln);
  }

  // Edges
  for (const e of graph.edges) {
    const label = e.data?.label ? `|${escapeMermaidLabel(e.data.label)}|` : "";
    const arrow = e.data?.arrowStyle === "bidirectional" ? "<-->" : "-->";
    const line = e.data?.lineStyle === "dashed" ? arrow.replace("-->", "-.->") : arrow;
    lines.push(`  ${safeId(e.source)} ${line}${label} ${safeId(e.target)}`);
  }

  return lines.join("\n") + "\n";
}
