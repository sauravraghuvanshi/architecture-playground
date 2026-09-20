import type { ArtifactBody, ArtifactExpression as Expr, ArtifactSyntax } from "./artifact-parser.ts";
import type { ArmTemplate } from "./deployment-assistance.ts";
import type { EngineeringCheck } from "./engineering-validation-contract.ts";

type Normal = string | boolean | null | { kind: string; value?: string; items?: Normal[] };
interface Resource {
  symbol: string;
  type: string;
  apiVersion?: string;
  name?: Expr;
  parent?: string;
  fields: Map<string, Expr>;
  existing?: boolean;
}
interface Context {
  language: "bicep" | "terraform" | "arm";
  variables: Map<string, Expr>;
  parameters: Map<string, Expr | undefined>;
  resources: Map<string, Resource>;
}
const text = (value: string): Expr => ({ kind: "string", text: value });
const template = (...items: Expr[]): Expr => ({ kind: "template", items });
const object = (value: unknown): Record<string, unknown> | undefined =>
  value !== null && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : undefined;
const unknown = (): Expr => ({ kind: "unsupported" });

class ArmExpressionReader {
  private index = 0;
  private readonly input: string;
  constructor(input: string) { this.input = input; }
  private space() { while (/\s/.test(this.input[this.index] ?? "") && this.index < this.input.length) this.index++; }
  private string(): string {
    this.index++;
    let result = "";
    while (this.index < this.input.length) {
      const character = this.input[this.index++];
      if (character !== "'") result += character;
      else if (this.input[this.index] === "'") { result += "'"; this.index++; }
      else return result;
    }
    throw new Error("Unclosed ARM string.");
  }
  expression(depth = 0): Expr {
    if (depth > 64) throw new Error("ARM expression depth exceeded.");
    this.space();
    let result: Expr;
    if (this.input[this.index] === "'") result = text(this.string());
    else {
      const token = /^[A-Za-z_][A-Za-z0-9_]*|^-?\d+(?:\.\d+)?/.exec(this.input.slice(this.index))?.[0];
      if (!token) throw new Error("Unsupported ARM expression.");
      this.index += token.length;
      this.space();
      if (this.input[this.index] === "(") {
        this.index++;
        const items: Expr[] = [];
        this.space();
        while (this.input[this.index] !== ")") {
          items.push(this.expression(depth + 1));
          this.space();
          if (this.input[this.index] !== ",") break;
          this.index++;
        }
        if (this.input[this.index++] !== ")") throw new Error("Unclosed ARM call.");
        result = { kind: "call", text: token, items };
      } else if (/^-?\d/.test(token)) result = { kind: "number", text: token };
      else result = { kind: "reference", text: token };
    }
    this.space();
    while (this.input[this.index] === ".") {
      this.index++;
      const name = /^[A-Za-z_][A-Za-z0-9_]*/.exec(this.input.slice(this.index))?.[0];
      if (!name) throw new Error("Unsupported ARM access.");
      this.index += name.length;
      result = { kind: "access", text: name, items: [result] };
      this.space();
    }
    return result;
  }
  parse(): Expr {
    const result = this.expression();
    this.space();
    if (this.index !== this.input.length) throw new Error("Unsupported ARM expression suffix.");
    return result;
  }
}

function armValue(value: unknown): Expr {
  if (typeof value === "string") {
    if (value.startsWith("[[")) return text(value.slice(1));
    if (value.startsWith("[") && value.endsWith("]")) {
      try { return new ArmExpressionReader(value.slice(1, -1)).parse(); } catch { return unknown(); }
    }
    return text(value);
  }
  if (typeof value === "boolean") return { kind: "boolean", boolean: value };
  if (typeof value === "number" && Number.isFinite(value)) return { kind: "number", text: String(value) };
  if (value === null) return { kind: "null" };
  if (Array.isArray(value)) return { kind: "array", items: value.map(armValue) };
  const record = object(value);
  return record ? { kind: "object", entries: Object.entries(record).map(([key, item]) => ({ key: armValue(key), value: armValue(item) })) } : unknown();
}

