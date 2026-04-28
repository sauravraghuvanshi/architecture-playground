/**
 * Default payload literals for non-architecture modes.
 *
 * Lives in `shared/` (no DOM imports) so that `modeCatalog.tsx` can pull
 * initial state in synchronously without dragging React Flow / Excalidraw /
 * dnd-kit into the SSR module graph.
 */

export const SEQUENCE_DEFAULT_PAYLOAD = {
  participants: [
    { id: "user", label: "User" },
    { id: "api", label: "API Gateway" },
    { id: "service", label: "Service" },
    { id: "db", label: "Database" },
  ],
  messages: [
    { id: "m1", from: "user", to: "api", label: "POST /order", row: 0, kind: "sync" },
    { id: "m2", from: "api", to: "service", label: "createOrder()", row: 1, kind: "sync" },
    { id: "m3", from: "service", to: "db", label: "INSERT", row: 2, kind: "sync" },
    { id: "m4", from: "db", to: "service", label: "ok", row: 3, kind: "return" },
    { id: "m5", from: "service", to: "api", label: "Order{}", row: 4, kind: "return" },
    { id: "m6", from: "api", to: "user", label: "201 Created", row: 5, kind: "return" },
  ],
} as const;

export const FLOWCHART_DEFAULT_PAYLOAD = {
  nodes: [
    { id: "n1", shape: "startend", label: "Start", x: 360, y: 0 },
    { id: "n2", shape: "process", label: "Receive request", x: 340, y: 110 },
    { id: "n3", shape: "decision", label: "Authorized?", x: 340, y: 230 },
    { id: "n4", shape: "process", label: "Handle request", x: 140, y: 380 },
    { id: "n5", shape: "process", label: "Reject 401", x: 540, y: 380 },
    { id: "n6", shape: "startend", label: "End", x: 360, y: 510 },
  ],
  edges: [
    { id: "e1", from: "n1", to: "n2" },
    { id: "e2", from: "n2", to: "n3" },
    { id: "e3", from: "n3", to: "n4", label: "Yes" },
    { id: "e4", from: "n3", to: "n5", label: "No" },
    { id: "e5", from: "n4", to: "n6" },
    { id: "e6", from: "n5", to: "n6" },
  ],
} as const;

export const MINDMAP_DEFAULT_PAYLOAD = {
  nodes: [
    { id: "root", label: "Product strategy", x: 0, y: 0, color: 0, isRoot: true },
    { id: "c1", label: "Discovery", x: -260, y: -160, color: 1 },
    { id: "c2", label: "Roadmap", x: 260, y: -160, color: 2 },
    { id: "c3", label: "Metrics", x: -260, y: 160, color: 3 },
    { id: "c4", label: "Launch plan", x: 260, y: 160, color: 4 },
    { id: "c5", label: "User research", x: -480, y: -260, color: 1 },
    { id: "c6", label: "OKRs", x: 480, y: -260, color: 2 },
  ],
  edges: [
    { id: "e1", from: "root", to: "c1" }, { id: "e2", from: "root", to: "c2" },
    { id: "e3", from: "root", to: "c3" }, { id: "e4", from: "root", to: "c4" },
    { id: "e5", from: "c1", to: "c5" }, { id: "e6", from: "c2", to: "c6" },
  ],
} as const;

export const ER_DEFAULT_PAYLOAD = {
  entities: [
    { id: "user", name: "User", x: 0, y: 0, columns: [
      { name: "id", type: "uuid", pk: true },
      { name: "email", type: "text" },
      { name: "created_at", type: "timestamptz" },
    ]},
    { id: "order", name: "Order", x: 360, y: 0, columns: [
      { name: "id", type: "uuid", pk: true },
      { name: "user_id", type: "uuid", fk: true },
      { name: "total_cents", type: "int" },
      { name: "status", type: "text" },
    ]},
    { id: "item", name: "OrderItem", x: 720, y: 0, columns: [
      { name: "id", type: "uuid", pk: true },
      { name: "order_id", type: "uuid", fk: true },
      { name: "sku", type: "text" },
      { name: "qty", type: "int" },
    ]},
  ],
  relationships: [
    { id: "r1", from: "user", to: "order", cardinality: "1:N" },
    { id: "r2", from: "order", to: "item", cardinality: "1:N" },
  ],
} as const;

