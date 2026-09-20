import { expect, test } from "@playwright/test";
import { generateArchitectureCode, generateArmTemplate } from "../components/diagrammatic/csa/architecture-codegen";
import { parseArmTemplate } from "../lib/deployment-assistance";

const payload = {
  nodes: [{
    id: "validation-app", kind: "icon" as const, label: "Synthetic validation app",
    iconId: "azure/application/application-service", iconPath: "/cloud-icons/azure/application/application-service.svg", x: 0, y: 0,
  }], edges: [],
};
function artifact() {
  const armTemplate = parseArmTemplate(generateArmTemplate(payload).template);
  return {
    format: "bicep" as const, code: generateArchitectureCode(payload, "bicep").output, armTemplate,
    resourceMappings: armTemplate.resources.map((resource) => ({ nodeId: "validation-app", resourceType: resource.type, resourceName: resource.name })),
  };
}

test("real hosted parser validates a matching pair without invoking a model or deploying resources", async ({ request }) => {
  const response = await request.post("/api/deploy/validate", { data: { payload, artifact: artifact() } });
  expect(response.status()).toBe(200);
  const { validation } = await response.json();
  expect(validation.status).toBe("passed-static-checks");
  expect(validation.canPublish).toBe(true);
  expect(validation.parser).toEqual({ name: "azure-bicep-parser", version: "0.47.16" });
  expect(validation.checks.find((check: { id: string }) => check.id === "azure-environment").status).toBe("not-verified");
});

test("real validation rejects the five reproduced acceptance gaps", async ({ request }) => {
  for (const problem of ["bicep-syntax", "terraform-syntax", "wrong-identity", "missing-plan", "no-resource-code"]) {
    const candidate: { format: "bicep" | "terraform"; code: string; armTemplate: ReturnType<typeof parseArmTemplate>; resourceMappings: Array<{ nodeId: string; resourceType: string; resourceName: string }> } = artifact();
    if (problem === "bicep-syntax") candidate.code = "THIS IS NOT BICEP {{{";
    if (problem === "terraform-syntax") { candidate.format = "terraform"; candidate.code = "not hcl {{{"; }
    if (problem === "no-resource-code") candidate.code = "param location string = 'westeurope'\n";
    const site = candidate.armTemplate.resources.find((resource) => resource.type === "Microsoft.Web/sites")!;
    if (problem === "wrong-identity") {
      site.type = "Microsoft.Compute/virtualMachines";
      candidate.resourceMappings.find((mapping) => mapping.resourceType === "Microsoft.Web/sites")!.resourceType = site.type;
    }
    if (problem === "missing-plan") {
      const properties = site.properties;
      if (!properties || typeof properties !== "object" || Array.isArray(properties)) throw new Error("Fixture site properties missing.");
      Reflect.deleteProperty(properties, "serverFarmId");
    }
    const response = await request.post("/api/deploy/validate", { data: { payload, artifact: candidate } });
    expect(response.status(), problem).toBe(200);
    const { validation } = await response.json();
    expect(validation.status, problem).toBe("failed");
    expect(validation.canPublish, problem).toBe(false);
  }
});

test("PowerShell is explicitly unverified rather than passed through its loading-capable parser", async ({ request }) => {
  const response = await request.post("/api/deploy/validate", {
    data: { payload, artifact: { ...artifact(), format: "powershell", code: "using module '/never-load-this-module'\n" } },
  });
  expect(response.status()).toBe(200);
  const { validation } = await response.json();
  expect(validation.status).toBe("needs-review");
  expect(validation.canPublish).toBe(false);
  expect(validation.parser.name).toBe("not-run");
});

test("Bash is syntax-checked without execution and script/ARM effects remain unverified", async ({ request }) => {
  const response = await request.post("/api/deploy/validate", {
    data: { payload, artifact: { ...artifact(), format: "azure-cli", code: "printf 'must not execute'\n" } },
  });
  expect(response.status()).toBe(200);
  const { validation } = await response.json();
  expect(validation.status).toBe("needs-review");
  expect(validation.checks.find((check: { id: string }) => check.id === "syntax").status).toBe("passed");
  expect(validation.parser.name).toBe("gnu-bash-noexec");
  expect(validation.canPublish).toBe(false);
});

test("publication rejects legacy ARM-only requests and client-authored validation flags", async ({ request }) => {
  const candidate = artifact();
  const old = await request.post("/api/deploy/template", { data: { source: "foundry-agent", consent: true, armTemplate: candidate.armTemplate } });
  expect(old.status()).toBe(400);
  const forged = await request.post("/api/deploy/validate", {
    data: { payload, artifact: { ...candidate, validation: { canPublish: true } } },
  });
  expect(forged.status()).toBe(400);
});
