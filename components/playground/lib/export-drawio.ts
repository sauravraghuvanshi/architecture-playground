/**
 * draw.io (diagrams.net) XML export and import.
 *
 * Round-trip target: a graph exported here and re-imported should preserve
 * node positions, labels, and basic edge connectivity. We do NOT attempt to
 * preserve cloud-icon visuals on import (drawio has its own shape libraries);
 * imported nodes become generic services with a "drawio:" iconId placeholder
 * so users can re-assign icons inside the playground.
 */
import type {
  PlaygroundGraph,
  PlaygroundNode,
  PlaygroundEdge,
  ServiceNodeData,
  GroupNodeData,
  StickyNodeData,
  CloudId,
} from "./types";
import { CURRENT_SCHEMA_VERSION } from "./types";

function escapeXml(s: string): string {
  return (s || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function toDrawioXml(graph: PlaygroundGraph): string {
  const cells: string[] = [];
  cells.push('<mxCell id="0" />');
  cells.push('<mxCell id="1" parent="0" />');

  for (const n of graph.nodes) {
    const x = n.position?.x ?? 0;
    const y = n.position?.y ?? 0;
    const w = n.width ?? 160;
    const h = n.height ?? (n.type === "group" ? 240 : 80);
    let label = "";
    let style = "rounded=1;whiteSpace=wrap;html=1;fillColor=#ffffff;";
    if (n.type === "service") {
      const d = n.data as ServiceNodeData;
      label = d.label || n.id;
      style = `rounded=1;whiteSpace=wrap;html=1;fillColor=#e0e7ff;strokeColor=#6366f1;`;
    } else if (n.type === "group") {
      const d = n.data as GroupNodeData;
      label = d.label || n.id;
      style = `rounded=0;whiteSpace=wrap;html=1;fillColor=none;strokeColor=#94a3b8;dashed=1;verticalAlign=top;`;
    } else if (n.type === "sticky") {
      const d = n.data as StickyNodeData;
      label = d.label || "note";
      style = `shape=note;whiteSpace=wrap;html=1;fillColor=#fef3c7;strokeColor=#f59e0b;`;
    }
    const parent = n.parentId ?? "1";
    cells.push(
      `<mxCell id="${escapeXml(n.id)}" value="${escapeXml(label)}" style="${style}" vertex="1" parent="${escapeXml(parent)}">` +
        `<mxGeometry x="${x}" y="${y}" width="${w}" height="${h}" as="geometry" />` +
        `</mxCell>`
    );
  }
  for (const e of graph.edges) {
    const label = e.data?.label ?? "";
    const dashed = e.data?.lineStyle === "dashed" ? "dashed=1;" : "";
    const style = `endArrow=classic;html=1;${dashed}`;
    cells.push(
      `<mxCell id="${escapeXml(e.id)}" value="${escapeXml(label)}" style="${style}" edge="1" parent="1" source="${escapeXml(e.source)}" target="${escapeXml(e.target)}">` +
        `<mxGeometry relative="1" as="geometry" />` +
        `</mxCell>`
    );
  }

  return (
    `<?xml version="1.0" encoding="UTF-8"?>\n` +
    `<mxfile host="architecture-playground">` +
    `<diagram name="${escapeXml(graph.metadata?.name ?? "Architecture")}" id="ap1">` +
    `<mxGraphModel dx="1200" dy="800" grid="1" gridSize="10" guides="1" tooltips="1" connect="1" arrows="1" fold="1" page="1" pageScale="1" pageWidth="850" pageHeight="1100" math="0" shadow="0">` +
    `<root>${cells.join("")}</root>` +
    `</mxGraphModel></diagram></mxfile>\n`
  );
}

interface ParsedAttr {
  [k: string]: string;
}

/**
 * Tiny attribute parser for an mxCell start tag. Avoids pulling in a full XML
 * parser dependency. Handles double-quoted attribute values only (which is
 * what drawio emits).
 */
function parseAttrs(tag: string): ParsedAttr {
  const out: ParsedAttr = {};
  const re = /(\w+)="([^"]*)"/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(tag))) out[m[1]] = decodeXml(m[2]);
  return out;
}

