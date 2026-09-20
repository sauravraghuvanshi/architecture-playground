import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";

export const PARSER_SOURCE_FILES = [
  "tools/artifact-validation/dotnet/Program.cs",
  "tools/artifact-validation/dotnet/Diagrammatic.ArtifactParser.csproj",
  "tools/artifact-validation/dotnet/packages.lock.json",
  "tools/artifact-validation/global.json",
  "tools/artifact-validation/NOTICE.txt",
  "tools/artifact-validation/BICEP-LICENSE.txt",
  "tools/artifact-validation/hcl/main.go",
  "tools/artifact-validation/hcl/go.mod",
  "tools/artifact-validation/hcl/go.sum",
];

export function parserSourceHash(root) {
  const hash = createHash("sha256");
  for (const file of PARSER_SOURCE_FILES) hash.update(file).update(readFileSync(path.join(root, file)));
  return hash.digest("hex");
}
