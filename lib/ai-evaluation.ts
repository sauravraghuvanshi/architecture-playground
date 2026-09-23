import { z } from "zod";
import {
  evaluationCandidateSchema, goldenDatasetSchema, REFERENCE_EVALUATION_MODEL,
  type GoldenTask, type EvaluationCandidate, type EvaluationMetric, type EvaluationCaseResult,
} from "./ai-evaluation-contract.ts";
import { generatedArchitectureSchema, designAdviceSchema, generationRequestSchema } from "./ai-mode-prompts.ts";
import { parseArchitectureDocument } from "./architecture-document.ts";
import { parseGeneratedArchitectureReview, architectureReviewRequestSchema } from "./architecture-review.ts";
import { reviewProvenanceSchema } from "./review-provenance.ts";
import { reviewHash } from "./review-provenance-server.ts";
import { REVIEW_GUIDANCE, findReviewGuidance } from "./review-guidance.ts";
import { resolveServiceIcon, SERVICE_CATALOG } from "./service-identity.ts";
import { engineeringArtifactInputSchema, parseDeploymentDraft, deploymentRequestSchema } from "./deployment-assistance.ts";
import { validateEngineeringArtifact } from "./engineering-validation.ts";
import { ArtifactParserError } from "./artifact-parser.ts";
import { conversionSourceSchema } from "./whiteboard-conversion.ts";
import { validateEvidenceImage } from "./review-image-server.ts";

export const AI_EVALUATION_VERSION = "domain-evaluator-v1";
export const AI_EVALUATION_DISCLAIMER = "Scores measure the declared synthetic task requirements, identities, directed topology, source associations and supported static artifact checks. They do not certify natural-language entailment, live-model quality, runtime behavior or deployment. Model attribution and human adjudications in supplied captures are operator-declared, not independently attested. No model or customer infrastructure was invoked by this evaluator.";
const normalizeLabel = (value: string) => value.trim().toLowerCase();
const ratio = (count: number, total: number) => total === 0 ? 1 : count / total;
const metric = (id: string, score: number, detail: string): EvaluationMetric => ({
  id, score, threshold: 1, passed: score === 1, detail,
});

interface SemanticNode { id: string; identity: string | null; label: string; provider: string | null }
interface SemanticGraph {
  nodes: SemanticNode[];
  edges: Array<{ source: string; target: string; label?: string }>;
}
function canonicalIdentity(value: string): string | null {
  if (value.startsWith("shape:")) return value;
  return resolveServiceIcon({ iconId: value }, SERVICE_CATALOG)?.id ?? null;
}

function generationGraph(value: unknown): SemanticGraph {
  const output = z.object({
    graph: generatedArchitectureSchema,
    designAssistance: designAdviceSchema,
    mode: z.literal("architecture").optional(),
  }).strict().parse(value);
  return {
    nodes: output.graph.nodes.map((node) => ({
      id: node.id, label: node.data.label, provider: node.data.cloud,
      identity: resolveServiceIcon({ iconId: node.data.iconId, cloud: node.data.cloud }, SERVICE_CATALOG)?.id ?? null,
    })),
    edges: output.graph.edges.map((edge) => ({ source: edge.source, target: edge.target, label: edge.data.label })),
  };
}

function conversionGraph(value: unknown): SemanticGraph {
  const output = z.object({ payload: z.unknown(), warnings: z.array(z.string().min(1).max(1200)).max(220) }).strict().parse(value);
  const payload = parseArchitectureDocument(output.payload);
  if (!payload.nodes.length) throw new Error("Conversion output is empty.");
  return {
    nodes: payload.nodes.flatMap((node): SemanticNode[] => {
      if (node.kind === "group") return [];
      if (node.kind === "shape") return [{ id: node.id, identity: `shape:${node.shape}`, label: node.label, provider: null }];
      const icon = resolveServiceIcon({ iconId: node.iconId, cloud: node.semantics?.provider }, SERVICE_CATALOG);
      return [{ id: node.id, identity: icon?.id ?? null, label: node.label, provider: icon?.cloud ?? node.iconId.split("/")[0] }];
    }),
    edges: payload.edges,
  };
}

