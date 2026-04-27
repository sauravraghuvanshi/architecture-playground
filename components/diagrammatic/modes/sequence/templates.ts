import { SEQUENCE_DEFAULT_PAYLOAD } from "../../shared/modeDefaults";
import type { ModeTemplate } from "../../shared/modeRegistry";

export const SEQUENCE_TEMPLATES: ModeTemplate[] = [
  {
    id: "rest-create-order",
    name: "REST: create order",
    description: "User → API → Service → DB → response",
    payload: SEQUENCE_DEFAULT_PAYLOAD,
  },
  {
    id: "oauth-pkce",
    name: "OAuth 2 (PKCE)",
    description: "Browser → IdP → API authorization-code exchange",
    payload: {
      participants: [
        { id: "browser", label: "Browser" },
        { id: "app", label: "Web App" },
        { id: "idp", label: "Identity Provider" },
        { id: "api", label: "Resource API" },
      ],
      messages: [
        { id: "m1", from: "browser", to: "app", label: "GET /login", row: 0, kind: "sync" },
        { id: "m2", from: "app", to: "browser", label: "Redirect → IdP (challenge)", row: 1, kind: "return" },
        { id: "m3", from: "browser", to: "idp", label: "Authenticate user", row: 2, kind: "sync" },
        { id: "m4", from: "idp", to: "browser", label: "Redirect → /callback?code", row: 3, kind: "return" },
        { id: "m5", from: "browser", to: "app", label: "GET /callback?code", row: 4, kind: "sync" },
        { id: "m6", from: "app", to: "idp", label: "POST /token (code + verifier)", row: 5, kind: "sync" },
        { id: "m7", from: "idp", to: "app", label: "access_token", row: 6, kind: "return" },
        { id: "m8", from: "app", to: "api", label: "GET /me (Bearer)", row: 7, kind: "sync" },
        { id: "m9", from: "api", to: "app", label: "user JSON", row: 8, kind: "return" },
        { id: "m10", from: "app", to: "browser", label: "Render dashboard", row: 9, kind: "return" },
      ],
    },
  },
  {
    id: "pubsub-event",
    name: "Pub/Sub event",
    description: "Producer → broker → fan-out to subscribers",
    payload: {
      participants: [
        { id: "producer", label: "Order Service" },
        { id: "broker", label: "Event Broker" },
        { id: "ship", label: "Shipping" },
        { id: "email", label: "Email Worker" },
      ],
      messages: [
        { id: "m1", from: "producer", to: "broker", label: "publish OrderCreated", row: 0, kind: "async" },
        { id: "m2", from: "broker", to: "producer", label: "ack", row: 1, kind: "return" },
        { id: "m3", from: "broker", to: "ship", label: "deliver OrderCreated", row: 2, kind: "async" },
        { id: "m4", from: "broker", to: "email", label: "deliver OrderCreated", row: 3, kind: "async" },
        { id: "m5", from: "ship", to: "broker", label: "ack", row: 4, kind: "return" },
        { id: "m6", from: "email", to: "broker", label: "ack", row: 5, kind: "return" },
        { id: "m7", from: "ship", to: "broker", label: "publish ShipmentScheduled", row: 6, kind: "async" },
      ],
    },
  },
];