function pathOf(value: Expr): string[] | undefined {
  if (value.kind === "reference" && value.text) return [value.text];
  if (value.kind === "access" && value.text && value.items?.[0]) {
    const prefix = pathOf(value.items[0]);
    return prefix && [...prefix, value.text];
  }
  return undefined;
}
const same = (left: Normal, right: Normal) => JSON.stringify(left) === JSON.stringify(right);
function join(values: Normal[]): Normal {
  const items: Normal[] = [];
  for (const value of values) {
    const parts = typeof value === "object" && value?.kind === "template" ? value.items ?? [] : [value];
    for (const part of parts) {
      if (part === "") continue;
      if (typeof part === "string" && typeof items.at(-1) === "string") items[items.length - 1] = `${items.at(-1)}${part}`;
      else items.push(part);
    }
  }
  return items.length === 1 ? items[0] : { kind: "template", items };
}

function resourceName(resource: Resource, context: Context, seen = new Set<string>()): Normal | undefined {
  if (!resource.name || seen.has(`resource:${resource.symbol}`)) return undefined;
  const next = new Set(seen).add(`resource:${resource.symbol}`);
  const own = normalize(resource.name, context, next);
  if (own === undefined || !resource.parent) return own;
  const parent = context.resources.get(resource.parent);
  const parentName = parent && resourceName(parent, context, next);
  return parentName === undefined ? undefined : join([parentName, "/", own]);
}

function normalize(value: Expr, context: Context, seen = new Set<string>(), depth = 0): Normal | undefined {
  if (depth > 64) return undefined;
  if (value.kind === "string") return value.text ?? "";
  if (value.kind === "boolean") return value.boolean;
  if (value.kind === "null") return null;
  if (value.kind === "number") return { kind: "number", value: value.text };
  const ref = pathOf(value);
  if (ref) {
    const parameter = context.language === "terraform" && ref[0] === "var" ? ref[1] : ref.length === 1 ? ref[0] : undefined;
    if (parameter && context.parameters.has(parameter)) return { kind: "parameter", value: parameter };
    const variable = context.language === "terraform" && ref[0] === "local" ? ref[1] : ref.length === 1 ? ref[0] : undefined;
    if (variable && context.variables.has(variable)) {
      if (seen.has(`variable:${variable}`)) return undefined;
      return normalize(context.variables.get(variable)!, context, new Set(seen).add(`variable:${variable}`), depth + 1);
    }
    const resourceKey = context.language === "terraform" ? ref.slice(0, 2).join(".") : ref[0];
    const resource = context.resources.get(resourceKey);
    const member = ref.slice(context.language === "terraform" ? 2 : 1);
    if (resource && member.length === 1 && (member[0] === "name" || member[0] === "id")) {
      const name = resourceName(resource, context, seen);
      return name === undefined ? undefined : member[0] === "name" ? name : { kind: "resourceId", value: resource.type.toLowerCase(), items: [name] };
    }
  }
  if (value.kind === "access" && value.items?.[0]) {
    const source = normalize(value.items[0], context, seen, depth + 1);
    return source === undefined ? undefined : { kind: "access", value: value.text, items: [source] };
  }
  if (value.kind === "object") {
    const entries: Normal[] = [];
    const keys = new Set<string>();
    for (const entry of value.entries ?? []) {
      const key = normalize(entry.key, context, seen, depth + 1);
      const item = normalize(entry.value, context, seen, depth + 1);
      if (key === undefined || item === undefined || keys.has(JSON.stringify(key))) return undefined;
      keys.add(JSON.stringify(key));
      entries.push({ kind: "entry", items: [key, item] });
    }
    return { kind: "object", items: entries.sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b))) };
  }
  if (value.kind === "call") {
    const name = value.text?.toLowerCase();
    const first = value.items?.[0];
    if ((name === "parameters" || name === "variables") && first?.kind === "string" && value.items?.length === 1) {
      const identifier = first.text ?? "";
      if (name === "parameters") return context.parameters.has(identifier) ? { kind: "parameter", value: identifier } : undefined;
      if (!context.variables.has(identifier) || seen.has(`variable:${identifier}`)) return undefined;
      return normalize(context.variables.get(identifier)!, context, new Set(seen).add(`variable:${identifier}`), depth + 1);
    }
    const items = value.items?.map((item) => normalize(item, context, seen, depth + 1)) ?? [];
    if (items.some((item) => item === undefined)) return undefined;
    const known = items as Normal[];
    if (name === "concat") return join(known);
    if (name === "resourceid" && typeof known[0] === "string" && /^Microsoft\./i.test(known[0]) && known.length > 1) {
      return { kind: "resourceId", value: known[0].toLowerCase(), items: [join(known.slice(1).flatMap((item, index) => index ? ["/", item] : [item]))] };
    }
    if (name && ["resourcegroup", "subscription", "tenant", "environment", "guid", "uniquestring", "tolower", "toupper"].includes(name)) {
      return { kind: "call", value: name, items: known };
    }
    return undefined;
  }
  if (value.kind === "template" || value.kind === "array") {
    const items = (value.items ?? []).map((item) => normalize(item, context, seen, depth + 1));
    if (items.some((item) => item === undefined)) return undefined;
    return value.kind === "template" ? join(items as Normal[]) : { kind: "array", items: items as Normal[] };
  }
  return undefined;
}