function gradeGraph(task: Extract<GoldenTask, { kind: "generation" | "conversion" }>, graph: SemanticGraph): EvaluationMetric[] {
  const roles = new Map<string, string>();
  const used = new Set<string>();
  const expected = task.expected;
  const ordered = [...expected.nodes].sort((left, right) => Number(Boolean(right.label)) - Number(Boolean(left.label)));
  for (const role of ordered) {
    const identities = role.identities.map(canonicalIdentity);
    if (identities.some((identity) => identity === null)) throw new Error("Golden task refers to an unknown service identity.");
    const matches = graph.nodes.filter((node) => !used.has(node.id) && identities.includes(node.identity) &&
      (!role.label || normalizeLabel(node.label) === normalizeLabel(role.label)));
    if (matches.length) {
      const node = matches.sort((left, right) => left.id < right.id ? -1 : left.id > right.id ? 1 : 0)[0];
      used.add(node.id);
      roles.set(node.id, role.key);
    }
  }
  const edgeMatches = expected.connections.filter((edge) =>
    graph.edges.some((actual) => roles.get(actual.source) === edge.source && roles.get(actual.target) === edge.target));
  const labeled = expected.connections.filter((edge) => edge.label !== undefined);
  const labelsMatched = labeled.filter((edge) => graph.edges.some((actual) =>
    roles.get(actual.source) === edge.source && roles.get(actual.target) === edge.target &&
    normalizeLabel(actual.label ?? "") === normalizeLabel(edge.label!)));
  const icons = graph.nodes.filter((node) => node.provider !== null);
  const providerMatches = icons.filter((node) => expected.providers.some((provider) => provider === node.provider));
  return [
    metric("requirements", ratio(roles.size + edgeMatches.length + labelsMatched.length, expected.nodes.length + expected.connections.length + labeled.length),
      `${roles.size}/${expected.nodes.length} requested roles, ${edgeMatches.length}/${expected.connections.length} directed connections and ${labelsMatched.length}/${labeled.length} specified connection labels retained.`),
    metric("identity-recall", ratio(roles.size, expected.nodes.length), "Every requested role must retain an allowed canonical identity and any explicitly requested label."),
    metric("identity-precision", ratio(roles.size, graph.nodes.length), "Unrequested, duplicated or unresolved non-container nodes reduce precision."),
    metric("known-identities", ratio(graph.nodes.filter((node) => node.identity !== null).length, graph.nodes.length), "Unknown catalog identities cannot receive credit from their labels."),
    metric("provider-fidelity", ratio(providerMatches.length, icons.length), "Every service must belong to a requested provider."),
    metric("topology-recall", ratio(edgeMatches.length, expected.connections.length), "Direction matters; reversed or omitted connections do not match."),
    metric("topology-precision", ratio(edgeMatches.length, graph.edges.length), "Extra and duplicated connections are not ignored."),
    metric("connection-labels", ratio(labelsMatched.length, labeled.length), "Only labels explicitly specified by the golden task are graded."),
  ];
}

function gradeReview(task: Extract<GoldenTask, { kind: "review" }>, value: unknown, candidate: EvaluationCandidate): EvaluationMetric[] {
  const input = architectureReviewRequestSchema.parse(task.input);
  const output = z.object({ review: z.unknown(), provenance: z.unknown().optional() }).passthrough().parse(value);
  const payload = input.source === "canvas" || input.source === "import" ? input.payload : undefined;
  const review = parseGeneratedArchitectureReview(JSON.stringify(output.review), payload);
  const actualGuidance = new Set(review.findings.flatMap((finding) => finding.guidanceIds ?? []));
  const covered = task.expected.requiredGuidanceIds.filter((id) => actualGuidance.has(id));
  const uncertainty = task.expected.unknownGuidanceIds.filter((id) => {
    const findings = review.findings.filter((finding) => finding.guidanceIds?.includes(id));
    return findings.length > 0 && findings.every((finding) => finding.evidenceStatus === "unknown");
  });
  let provenanceValid = candidate.origin === "reference-fixture";
  if (candidate.origin === "recorded-candidate") {
    const provenance = reviewProvenanceSchema.parse(output.provenance);
    provenanceValid = provenance.source === input.source &&
      provenance.evidenceSha256 === reviewHash(input) &&
      provenance.reviewSha256 === reviewHash(review) &&
      provenance.guidanceSha256 === reviewHash(REVIEW_GUIDANCE) &&
      provenance.attempts.every((attempt) => attempt.invocation.modelReportedId === candidate.models.review.id);
  }
  return [
    metric("requirements", ratio(covered.length, task.expected.requiredGuidanceIds.length), "Required guidance themes must be represented; free-form entailment is not measured."),
    metric("grounding-coverage", ratio(covered.length, task.expected.requiredGuidanceIds.length), "Specific curated articles, framework consistency and exact diagram references are validated by the production parser."),
    metric("uncertainty-preservation", ratio(uncertainty.length, task.expected.unknownGuidanceIds.length), "Missing deployment evidence must not be relabeled as observed implementation."),
    metric("provenance-binding", provenanceValid ? 1 : 0, candidate.origin === "reference-fixture"
      ? "Reference fixture: provider attribution is not claimed."
      : "Recorded review must match its task, result, guidance snapshot and declared provider model identifier."),
  ];
}

