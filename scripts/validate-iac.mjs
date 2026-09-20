import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { generateArchitectureCode, generateArmTemplate } from "../components/diagrammatic/csa/architecture-codegen.ts";
import { parseArmTemplate } from "../lib/deployment-assistance.ts";
import { compilerFixtures } from "./iac-fixtures.mjs";

const directory = mkdtempSync(join(tmpdir(), "diagrammatic-iac-"));
const terraform = process.env.TERRAFORM_CLI ?? "terraform";
const bicep = process.env.BICEP_CLI ?? "bicep";
const env = Object.fromEntries(Object.entries(process.env).filter(([key]) =>
  /^(PATH|SYSTEMROOT|WINDIR|COMSPEC|PATHEXT|TEMP|TMP|HOME|USERPROFILE|APPDATA|LOCALAPPDATA|HTTPS?_PROXY|NO_PROXY)$/i.test(key),
));
env.TF_IN_AUTOMATION = "1";
env.TF_INPUT = "0";
env.TF_CLI_CONFIG_FILE = join(directory, "terraform.rc");
env.TF_DATA_DIR = join(directory, "provider-data");
writeFileSync(env.TF_CLI_CONFIG_FILE, "");

function run(executable, args) {
  const result = spawnSync(executable, args, { cwd: directory, env, encoding: "utf8", timeout: 240_000, maxBuffer: 8 * 1024 * 1024 });
  if (result.error) throw new Error(`${executable}: ${result.error.message}. Install the tool separately or configure BICEP_CLI/TERRAFORM_CLI.`);
  assert.equal(result.status, 0, `${executable} ${args.join(" ")}\n${result.stdout}\n${result.stderr}`);
  return result.stdout;
}

try {
  console.log(run(bicep, ["--version"]).trim());
  console.log(run(terraform, ["version", "-json"]).trim());
  for (const [index, [name, payload]] of compilerFixtures.entries()) {
    writeFileSync(join(directory, "main.bicep"), generateArchitectureCode(payload, "bicep").output);
    writeFileSync(join(directory, "main.tf"), generateArchitectureCode(payload, "terraform").output);
    const compiled = JSON.parse(run(bicep, ["build", "main.bicep", "--stdout"]));
    const native = parseArmTemplate(generateArmTemplate(payload).template);
    const types = (template) => template.resources.map((resource) => resource.type).sort();
    assert.deepEqual(types(compiled), types(native), `${name}: Bicep and ARM resource inventories differ`);
    run(terraform, ["fmt", "-check", "-diff", "main.tf"]);
    if (index === 0) {
      run(terraform, ["init", "-backend=false", "-input=false", "-no-color"]);
      console.log(run(terraform, ["version", "-json"]).trim());
    }
    const validation = JSON.parse(run(terraform, ["validate", "-json"]));
    assert.equal(validation.valid, true, JSON.stringify(validation));
    assert.equal(validation.error_count, 0);
    assert.equal(validation.warning_count, 0, JSON.stringify(validation));
    console.log(`PASS ${name}: Bicep build, ARM inventory, Terraform fmt and provider validation`);
  }
  console.log(`${compilerFixtures.length} synthetic graphs passed. No plan, apply, Azure login, What-If or resource deployment was executed.`);
} finally {
  rmSync(directory, { recursive: true, force: true });
}