function decodeXml(s: string): string {
  return s
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, "&");
}

/**
 * Best-effort drawio XML import. Maps mxCell vertices to service nodes and
 * mxCell edges to PlaygroundEdge. Subgraph hierarchy preserved via parent.
 */
export function fromDrawioXml(xml: string): PlaygroundGraph {
  const nodes: PlaygroundNode[] = [];
  const edges: PlaygroundEdge[] = [];

  // Pull each <mxCell ...> ... </mxCell> or self-closing.
  const cellRe = /<mxCell\b([^>]*?)(\/>|>([\s\S]*?)<\/mxCell>)/g;
  let cm: RegExpExecArray | null;
  while ((cm = cellRe.exec(xml))) {
    const attrTag = "<x " + cm[1] + ">";
    const attrs = parseAttrs(attrTag);
    const inner = cm[3] ?? "";
    if (!attrs.id || attrs.id === "0" || attrs.id === "1") continue;

    const geomMatch = inner.match(/<mxGeometry\b([^/>]*?)\/?>/);
    const geomAttrs = geomMatch ? parseAttrs("<g " + geomMatch[1] + ">") : {};

    if (attrs.edge === "1") {
      if (!attrs.source || !attrs.target) continue;
      edges.push({
        id: attrs.id,
        source: attrs.source,
        target: attrs.target,
        data: {
          label: attrs.value || undefined,
          connectionType: "data-flow",
          lineStyle: /dashed=1/.test(attrs.style ?? "") ? "dashed" : "solid",
          arrowStyle: "forward",
        },
      });
      continue;
    }

    if (attrs.vertex === "1") {
      const x = Number(geomAttrs.x ?? 0);
      const y = Number(geomAttrs.y ?? 0);
      const w = Number(geomAttrs.width ?? 160);
      const h = Number(geomAttrs.height ?? 80);
      const isSticky = /shape=note/.test(attrs.style ?? "");
      const isGroup = /dashed=1/.test(attrs.style ?? "") && /fillColor=none/.test(attrs.style ?? "");
      if (isGroup) {
        nodes.push({
          id: attrs.id,
          type: "group",
          position: { x, y },
          width: w,
          height: h,
          parentId: attrs.parent && attrs.parent !== "1" ? attrs.parent : undefined,
          data: { label: attrs.value || attrs.id, variant: "custom" } as GroupNodeData,
        });
      } else if (isSticky) {
        nodes.push({
          id: attrs.id,
          type: "sticky",
          position: { x, y },
          width: w,
          height: h,
          parentId: attrs.parent && attrs.parent !== "1" ? attrs.parent : undefined,
          data: { label: attrs.value || "" } as StickyNodeData,
        });
      } else {
        nodes.push({
          id: attrs.id,
          type: "service",
          position: { x, y },
          width: w,
          height: h,
          parentId: attrs.parent && attrs.parent !== "1" ? attrs.parent : undefined,
          data: {
            iconId: "drawio:imported",
            label: attrs.value || attrs.id,
            cloud: "azure" as CloudId,
          } as ServiceNodeData,
        });
      }
    }
  }

  return {
    nodes,
    edges,
    layers: [
      {
        id: "default",
        name: "Default",
        visible: true,
        locked: false,
        color: "#6366f1",
        order: 0,
      },
    ],
    metadata: {
      name: "Imported from draw.io",
      updatedAt: new Date().toISOString(),
    },
  };
}

export function exportDrawio(graph: PlaygroundGraph, filename = "architecture.drawio") {
  const xml = toDrawioXml(graph);
  const blob = new Blob([xml], { type: "application/xml" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1500);
}

export async function readDrawioFile(file: File): Promise<PlaygroundGraph> {
  const text = await file.text();
  return fromDrawioXml(text);
}

// Keep the schema version referenced for potential metadata embedding later.
void CURRENT_SCHEMA_VERSION;