async function gradeIac(task: Extract<GoldenTask, { kind: "iac" }>, value: unknown): Promise<EvaluationMetric[]> {
  const payload = parseArchitectureDocument(task.input.payload);
  const envelope = z.object({
    format: z.unknown(), code: z.unknown(), armTemplate: z.unknown(), resourceMappings: z.unknown(),
  }).passthrough().parse(value);
  const input = engineeringArtifactInputSchema.parse({
    format: envelope.format, code: envelope.code, armTemplate: envelope.armTemplate, resourceMappings: envelope.resourceMappings,
  });
  const artifact = parseDeploymentDraft({
    ...input, assumptions: ["Static candidate evaluation; no resource deployment."], warnings: [],
  }, payload, task.expected.format);
  const validation = await validateEngineeringArtifact(artifact, payload);
  const types = artifact.armTemplate.resources.map((resource) => resource.type);
  const expectedCounts = new Map<string, number>();
  for (const type of task.expected.resourceTypes) expectedCounts.set(type, (expectedCounts.get(type) ?? 0) + 1);
  let matched = 0;
  for (const [type, count] of expectedCounts) matched += Math.min(count, types.filter((actual) => actual === type).length);
  const incomplete = validation.checks.filter((check) => check.id !== "azure-environment" && check.status !== "passed").map((check) => check.id);
  return [
    metric("requirements", ratio(matched, task.expected.resourceTypes.length), "Independently declared primary and supporting resource types must be present."),
    metric("artifact-format", artifact.format === task.expected.format ? 1 : 0, "The requested language must be retained."),
    metric("resource-precision", ratio(matched, types.length), "Unexpected resources reduce precision."),
    metric("artifact-validity", validation.canPublish ? 1 : 0, `${validation.parser?.name ?? "unavailable"} ${validation.parser?.version ?? ""}: real checks run again; not-passed checks: ${incomplete.join(", ") || "none"}. Candidate-authored validation flags are not trusted.`),
  ];
}

function assertJsonBudget(value: unknown) {
  const active = new Set<object>();
  const stack: Array<{ value: unknown; depth: number; leave?: boolean }> = [{ value, depth: 0 }];
  let values = 0;
  let bytes = 0;
  while (stack.length) {
    const item = stack.pop()!;
    if (item.leave) { active.delete(item.value as object); continue; }
    if (++values > 200_000 || item.depth > 40) throw new Error("Evaluation input exceeds the JSON depth/value budget.");
    bytes += typeof item.value === "string" ? Buffer.byteLength(item.value, "utf8") : 8;
    if (bytes > 16 * 1024 * 1024) throw new Error("Evaluation input exceeds the 16 MiB JSON value budget.");
    if (item.value === null || ["string", "boolean"].includes(typeof item.value)) continue;
    if (typeof item.value === "number" && Number.isFinite(item.value)) continue;
    if (!item.value || typeof item.value !== "object") throw new Error("Evaluation inputs must be finite JSON values.");
    if (active.has(item.value)) throw new Error("Evaluation inputs cannot contain cycles.");
    if (Array.isArray(item.value)) {
      const keys = Object.keys(item.value);
      if (keys.length !== item.value.length || keys.some((key, index) => key !== String(index))) throw new Error("Evaluation inputs cannot contain sparse arrays or custom array properties.");
    }
    if (Object.getOwnPropertySymbols(item.value).length) throw new Error("Evaluation inputs cannot contain symbol properties.");
    const prototype = Object.getPrototypeOf(item.value);
    if (!Array.isArray(item.value) && prototype !== null && Object.getPrototypeOf(prototype) !== null) throw new Error("Evaluation inputs must contain plain JSON objects.");
    active.add(item.value);
    stack.push({ value: item.value, depth: item.depth, leave: true });
    for (const [key, descriptor] of Object.entries(Object.getOwnPropertyDescriptors(item.value))) {
      if (Array.isArray(item.value) && key === "length") continue;
      if (!("value" in descriptor)) throw new Error("Evaluation inputs cannot contain accessors.");
      bytes += Buffer.byteLength(key, "utf8");
      stack.push({ value: descriptor.value, depth: item.depth + 1 });
    }
  }
}