const TF_TYPES: Record<string, string> = {
  azurerm_service_plan: "Microsoft.Web/serverfarms", azurerm_linux_web_app: "Microsoft.Web/sites",
  azurerm_windows_web_app: "Microsoft.Web/sites", azurerm_linux_function_app: "Microsoft.Web/sites",
  azurerm_mssql_server: "Microsoft.Sql/servers", azurerm_mssql_database: "Microsoft.Sql/servers/databases",
  azurerm_storage_account: "Microsoft.Storage/storageAccounts", azurerm_api_management: "Microsoft.ApiManagement/service",
  azurerm_cognitive_account: "Microsoft.CognitiveServices/accounts", azurerm_key_vault: "Microsoft.KeyVault/vaults",
  azurerm_cdn_frontdoor_profile: "Microsoft.Cdn/profiles", azurerm_servicebus_namespace: "Microsoft.ServiceBus/namespaces",
  azurerm_cosmosdb_account: "Microsoft.DocumentDB/databaseAccounts", azurerm_kubernetes_cluster: "Microsoft.ContainerService/managedClusters",
  azurerm_virtual_network: "Microsoft.Network/virtualNetworks", azurerm_subnet: "Microsoft.Network/virtualNetworks/subnets",
  azurerm_log_analytics_workspace: "Microsoft.OperationalInsights/workspaces", azurerm_application_insights: "Microsoft.Insights/components",
  azurerm_user_assigned_identity: "Microsoft.ManagedIdentity/userAssignedIdentities", azurerm_role_assignment: "Microsoft.Authorization/roleAssignments",
};

function fieldMap(body: ArtifactBody, failures: string[]): Map<string, Expr> {
  const result = new Map<string, Expr>();
  for (const attribute of body.attributes) {
    if (result.has(attribute.name)) failures.push(`Duplicate code property "${attribute.name.slice(0, 100)}".`);
    result.set(attribute.name, attribute.value);
  }
  return result;
}
function member(value: Expr | undefined, key: string): Expr | undefined {
  return value?.kind === "object" ? value.entries?.find((entry) => entry.key.kind === "string" && entry.key.text === key)?.value : undefined;
}
function selectedFields(fields: Map<string, Expr>): Map<string, Expr> {
  const result = new Map<string, Expr>();
  for (const key of ["location", "kind", "identity", "tags"]) if (fields.has(key)) result.set(key, fields.get(key)!);
  const sku = member(fields.get("sku"), "name");
  if (sku) result.set("sku.name", sku);
  for (const key of ["serverFarmId", "httpsOnly", "enableRbacAuthorization", "enablePurgeProtection", "allowSharedKeyAccess", "allowBlobPublicAccess", "disableLocalAuth", "publicNetworkAccess", "WorkspaceResourceId"]) {
    const value = member(fields.get("properties"), key);
    if (value) result.set(`properties.${key}`, value);
  }
  return result;
}

