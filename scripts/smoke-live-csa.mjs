import { pathToFileURL } from "node:url";

export const SMOKE_ARCHITECTURE = {
  nodes: [{
    id: "live-smoke-web", kind: "icon", label: "Live Smoke Web App",
    iconId: "azure/application/app-service-api",
    iconPath: "/cloud-icons/azure/application/app-service-api.svg",
    x: 0, y: 0,
  }],
  edges: [],
};

async function expectStatus(response, expected, label) {
  if (response.status !== expected) {
    throw new Error(`${label} returned ${response.status}; expected ${expected}.`);
  }
}

function sessionCookie(response) {
  const match = (response.headers.get("set-cookie") ?? "").match(/(?:^|,\s*)diagrammatic_session=([^;]+)/);
  if (!match) throw new Error("Login did not issue the session cookie.");
  return `diagrammatic_session=${match[1]}`;
}

export async function runLiveCsaSmoke({
  baseUrl, username, password, invokeAgents = false, publishTemplate = false,
  requireAgents = false, fetchImpl = fetch,
  wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
}) {
  if (!baseUrl || !username || !password) {
    throw new Error("LIVE_BASE_URL, APP_AUTH_USERNAME, and APP_AUTH_PASSWORD are required.");
  }
  const base = new URL(baseUrl);
  if (base.protocol !== "https:" || base.username || base.password || base.search || base.hash) {
    throw new Error("LIVE_BASE_URL must be a public HTTPS application URL without credentials or query parameters.");
  }
  const origin = base.origin;
  const call = (path, options = {}) => fetchImpl(`${origin}${path}`, {
    ...options, redirect: "manual", signal: AbortSignal.timeout(150_000),
  });
  const anonymous = await call("/diagrammatic");
  await expectStatus(anonymous, 307, "Anonymous workspace");
  const loginLocation = new URL(anonymous.headers.get("location") ?? "", origin);
  if (loginLocation.origin !== origin || loginLocation.pathname !== "/login") {
    throw new Error("Anonymous workspace did not redirect to the application's login page.");
  }
  const unauthorized = await call("/api/deploy/template", { method: "POST" });
  await expectStatus(unauthorized, 401, "Anonymous template publication");
  const login = await call("/api/auth/login", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password }),
  });
  await expectStatus(login, 200, "Login");
  const cookie = sessionCookie(login);
  const authenticated = { Cookie: cookie };
  const jsonHeaders = { ...authenticated, "Content-Type": "application/json" };
  const report = { checks: ["auth gate"], reviewAgent: "unavailable", deploymentAgent: "unavailable", templatePublication: "not exercised (explicit opt-in required)" };
  try {
    let capabilities;
    for (let attempt = 0; attempt < 18; attempt++) {
      const response = await call("/api/ai/status", { headers: authenticated });
      if (response.ok) {
        const candidate = await response.json();
        if (typeof candidate.reviewAgentConfigured === "boolean" && typeof candidate.deploymentAgentConfigured === "boolean") {
          capabilities = candidate;
          break;
        }
      }
      if (attempt < 17) await wait(10_000);
    }
    if (!capabilities) throw new Error("The named Foundry-agent capability contract is unavailable; a generic model flag is not sufficient.");
    report.reviewAgent = capabilities.reviewAgentConfigured ? "configured, not invoked" : "unavailable (not exercised)";
    report.deploymentAgent = capabilities.deploymentAgentConfigured ? "configured, not invoked" : "unavailable (not exercised)";
    report.checks.push("role-specific agent capability contract");
    if (requireAgents && (!capabilities.reviewAgentConfigured || !capabilities.deploymentAgentConfigured)) {
      throw new Error(`Required Foundry capabilities unavailable: review=${capabilities.reviewAgentConfigured}, deployment=${capabilities.deploymentAgentConfigured}.`);
    }

    await expectStatus(await call("/diagrammatic", { headers: authenticated }), 200, "Authenticated workspace");
    report.checks.push("authenticated workspace");

    // Read-only broker checks do not publish a template or call an Azure agent.
    const preflight = await call("/api/deploy/template", { method: "OPTIONS" });
    await expectStatus(preflight, 204, "Anonymous Portal preflight");
    if (preflight.headers.get("access-control-allow-origin") !== "*") throw new Error("Portal preflight is missing public CORS.");
    const invalidToken = await call("/api/deploy/template?token=invalid");
    await expectStatus(invalidToken, 400, "Anonymous invalid-token fetch");
    if (invalidToken.headers.get("access-control-allow-origin") !== "*") throw new Error("Template errors are missing public CORS.");
    const unconfirmed = await call("/api/deploy/template", {
      method: "POST", headers: jsonHeaders,
      body: JSON.stringify({ source: "offline", consent: false, payload: SMOKE_ARCHITECTURE }),
    });
    await expectStatus(unconfirmed, 400, "Unconfirmed template publication");
    report.checks.push("anonymous GET/OPTIONS CORS", "publication consent enforcement");

    if (invokeAgents && capabilities.reviewAgentConfigured) {
      const response = await call("/api/ai/review", {
        method: "POST", headers: jsonHeaders,
        body: JSON.stringify({ source: "canvas", payload: SMOKE_ARCHITECTURE, context: "Synthetic smoke evidence; treat missing production requirements as unknown." }),
      });
      await expectStatus(response, 200, "Named Foundry review agent");
      const result = await response.json();
      if (result.transport !== "foundry-agent" || typeof result.review?.score !== "number" || !Array.isArray(result.review?.findings)) {
        throw new Error("Review did not return a structured result from the named Foundry agent.");
      }
      report.reviewAgent = "passed (named Foundry agent invoked)";
    }
    if (invokeAgents && capabilities.deploymentAgentConfigured) {
      const response = await call("/api/ai/deploy", {
        method: "POST", headers: jsonHeaders,
        body: JSON.stringify({ payload: SMOKE_ARCHITECTURE, format: "bicep", context: "Synthetic smoke only. Generate a draft; do not deploy." }),
      });
      await expectStatus(response, 200, "Named Foundry deployment agent");
      const result = await response.json();
      if (result.source !== "foundry-agent" || result.format !== "bicep" || typeof result.code !== "string" || !result.code.trim() ||
        !Array.isArray(result.armTemplate?.resources) || !result.armTemplate.resources.length ||
        !Array.isArray(result.resourceMappings) || !result.resourceMappings.length) {
        throw new Error("Deployment generation did not return a structured named-agent draft.");
      }
      report.deploymentAgent = "passed (draft generated; nothing published or deployed)";
    }

    if (publishTemplate) {
      const response = await call("/api/deploy/template", {
        method: "POST", headers: jsonHeaders,
        body: JSON.stringify({ source: "offline", consent: true, payload: SMOKE_ARCHITECTURE }),
      });
      await expectStatus(response, 200, "Explicit offline template handoff");
      const result = await response.json();
      const prefix = "https://portal.azure.com/#create/Microsoft.Template/uri/";
      if (typeof result.portalUrl !== "string" || !result.portalUrl.startsWith(prefix)) throw new Error("Invalid Azure Portal handoff URL.");
      const templateUrl = new URL(decodeURIComponent(result.portalUrl.slice(prefix.length)));
      if (templateUrl.origin !== origin || templateUrl.pathname !== "/api/deploy/template") {
        throw new Error("Template origin does not match LIVE_BASE_URL; use the configured public application origin.");
      }
      const template = await call(`${templateUrl.pathname}${templateUrl.search}`);
      await expectStatus(template, 200, "Anonymous short-lived template");
      if (template.headers.get("access-control-allow-origin") !== "*") throw new Error("Published template is missing public CORS.");
      const content = await template.json();
      if (!content.resources?.some((resource) => resource.type === "Microsoft.Web/sites")) throw new Error("Offline template is missing the expected App Service resource.");
      report.templatePublication = "passed (explicit offline source and consent; public for 10 minutes; no Azure deployment)";
    }
  } finally {
    await expectStatus(await call("/api/auth/logout", { method: "POST", headers: authenticated }), 200, "Logout");
    report.checks.push("logout");
  }
  return report;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const report = await runLiveCsaSmoke({
    baseUrl: process.env.LIVE_BASE_URL,
    username: process.env.APP_AUTH_USERNAME,
    password: process.env.APP_AUTH_PASSWORD,
    invokeAgents: process.env.LIVE_INVOKE_AGENTS === "true",
    publishTemplate: process.env.LIVE_PUBLISH_TEMPLATE === "true",
    requireAgents: process.env.LIVE_REQUIRE_AGENTS === "true",
  });
  console.log("Live workspace smoke passed for exercised checks only. Configured/unavailable capabilities are not agent acceptance results.");
  console.log(JSON.stringify(report, null, 2));
}
