import assert from "node:assert/strict";
import test from "node:test";
import { randomUUID } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { isAbsolute, join, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { generateArchitectureCode } from "../components/diagrammatic/csa/architecture-codegen.ts";

const bash = process.env.BASH_CLI || (process.platform === "win32" ? "C:\\Program Files\\Git\\bin\\bash.exe" : "/bin/bash");
assert.ok(isAbsolute(bash) && existsSync(bash), "BASH_CLI must point to an installed Bash executable using an absolute path.");
const node = (id, iconId) => ({ id, kind: "icon", label: id, iconId });
const app = node("app", "azure/application/application-service");
const sql = node("sql", "azure/databases/sql-database");
const apim = node("apim", "azure/integration/api-management");
const graph = (...nodes) => ({ nodes, edges: [] });
const simple = graph(app);
const full = graph(app, sql, apim);
const subscription = "abcdefab-1234-5678-9012-abcdefabcdef";
const requiredEnv = {
  AZURE_SUBSCRIPTION_ID: subscription,
  AZURE_RESOURCE_GROUP: "existing-customer-group",
  AZURE_SUFFIX: "review",
  SQL_ADMIN_OBJECT_ID: "33333333-3333-3333-3333-333333333333",
  SQL_ADMIN_LOGIN: "Customer SQL Administrators",
  APIM_PUBLISHER_EMAIL: "owner@example.test",
};
const compiledTemplate = '{"$schema":"hermetic-compiled-template","resources":[]}';
const authVariables = [
  "AZURE_CLIENT_ID", "AZURE_CLIENT_SECRET", "AZURE_TENANT_ID", "AZURE_CLIENT_CERTIFICATE_PATH",
  "AZURE_FEDERATED_TOKEN_FILE", "AZURE_USERNAME", "AZURE_PASSWORD", "AZURE_ACCESS_TOKEN",
  "ARM_CLIENT_ID", "ARM_CLIENT_SECRET", "ARM_TENANT_ID", "ARM_SUBSCRIPTION_ID", "ARM_OIDC_TOKEN",
  "MSI_ENDPOINT", "MSI_SECRET", "IDENTITY_ENDPOINT", "IDENTITY_HEADER",
  "ACTIONS_ID_TOKEN_REQUEST_TOKEN", "ACTIONS_ID_TOKEN_REQUEST_URL", "SYSTEM_ACCESSTOKEN",
];
const shellPath = (path) => process.platform === "win32"
  ? resolve(path).replaceAll("\\", "/").replace(/^([A-Za-z]):/, (_, drive) => `/${drive.toLowerCase()}`)
  : resolve(path);
const stubHeader = `#!/bin/bash
set -euo pipefail
[[ "$PATH" == "$TEST_STUB_PATH" ]] || { printf '%s\\n' "PATH escaped the isolated stubs" >&2; exit 95; }
for name in ${authVariables.join(" ")}; do
  [[ ! -v "$name" ]] || { printf '%s\\n' "Inherited authentication reached a mock" >&2; exit 96; }
done
printf '%s\\0' "\${0##*/}" "$@" >> "$TEST_CALLS"
printf '\\0' >> "$TEST_CALLS"
`;
const azStub = `${stubHeader}
case "\${1:-} \${2:-}" in
  "account show")
    [[ "$TEST_SCENARIO" != "no-context" ]] || { printf '%s\\n' "Synthetic missing login" >&2; exit 11; }
    case "$TEST_SCENARIO" in
      wrong-subscription) printf '%s\\n' "22222222-2222-2222-2222-222222222222" ;;
      empty-subscription) printf '\\n' ;;
      uppercase-subscription) printf '%s\\n' "\${AZURE_SUBSCRIPTION_ID^^}" ;;
      *) printf '%s\\n' "$AZURE_SUBSCRIPTION_ID" ;;
    esac
    ;;
  "group show")
    [[ "$TEST_SCENARIO" != "missing-group" && "$TEST_SCENARIO" != "group-error" ]] || { printf '%s\\n' "Synthetic group lookup failure" >&2; exit 12; }
    if [[ "$TEST_SCENARIO" == "empty-group-location" ]]; then printf '\\n'; else printf '%s\\n' "westeurope"; fi
    ;;
  "deployment group")
    action="\${3:-}"
    [[ "$action" == "what-if" || "$action" == "create" ]] || { printf '%s\\n' "FORBIDDEN deployment command" >&2; exit 90; }
    template=""
    for ((index=1; index <= $#; index++)); do
      if [[ "\${!index}" == "--template-file" ]]; then ((index+=1)); template="\${!index}"; break; fi
    done
    [[ -f "$template" && "$(< "$template")" == "$TEST_COMPILED_TEMPLATE" ]] || { printf '%s\\n' "Expected the locally compiled template" >&2; exit 91; }
    if [[ "$action" == "what-if" ]]; then
      [[ "$TEST_SCENARIO" != "preview-error" ]] || { printf '%s\\n' "Synthetic What-If failure" >&2; exit 13; }
      printf '%s\\n' "preview-succeeded" > "$TEST_PREVIEW_MARKER"
    else
      [[ -f "$TEST_PREVIEW_MARKER" ]] || { printf '%s\\n' "FORBIDDEN deployment before successful preview" >&2; exit 92; }
      [[ "$TEST_SCENARIO" != "deploy-error" ]] || { printf '%s\\n' "Synthetic deployment failure" >&2; exit 14; }
    fi
    ;;
  *) printf '%s\\n' "FORBIDDEN Azure command: $*" >&2; exit 99 ;;
esac
`;
const bicepStub = `${stubHeader}
[[ $# == 3 && "$1" == "build" && "$3" == "--stdout" && -s "$2" ]] || { printf '%s\\n' "Unexpected Bicep invocation" >&2; exit 98; }
[[ "$TEST_SCENARIO" != "compile-error" ]] || { printf '%s\\n' "Synthetic Bicep compiler failure" >&2; exit 10; }
printf '%s\\n' "$TEST_COMPILED_TEMPLATE"
`;

function execute({ scenario = "success", payload = full, env = {}, args = [], template, syntaxOnly = false } = {}) {
  // ESLint ignores node_modules, so concurrent lint cannot traverse roots being cleaned up.
  const directory = join(process.cwd(), "node_modules", ".cache", `.test-azure-cli-${randomUUID()}`);
  const stubs = join(directory, "stubs");
  const exported = join(directory, "export with spaces");
  mkdirSync(stubs, { recursive: true });
  mkdirSync(exported);
  try {
    const result = generateArchitectureCode(payload, "azure-cli");
    const script = join(exported, result.filename);
    const log = join(directory, "calls.bin");
    const compiled = join(directory, "compiled.json");
    const bashEnvironment = join(directory, "isolated-bash-env.sh");
    writeFileSync(script, result.output);
    // Git for Windows prepends system/user bin paths even with --noprofile --norc.
    writeFileSync(bashEnvironment, 'export PATH="$TEST_STUB_PATH"\n');
    if (template !== null) {
      writeFileSync(join(exported, "main.bicep"), template ?? generateArchitectureCode(payload, "bicep").output);
    }
    const writeStub = (name, body) => writeFileSync(join(stubs, name), body, { mode: 0o700 });
    if (scenario !== "missing-az") writeStub("az", azStub);
    if (scenario !== "missing-bicep") writeStub("bicep", bicepStub);
    // Only these utilities are reachable; neither the host Azure CLI nor its config is on PATH.
    writeStub("dirname", "#!/bin/bash\nexec /usr/bin/dirname \"$@\"\n");
    writeStub("rm", "#!/bin/bash\nexec /usr/bin/rm \"$@\"\n");
    writeStub("mktemp", "#!/bin/bash\nset -euo pipefail\n: > \"$TEST_COMPILED_PATH\"\nprintf '%s\\n' \"$TEST_COMPILED_PATH\"\n");
    const environment = {};
    for (const key of ["SystemRoot", "WINDIR", "ComSpec", "PATHEXT"]) {
      if (process.env[key]) environment[key] = process.env[key];
    }
    Object.assign(environment, requiredEnv, env, {
      PATH: shellPath(stubs),
      BASH_ENV: shellPath(bashEnvironment),
      TEST_STUB_PATH: shellPath(stubs),
      HOME: shellPath(directory),
      USERPROFILE: directory,
      TMP: shellPath(directory), TEMP: shellPath(directory), TMPDIR: shellPath(directory),
      AZURE_CONFIG_DIR: shellPath(join(directory, "azure-config")),
      TEST_CALLS: shellPath(log),
      TEST_SCENARIO: scenario,
      TEST_COMPILED_PATH: shellPath(compiled),
      TEST_COMPILED_TEMPLATE: compiledTemplate,
      TEST_PREVIEW_MARKER: shellPath(join(directory, "preview-succeeded")),
    });
    const child = spawnSync(bash, ["--noprofile", "--norc", ...(syntaxOnly ? ["-n"] : []), shellPath(script), ...args], {
      cwd: directory, encoding: "utf8", env: environment, timeout: 20_000,
    });
    assert.ifError(child.error);
    assert.equal(child.signal, null, child.stderr);
    const calls = existsSync(log)
      ? readFileSync(log, "utf8").split("\0\0").filter(Boolean).map((call) => call.split("\0"))
      : [];
    for (const call of calls) {
      const command = call.slice(0, call[0] === "bicep" ? 2 : call[1] === "deployment" ? 4 : 3).join(" ");
      assert.ok(["bicep build", "az account show", "az group show", "az deployment group what-if", "az deployment group create"].includes(command), `Forbidden command: ${JSON.stringify(call)}`);
    }
    assert.doesNotMatch(child.stderr, /FORBIDDEN/);
    assert.equal(existsSync(compiled), false, "Compiled scratch output must be removed on success and failure.");
    return { ...child, calls, output: result.output, filename: result.filename, templatePath: shellPath(join(exported, "main.bicep")), compiledPath: shellPath(compiled) };
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
}

const commands = (result) => result.calls.map((call) => call.slice(0, call[0] === "bicep" ? 2 : call[1] === "deployment" ? 4 : 3).join(" "));
const preflightCommands = ["bicep build", "az account show", "az group show"];
const successfulCommands = [...preflightCommands, "az deployment group what-if"];
const assertFailure = (result, expectedCommands, message) => {
  assert.notEqual(result.status, 0, "Expected failure rather than success.");
  assert.match(result.stderr, message);
  assert.deepEqual(commands(result), expectedCommands);
  assert.equal(result.calls.some((call) => call[0] === "az" && call[3] === "create"), false);
};
const flag = (call, name) => {
  const index = call.indexOf(name);
  assert.ok(index >= 0, `Missing ${name}: ${JSON.stringify(call)}`);
  assert.equal(call.lastIndexOf(name), index, `Duplicate ${name}`);
  return call[index + 1];
};
const parameters = (call) => call.slice(call.indexOf("--parameters") + 1);

for (const [name, payload] of [["app", simple], ["SQL", graph(sql)], ["APIM", graph(apim)], ["combined", full]]) {
  test(`generated ${name} Bash passes the real Bash parser without executing tools`, () => {
    const result = execute({ payload, syntaxOnly: true });
    assert.equal(result.status, 0, result.stderr);
    assert.deepEqual(result.calls, []);
  });
}

test("Bash previews by default, compiles the adjacent Bicep and pins every scoped request to the checked subscription", () => {
  const result = execute();
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.filename, "deploy.sh");
  assert.deepEqual(commands(result), successfulCommands);
  assert.deepEqual(result.calls[0], ["bicep", "build", result.templatePath, "--stdout"]);
  assert.deepEqual(result.calls[1], ["az", "account", "show", "--query", "id", "--output", "tsv"]);
  assert.deepEqual(result.calls[2], ["az", "group", "show", "--subscription", subscription, "--name", requiredEnv.AZURE_RESOURCE_GROUP, "--query", "location", "--output", "tsv"]);
  const preview = result.calls.at(-1);
  assert.equal(flag(preview, "--subscription"), subscription);
  assert.equal(flag(preview, "--resource-group"), requiredEnv.AZURE_RESOURCE_GROUP);
  assert.equal(flag(preview, "--name"), "diagrammatic-review");
  assert.equal(flag(preview, "--mode"), "Incremental");
  assert.equal(flag(preview, "--template-file"), result.compiledPath);
  assert.deepEqual(parameters(preview), [
    "environmentName=review", "location=westeurope",
    `sqlAdminObjectId=${requiredEnv.SQL_ADMIN_OBJECT_ID}`,
    `sqlAdminLogin=${requiredEnv.SQL_ADMIN_LOGIN}`,
    `publisherEmail=${requiredEnv.APIM_PUBLISHER_EMAIL}`,
  ]);
  assert.match(result.stdout, /Preview only\. Nothing deployed/);
});

test("--deploy is the only write opt-in and deploys the same template and parameters only after successful What-If", () => {
  const result = execute({ args: ["--deploy"] });
  assert.equal(result.status, 0, result.stderr);
  assert.deepEqual(commands(result), [...successfulCommands, "az deployment group create"]);
  assert.deepEqual(result.calls.at(-1), result.calls.at(-2).map((argument, index) => index === 3 ? "create" : argument));
  assert.equal(flag(result.calls.at(-1), "--subscription"), subscription);
  assert.doesNotMatch(result.stdout, /Nothing deployed/);
});

for (const args of [["--yes"], ["--Deploy"], ["deploy"], ["--deploy=true"], ["--deploy", "--deploy"], ["", "--deploy"]]) {
  test(`invalid deploy invocation ${JSON.stringify(args)} fails before any tool executes`, () => {
    assertFailure(execute({ args }), [], /Usage: deploy\.sh \[--deploy\]/);
  });
}

for (const [name, template] of [["missing", null], ["empty", ""]]) {
  test(`${name} companion Bicep prevents preview and explicit deployment`, () => {
    assertFailure(execute({ template, args: ["--deploy"] }), [], /matching nonempty main\.bicep/);
  });
}

for (const [name, value, message] of [
  ["AZURE_SUBSCRIPTION_ID", "", /Set AZURE_SUBSCRIPTION_ID/],
  ["AZURE_SUBSCRIPTION_ID", "not-a-guid", /nonzero GUID/],
  ["AZURE_SUBSCRIPTION_ID", "00000000-0000-0000-0000-000000000000", /nonzero GUID/],
  ["AZURE_RESOURCE_GROUP", "", /Set AZURE_RESOURCE_GROUP/],
  ["AZURE_RESOURCE_GROUP", " \t ", /must not be blank/],
  ["AZURE_SUFFIX", "", /Set AZURE_SUFFIX/],
  ["SQL_ADMIN_OBJECT_ID", "", /Set SQL_ADMIN_OBJECT_ID/],
  ["SQL_ADMIN_OBJECT_ID", "not-a-guid", /nonzero GUID/],
  ["SQL_ADMIN_OBJECT_ID", "00000000-0000-0000-0000-000000000000", /nonzero GUID/],
  ["APIM_PUBLISHER_EMAIL", "", /Set APIM_PUBLISHER_EMAIL/],
  ["APIM_PUBLISHER_EMAIL", "invalid", /email address/],
  ["APIM_PUBLISHER_EMAIL", "owner@example", /email address/],
  ["APIM_PUBLISHER_EMAIL", "owner name@example.test", /email address/],
]) {
  test(`invalid ${name}=${JSON.stringify(value)} fails before compilation or Azure access`, () => {
    assertFailure(execute({ env: { [name]: value }, args: ["--deploy"] }), [], message);
  });
}

for (const suffix of ["a", "ab", "abcdefghijk", "Review", "abC", "1ab", "ab-", "ab_", "a.b", "éab", " abc", "abc ", "abc\n", "$(id)"]) {
  test(`Bash rejects invalid namespace ${JSON.stringify(suffix)} before any Azure access`, () => {
    assertFailure(execute({ env: { AZURE_SUFFIX: suffix }, args: ["--deploy"] }), [], /3-10 lowercase letters\/digits/);
  });
}

for (const suffix of ["abc", "a01", "a123456789"]) {
  test(`Bash preserves valid namespace ${suffix} literally`, () => {
    const result = execute({ payload: simple, env: { AZURE_SUFFIX: suffix } });
    assert.equal(result.status, 0, result.stderr);
    assert.deepEqual(parameters(result.calls.at(-1)), [`environmentName=${suffix}`, "location=westeurope"]);
  });
}

for (const [scenario, expected, message] of [
  ["missing-az", [], /Install Azure CLI separately/],
  ["missing-bicep", [], /Install standalone Bicep CLI separately/],
  ["compile-error", ["bicep build"], /Synthetic Bicep compiler failure/],
  ["no-context", ["bicep build", "az account show"], /Synthetic missing login/],
  ["wrong-subscription", ["bicep build", "az account show"], /does not match AZURE_SUBSCRIPTION_ID/],
  ["empty-subscription", ["bicep build", "az account show"], /does not match AZURE_SUBSCRIPTION_ID/],
  ["missing-group", preflightCommands, /Synthetic group lookup failure/],
  ["group-error", preflightCommands, /Synthetic group lookup failure/],
  ["empty-group-location", preflightCommands, /resource group location is unavailable/],
  ["preview-error", successfulCommands, /Synthetic What-If failure/],
]) {
  test(`${scenario} blocks explicit deployment without sign-in, context switch or resource-group creation`, () => {
    assertFailure(execute({ scenario, args: ["--deploy"] }), expected, message);
  });
}

test("deployment failure propagates without retries or fallback writes", () => {
  const result = execute({ scenario: "deploy-error", args: ["--deploy"] });
  assert.equal(result.status, 14);
  assert.match(result.stderr, /Synthetic deployment failure/);
  assert.deepEqual(commands(result), [...successfulCommands, "az deployment group create"]);
});

test("subscription comparison is case-insensitive without changing the explicitly pinned subscription", () => {
  const result = execute({ scenario: "uppercase-subscription" });
  assert.equal(result.status, 0, result.stderr);
  assert.equal(flag(result.calls.at(-1), "--subscription"), subscription);
});

test("simple Bash does not require SQL/APIM inputs and honors an explicit region", () => {
  const result = execute({ payload: simple, env: { SQL_ADMIN_OBJECT_ID: "", SQL_ADMIN_LOGIN: "", APIM_PUBLISHER_EMAIL: "", AZURE_LOCATION: "centralindia" } });
  assert.equal(result.status, 0, result.stderr);
  assert.deepEqual(parameters(result.calls.at(-1)), ["environmentName=review", "location=centralindia"]);
});

test("SQL-only Bash uses its default administrator label without requiring APIM configuration", () => {
  const result = execute({ payload: graph(sql), env: { SQL_ADMIN_LOGIN: "", APIM_PUBLISHER_EMAIL: "" } });
  assert.equal(result.status, 0, result.stderr);
  assert.deepEqual(parameters(result.calls.at(-1)), [
    "environmentName=review", "location=westeurope",
    `sqlAdminObjectId=${requiredEnv.SQL_ADMIN_OBJECT_ID}`, "sqlAdminLogin=Azure SQL Administrators",
  ]);
});

test("APIM-only Bash does not require SQL configuration", () => {
  const result = execute({ payload: graph(apim), env: { SQL_ADMIN_OBJECT_ID: "", SQL_ADMIN_LOGIN: "" } });
  assert.equal(result.status, 0, result.stderr);
  assert.deepEqual(parameters(result.calls.at(-1)), ["environmentName=review", "location=westeurope", `publisherEmail=${requiredEnv.APIM_PUBLISHER_EMAIL}`]);
});

test("shell metacharacters in a SQL display name remain one literal parameter", () => {
  const label = "Administrators; az login $(az account set) `az group create` * \"quoted\"";
  const result = execute({ env: { SQL_ADMIN_LOGIN: label } });
  assert.equal(result.status, 0, result.stderr);
  assert.deepEqual(commands(result), successfulCommands);
  assert.ok(parameters(result.calls.at(-1)).includes(`sqlAdminLogin=${label}`));
});

test("inherited Azure credentials and shell startup settings never reach the executable mocks", () => {
  const poisoned = [...authVariables, "BASH_ENV", "ENV", "AZURE_CONFIG_DIR"];
  const previous = new Map(poisoned.map((name) => [name, process.env[name]]));
  try {
    for (const name of poisoned) process.env[name] = "synthetic-value-that-must-not-be-inherited";
    const result = execute();
    assert.equal(result.status, 0, result.stderr);
    assert.deepEqual(commands(result), successfulCommands);
  } finally {
    for (const [name, value] of previous) {
      if (value === undefined) delete process.env[name];
      else process.env[name] = value;
    }
  }
});

test("unsupported diagrams emit no executable deployment artifact", () => {
  const result = generateArchitectureCode(graph(), "azure-cli");
  assert.equal(result.output, "");
  assert.match(result.warnings.join("\n"), /No supported Azure service/);
});