function terraformFields(type: string, attributes: Map<string, Expr>, body: ArtifactBody, failures: string[]): Map<string, Expr> {
  const result = new Map([...attributes].filter(([key]) => ["location", "tags"].includes(key)));
  const copy = (attribute: string, target: string) => { if (attributes.has(attribute)) result.set(target, attributes.get(attribute)!); };
  const inverted = (attribute: string, target: string) => {
    const value = attributes.get(attribute);
    if (value) result.set(target, value.kind === "boolean" ? { kind: "boolean", boolean: !value.boolean } : unknown());
  };
  const identity = body.blocks.filter((block) => block.type === "identity");
  if (identity.length > 1) failures.push("Terraform has multiple identity blocks for one resource.");
  if (identity.length === 1) {
    const fields = fieldMap(identity[0].body, failures);
    if (fields.has("identity_ids")) result.set("identity", unknown());
    else if (fields.has("type")) result.set("identity", { kind: "object", entries: [{ key: text("type"), value: fields.get("type")! }] });
  }
  if (type === "azurerm_linux_web_app") result.set("kind", text("app,linux"));
  if (type === "azurerm_windows_web_app") result.set("kind", text("app"));
  if (type === "azurerm_linux_function_app") result.set("kind", text("functionapp,linux"));
  if (type === "azurerm_service_plan") {
    const os = attributes.get("os_type");
    result.set("kind", os?.kind === "string" ? text(os.text === "Linux" ? "linux" : "app") : unknown());
  }
  if (["azurerm_service_plan", "azurerm_mssql_database", "azurerm_cognitive_account", "azurerm_cdn_frontdoor_profile"].includes(type)) copy("sku_name", "sku.name");
  if (type === "azurerm_api_management" && attributes.has("sku_name")) {
    const sku = attributes.get("sku_name")!;
    result.set("sku.name", sku.kind === "string" ? text(sku.text?.replace(/_\d+$/, "") ?? "") : unknown());
  }
  if (type === "azurerm_cognitive_account") copy("kind", "kind");
  if (type === "azurerm_cosmosdb_account") copy("kind", "kind");
  if (type === "azurerm_storage_account") {
    copy("account_kind", "kind");
    const tier = attributes.get("account_tier");
    const replication = attributes.get("account_replication_type");
    if (tier && replication) result.set("sku.name", template(tier, text("_"), replication));
  }
  copy("service_plan_id", "properties.serverFarmId");
  copy("https_only", "properties.httpsOnly");
  copy("rbac_authorization_enabled", "properties.enableRbacAuthorization");
  copy("purge_protection_enabled", "properties.enablePurgeProtection");
  copy("shared_access_key_enabled", "properties.allowSharedKeyAccess");
  copy("allow_nested_items_to_be_public", "properties.allowBlobPublicAccess");
  copy("workspace_id", "properties.WorkspaceResourceId");
  copy("public_network_access", "properties.publicNetworkAccess");
  inverted("local_auth_enabled", "properties.disableLocalAuth");
  inverted("local_authentication_enabled", "properties.disableLocalAuth");
  const network = attributes.get("public_network_access_enabled");
  if (network) result.set("properties.publicNetworkAccess", network.kind === "boolean" ? text(network.boolean ? "Enabled" : "Disabled") : unknown());
  return result;
}

