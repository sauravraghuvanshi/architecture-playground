import { readFileSync, existsSync, readdirSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { join } from "node:path";
import ts from "typescript";
import { z } from "zod";
import { reviewHash } from "../lib/review-provenance-server.ts";
import { evaluationModelsSchema } from "../lib/ai-evaluation-contract.ts";

// Initial reviewed subject checkpoint, not a claim of live-model qualification.
export const AI_EVALUATION_BOOTSTRAP_REVISION = "4ba594f2994554e842e19247f678d5ad978de33c";
export const AI_SUBJECT_FILES = [
  "lib/ai.ts", "lib/ai-mode-prompts.ts", "lib/whiteboard-conversion.ts",
  "lib/architecture-review.ts", "lib/review-guidance.ts", "lib/review-provenance.ts",
  "lib/review-provenance-server.ts", "lib/deployment-assistance.ts", "lib/foundry-agent.ts",
  "lib/architecture-model.ts", "lib/service-identity.ts",
  "lib/deployment-grounding.ts", "components/diagrammatic/csa/architecture-codegen.ts",
  "components/diagrammatic/csa/terraform-emitter.ts", "components/diagrammatic/csa/azure-cli-emitter.ts",
  "scripts/build-cloud-icon-manifest.mjs",
];

export function normalizeAiSubject(source, fileName) {
  const result = ts.transpileModule(source.replace(/\r\n/g, "\n"), {
    fileName,
    compilerOptions: {
      target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext,
      removeComments: true, newLine: ts.NewLineKind.LineFeed,
    },
    transformers: {
      before: [(context) => {
        const visit = (node) => {
          if (ts.isImportDeclaration(node) && ts.isStringLiteral(node.moduleSpecifier) && node.moduleSpecifier.text.startsWith(".")) {
            return ts.factory.updateImportDeclaration(node, node.modifiers, node.importClause,
              ts.factory.createStringLiteral(node.moduleSpecifier.text.replace(/\.ts$/, "")), node.attributes);
          }
          return ts.visitEachChild(node, visit, context);
        };
        return (node) => ts.visitNode(node, visit);
      }],
    },
  });
  return result.outputText;
}

export function aiSubjectFingerprint({ root = process.cwd(), revision } = {}) {
  if (revision && !/^[a-f0-9]{40}$/.test(revision)) throw new Error("Subject revision must be a full commit ID.");
  const read = (file) => revision
    ? execFileSync("git", ["show", `${revision}:${file}`], { cwd: root, encoding: "utf8", maxBuffer: 8 * 1024 * 1024 })
    : readFileSync(join(root, ...file.split("/")), "utf8");
  const sources = Object.fromEntries(AI_SUBJECT_FILES.map((file) => [file, normalizeAiSubject(read(file), file)]));
  const lock = JSON.parse(read("package-lock.json"));
  const dependencies = Object.fromEntries(["typescript", "zod", "openai", "@azure/ai-projects"].map((name) => {
    const version = lock.packages?.[`node_modules/${name}`]?.version;
    if (!version) throw new Error(`AI subject dependency ${name} is not locked.`);
    return [name, version];
  }));
  const selectionPath = "content/ai-evaluation/model-selection.json";
  const selectionExists = revision
    ? Boolean(execFileSync("git", ["ls-tree", "--name-only", revision, "--", selectionPath], { cwd: root, encoding: "utf8" }).trim())
    : existsSync(join(root, ...selectionPath.split("/")));
  const models = selectionExists
    ? z.object({ schemaVersion: z.literal(1), models: evaluationModelsSchema }).strict().parse(JSON.parse(read(selectionPath))).models
    : null;
  let catalogPaths;
  if (revision) {
    const tree = execFileSync("git", ["ls-tree", "-r", "-z", revision, "--", "public/cloud-icons"], { cwd: root, encoding: "utf8", maxBuffer: 4 * 1024 * 1024 });
    catalogPaths = tree.split("\0").filter(Boolean).flatMap((entry) => {
      const [metadata, file] = entry.split("\t");
      return metadata.startsWith("100") && /^public\/cloud-icons\/(?:azure|aws|gcp)\/[^/]+\/[^/]+\.svg$/.test(file) ? [file] : [];
    });
  } else {
    catalogPaths = [];
    for (const cloud of ["azure", "aws", "gcp"]) {
      const directory = join(root, "public", "cloud-icons", cloud);
      for (const category of readdirSync(directory, { withFileTypes: true }).filter((entry) => entry.isDirectory())) {
        for (const file of readdirSync(join(directory, category.name), { withFileTypes: true })) {
          if (file.isFile() && file.name.endsWith(".svg")) catalogPaths.push(`public/cloud-icons/${cloud}/${category.name}/${file.name}`);
        }
      }
    }
  }
  catalogPaths.sort();
  return {
    version: 1, fingerprint: reviewHash({ version: 1, sources, dependencies, models, catalogPaths }),
    files: AI_SUBJECT_FILES, dependencies, models, catalogEntryCount: catalogPaths.length,
    scope: "repository-prompt-contract-transport-and-dependency-subjects",
    runtimeModelConfigurationVerified: false,
  };
}
