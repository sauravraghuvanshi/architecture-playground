import assert from "node:assert/strict";
import test from "node:test";
import { randomUUID } from "node:crypto";
import { existsSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { delimiter, join } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { generateArchitectureCode } from "../components/diagrammatic/csa/architecture-codegen.ts";

const node = (id, iconId) => ({ id, kind: "icon", label: id, iconId });
const simple = { nodes: [node("app", "azure/application/application-service")], edges: [] };
const full = { nodes: [...simple.nodes, node("sql", "azure/databases/sql-database"), node("apim", "azure/integration/api-management")], edges: [] };
const containerApp = { nodes: [node("orchestrator", "azure/application/container-app")], edges: [] };
const containerInputs = {
  CONTAINER_APP_ENVIRONMENT_ID: "/subscriptions/11111111-1111-1111-1111-111111111111/resourceGroups/existing/providers/Microsoft.App/managedEnvironments/reviewed",
  CONTAINER_APP_IMAGE: "example.invalid/reviewed-image:v1",
};
const harness = fileURLToPath(new URL("./test-preview-powershell.ps1", import.meta.url));
const pwsh = (process.env.PATH || "").split(delimiter)
  .map((directory) => join(directory, process.platform === "win32" ? "pwsh.exe" : "pwsh"))
  .find((path) => existsSync(path));
assert.ok(pwsh, "PowerShell 7 (pwsh) must be installed separately to run the preview suite.");
const requiredEnv = {
  AZURE_SUBSCRIPTION_ID: "11111111-1111-1111-1111-111111111111",
  AZURE_RESOURCE_GROUP: "existing-customer-group",
  AZURE_SUFFIX: "review",
  SQL_ADMIN_OBJECT_ID: "33333333-3333-3333-3333-333333333333",
  SQL_ADMIN_LOGIN: "Customer SQL Administrators",
  APIM_PUBLISHER_EMAIL: "owner@example.test",
};

function execute(scenario = "success", { payload = full, env = {}, template = "targetScope = 'resourceGroup'\n" } = {}) {
  // ESLint ignores node_modules, so concurrent lint cannot traverse roots being cleaned up.
  const directory = join(process.cwd(), "node_modules", ".cache", `.test-powershell-preview-${randomUUID()}`);
  mkdirSync(directory, { recursive: true });
  try {
    const result = generateArchitectureCode(payload, "powershell");
    const previewPath = join(directory, "preview.ps1");
    writeFileSync(previewPath, result.output);
    if (template !== null) writeFileSync(join(directory, "main.bicep"), template);
    const environment = {};
    for (const name of ["SystemRoot", "WINDIR", "ComSpec", "PATHEXT"]) {
      if (process.env[name]) environment[name] = process.env[name];
    }
    Object.assign(environment, requiredEnv, env, {
      PATH: directory, HOME: directory, USERPROFILE: directory,
      TMP: directory, TEMP: directory, TMPDIR: directory,
      AZURE_CONFIG_DIR: join(directory, "azure-config"),
      PSModulePath: directory,
    });
    const child = spawnSync(pwsh, ["-NoLogo", "-NoProfile", "-NonInteractive", "-File", harness, "-PreviewPath", previewPath, "-Scenario", scenario], {
      cwd: directory, encoding: "utf8", env: environment, timeout: 20_000,
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
    location: "westeurope", environmentName: "review",
    sqlAdminObjectId: requiredEnv.SQL_ADMIN_OBJECT_ID,
    sqlAdminLogin: requiredEnv.SQL_ADMIN_LOGIN, publisherEmail: requiredEnv.APIM_PUBLISHER_EMAIL,
  });

  test("Container Apps PowerShell passes explicit existing-environment and image inputs without resource writes", () => {
    const result = execute("success", { payload: containerApp, env: containerInputs });
    assert.equal(result.error, null);
    assert.deepEqual(result.calls.at(-1).parameters, {
      location: "westeurope", environmentName: "review",
      containerAppEnvironmentId: containerInputs.CONTAINER_APP_ENVIRONMENT_ID,
      containerAppImage: containerInputs.CONTAINER_APP_IMAGE,
    });
  });

  test("Container Apps PowerShell stops missing or malformed prerequisites before context reads", () => {
    for (const env of [
      {}, { ...containerInputs, CONTAINER_APP_ENVIRONMENT_ID: "" },
      { ...containerInputs, CONTAINER_APP_ENVIRONMENT_ID: "/providers/Microsoft.Web/sites/not-environment" },
      { ...containerInputs, CONTAINER_APP_IMAGE: "" }, { ...containerInputs, CONTAINER_APP_IMAGE: " " },
    ]) {
      const result = execute("success", { payload: containerApp, env });
      assert.ok(result.error);
      assert.deepEqual(result.calls, []);
    }
  });
  assert.equal(result.commands.some(command => /^(New|Set|Remove|Connect|Install|Invoke)-Az/.test(command)), false);
  assert.doesNotMatch(result.output, /rerun with -Confirm before deployment|Get-Random|New-AzResourceGroup/);
});

test("all local preflight failures stop before Azure context or resource reads", () => {
  const cases = [
    { template: null }, { template: "" },
    { env: { AZURE_SUBSCRIPTION_ID: "" } }, { env: { AZURE_SUBSCRIPTION_ID: "not-a-guid" } },
    { env: { AZURE_SUBSCRIPTION_ID: "00000000-0000-0000-0000-000000000000" } },
    { env: { AZURE_RESOURCE_GROUP: " " } }, { env: { AZURE_SUFFIX: "" } },
    { env: { SQL_ADMIN_OBJECT_ID: "" } }, { env: { SQL_ADMIN_OBJECT_ID: "invalid" } },
    { env: { SQL_ADMIN_OBJECT_ID: "00000000-0000-0000-0000-000000000000" } },
    { env: { APIM_PUBLISHER_EMAIL: "" } }, { env: { APIM_PUBLISHER_EMAIL: "invalid" } },
    { env: { APIM_PUBLISHER_EMAIL: "owner@example" } },
    { env: { APIM_PUBLISHER_EMAIL: "Owner <owner@example.test>" } },
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
  assert.deepEqual(result.calls.at(-1).parameters, { location: "centralindia", environmentName: "review" });
});

for (const suffix of ["a", "ab", "abcdefghijk", "Review", "abC", "1ab", "ab-", "ab_", "a.b", "éab", " abc", "abc ", "abc\n", "$(id)"]) {
  test(`PowerShell rejects invalid namespace ${JSON.stringify(suffix)} before context or resource reads`, () => {
    const result = execute("success", { env: { AZURE_SUFFIX: suffix } });
    assert.match(result.error, /3-10 character lowercase letter\/digit namespace/);
    assert.deepEqual(result.calls, []);
  });
}

for (const suffix of ["abc", "a01", "a123456789"]) {
  test(`PowerShell accepts valid namespace ${suffix} and passes it literally`, () => {
    const result = execute("success", { payload: simple, env: { AZURE_SUFFIX: suffix } });
    assert.equal(result.error, null);
    assert.deepEqual(result.calls.at(-1).parameters, { location: "westeurope", environmentName: suffix });
  });
}

test("PowerShell supplies the SQL administrator display-name default without requiring a secret", () => {
  const result = execute("success", { env: { SQL_ADMIN_LOGIN: "" } });
  assert.equal(result.error, null);
  assert.equal(result.calls.at(-1).parameters.sqlAdminLogin, "Azure SQL Administrators");
});

test("unsupported diagrams cannot contact Azure under a preview-success label", () => {
  const result = execute("success", { payload: { nodes: [], edges: [] } });
  assert.ok(result.error);
  assert.deepEqual(result.calls, []);
});
