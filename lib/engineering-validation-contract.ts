import { z } from "zod";

export const ENGINEERING_VALIDATION_PROFILE = "azure-static-v1";
export const engineeringCheckSchema = z.object({
  id: z.enum(["syntax", "resource-mappings", "coverage", "prerequisites", "artifact-consistency", "azure-environment"]),
  status: z.enum(["passed", "failed", "not-verified"]),
  summary: z.string().min(1).max(1500),
  details: z.array(z.string().min(1).max(1500)).max(100),
}).strict();
export type EngineeringCheck = z.infer<typeof engineeringCheckSchema>;

export const engineeringCoverageSchema = z.object({
  nodeId: z.string().min(1).max(200),
  label: z.string().max(1000),
  serviceId: z.string().max(1000).optional(),
  status: z.enum(["mapped", "partial", "excluded", "unsupported"]),
  resourceTypes: z.array(z.string().max(200)).max(100),
  reason: z.string().min(1).max(1500),
}).strict();
export type EngineeringCoverage = z.infer<typeof engineeringCoverageSchema>;

export const engineeringValidationSchema = z.object({
  version: z.literal(1),
  profile: z.literal(ENGINEERING_VALIDATION_PROFILE),
  artifactHash: z.string().regex(/^[a-f0-9]{64}$/),
  checkedAt: z.string().datetime(),
  status: z.enum(["passed-static-checks", "needs-review", "failed"]),
  canPublish: z.boolean(),
  checks: z.array(engineeringCheckSchema).length(6),
  coverage: z.array(engineeringCoverageSchema).max(500),
  parser: z.object({
    name: z.string().min(1).max(100),
    version: z.string().min(1).max(100),
  }).strict(),
  disclaimer: z.string().min(1).max(2000),
}).strict().superRefine((report, context) => {
  if (new Set(report.checks.map((check) => check.id)).size !== report.checks.length) {
    context.addIssue({ code: "custom", message: "Validation checks must have unique IDs." });
  }
  if (new Set(report.coverage.map((row) => row.nodeId)).size !== report.coverage.length) {
    context.addIssue({ code: "custom", message: "Coverage rows must have unique node IDs." });
  }
  const failed = report.checks.some((check) => check.status === "failed");
  const staticPassed = report.checks.every((check) => check.id === "azure-environment" || check.status === "passed");
  const expectedStatus = failed ? "failed" : staticPassed ? "passed-static-checks" : "needs-review";
  if (report.status !== expectedStatus || report.canPublish !== (!failed && staticPassed)) {
    context.addIssue({ code: "custom", message: "Validation status contradicts its checks." });
  }
  if (report.checks.find((check) => check.id === "azure-environment")?.status !== "not-verified") {
    context.addIssue({ code: "custom", message: "This profile does not perform Azure environment validation." });
  }
});
export type EngineeringValidation = z.infer<typeof engineeringValidationSchema>;

export const ENGINEERING_VALIDATION_DISCLAIMER =
  "Static artifact checks are not a deployment or a production-readiness certificate. Parsing does not perform full language binding, provider-schema validation, Azure permissions, policy, quota, name availability, network reachability or workload execution. No generated script or infrastructure was executed.";
