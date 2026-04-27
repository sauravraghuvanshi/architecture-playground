import { UML_DEFAULT_PAYLOAD } from "../../shared/modeDefaults";
import type { ModeTemplate } from "../../shared/modeRegistry";

export const UML_TEMPLATES: ModeTemplate[] = [
  {
    id: "animal-kingdom",
    name: "Animal kingdom",
    description: "Animal / Dog / Cat with Trainable interface",
    payload: UML_DEFAULT_PAYLOAD,
  },
  {
    id: "auth-system",
    name: "Auth system",
    description: "User / Session / Token / OAuthProvider",
    payload: {
      classes: [
        { id: "User", name: "User", x: 0, y: 0,
          fields: [
            { name: "id", type: "string", visibility: "+" },
            { name: "email", type: "string", visibility: "+" },
            { name: "passwordHash", type: "string", visibility: "-" },
          ],
          methods: [
            { name: "verifyPassword", returns: "boolean", params: "pw: string", visibility: "+" },
          ],
        },
        { id: "Session", name: "Session", x: 280, y: 0,
          fields: [
            { name: "id", type: "string", visibility: "+" },
            { name: "userId", type: "string", visibility: "+" },
            { name: "expires", type: "Date", visibility: "+" },
          ],
          methods: [{ name: "isExpired", returns: "boolean", visibility: "+" }],
        },
        { id: "Token", name: "Token", x: 560, y: 0,
          fields: [
            { name: "value", type: "string", visibility: "+" },
            { name: "scopes", type: "string[]", visibility: "+" },
          ],
          methods: [{ name: "verify", returns: "boolean", visibility: "+" }],
        },
        { id: "OAuthProvider", name: "OAuthProvider", stereotype: "interface", x: 0, y: 260,
          fields: [],
          methods: [
            { name: "authorize", returns: "string", visibility: "+" },
            { name: "exchange", returns: "Token", params: "code: string", visibility: "+" },
          ],
        },
        { id: "GitHubProvider", name: "GitHubProvider", x: 280, y: 260,
          fields: [{ name: "clientId", type: "string", visibility: "-" }],
          methods: [
            { name: "authorize", returns: "string", visibility: "+" },
            { name: "exchange", returns: "Token", params: "code: string", visibility: "+" },
          ],
        },
      ],
      relations: [
        { id: "r1", from: "Session", to: "User", kind: "composition" },
        { id: "r2", from: "Token", to: "User", kind: "composition" },
        { id: "r3", from: "GitHubProvider", to: "OAuthProvider", kind: "implementation" },
      ],
    },
  },
];
