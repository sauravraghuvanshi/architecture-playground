import { ER_DEFAULT_PAYLOAD, ER_EMPTY_PAYLOAD } from "../../shared/modeDefaults";
import type { ModeTemplate } from "../../shared/modeRegistry";

export const ER_TEMPLATES: ModeTemplate[] = [
  {
    id: "blank",
    name: "Blank canvas",
    description: "Start fresh — add entities from the builder palette",
    payload: ER_EMPTY_PAYLOAD,
  },
  {
    id: "ecommerce",
    name: "E-commerce",
    description: "User → Order → OrderItem",
    payload: ER_DEFAULT_PAYLOAD,
  },
  {
    id: "saas-tenant",
    name: "SaaS multi-tenant",
    description: "Org / Member / Project / Invite",
    payload: {
      entities: [
        {
          id: "org", name: "Org", x: 0, y: 0, columns: [
            { name: "id", type: "uuid", pk: true },
            { name: "name", type: "text" },
            { name: "plan", type: "text" },
            { name: "created_at", type: "timestamptz" },
          ],
        },
        {
          id: "member", name: "Member", x: 360, y: 0, columns: [
            { name: "id", type: "uuid", pk: true },
            { name: "org_id", type: "uuid", fk: true },
            { name: "user_id", type: "uuid", fk: true },
            { name: "role", type: "text" },
          ],
        },
        {
          id: "user", name: "User", x: 720, y: 0, columns: [
            { name: "id", type: "uuid", pk: true },
            { name: "email", type: "text" },
          ],
        },
        {
          id: "project", name: "Project", x: 0, y: 280, columns: [
            { name: "id", type: "uuid", pk: true },
            { name: "org_id", type: "uuid", fk: true },
            { name: "name", type: "text" },
          ],
        },
        {
          id: "invite", name: "Invite", x: 360, y: 280, columns: [
            { name: "id", type: "uuid", pk: true },
            { name: "org_id", type: "uuid", fk: true },
            { name: "email", type: "text" },
            { name: "expires_at", type: "timestamptz" },
          ],
        },
      ],
      relationships: [
        { id: "r1", from: "org", to: "member", cardinality: "1:N" },
        { id: "r2", from: "user", to: "member", cardinality: "1:N" },
        { id: "r3", from: "org", to: "project", cardinality: "1:N" },
        { id: "r4", from: "org", to: "invite", cardinality: "1:N" },
      ],
    },
  },
];