function scanBody(body: ArtifactBody, failures: string[], unresolved: string[]) {
  const bodies = [body];
  const expressions: Expr[] = [];
  const sensitive = (name: string) => /password|clientsecret|accesstoken|connectionstring|accountkey|primarykey|secondarykey|apikey|^secret$|^token$/i.test(name.replace(/[_-]/g, ""));
  while (bodies.length) {
    const item = bodies.pop()!;
    expressions.push(...item.attributes.map((attribute) => attribute.value));
    for (const block of item.blocks) {
      bodies.push(block.body);
      if (["module", "provisioner", "dynamic", "lifecycle", "unsupported"].includes(block.type)) unresolved.push("Modules, provisioners, dynamic/lifecycle behavior or unsupported declarations are not compared.");
      if (block.type === "provider" && block.labels[0] !== "azurerm") unresolved.push("Only the AzureRM provider is covered by the current Terraform mapping profile.");
      if (block.type === "required_providers") {
        for (const attribute of block.body.attributes) {
          const source = member(attribute.value, "source");
          if (attribute.name !== "azurerm" || source?.kind !== "string" || !["hashicorp/azurerm", "registry.terraform.io/hashicorp/azurerm"].includes(source.text ?? "")) {
            unresolved.push("A Terraform provider source is absent, computed or outside the audited AzureRM profile.");
          }
        }
      }
      if (["param", "variable"].includes(block.type) && sensitive(block.labels[0] ?? "") &&
          block.body.attributes.some((attribute) => attribute.name === "default" && attribute.value.kind === "string")) {
        failures.push("Code includes a literal default for a sensitive parameter.");
      }
    }
  }
  let count = 0;
  while (expressions.length) {
    if (++count > 20_000) { unresolved.push("Artifact exceeds the bounded expression inspection profile."); break; }
    const expression = expressions.pop()!;
    if (expression.kind === "unsupported") unresolved.push("Artifact contains an expression outside the comparison profile.");
    if (expression.kind === "call" && /^(loadTextContent|loadJsonContent|loadYamlContent|loadFileAsBase64|readEnvironmentVariable|file|filebase64|fileexists|fileset|templatefile|pathexpand|listKeys|listSecrets|listCredentials|newGuid|utcNow)$/i.test(expression.text ?? "")) {
      unresolved.push("File/environment reads, credential lookups or nondeterministic functions are not evaluated or certified.");
    }
    for (const entry of expression.entries ?? []) {
      if (entry.key.kind === "string" && sensitive(entry.key.text ?? "") && entry.value.kind === "string") failures.push("Code contains a literal value in a recognized sensitive property.");
      expressions.push(entry.key, entry.value);
    }
    expressions.push(...expression.items ?? []);
  }
}

