import { createHash } from "node:crypto";
import type { ArchitectureCodeInput } from "./architecture-model.ts";
import type { DeploymentDraft } from "./deployment-assistance.ts";
import { ArtifactParserError, parseArtifactSyntax, type ArtifactSyntax } from "./artifact-parser.ts";
import { inspectArtifactConsistency } from "./artifact-consistency.ts";
import { inspectEngineeringCoverage, inspectEngineeringPrerequisites } from "./engineering-coverage.ts";
import {
  ENGINEERING_VALIDATION_DISCLAIMER, ENGINEERING_VALIDATION_PROFILE,
  engineeringValidationSchema, type EngineeringCheck, type EngineeringValidation,
} from "./engineering-validation-contract.ts";

export type EngineeringArtifact = Pick<DeploymentDraft, "format" | "code" | "armTemplate" | "resourceMappings">;

function artifactHash(artifact: EngineeringArtifact, evidence: ArchitectureCodeInput): string {
  const { format, code, armTemplate, resourceMappings } = artifact;
  const canonical = JSON.stringify({ artifact: { format, code, armTemplate, resourceMappings }, evidence }, (_key, value: unknown) =>
    value && typeof value === "object" && !Array.isArray(value)
      ? Object.fromEntries(Object.entries(value).sort(([left], [right]) => left < right ? -1 : left > right ? 1 : 0))
      : value);
  return createHash("sha256").update(canonical).digest("hex");
}

export async function preflightEngineeringParser(format: DeploymentDraft["format"], signal?: AbortSignal): Promise<void> {
  if (format !== "powershell") await parseArtifactSyntax("", format, signal);
}

export async function validateEngineeringArtifact(
  artifact: EngineeringArtifact,
  evidence: ArchitectureCodeInput,
  signal?: AbortSignal,
): Promise<EngineeringValidation> {
  let syntax: ArtifactSyntax;
  let syntaxCheck: EngineeringCheck;
  try {
    syntax = await parseArtifactSyntax(artifact.code, artifact.format, signal);
    syntaxCheck = {
      id: "syntax", status: syntax.valid ? "passed" : "failed",
      summary: syntax.valid ? `${syntax.parser} ${syntax.version} accepted the syntax; no generated code was executed.` : "The language parser found syntax errors or warnings.",
      details: syntax.diagnostics.map((item) => `${item.code} at ${item.line}:${item.column}: ${item.message}`.slice(0, 1500)),
    };
  } catch (cause) {
    if (!(cause instanceof ArtifactParserError) || cause.code !== "unsupported") throw cause;
    syntax = { parser: "not-run", version: "unsupported-profile", valid: false, complete: false, diagnostics: [] };
    syntaxCheck = {
      id: "syntax", status: "not-verified",
      summary: "This language has no approved execution-free syntax validator in the current host.",
      details: ["PowerShell's public parser can perform module/assembly/DSC resolution. It is not invoked on untrusted model text. Use isolated external tooling or the separately selected deterministic offline preview."],
    };
  }
  const coverage = inspectEngineeringCoverage(artifact.armTemplate, artifact.resourceMappings, evidence);
  const checks: EngineeringCheck[] = [
    syntaxCheck, coverage.mapping, coverage.coverageCheck,
    inspectEngineeringPrerequisites(artifact.armTemplate),
    inspectArtifactConsistency(syntax, artifact.format, artifact.armTemplate),
    {
      id: "azure-environment", status: "not-verified",
      summary: "Azure environment and deployment validation were not performed.",
      details: ["No full compiler binding, Terraform provider initialization, permissions/policy/quota checks, name-availability lookup, What-If or resource deployment was executed. Static checks cannot certify a working production workload."],
    },
  ];
  const failed = checks.some((check) => check.status === "failed");
  const canPublish = !failed && checks.every((check) => check.id === "azure-environment" || check.status === "passed");
  return engineeringValidationSchema.parse({
    version: 1, profile: ENGINEERING_VALIDATION_PROFILE,
    artifactHash: artifactHash(artifact, evidence), checkedAt: new Date().toISOString(),
    status: failed ? "failed" : canPublish ? "passed-static-checks" : "needs-review",
    canPublish, checks, coverage: coverage.coverage,
    parser: { name: syntax.parser, version: syntax.version },
    disclaimer: ENGINEERING_VALIDATION_DISCLAIMER,
  });
}
