import assert from "node:assert/strict";
import test from "node:test";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { generateArchitectureCode } from "../components/diagrammatic/csa/architecture-codegen.ts";

const node = (id, iconId) => ({ id, kind: "icon", label: id, iconId });
const simple = { nodes: [node("app", "azure/application/application-service")], edges: [] };
const full = { nodes: [...simple.nodes, node("sql", "azure/databases/sql-database"), node("apim", "azure/integration/api-management")], edges: [] };
const harness = fileURLToPath(new URL("./test-preview-powershell.ps1", import.meta.url));
const requiredEnv = {
  AZURE_SUBSCRIPTION_ID: "11111111-1111-1111-1111-111111111111",
  AZURE_RESOURCE_GROUP: "existing-customer-group",
  AZURE_SUFFIX: "review",
  SQL_ADMIN_OBJECT_ID: "33333333-3333-3333-3333-333333333333",
  SQL_ADMIN_LOGIN: "Customer SQL Administrators",
  APIM_PUBLISHER_EMAIL: "owner@example.test",
};

function execute(scenario = "success", { payload = full, env = {}, template = "targetScope = 'resourceGroup'\n" } = {}) {
  const directory = mkdtempSync(join(tmpdir(), "diagrammatic-preview-test-"));
  try {
    const result = generateArchitectureCode(payload, "powershell");
    const previewPath = join(directory, "preview.ps1");
    writeFileSync(previewPath, result.output);
    if (template !== null) writeFileSync(join(directory, "main.bicep"), template);
    const environment = { ...process.env };
    for (const name of Object.keys(environment)) {
      if (/^(AZURE_|SQL_ADMIN_|APIM_)/.test(name)) delete environment[name];
    }
    Object.assign(environment, requiredEnv, env);
    const child = spawnSync("pwsh", ["-NoLogo", "-NoProfile", "-NonInteractive", "-File", harness, "-PreviewPath", previewPath, "-Scenario", scenario], {
      encoding: "utf8", env: environment, timeout: 20_000,
    });
    assert.ifError(child.error);
    assert.equal(child.status, 0, child.stderr || child.stdout);
    const observed = JSON.parse(child.stdout.trim().split(/\r?\n/).at(-1));
    assert.deepEqual(observed.parseErrors, []);
    assert.equal(observed.calls.some(call => call.command.startsWith("FORBIDDEN:")), false, JSON.stringify(observed));
    return { ...observed, output: result.output, filename: result.filename };
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
}

test("offline PowerShell uses only a read-only What-If API against the explicitly checked subscription and group", () => {
  const result = execute();
  assert.equal(result.error, null);
  assert.equal(result.filename, "preview.ps1");
  assert.deepEqual(result.calls.map(call => call.command), ["Get-AzContext", "Get-AzResourceGroup", "Get-AzResourceGroupDeploymentWhatIfResult"]);
  const preview = result.calls.at(-1);
  assert.equal(preview.group, requiredEnv.AZURE_RESOURCE_GROUP);
  assert.equal(preview.mode, "Incremental");
  assert.equal(preview.skipPrompt, true);
  assert.deepEqual(preview.parameters, {
    location: "westeurope", environmentName: "csa-review",
    sqlAdminObjectId: requiredEnv.SQL_ADMIN_OBJECT_ID,
    sqlAdminLogin: requiredEnv.SQL_ADMIN_LOGIN, publisherEmail: requiredEnv.APIM_PUBLISHER_EMAIL,
  });
  assert.equal(result.commands.some(command => /^(New|Set|Remove|Connect|Install|Invoke)-Az/.test(command)), false);
  assert.doesNotMatch(result.output, /rerun with -Confirm before deployment|Get-Random|New-AzResourceGroup/);
});

test("all local preflight failures stop before Azure context or resource reads", () => {
  const cases = [
    { template: null }, { template: "" },
    { env: { AZURE_SUBSCRIPTION_ID: "" } }, { env: { AZURE_SUBSCRIPTION_ID: "not-a-guid" } },
    { env: { AZURE_RESOURCE_GROUP: " " } }, { env: { AZURE_SUFFIX: "" } },
    { env: { SQL_ADMIN_OBJECT_ID: "" } }, { env: { SQL_ADMIN_OBJECT_ID: "invalid" } },
    { env: { APIM_PUBLISHER_EMAIL: "" } }, { env: { APIM_PUBLISHER_EMAIL: "invalid" } },
  ];
  for (const input of cases) {
    const result = execute("success", input);
    assert.ok(result.error, JSON.stringify(input));
    assert.deepEqual(result.calls, [], JSON.stringify(input));
  }
  for (const scenario of ["missing-command", "missing-bicep"]) {
    const result = execute(scenario);
    assert.ok(result.error);
    assert.deepEqual(result.calls, []);
  }
});

test("missing or mismatched login never signs in or switches subscription automatically", () => {
  for (const scenario of ["no-context", "wrong-subscription"]) {
    const result = execute(scenario);
    assert.ok(result.error);
    assert.deepEqual(result.calls.map(call => call.command), ["Get-AzContext"]);
  }
});

test("missing resource groups, access denial and provider failure remain errors without deployment fallback", () => {
  for (const scenario of ["missing-group", "group-error", "preview-error", "preview-failed-status"]) {
    const result = execute(scenario);
    assert.ok(result.error);
    assert.equal(result.calls.filter(call => call.command === "Get-AzResourceGroupDeploymentWhatIfResult").length, scenario.startsWith("preview-") ? 1 : 0);
  }
});

test("PowerShell WhatIf dry run cancels remote reads and preview requests", () => {
  const result = execute("cancel");
  assert.equal(result.error, null);
  assert.deepEqual(result.calls.map(call => call.command), ["Get-AzContext"]);
});

test("an unanswered confirmation cannot fall through to any remote operation", () => {
  const result = execute("confirmation-unavailable");
  assert.match(result.error, /NonInteractive|confirmation|ShouldProcess/i);
  assert.deepEqual(result.calls.map(call => call.command), ["Get-AzContext"]);
});

test("simple previews do not require unrelated SQL or APIM inputs and allow an explicit location", () => {
  const result = execute("success", { payload: simple, env: { SQL_ADMIN_OBJECT_ID: "", APIM_PUBLISHER_EMAIL: "", AZURE_LOCATION: "centralindia" } });
  assert.equal(result.error, null);
  assert.deepEqual(result.calls.at(-1).parameters, { location: "centralindia", environmentName: "csa-review" });
});

test("unsupported diagrams cannot contact Azure under a preview-success label", () => {
  const result = execute("success", { payload: { nodes: [], edges: [] } });
  assert.ok(result.error);
  assert.deepEqual(result.calls, []);
});
