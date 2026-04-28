import { C4_DEFAULT_PAYLOAD, C4_EMPTY_PAYLOAD } from "../../shared/modeDefaults";
import type { ModeTemplate } from "../../shared/modeRegistry";

export const C4_TEMPLATES: ModeTemplate[] = [
  {
    id: "blank",
    name: "Blank canvas",
    description: "Start fresh — add C4 elements from the builder palette",
    payload: C4_EMPTY_PAYLOAD,
  },
  {
    id: "bookstore",
    name: "Bookstore",
    description: "Customer → Web → API → DB + Stripe",
    payload: C4_DEFAULT_PAYLOAD,
  },
  {
    id: "mobile-banking",
    name: "Mobile banking",
    description: "Customer → Mobile → BFF → Core + Fraud",
    payload: {
      nodes: [
        { id: "cust", kind: "person", name: "Customer", description: "Holds an account", x: 0, y: 0 },
        { id: "mobile", kind: "container", name: "Mobile App", description: "iOS / Android client", tech: "React Native", x: 280, y: 0 },
        { id: "bff", kind: "container", name: "BFF API", description: "Mobile-shaped API", tech: "Node.js", x: 560, y: 0 },
        { id: "core", kind: "container", name: "Core Banking", description: "Accounts, transactions", tech: "Java / PostgreSQL", x: 840, y: 0 },
        { id: "fraud", kind: "system", name: "Fraud Service", description: "Risk scoring", external: true, x: 840, y: 220 },
        { id: "push", kind: "system", name: "Push Notifications", description: "FCM / APNs", external: true, x: 280, y: 220 },
      ],
      edges: [
        { id: "e1", from: "cust", to: "mobile", label: "Uses", tech: "Touch" },
        { id: "e2", from: "mobile", to: "bff", label: "REST", tech: "JSON / HTTPS" },
        { id: "e3", from: "bff", to: "core", label: "Calls", tech: "gRPC" },
        { id: "e4", from: "bff", to: "fraud", label: "Score txn", tech: "HTTPS" },
        { id: "e5", from: "bff", to: "push", label: "Notify", tech: "HTTPS" },
      ],
    },
  },
];
