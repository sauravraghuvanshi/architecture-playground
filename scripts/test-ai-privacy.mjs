import assert from "node:assert/strict";
import test from "node:test";
import { getAiConfig } from "../lib/ai.ts";
import { getImageAiConfig, getImageAiProxyBaseUrl } from "../lib/ai-image-config.ts";
import { describeAiPrivacy } from "../lib/ai-privacy.ts";
import { aiPrivacySchema } from "../lib/ai-privacy-contract.ts";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import ts from "typescript";

const keys = [
  "NODE_ENV", "DIAGRAMMATIC_AI_PROXY_URL", "AZURE_OPENAI_ENDPOINT", "AZURE_OPENAI_API_KEY", "AZURE_OPENAI_DEPLOYMENT",
  "AZURE_OPENAI_IMAGE_ENDPOINT", "AZURE_OPENAI_IMAGE_API_KEY", "AZURE_OPENAI_IMAGE_DEPLOYMENT",
  "AZURE_AI_PROJECT_ENDPOINT", "AZURE_AI_REVIEW_AGENT_NAME", "AZURE_AI_DEPLOY_AGENT_NAME",
];
function environment(overrides, run) {
  const before = Object.fromEntries(keys.map((key) => [key, process.env[key]]));
  for (const key of keys) delete process.env[key];
  Object.assign(process.env, overrides);
  try { return run(); } finally {
    for (const key of keys) {
      if (before[key] === undefined) delete process.env[key]; else process.env[key] = before[key];
    }
  }
}

test("development and production never infer a public-demo AI destination", () => {
  for (const NODE_ENV of ["development", "production", "test"]) environment({ NODE_ENV }, () => {
    assert.equal(getImageAiProxyBaseUrl(), null);
    assert.equal(getImageAiConfig(), null);
    assert.equal(getAiConfig(), null);
    const privacy = describeAiPrivacy();
    assert.ok(Object.values(privacy.destinations).every((item) => !item.configured && item.origin === null));
  });
});

test("image proxy selection is explicit and validates the complete configured origin", () => {
  for (const configured of ["", "off", "disabled", "none", "http://example.com", "https://user:secret@example.com", "https://example.com/?key=secret", "https://example.com/#secret", "https://example.com/api", "not-a-url"]) {
    environment({ NODE_ENV: "production", DIAGRAMMATIC_AI_PROXY_URL: configured }, () => assert.equal(getImageAiProxyBaseUrl(), null, configured));
  }
  environment({ NODE_ENV: "production", DIAGRAMMATIC_AI_PROXY_URL: "https://approved.example/" }, () => {
    assert.equal(getImageAiProxyBaseUrl(), "https://approved.example");
    assert.equal(describeAiPrivacy().destinations.image.transport, "configured-proxy");
    assert.match(describeAiPrivacy().destinations.image.retention, /cannot be verified/);
  });
  environment({ NODE_ENV: "development", DIAGRAMMATIC_AI_PROXY_URL: "http://127.0.0.1:4001" }, () => assert.equal(getImageAiProxyBaseUrl(), "http://127.0.0.1:4001"));
  environment({ NODE_ENV: "production", DIAGRAMMATIC_AI_PROXY_URL: "http://127.0.0.1:4001" }, () => assert.equal(getImageAiProxyBaseUrl(), null));
});

test("disclosure shows selected origins/data/retention without keys, deployment names or project paths", () => {
  environment({
    NODE_ENV: "production", AZURE_OPENAI_ENDPOINT: "https://chat-fixture.openai.azure.com",
    AZURE_OPENAI_API_KEY: "SECRET-CHAT-KEY", AZURE_OPENAI_DEPLOYMENT: "PRIVATE-DEPLOYMENT",
    AZURE_OPENAI_IMAGE_ENDPOINT: "https://image-fixture.openai.azure.com",
    AZURE_OPENAI_IMAGE_API_KEY: "SECRET-IMAGE-KEY", AZURE_OPENAI_IMAGE_DEPLOYMENT: "PRIVATE-IMAGE",
    DIAGRAMMATIC_AI_PROXY_URL: "https://unused-proxy.example",
    AZURE_AI_PROJECT_ENDPOINT: "https://fixture.services.ai.azure.com/api/projects/PRIVATE-PROJECT",
    AZURE_AI_REVIEW_AGENT_NAME: "private-review", AZURE_AI_DEPLOY_AGENT_NAME: "private-deploy",
  }, () => {
    const privacy = aiPrivacySchema.parse(describeAiPrivacy());
    assert.equal(privacy.destinations.chat.origin, "https://chat-fixture.openai.azure.com");
    assert.equal(privacy.destinations.image.origin, "https://image-fixture.openai.azure.com");
    assert.equal(privacy.destinations.review.origin, "https://fixture.services.ai.azure.com");
    assert.match(privacy.destinations.review.retention, /not a zero-retention/);
    assert.doesNotMatch(JSON.stringify(privacy), /SECRET-|PRIVATE-|private-review|private-deploy|unused-proxy/);
  });
});

test("misconfigured direct endpoints do not disclose credentials or become valid destinations", () => {
  environment({ NODE_ENV: "production", AZURE_OPENAI_ENDPOINT: "https://user:secret@fixture.openai.azure.com", AZURE_OPENAI_API_KEY: "key", AZURE_OPENAI_DEPLOYMENT: "model" }, () => {
    assert.equal(getAiConfig(), null);
    assert.equal(describeAiPrivacy().destinations.chat.origin, null);
  });
});

test("privacy API is read-only and disables caching without calling a provider", async () => {
  const source = readFileSync(new URL("../app/api/ai/privacy/route.ts", import.meta.url), "utf8");
  const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const exports = {};
  const fixture = environment({}, () => describeAiPrivacy());
  vm.runInNewContext(compiled, { exports, require: (name) => {
    if (name === "next/server") return { NextResponse: { json: (data, options) => Response.json(data, options) } };
    if (name === "@/lib/ai-privacy") return { describeAiPrivacy: () => fixture };
    throw new Error(`Unexpected dependency ${name}`);
  } });
  const response = exports.GET();
  assert.equal(response.headers.get("Cache-Control"), "no-store");
  assert.deepEqual(await response.json(), fixture);
});
