import { z } from "zod";

export const REFERENCE_EVALUATION_MODEL = "hand-authored-reference-fixture";
const id = z.string().regex(/^[a-z0-9][a-z0-9_-]{0,79}$/);
const hash = z.string().regex(/^[a-f0-9]{64}$/);
const text = z.string().trim().min(1).max(2000);
const identity = z.string().regex(/^(?:(?:azure|aws|gcp)\/[a-z0-9-]+\/[a-z0-9-]+|shape:(?:rectangle|circle|diamond|database|person|document|internet))$/);
const node = z.object({
  key: id,
  identities: z.array(identity).min(1).max(8),
  label: z.string().trim().min(1).max(200).optional(),
}).strict();
const graphExpectations = z.object({
  nodes: z.array(node).min(1).max(60),
  connections: z.array(z.object({ source: id, target: id, label: z.string().trim().min(1).max(200).optional() }).strict()).max(180),
  providers: z.array(z.enum(["azure", "aws", "gcp"])).max(3),
}).strict().superRefine((value, context) => {
  const keys = new Set(value.nodes.map((entry) => entry.key));
  if (keys.size !== value.nodes.length || value.connections.some((edge) => !keys.has(edge.source) || !keys.has(edge.target))) {
    context.addIssue({ code: "custom", message: "Golden graph roles must be unique and every expected connection must reference them." });
  }
  if (new Set(value.connections.map((edge) => `${edge.source}->${edge.target}`)).size !== value.connections.length) {
    context.addIssue({ code: "custom", message: "Golden connections must be unique." });
  }
  if (new Set(value.providers).size !== value.providers.length || value.nodes.some((entry) => new Set(entry.identities).size !== entry.identities.length)) {
    context.addIssue({ code: "custom", message: "Golden provider and identity alternatives must be unique." });
  }
});
const common = {
  id, title: text,
  input: z.record(z.string(), z.unknown()),
};
export const goldenTaskSchema = z.discriminatedUnion("kind", [
  z.object({ ...common, kind: z.literal("generation"), expected: graphExpectations }).strict(),
  z.object({ ...common, kind: z.literal("conversion"), expected: graphExpectations }).strict(),
  z.object({
    ...common, kind: z.literal("review"),
    expected: z.object({
      requiredGuidanceIds: z.array(id).min(1).max(12),
      unknownGuidanceIds: z.array(id).max(12),
    }).strict().superRefine((value, context) => {
      if (new Set(value.requiredGuidanceIds).size !== value.requiredGuidanceIds.length ||
          new Set(value.unknownGuidanceIds).size !== value.unknownGuidanceIds.length ||
          value.unknownGuidanceIds.some((id) => !value.requiredGuidanceIds.includes(id))) {
        context.addIssue({ code: "custom", message: "Unknown guidance requirements must be a unique subset of required guidance IDs." });
      }
    }),
  }).strict(),
  z.object({
    ...common, kind: z.literal("iac"),
    expected: z.object({
      format: z.enum(["bicep", "terraform"]),
      resourceTypes: z.array(z.string().regex(/^Microsoft\.[A-Za-z0-9.]+\/[A-Za-z0-9/]+$/)).min(1).max(60),
    }).strict(),
  }).strict(),
]);
export type GoldenTask = z.infer<typeof goldenTaskSchema>;

export const goldenDatasetSchema = z.object({
  schemaVersion: z.literal(1), id,
  version: z.string().regex(/^\d{4}-\d{2}-\d{2}\.\d+$/),
  description: text,
  tasks: z.array(goldenTaskSchema).min(4).max(100),
}).strict().superRefine((dataset, context) => {
  if (new Set(dataset.tasks.map((task) => task.id)).size !== dataset.tasks.length) context.addIssue({
    code: "custom", message: "Golden task IDs must be unique.",
  });
  if (new Set(dataset.tasks.map((task) => task.kind)).size !== 4) context.addIssue({
    code: "custom", message: "The benchmark must cover generation, conversion, review and IaC.",
  });
});
export type GoldenDataset = z.infer<typeof goldenDatasetSchema>;

const modelIdentity = z.object({ id: z.string().trim().min(1).max(200), version: z.string().trim().min(1).max(200).nullable() }).strict();
export const evaluationModelsSchema = z.object({
  generation: modelIdentity, conversion: modelIdentity, review: modelIdentity, iac: modelIdentity,
}).strict();
export const evaluationCandidateSchema = z.object({
  schemaVersion: z.literal(1),
  datasetId: id, datasetVersion: z.string().min(1).max(80),
  datasetSha256: hash, subjectSha256: hash,
  origin: z.enum(["reference-fixture", "recorded-candidate"]),
  models: evaluationModelsSchema,
  runId: id, capturedAt: z.string().datetime(),
  cases: z.array(z.object({
    taskId: id, inputSha256: hash, output: z.unknown(),
    groundingReview: z.object({
      reviewer: z.string().trim().min(1).max(200),
      reviewedAt: z.string().datetime(), outputSha256: hash,
      grounded: z.boolean(), notes: text,
    }).strict().optional(),
  }).strict()).min(1).max(100),
}).strict().superRefine((candidate, context) => {
  if (new Set(candidate.cases.map((entry) => entry.taskId)).size !== candidate.cases.length) context.addIssue({
    code: "custom", message: "Candidate task IDs must be unique; attempts cannot overwrite one another.",
  });
});
export type EvaluationCandidate = z.infer<typeof evaluationCandidateSchema>;

export interface EvaluationMetric {
  id: string;
  score: number;
  threshold: number;
  passed: boolean;
  detail: string;
}
export interface EvaluationCaseResult {
  taskId: string;
  kind: GoldenTask["kind"];
  passed: boolean;
  metrics: EvaluationMetric[];
  errors: string[];
}
