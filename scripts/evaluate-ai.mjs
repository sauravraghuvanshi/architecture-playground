import { readFileSync, statSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { evaluateAiCandidate } from "../lib/ai-evaluation.ts";
import { reviewHash } from "../lib/review-provenance-server.ts";
import { goldenDatasetSchema, REFERENCE_EVALUATION_MODEL } from "../lib/ai-evaluation-contract.ts";
import { aiSubjectFingerprint, AI_EVALUATION_BOOTSTRAP_REVISION } from "./ai-evaluation-subjects.mjs";
import { parserSourceHash } from "./artifact-parser-build-config.mjs";

export function readEvaluationJson(path) {
  const info = statSync(path);
  if (!info.isFile() || info.size > 16 * 1024 * 1024) throw new Error("Evaluation inputs must be regular JSON files of at most 16 MiB.");
  const bytes = readFileSync(path);
  if (bytes.length > 16 * 1024 * 1024) throw new Error("Evaluation input grew beyond its byte limit.");
  try {
    return JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes));
  } catch (cause) {
    if (!(cause instanceof SyntaxError) && !(cause instanceof TypeError)) throw cause;
    throw new Error("Evaluation input must be complete JSON encoded as valid UTF-8; source content was not logged.");
  }
}

export function referenceCandidate(dataset, referenceOutputs, subjectSha256) {
  const identity = { id: REFERENCE_EVALUATION_MODEL, version: "1" };
  const candidate = {
    schemaVersion: 1, datasetId: dataset.id, datasetVersion: dataset.version,
    datasetSha256: reviewHash(dataset), subjectSha256,
    origin: "reference-fixture",
    models: { generation: identity, conversion: identity, review: identity, iac: identity },
    runId: "reference-contract-baseline", capturedAt: "2026-09-22T00:00:00.000Z",
    cases: dataset.tasks.map((task) => {
      if (!Object.hasOwn(referenceOutputs, task.id) || referenceOutputs[task.id] === undefined) throw new Error(`Reference output missing for ${task.id}.`);
      return { taskId: task.id, inputSha256: reviewHash(task.input), output: referenceOutputs[task.id] };
    }),
  };
  return JSON.parse(JSON.stringify(candidate));
}

export function enforceSubjectPromotion({ current, baseline, report }) {
  if (current === baseline && !report) return { status: "unchanged-grandfathered-subject", liveModelQualification: "not-asserted" };
  if (!report || report.subjectSha256 !== current || report.origin !== "recorded-candidate" || report.eligibleForSubjectPromotion !== true) {
    throw new Error("AI subjects changed without a complete passing recorded-candidate evaluation and declared model versions. Reference fixtures cannot authorize prompt/model-subject promotion.");
  }
  return { status: "recorded-candidate-checks-passed", liveModelQualification: "declared-capture-not-runtime-attestation" };
}

function saveReport(report, path) {
  if (path) {
    const target = resolve(path);
    mkdirSync(dirname(target), { recursive: true });
    writeFileSync(target, `${JSON.stringify(report, null, 2)}\n`);
  }
  return report;
}