export const UML_DEFAULT_PAYLOAD = {
  classes: [
    { id: "Animal", name: "Animal", x: 0, y: 0,
      fields: [{ name: "name", type: "string", visibility: "+" }, { name: "age", type: "number", visibility: "+" }],
      methods: [{ name: "speak", returns: "void", visibility: "+" }] },
    { id: "Dog", name: "Dog", x: -200, y: 220,
      fields: [{ name: "breed", type: "string", visibility: "+" }],
      methods: [{ name: "fetch", returns: "void", visibility: "+" }] },
    { id: "Cat", name: "Cat", x: 200, y: 220,
      fields: [{ name: "indoor", type: "boolean", visibility: "+" }],
      methods: [{ name: "purr", returns: "void", visibility: "+" }] },
    { id: "Trainable", name: "Trainable", stereotype: "interface", x: -440, y: 0,
      fields: [], methods: [{ name: "train", returns: "void", params: "cmd: string", visibility: "+" }] },
  ],
  relations: [
    { id: "r1", from: "Dog", to: "Animal", kind: "inheritance" },
    { id: "r2", from: "Cat", to: "Animal", kind: "inheritance" },
    { id: "r3", from: "Dog", to: "Trainable", kind: "implementation" },
  ],
} as const;

export const C4_DEFAULT_PAYLOAD = {
  nodes: [
    { id: "user", kind: "person", name: "Customer", description: "Buys books", x: 0, y: 0 },
    { id: "web", kind: "container", name: "Web App", description: "Lists books, accepts orders", tech: "Next.js", x: 280, y: 0 },
    { id: "api", kind: "container", name: "API", description: "REST + auth", tech: "FastAPI", x: 560, y: 0 },
    { id: "db", kind: "container", name: "Database", description: "Catalog + orders", tech: "PostgreSQL", x: 840, y: 0 },
    { id: "stripe", kind: "system", name: "Stripe", description: "Payments", external: true, x: 560, y: 220 },
  ],
  edges: [
    { id: "e1", from: "user", to: "web", label: "Visits", tech: "HTTPS" },
    { id: "e2", from: "web", to: "api", label: "Reads / writes", tech: "JSON / HTTPS" },
    { id: "e3", from: "api", to: "db", label: "SQL", tech: "TCP" },
    { id: "e4", from: "api", to: "stripe", label: "Charges", tech: "HTTPS" },
  ],
} as const;

export const WHITEBOARD_DEFAULT_PAYLOAD = {
  elements: [],
  appState: { viewBackgroundColor: "#0a0a0b", currentItemStrokeColor: "#bef264" },
  files: {},
} as const;

export const KANBAN_DEFAULT_PAYLOAD = {
  columns: [
    { id: "backlog", title: "Backlog", cardIds: ["c1", "c2", "c3"] },
    { id: "doing",   title: "In progress", wipLimit: 2, cardIds: ["c4"] },
    { id: "review",  title: "Review", wipLimit: 2, cardIds: ["c5"] },
    { id: "done",    title: "Done", cardIds: ["c6"] },
  ],
  cards: {
    c1: { id: "c1", title: "Onboarding flow", label: "growth" },
    c2: { id: "c2", title: "Audit log retention policy", label: "compliance" },
    c3: { id: "c3", title: "Refresh marketing copy", label: "design" },
    c4: { id: "c4", title: "Animated GIF export", label: "feature" },
    c5: { id: "c5", title: "Sequence-mode toolbar", label: "feature" },
    c6: { id: "c6", title: "Dark theme toggle", label: "design" },
  },
} as const;

/* -----------------------------------------------------------------------
 * Empty payloads — used by the "Blank canvas" template and the Builder
 * Palette's Clear button. Each is a structurally-valid (but empty) payload
 * for its mode so hydrate() doesn't have to special-case missing arrays.
 * ----------------------------------------------------------------------- */

export const FLOWCHART_EMPTY_PAYLOAD = { nodes: [], edges: [] } as const;
export const SEQUENCE_EMPTY_PAYLOAD = { participants: [], messages: [] } as const;
export const MINDMAP_EMPTY_PAYLOAD = { nodes: [], edges: [] } as const;
export const ER_EMPTY_PAYLOAD = { entities: [], relationships: [] } as const;
export const UML_EMPTY_PAYLOAD = { classes: [], relations: [] } as const;
export const C4_EMPTY_PAYLOAD = { nodes: [], edges: [] } as const;
