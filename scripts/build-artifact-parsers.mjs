import { spawnSync } from "node:child_process";
import { chmodSync, copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parserSourceHash, PARSER_SOURCE_FILES } from "./artifact-parser-build-config.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const target = process.env.ARTIFACT_PARSER_TARGET ?? (process.platform === "win32" ? "win-x64" : "linux-x64");
if (!["win-x64", "linux-x64"].includes(target)) throw new Error("Only win-x64 and linux-x64 parser builds are supported.");
const output = path.join(root, "node_modules", ".cache", "artifact-validation");
const cache = path.join(root, "node_modules", ".cache", "artifact-validation-build");
mkdirSync(output, { recursive: true });
mkdirSync(cache, { recursive: true });
const env = {
  ...process.env, DOTNET_CLI_TELEMETRY_OPTOUT: "1", DOTNET_NOLOGO: "1", GOTOOLCHAIN: "local", CGO_ENABLED: "0",
  GOMODCACHE: process.env.GOMODCACHE ?? path.join(cache, "go-mod"), GOCACHE: process.env.GOCACHE ?? path.join(cache, "go-build"),
};
function run(executable, args, cwd, extra = {}) {
  const result = spawnSync(executable, args, { cwd, env: { ...env, ...extra }, stdio: "inherit", shell: false });
  if (result.error) throw new Error(`Required build tool ${executable} is unavailable: ${result.error.message}`);
  if (result.status !== 0) throw new Error(`${executable} build failed (${result.status}).`);
}
const source = process.env.DIAGRAMMATIC_NUGET_SOURCE;
if (source && !["https://api.nuget.org/v3/index.json", "https://www.nuget.org/api/v2/"].includes(source)) {
  throw new Error("Parser builds only accept the documented official NuGet feeds.");
}
run(process.env.DOTNET_BINARY ?? "dotnet", [
  "publish", "Diagrammatic.ArtifactParser.csproj", "-c", "Release", "-r", target, "--self-contained", "true",
  "-o", path.join(output, "dotnet"), "-p:RestoreLockedMode=true",
  ...(source ? ["--source", source] : [`-p:RestoreConfigFile=${path.join(root, "tools", "artifact-validation", "NuGet.Config")}`]),
], path.join(root, "tools", "artifact-validation", "dotnet"));
run(process.env.GO_BINARY ?? "go", [
  "build", "-mod=readonly", "-trimpath", "-o", path.join(output, `hcl-parser${target.startsWith("win") ? ".exe" : ""}`), ".",
], path.join(root, "tools", "artifact-validation", "hcl"), { GOOS: target.startsWith("win") ? "windows" : "linux", GOARCH: "amd64" });
if (target === (process.platform === "win32" ? "win-x64" : "linux-x64")) {
  const suffix = target.startsWith("win") ? ".exe" : "";
  const checks = [
    [path.join(output, "dotnet", `Diagrammatic.ArtifactParser${suffix}`), { language: "bicep", code: "var sample = loadTextContent('/must-not-be-opened')\n" }, true],
    [path.join(output, "dotnet", `Diagrammatic.ArtifactParser${suffix}`), { language: "bicep", code: "THIS IS NOT BICEP {{{" }, false],
    [path.join(output, `hcl-parser${suffix}`), { code: 'sample = file("/must-not-be-opened")\n' }, true],
    [path.join(output, `hcl-parser${suffix}`), { code: 'variable "x" { type = string default = "invalid" }' }, false],
  ];
  for (const [executable, request, expected] of checks) {
    const checked = spawnSync(executable, [], {
      input: JSON.stringify(request), encoding: "utf8", shell: false, timeout: 10_000, maxBuffer: 1_000_000,
      env: { NODE_ENV: "production", ...(process.env.SystemRoot ? { SystemRoot: process.env.SystemRoot } : {}), DOTNET_SYSTEM_GLOBALIZATION_INVARIANT: "1", DOTNET_CLI_TELEMETRY_OPTOUT: "1" },
    });
    if (checked.error || checked.status !== 0 || checked.stderr.trim() || JSON.parse(checked.stdout).valid !== expected) {
      throw new Error("Trusted parser native-platform smoke failed; no application deployment is permitted.");
    }
  }
}
const licenses = path.join(output, "licenses");
mkdirSync(licenses, { recursive: true });
copyFileSync(path.join(root, "tools", "artifact-validation", "NOTICE.txt"), path.join(output, "NOTICE.txt"));
copyFileSync(path.join(root, "tools", "artifact-validation", "BICEP-LICENSE.txt"), path.join(licenses, "BICEP-LICENSE.txt"));
function copyNotices(directory, name) {
  if (!existsSync(directory)) return;
  for (const file of readdirSync(directory)) {
    if (!/^(license|thirdpartynotices|notice)(\.[^.]+)?$/i.test(file)) continue;
    const destination = path.join(licenses, name);
    mkdirSync(destination, { recursive: true });
    const source = path.join(directory, file);
    const target = path.join(destination, file);
    if (existsSync(target)) {
      if (readFileSync(source).equals(readFileSync(target))) continue;
      chmodSync(target, 0o644);
    }
    copyFileSync(source, target);
  }
}
const assets = JSON.parse(readFileSync(path.join(root, "tools", "artifact-validation", "dotnet", "obj", "project.assets.json"), "utf8"));
for (const [name, library] of Object.entries(assets.libraries)) {
  if (library.type !== "package") continue;
  for (const packageRoot of Object.keys(assets.packageFolders)) copyNotices(path.join(packageRoot, library.path), name.replaceAll("/", "-"));
}
const runtime = JSON.parse(readFileSync(path.join(output, "dotnet", "Diagrammatic.ArtifactParser.runtimeconfig.json"), "utf8"));
for (const framework of runtime.runtimeOptions.includedFrameworks ?? []) {
  for (const packageRoot of Object.keys(assets.packageFolders)) {
    copyNotices(path.join(packageRoot, `${framework.name.toLowerCase()}.runtime.${target}`, framework.version), `${framework.name}-${framework.version}`);
  }
}
const moduleList = spawnSync(process.env.GO_BINARY ?? "go", ["list", "-m", "-f", "{{.Path}}|{{.Version}}|{{.Dir}}", "all"], {
  cwd: path.join(root, "tools", "artifact-validation", "hcl"), env, encoding: "utf8", shell: false,
});
if (moduleList.error || moduleList.status !== 0) throw new Error("Could not enumerate Go dependency notices.");
for (const line of moduleList.stdout.trim().split(/\r?\n/)) {
  const [name, version, directory] = line.split("|");
  if (directory && version) copyNotices(directory, `${name.replaceAll("/", "-")}-${version}`);
}
const goRoot = spawnSync(process.env.GO_BINARY ?? "go", ["env", "GOROOT"], { env, encoding: "utf8", shell: false });
if (goRoot.error || goRoot.status !== 0) throw new Error("Could not locate Go runtime notices.");
copyNotices(goRoot.stdout.trim(), "go-runtime");
writeFileSync(path.join(output, "manifest.json"), JSON.stringify({
  version: 1, target, sourceHash: parserSourceHash(root), files: PARSER_SOURCE_FILES,
  parsers: { bicep: "Azure.Bicep.Core 0.47.16", terraform: "HashiCorp HCL 2.25.0" },
}, null, 2) + "\n");
console.log(`Trusted parser-only helpers built for ${target}. No customer code was executed.`);
