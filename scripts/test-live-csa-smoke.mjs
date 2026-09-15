import assert from "node:assert/strict";
import test from "node:test";
import { runLiveCsaSmoke, SMOKE_ARCHITECTURE } from "./smoke-live-csa.mjs";

function harness({
  capabilities = { diagramConfigured: true, reviewAgentConfigured: false, deploymentAgentConfigured: false },
  reviewTransport = "foundry-agent", deploymentSource = "foundry-agent",
  publicationOrigin = "https://diagram.example",
} = {}) {
  const calls = [];
  const agentCalls = [];
  const publications = [];
  let logoutCount = 0;
  let waits = 0;
  const fetchImpl = async (url, options = {}) => {
    const parsed = new URL(url);
    assert.equal(parsed.origin, "https://diagram.example", "Unit smoke must not follow an external handoff.");
    const method = options.method ?? "GET";
    const cookie = new Headers(options.headers).get("cookie");
    calls.push({ path: `${parsed.pathname}${parsed.search}`, method, cookie });
    if (parsed.pathname === "/diagrammatic") {
      return cookie ? new Response("workspace") : new Response(null, { status: 307, headers: { Location: "/login?next=%2Fdiagrammatic" } });
    }
    if (parsed.pathname === "/api/auth/login") {
      return Response.json({}, { headers: { "Set-Cookie": "diagrammatic_session=test-session; HttpOnly; Secure" } });
    }
    if (parsed.pathname === "/api/auth/logout") {
      logoutCount++;
      return Response.json({});
    }
    if (parsed.pathname === "/api/ai/status") return Response.json(capabilities);
    if (parsed.pathname === "/api/deploy/template") {
      const headers = { "Access-Control-Allow-Origin": "*" };
      if (method === "OPTIONS") return new Response(null, { status: 204, headers });
      if (method === "POST") {
        if (!cookie) return Response.json({}, { status: 401 });
        const body = JSON.parse(options.body);
        if (body.consent !== true) return Response.json({}, { status: 400 });
        publications.push(body);
        return Response.json({
          portalUrl: "https://portal.azure.com/#create/Microsoft.Template/uri/" + encodeURIComponent(`${publicationOrigin}/api/deploy/template?token=test-only`),
        });
      }
      if (parsed.searchParams.get("token") === "invalid") return Response.json({}, { status: 400, headers });
      return Response.json({ resources: [{ type: "Microsoft.Web/sites" }] }, { headers });
    }
    if (parsed.pathname === "/api/ai/review" || parsed.pathname === "/api/ai/deploy") {
      agentCalls.push({ path: parsed.pathname, body: JSON.parse(options.body) });
      return Response.json(parsed.pathname.endsWith("/review")
        ? { transport: reviewTransport, review: { score: 30, findings: [] } }
        : {
          source: deploymentSource, format: "bicep", code: "param location string",
          armTemplate: { resources: [{ type: "Microsoft.Web/sites" }] },
          resourceMappings: [{ nodeId: "live-smoke-web", resourceType: "Microsoft.Web/sites", resourceName: "app" }],
        });
    }
    throw new Error(`Unexpected smoke request: ${method} ${parsed.pathname}`);
  };
  return {
    calls, agentCalls, publications,
    get logoutCount() { return logoutCount; },
    get waits() { return waits; },
    run: (options = {}) => runLiveCsaSmoke({
      baseUrl: "https://diagram.example", username: "smoke-test", password: "test-only",
      fetchImpl, wait: async () => { waits++; }, ...options,
    }),
  };
}

test("generic diagram model never substitutes for unavailable review/deployment agents", async () => {
  const smoke = harness();
  const report = await smoke.run();
  assert.match(report.reviewAgent, /unavailable.*not exercised/);
  assert.match(report.deploymentAgent, /unavailable.*not exercised/);
  assert.match(report.templatePublication, /not exercised/);
  assert.equal(smoke.agentCalls.length, 0);
  assert.equal(smoke.publications.length, 0);
  assert.ok(report.checks.includes("publication consent enforcement"));
  assert.equal(smoke.logoutCount, 1);
});

test("configured agent status is not reported as successful invocation without explicit opt-in", async () => {
  const smoke = harness({ capabilities: { diagramConfigured: false, reviewAgentConfigured: true, deploymentAgentConfigured: true } });
  const report = await smoke.run();
  assert.equal(report.reviewAgent, "configured, not invoked");
  assert.equal(report.deploymentAgent, "configured, not invoked");
  assert.equal(smoke.agentCalls.length, 0);
  assert.equal(smoke.publications.length, 0);
});

test("required missing agents fail acceptance explicitly and still sign out", async () => {
  const smoke = harness();
  await assert.rejects(smoke.run({ requireAgents: true }), /Required Foundry capabilities unavailable/);
  assert.equal(smoke.agentCalls.length, 0);
  assert.equal(smoke.logoutCount, 1);
});

test("opted-in named agent checks are independent and require the Foundry result contract", async () => {
  const partial = harness({ capabilities: { reviewAgentConfigured: true, deploymentAgentConfigured: false } });
  const result = await partial.run({ invokeAgents: true });
  assert.match(result.reviewAgent, /passed.*named Foundry/);
  assert.match(result.deploymentAgent, /unavailable/);
  assert.deepEqual(partial.agentCalls.map((call) => call.path), ["/api/ai/review"]);
  assert.equal(partial.agentCalls[0].body.source, "canvas");
  assert.deepEqual(partial.agentCalls[0].body.payload, SMOKE_ARCHITECTURE);
  assert.match(partial.agentCalls[0].body.context, /Synthetic smoke evidence/);
  assert.equal("businessContext" in partial.agentCalls[0].body, false);

  const ready = { reviewAgentConfigured: true, deploymentAgentConfigured: true };
  const both = harness({ capabilities: ready });
  const report = await both.run({ invokeAgents: true });
  assert.match(report.deploymentAgent, /passed.*nothing published or deployed/);
  assert.equal(both.agentCalls.length, 2);
  assert.equal(both.publications.length, 0);
  await assert.rejects(harness({ capabilities: ready, reviewTransport: "chat-completion" }).run({ invokeAgents: true }), /named Foundry agent/);
  await assert.rejects(harness({ capabilities: ready, deploymentSource: "offline" }).run({ invokeAgents: true }), /named-agent draft/);
});

test("template publication is opt-in and uses explicit offline source and consent with anonymous retrieval", async () => {
  const smoke = harness();
  const report = await smoke.run({ publishTemplate: true });
  assert.deepEqual(smoke.publications, [{ source: "offline", consent: true, payload: SMOKE_ARCHITECTURE }]);
  const retrieval = smoke.calls.find((call) => call.path.includes("token=test-only"));
  assert.equal(retrieval.cookie, null);
  assert.equal(smoke.agentCalls.length, 0);
  assert.match(report.templatePublication, /explicit offline source and consent/);
  assert.match(report.templatePublication, /no Azure deployment/);
});

test("smoke refuses a foreign template origin and obsolete status contracts", async () => {
  await assert.rejects(harness({ publicationOrigin: "https://untrusted.invalid" }).run({ publishTemplate: true }), /Template origin does not match/);
  const obsolete = harness({ capabilities: { diagramConfigured: true, architectureImageReview: true } });
  await assert.rejects(obsolete.run(), /generic model flag is not sufficient/);
  assert.equal(obsolete.waits, 17);
  assert.equal(obsolete.logoutCount, 1);
});