export async function runAiEvaluation(args) {
  const allowed = new Set(["--reference", "--gate", "--candidate", "--output", "--export-inputs"]);
  const options = {};
  for (let index = 0; index < args.length; index++) {
    const flag = args[index];
    if (!allowed.has(flag) || flag in options) throw new Error(`Unknown or repeated evaluation option: ${flag}`);
    if (["--candidate", "--output", "--export-inputs"].includes(flag)) {
      const value = args[++index];
      if (!value || value.startsWith("--")) throw new Error(`${flag} requires a file path.`);
      options[flag] = value;
    } else options[flag] = true;
  }
  const { loadGoldenBenchmark } = await import("./fixtures/ai-quality-cases.mjs");
  const loaded = await loadGoldenBenchmark();
  const dataset = goldenDatasetSchema.parse(loaded.dataset);
  const subject = aiSubjectFingerprint();
  const evaluatorFiles = [
    "lib/ai-evaluation.ts", "lib/ai-evaluation-contract.ts", "scripts/evaluate-ai.mjs",
    "scripts/ai-evaluation-subjects.mjs", "lib/engineering-validation.ts", "lib/engineering-coverage.ts",
    "lib/artifact-consistency.ts", "lib/artifact-parser.ts", "lib/architecture-document.ts",
    "lib/review-evidence.ts", "lib/review-image.ts", "lib/review-image-server.ts",
  ];
  const toolchain = {
    evaluatorCodeSha256: reviewHash(Object.fromEntries(evaluatorFiles.map((file) => [file, readFileSync(join(process.cwd(), ...file.split("/")), "utf8").replace(/\r\n/g, "\n")]))),
    parserSourceSha256: parserSourceHash(process.cwd()),
    nodeVersion: process.versions.node, dependencies: subject.dependencies,
  };
  if (options["--export-inputs"]) {
    if (options["--reference"] || options["--candidate"] || options["--gate"] || options["--output"]) throw new Error("--export-inputs must be used on its own.");
    const path = resolve(options["--export-inputs"]);
    mkdirSync(dirname(path), { recursive: true });
    const endpoints = { generation: "/api/ai/generate", conversion: "/api/ai/convert", review: "/api/ai/review", iac: "/api/ai/deploy" };
    const tasks = dataset.tasks.map((task) => ({
      id: task.id, kind: task.kind, input: task.input, inputSha256: reviewHash(task.input),
      request: { method: "POST", path: endpoints[task.kind], headers: task.kind === "review" ? { "X-Diagrammatic-Review-Contract": "2" } : {} },
    }));
    writeFileSync(path, `${JSON.stringify({ dataset: { id: dataset.id, version: dataset.version, sha256: reviewHash(dataset) }, subject, tasks }, null, 2)}\n`);
    console.log(`Exported ${dataset.tasks.length} synthetic task inputs without expected answers. No provider was invoked.`);
    return { exported: true };
  }
  if (Boolean(options["--reference"]) === Boolean(options["--candidate"]) && !options["--gate"]) {
    throw new Error("Choose --reference, --candidate <file>, or --gate explicitly.");
  }
  if (options["--gate"] && (options["--reference"] || options["--candidate"])) throw new Error("--gate cannot be combined with reference/candidate mode.");
  let candidate;
  let promotion;
  if (options["--gate"]) {
    const baseline = aiSubjectFingerprint({ revision: AI_EVALUATION_BOOTSTRAP_REVISION });
    const reference = await evaluateAiCandidate(dataset, referenceCandidate(dataset, loaded.referenceOutputs, subject.fingerprint), subject.fingerprint);
    if (reference.status !== "passed-declared-task-checks") throw new Error("Reference contracts fail the domain benchmark; deployment is blocked.");
    const path = join(process.cwd(), "content", "ai-evaluation", "candidates", `${subject.fingerprint}.json`);
    if (subject.fingerprint === baseline.fingerprint && !existsSync(path)) {
      promotion = enforceSubjectPromotion({ current: subject.fingerprint, baseline: baseline.fingerprint });
      console.log(`Reference contracts: ${reference.passedTasks}/${reference.totalTasks}. Subjects unchanged from the grandfathered baseline; no live-model quality claim.`);
      return saveReport({ ...reference, promotion, toolchain }, options["--output"]);
    }
    if (!existsSync(path)) {
      enforceSubjectPromotion({ current: subject.fingerprint, baseline: baseline.fingerprint });
    }
    candidate = readEvaluationJson(path);
    const report = await evaluateAiCandidate(dataset, candidate, subject.fingerprint, subject.models ?? undefined);
    promotion = enforceSubjectPromotion({ current: subject.fingerprint, baseline: baseline.fingerprint, report });
    console.log(`Recorded candidate checks: ${report.passedTasks}/${report.totalTasks}. Runtime/model attribution remains explicitly unverified.`);
    return saveReport({ ...report, promotion, toolchain }, options["--output"]);
  }
  candidate = options["--reference"] ? referenceCandidate(dataset, loaded.referenceOutputs, subject.fingerprint) : readEvaluationJson(resolve(options["--candidate"]));
  const report = await evaluateAiCandidate(dataset, candidate, subject.fingerprint, subject.models ?? undefined);
  saveReport({ ...report, toolchain }, options["--output"]);
  console.log(`${report.status}: ${report.passedTasks}/${report.totalTasks}; origin=${report.origin}; subject promotion=${report.eligibleForSubjectPromotion}.`);
  if (report.status !== "passed-declared-task-checks") throw new Error("Domain quality checks failed. Inspect the per-case metrics; no partial pass qualifies the candidate.");
  return { ...report, toolchain };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try { await runAiEvaluation(process.argv.slice(2)); }
  catch (cause) {
    console.error(cause instanceof Error ? cause.message : "AI evaluation failed.");
    process.exitCode = 1;
  }
}
