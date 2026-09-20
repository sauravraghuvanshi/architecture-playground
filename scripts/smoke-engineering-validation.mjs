import { sessionCookie, SMOKE_ARCHITECTURE } from "./smoke-live-csa.mjs";

const base = new URL(process.env.LIVE_BASE_URL ?? "");
if (base.protocol !== "https:" || base.username || base.password || base.search || base.hash) {
  throw new Error("LIVE_BASE_URL must be the public HTTPS application URL.");
}
if (!process.env.APP_AUTH_USERNAME || !process.env.APP_AUTH_PASSWORD) throw new Error("Application smoke credentials are required.");
const call = (pathname, body, cookie) => fetch(`${base.origin}${pathname}`, {
  method: "POST", redirect: "manual", signal: AbortSignal.timeout(30_000),
  headers: { "Content-Type": "application/json", ...(cookie ? { Cookie: cookie } : {}) },
  body: JSON.stringify(body),
});
const login = await call("/api/auth/login", { username: process.env.APP_AUTH_USERNAME, password: process.env.APP_AUTH_PASSWORD });
if (!login.ok) throw new Error(`Static validation login failed (${login.status}).`);
const cookie = sessionCookie(login);
const type = "Microsoft.Web/sites";
const planType = "Microsoft.Web/serverfarms";
const artifact = {
  format: "bicep",
  code: `param location string = 'westeurope'
resource plan 'Microsoft.Web/serverfarms@2024-04-01' = {
  name: 'validation-plan'
  location: location
  kind: 'app'
  sku: { name: 'B1' }
}
resource site 'Microsoft.Web/sites@2024-04-01' = {
  name: 'validation-site'
  location: location
  kind: 'app'
  properties: {
    serverFarmId: plan.id
    httpsOnly: true
  }
}
`,
  armTemplate: {
    $schema: "https://schema.management.azure.com/schemas/2019-04-01/deploymentTemplate.json#",
    contentVersion: "1.0.0.0",
    parameters: { location: { type: "string", defaultValue: "westeurope" } },
    resources: [
      { type: planType, apiVersion: "2024-04-01", name: "validation-plan", location: "[parameters('location')]", kind: "app", sku: { name: "B1" } },
      { type, apiVersion: "2024-04-01", name: "validation-site", location: "[parameters('location')]", kind: "app", properties: { serverFarmId: "[resourceId('Microsoft.Web/serverfarms', 'validation-plan')]", httpsOnly: true } },
    ],
  },
  resourceMappings: [
    { nodeId: SMOKE_ARCHITECTURE.nodes[0].id, resourceType: planType, resourceName: "validation-plan" },
    { nodeId: SMOKE_ARCHITECTURE.nodes[0].id, resourceType: type, resourceName: "validation-site" },
  ],
};
try {
  const checks = [
    [artifact, "passed-static-checks"],
    [{ ...artifact, code: "THIS IS NOT BICEP {{{" }, "failed"],
    [{ ...artifact, format: "terraform", code: "not hcl {{{" }, "failed"],
    [{ ...artifact, format: "azure-cli", code: "printf 'not executed'\n" }, "needs-review"],
    [{ ...artifact, format: "powershell", code: "using module '/never-load-this'\n" }, "needs-review"],
  ];
  for (const [index, [candidate, expected]] of checks.entries()) {
    let response;
    for (let attempt = 0; attempt < 12; attempt++) {
      response = await call("/api/deploy/validate", { payload: SMOKE_ARCHITECTURE, artifact: candidate }, cookie);
      if (index !== 0 || ![404, 502, 503].includes(response.status) || attempt === 11) break;
      await new Promise((resolve) => setTimeout(resolve, 5000));
    }
    if (!response.ok) throw new Error(`Hosted ${candidate.format} static validation failed (${response.status}).`);
    const result = await response.json();
    if (result.validation?.status !== expected) throw new Error(`Hosted ${candidate.format} validation returned unexpected status.`);
  }
  console.log("Hosted Bicep/HCL parsing, Bash no-execute syntax and explicit PowerShell limits verified. No model, publication or deployment invoked.");
} finally {
  const logout = await call("/api/auth/logout", {}, cookie);
  if (!logout.ok) throw new Error(`Static validation logout failed (${logout.status}).`);
}
