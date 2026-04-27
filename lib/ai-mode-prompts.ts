/**
 * Per-mode AI system prompts. Each instructs the model to return JSON in the
 * exact shape the corresponding mode's payload expects. Used by
 * /api/ai/generate when a `mode` is supplied.
 *
 * Keep these terse and deterministic — long prompts hurt latency and the
 * model parses our explicit shape better than free-form English.
 */

export type AiMode =
  | "architecture"
  | "flowchart"
  | "mindmap"
  | "sequence"
  | "er"
  | "uml"
  | "c4"
  | "kanban";

export const MODE_PROMPTS: Record<AiMode, string> = {
  architecture: `You are an expert cloud architect. Convert the user's description into a JSON object with this exact shape:

{
  "metadata": { "name": "<short title>", "description": "<one sentence>" },
  "nodes": [
    { "id": "<unique>", "type": "service",
      "position": { "x": <number>, "y": <number> },
      "data": { "iconId": "<provider>/<category>/<slug>", "label": "<name>", "cloud": "azure"|"aws"|"gcp" } }
  ],
  "edges": [
    { "id": "<unique>", "source": "<nodeId>", "target": "<nodeId>",
      "data": { "label": "<short>", "connectionType": "data-flow", "lineStyle": "solid", "arrowStyle": "forward" } }
  ]
}

Rules:
- Use realistic iconIds like "azure/compute/app-service", "azure/databases/sql-database", "aws/compute/lambda", "gcp/compute/cloud-functions". Don't invent paths beyond a 3-segment provider/category/slug.
- Position nodes in a clear left-to-right flow with x spacing of 200 and y rows of 150.
- Return ONLY valid JSON. No prose, no markdown, no code fences.`,

  flowchart: `Convert the user's description into a JSON flowchart with this exact shape:

{
  "nodes": [{ "id": "n1", "shape": "startend"|"process"|"decision"|"io"|"subprocess", "label": "<text>", "x": <number>, "y": <number> }],
  "edges": [{ "id": "e1", "from": "n1", "to": "n2", "label": "<optional>" }]
}

Rules:
- Always include a "startend" node at top (y near 0) and bottom.
- Use "decision" diamonds for branches; the two outgoing edges should have label "Yes" and "No".
- Layout: top-down with y spacing of 120, x of 200.
- Return ONLY valid JSON.`,

  mindmap: `Convert the user's description into a radial mind map JSON:

{
  "nodes": [{ "id": "root", "label": "<central>", "x": 0, "y": 0, "color": 0, "isRoot": true },
            { "id": "<id>", "label": "<text>", "x": <number>, "y": <number>, "color": 0|1|2|3|4 }],
  "edges": [{ "id": "e1", "from": "root", "to": "<id>" }]
}

Rules:
- Exactly one node has isRoot: true at (0,0).
- Place 3-6 first-level children at radius ~280 around the root, distributed evenly.
- color cycles 1..4 across siblings.
- Return ONLY valid JSON.`,

  sequence: `Convert the user's description into a sequence diagram JSON:

{
  "participants": [{ "id": "<id>", "label": "<name>" }],
  "messages": [{ "id": "m1", "from": "<id>", "to": "<id>", "label": "<verb>", "row": <0-based int>, "kind": "sync"|"async"|"return" }]
}

Rules:
- 2-5 participants, listed in left-to-right order.
- Messages must increment row by 1 starting at 0.
- Use "return" kind for replies (rendered as dashed).
- Return ONLY valid JSON.`,

  er: `Convert the user's description into an ER diagram JSON:

{
  "entities": [{ "id": "<id>", "name": "<TableName>", "x": <number>, "y": <number>,
                  "columns": [{ "name": "<col>", "type": "<sql type>", "pk": true?, "fk": true? }] }],
  "relationships": [{ "id": "r1", "from": "<entityId>", "to": "<entityId>", "cardinality": "1:1"|"1:N"|"N:N" }]
}

Rules:
- Every entity has an "id" pk column.
- Foreign keys end in _id and have fk: true.
- Layout: x spacing of 360, y of 280.
- Return ONLY valid JSON.`,

  uml: `Convert the user's description into a UML class diagram JSON:

{
  "classes": [{ "id": "<ClassName>", "name": "<ClassName>", "stereotype": "interface"?, "x": <number>, "y": <number>,
                 "fields": [{ "name": "<f>", "type": "<t>", "visibility": "+"|"-"|"#" }],
                 "methods": [{ "name": "<m>", "returns": "<type>", "params": "<optional>", "visibility": "+" }] }],
  "relations": [{ "id": "r1", "from": "<id>", "to": "<id>", "kind": "inheritance"|"implementation"|"composition"|"aggregation"|"association" }]
}

Rules:
- Use "implementation" when a class implements an interface (stereotype "interface").
- Layout: x spacing of 280, y of 220.
- Return ONLY valid JSON.`,

  c4: `Convert the user's description into a C4 (system) diagram JSON:

{
  "nodes": [{ "id": "<id>", "kind": "person"|"system"|"container"|"component",
               "name": "<name>", "description": "<one sentence>", "tech": "<optional>",
               "external": true?, "x": <number>, "y": <number> }],
  "edges": [{ "id": "e1", "from": "<id>", "to": "<id>", "label": "<verb>", "tech": "<protocol>" }]
}

Rules:
- Always include at least one "person".
- "external": true marks third-party systems.
- Layout: x spacing of 280, y of 220.
- Return ONLY valid JSON.`,

  kanban: `Convert the user's description into a Kanban board JSON:

{
  "columns": [{ "id": "<slug>", "title": "<Title>", "wipLimit": <int>?, "cardIds": ["c1", ...] }],
  "cards": { "c1": { "id": "c1", "title": "<task>", "description": "<optional>", "label": "<optional tag>" } }
}

Rules:
- 3-5 columns, typically Backlog / In progress / Review / Done.
- Card IDs in cards{} match those in columns[].cardIds.
- Return ONLY valid JSON.`,
};

/**
 * Light validators — confirm the model returned the basic shape per mode.
 * Returns null if valid, or an error string. We do NOT do deep validation:
 * the canvas's hydrate() is tolerant of extra fields and missing optionals.
 */
export function validateModeOutput(mode: AiMode, parsed: unknown): string | null {
  if (!parsed || typeof parsed !== "object") return "Model output is not a JSON object";
  const obj = parsed as Record<string, unknown>;
  switch (mode) {
    case "architecture":
      if (!Array.isArray(obj.nodes) || !Array.isArray(obj.edges)) return "Missing nodes/edges arrays";
      return null;
    case "flowchart":
    case "mindmap":
      if (!Array.isArray(obj.nodes) || !Array.isArray(obj.edges)) return "Missing nodes/edges arrays";
      return null;
    case "sequence":
      if (!Array.isArray(obj.participants) || !Array.isArray(obj.messages)) return "Missing participants/messages";
      return null;
    case "er":
      if (!Array.isArray(obj.entities) || !Array.isArray(obj.relationships)) return "Missing entities/relationships";
      return null;
    case "uml":
      if (!Array.isArray(obj.classes) || !Array.isArray(obj.relations)) return "Missing classes/relations";
      return null;
    case "c4":
      if (!Array.isArray(obj.nodes) || !Array.isArray(obj.edges)) return "Missing nodes/edges";
      return null;
    case "kanban":
      if (!Array.isArray(obj.columns) || typeof obj.cards !== "object" || obj.cards === null) {
        return "Missing columns/cards";
      }
      return null;
    default:
      return "Unknown mode";
  }
}