export function inspectArtifactConsistency(
  syntax: ArtifactSyntax,
  format: "bicep" | "terraform" | "azure-cli" | "powershell",
  templateInput: ArmTemplate,
): EngineeringCheck {
  if (format === "powershell" || format === "azure-cli") return {
    id: "artifact-consistency", status: "not-verified", summary: "Imperative script effects cannot be proven equivalent to ARM without execution.",
    details: ["No generated script is executed. Review the script and ARM independently; automatic Portal publication is disabled for this profile."],
  };
  const failures: string[] = [];
  const unresolved: string[] = [];
  if (!syntax.valid || !syntax.body) return { id: "artifact-consistency", status: "not-verified", summary: "No valid declaration inventory is available.", details: [] };
  scanBody(syntax.body, failures, unresolved);
  if (format === "bicep" && syntax.body.attributes.some((attribute) => attribute.name === "targetScope" && (attribute.value.kind !== "string" || attribute.value.text !== "resourceGroup"))) {
    unresolved.push("Only resource-group Bicep scope is compared by this handoff profile.");
  }
  if (!syntax.complete) unresolved.push("The syntax tree contains constructs outside the bounded static comparison profile.");
  const code: Context = { language: format, variables: new Map(), parameters: new Map(), resources: new Map() };
  const declarations = new Set<string>();
  const bicepNames = new Set<string>();
  for (const block of syntax.body.blocks) {
    const attributes = fieldMap(block.body, failures);
    if (format === "bicep" && ["param", "var", "resource", "output"].includes(block.type)) {
      if (bicepNames.has(block.labels[0])) failures.push("Bicep contains duplicate top-level symbol names.");
      bicepNames.add(block.labels[0]);
    }
    if (["module", "unsupported"].includes(block.type)) unresolved.push("Modules, imports or unsupported declarations require external review.");
    if (block.type === "param" || block.type === "variable") {
      const name = block.labels[0];
      if (!name || declarations.has(`parameter:${name}`)) failures.push("Code contains duplicate or missing parameter names.");
      declarations.add(`parameter:${name}`);
      code.parameters.set(name, attributes.get("default"));
    } else if (block.type === "var") {
      const name = block.labels[0];
      if (!name || declarations.has(`variable:${name}`)) failures.push("Code contains duplicate or missing variable names.");
      declarations.add(`variable:${name}`);
      code.variables.set(name, attributes.get("value") ?? unknown());
    } else if (block.type === "locals") {
      for (const [name, value] of attributes) {
        if (code.variables.has(name)) failures.push("Code contains duplicate local values.");
        code.variables.set(name, value);
      }
    } else if (block.type === "resource") {
      const isBicep = format === "bicep";
      const [first, second] = block.labels;
      const symbol = isBicep ? first : `${first}.${second}`;
      const at = isBicep ? second?.lastIndexOf("@") ?? -1 : -1;
      const type = isBicep ? second?.slice(0, at) : TF_TYPES[first];
      if (!type || (isBicep && at < 1)) { unresolved.push("A resource type is computed or outside the audited mapping table."); continue; }
      if (code.resources.has(symbol)) failures.push("Code contains duplicate resource declaration identities.");
      if (attributes.has("count") || attributes.has("for_each") || block.body.blocks.some((item) => ["dynamic", "provisioner"].includes(item.type))) {
        unresolved.push("Resource expansion, dynamic blocks or provisioners are not statically compared.");
      }
      code.resources.set(symbol, {
        symbol, type, apiVersion: isBicep ? second.slice(at + 1) : undefined,
        name: attributes.get("name"), parent: isBicep ? pathOf(attributes.get("parent") ?? unknown())?.[0] : undefined,
        fields: isBicep ? selectedFields(attributes) : terraformFields(first, attributes, block.body, failures),
        existing: block.flags?.includes("existing"),
      });
      if (!isBicep && (first === "azurerm_mssql_database" || first === "azurerm_subnet")) {
        const parent = attributes.get(first === "azurerm_mssql_database" ? "server_id" : "virtual_network_name");
        const ref = parent && pathOf(parent);
        if (ref?.length === 3 && ref[2] === "id") code.resources.get(symbol)!.parent = ref.slice(0, 2).join(".");
        else if (first === "azurerm_subnet" && parent && attributes.get("name")) code.resources.get(symbol)!.name = template(parent, text("/"), attributes.get("name")!);
        else unresolved.push("A child resource parent name cannot be determined without external state.");
      }
    }
  }
  const arm: Context = {
    language: "arm",
    variables: new Map(Object.entries(templateInput.variables ?? {}).map(([name, value]) => [name, armValue(value)])),
    parameters: new Map(Object.entries(templateInput.parameters ?? {}).map(([name, value]) => [name, value.defaultValue === undefined ? undefined : armValue(value.defaultValue)])),
    resources: new Map(),
  };
  for (const resource of templateInput.resources) {
    if ("copy" in resource || "condition" in resource) unresolved.push("ARM resource expansion or conditions are not statically compared.");
    arm.resources.set(`${resource.type}/${resource.name}`, {
      symbol: `${resource.type}/${resource.name}`, type: resource.type, apiVersion: resource.apiVersion,
      name: armValue(resource.name), fields: selectedFields(new Map(Object.entries(resource).map(([key, value]) => [key, armValue(value)]))),
    });
  }
  const actual = [...code.resources.values()].filter((resource) => !resource.existing);
  const embeddedSubnets = templateInput.resources.some((resource) => object(resource.properties)?.subnets !== undefined);
  if (actual.length !== arm.resources.size) {
    const message = `Code declares ${actual.length} resources, while ARM declares ${arm.resources.size}.`;
    if (!syntax.complete || (format === "terraform" && embeddedSubnets)) unresolved.push(`${message} Expansion/embedded-child normalization is outside this profile.`);
    else failures.push(message);
  }
  const matched = new Set<string>();
  for (const resource of actual) {
    const name = resourceName(resource, code);
    if (name === undefined) { unresolved.push(`Resource "${resource.symbol.slice(0, 100)}" has an indeterminate name.`); continue; }
    const counterpart = [...arm.resources.values()].find((candidate) => {
      const candidateName = resourceName(candidate, arm);
      return candidate.type.toLowerCase() === resource.type.toLowerCase() && candidateName !== undefined && same(candidateName, name);
    });
    if (!counterpart || matched.has(counterpart.symbol)) {
      const ambiguous = [...arm.resources.values()].some((candidate) => candidate.type.toLowerCase() === resource.type.toLowerCase() && resourceName(candidate, arm) === undefined);
      const message = `Resource "${resource.symbol.slice(0, 100)}" has no unique matching ARM type/name declaration.`;
      if (ambiguous || (format === "terraform" && embeddedSubnets && resource.type.endsWith("/subnets"))) unresolved.push(message);
      else failures.push(message);
      continue;
    }
    matched.add(counterpart.symbol);
    if (format === "bicep" && resource.apiVersion !== counterpart.apiVersion) failures.push(`Resource "${resource.symbol.slice(0, 100)}" has different API versions in code and ARM.`);
    for (const key of new Set([...resource.fields.keys(), ...counterpart.fields.keys()])) {
      const left = resource.fields.get(key);
      const right = counterpart.fields.get(key);
      if (!left || !right) {
        const message = `Resource "${resource.symbol.slice(0, 100)}" differs in declared "${key}".`;
        if (format === "terraform" && !left) unresolved.push(`${message} Provider defaults are not inferred.`);
        else failures.push(message);
        continue;
      }
      const codeValue = normalize(left, code);
      const armResult = normalize(right, arm);
      if (codeValue === undefined || armResult === undefined) unresolved.push(`Resource "${resource.symbol.slice(0, 100)}" has indeterminate "${key}".`);
      else if (!same(codeValue, armResult)) failures.push(`Resource "${resource.symbol.slice(0, 100)}" differs in "${key}" between code and ARM.`);
    }
  }
  for (const [name, value] of code.parameters) {
    if (!arm.parameters.has(name)) { unresolved.push(`Code parameter "${name.slice(0, 100)}" has no same-named ARM binding.`); continue; }
    const other = arm.parameters.get(name);
    if (!value || !other) continue;
    const left = normalize(value, code);
    const right = normalize(other, arm);
    if (left === undefined || right === undefined) unresolved.push(`Parameter "${name.slice(0, 100)}" has a computed default outside this profile.`);
    else if (!same(left, right)) failures.push(`Parameter "${name.slice(0, 100)}" has different declared defaults.`);
  }
  return {
    id: "artifact-consistency", status: failures.length ? "failed" : unresolved.length ? "not-verified" : "passed",
    summary: failures.length ? "Code and ARM disagree on their declared resource inventory or selected settings." :
      unresolved.length ? "Some code/ARM correspondence remains indeterminate." : "Resource inventory and selected static settings align; full deployment equivalence is not certified.",
    details: [...new Set([...failures, ...unresolved]), "Comparison covers declaration identity and selected explicit settings, not full compiler/provider expansion or every resource property."].slice(0, 100),
  };
}