export async function evaluateAiCandidate(datasetValue: unknown, candidateValue: unknown, subjectSha256: string, expectedModels?: EvaluationCandidate["models"]) {
  assertJsonBudget(datasetValue);
  assertJsonBudget(candidateValue);
  const dataset = goldenDatasetSchema.parse(datasetValue);
  const candidate = evaluationCandidateSchema.parse(candidateValue);
  const datasetSha256 = reviewHash(dataset);
  const issues: string[] = [];
  if (candidate.datasetId !== dataset.id || candidate.datasetVersion !== dataset.version || candidate.datasetSha256 !== datasetSha256) issues.push("Dataset identity/version/fingerprint mismatch.");
  if (candidate.subjectSha256 !== subjectSha256) issues.push("Prompt/schema/model-subject fingerprint mismatch.");
  if (candidate.origin === "recorded-candidate" && expectedModels && reviewHash(candidate.models) !== reviewHash(expectedModels)) {
    issues.push("Recorded model identities/versions do not match the nominated model selection.");
  }
  const ids = new Set(dataset.tasks.map((task) => task.id));
  if (candidate.cases.some((entry) => !ids.has(entry.taskId))) issues.push("Candidate includes unknown task IDs.");
  const results: EvaluationCaseResult[] = [];
  for (const task of dataset.tasks) {
    if (task.kind === "generation") {
      if (generationRequestSchema.strict().parse(task.input).mode !== "architecture") throw new Error(`Golden task ${task.id} must target architecture generation.`);
    } else if (task.kind === "conversion") {
      const envelope = z.object({ image: z.unknown(), sourceNodes: z.unknown().optional() }).strict().parse(task.input);
      const request = architectureReviewRequestSchema.parse({ source: "image", image: envelope.image });
      if (!request.image || request.image.mimeType !== "image/png") throw new Error(`Golden task ${task.id} requires a real Whiteboard PNG.`);
      conversionSourceSchema.parse(envelope.sourceNodes ?? []);
      await validateEvidenceImage(request.image);
    } else if (task.kind === "review") {
      const request = architectureReviewRequestSchema.parse(task.input);
      if (request.assessmentOnly) throw new Error(`Golden task ${task.id} must target an AI review, not an offline assessment.`);
      if (request.image) await validateEvidenceImage(request.image);
    } else {
      const input = deploymentRequestSchema.parse(task.input);
      parseArchitectureDocument(input.payload);
      if (input.format !== task.expected.format) throw new Error(`Golden task ${task.id} has inconsistent format expectations.`);
    }
    if (task.kind === "generation" || task.kind === "conversion") {
      if (task.expected.nodes.some((node) => node.identities.some((identity) => canonicalIdentity(identity) === null))) {
        throw new Error(`Golden task ${task.id} names an unknown catalog identity.`);
      }
      for (let left = 0; left < task.expected.nodes.length; left++) {
        for (let right = left + 1; right < task.expected.nodes.length; right++) {
          const a = task.expected.nodes[left], b = task.expected.nodes[right];
          const overlap = a.identities.map(canonicalIdentity).some((identity) => b.identities.map(canonicalIdentity).includes(identity));
          if (overlap && (!a.label || !b.label || normalizeLabel(a.label) === normalizeLabel(b.label))) {
            throw new Error(`Golden task ${task.id} must disambiguate repeated service roles with distinct labels.`);
          }
        }
      }
    }
    const entry = candidate.cases.find((item) => item.taskId === task.id);
    if (!entry || entry.inputSha256 !== reviewHash(task.input)) {
      results.push({ taskId: task.id, kind: task.kind, passed: false, metrics: [], errors: [entry ? "Task input fingerprint mismatch." : "Required candidate output is missing."] });
      continue;
    }
    if (task.kind === "review" && [...task.expected.requiredGuidanceIds, ...task.expected.unknownGuidanceIds].some((id) => !findReviewGuidance(id))) {
      throw new Error(`Golden task ${task.id} names unknown curated guidance.`);
    }
    try {
      let metrics: EvaluationMetric[];
      if (task.kind === "generation") metrics = gradeGraph(task, generationGraph(entry.output));
      else if (task.kind === "conversion") metrics = gradeGraph(task, conversionGraph(entry.output));
      else if (task.kind === "review") metrics = gradeReview(task, entry.output, candidate);
      else metrics = await gradeIac(task, entry.output);
      results.push({ taskId: task.id, kind: task.kind, passed: metrics.every((check) => check.passed), metrics, errors: [] });
    } catch (cause) {
      if (cause instanceof ArtifactParserError) {
        throw new Error(`Evaluation infrastructure failed (${cause.code}) for ${task.id}; no quality verdict was produced.`);
      }
      if (cause instanceof TypeError || cause instanceof ReferenceError || cause instanceof RangeError) {
        throw new Error(`Evaluator could not run (${cause.name}) for ${task.id}; no quality verdict was produced.`);
      }
      // Candidate bytes can contain confidential text. Report the failure class,
      // not parser excerpts, code, prompts or arbitrary exception messages.
      results.push({
        taskId: task.id, kind: task.kind, passed: false, metrics: [],
        errors: [cause instanceof z.ZodError ? "Production contract rejected the output." : "Production validation could not qualify the output."],
      });
    }
  }
  const passed = issues.length === 0 && results.every((result) => result.passed);
  const modelVersionsPinned = Object.values(candidate.models).every((model) => model.version !== null && !/^(latest|unknown|unreported|unresolved|default)$/i.test(model.version));
  const groundingReviews = dataset.tasks.filter((task) => task.kind === "review").map((task) => {
    const entry = candidate.cases.find((item) => item.taskId === task.id);
    const judgment = entry?.groundingReview;
    return {
      taskId: task.id,
      accepted: Boolean(entry && judgment?.grounded && judgment.outputSha256 === reviewHash(entry.output) &&
        Date.parse(judgment.reviewedAt) >= Date.parse(candidate.capturedAt)),
    };
  });
  const promotionBlockers = [
    ...(!passed ? ["Declared task checks or fingerprints failed."] : []),
    ...(candidate.origin !== "recorded-candidate" ? ["Reference fixtures are not provider quality evidence."] : []),
    ...(!modelVersionsPinned ? ["At least one declared model version is unresolved."] : []),
    ...(Object.values(candidate.models).some((model) => model.id === REFERENCE_EVALUATION_MODEL) ? ["Reference model identifiers cannot authorize promotion."] : []),
    ...(candidate.origin === "recorded-candidate" ? groundingReviews.filter((entry) => !entry.accepted).map((entry) => `Human grounding review is missing, rejected or stale for ${entry.taskId}.`) : []),
  ];
  return {
    schemaVersion: 1, evaluatorVersion: AI_EVALUATION_VERSION,
    dataset: { id: dataset.id, version: dataset.version, sha256: datasetSha256 },
    subjectSha256, candidateSha256: reviewHash(candidate),
    origin: candidate.origin, runId: candidate.runId, models: candidate.models,
    status: passed ? "passed-declared-task-checks" : "failed-declared-task-checks",
    eligibleForSubjectPromotion: promotionBlockers.length === 0, promotionBlockers,
    modelAttribution: "operator-supplied-not-independently-attested",
    passRate: results.filter((result) => result.passed).length / dataset.tasks.length,
    passedTasks: results.filter((result) => result.passed).length, totalTasks: dataset.tasks.length,
    issues, results, groundingReviews, execution: "offline-supplied-output-scoring", liveModelInvoked: false, customerInfrastructureExecuted: false,
    notEvaluated: ["automated free-form factual entailment", "live model performance", "stochastic repeatability", "visual layout and image aesthetics", "runtime correctness", "real deployment", "cost and latency SLOs"],
    disclaimer: AI_EVALUATION_DISCLAIMER,
  };
}
