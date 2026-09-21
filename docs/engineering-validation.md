# Engineering artifact validation

AI deployment drafts receive an independently computed static report. The model
cannot supply a trusted "passed" flag, and a nonempty code string is not proof
of a usable artifact.

## What the profile checks

`azure-static-v1` separates six checks:

1. **Syntax:** official Bicep lexer/parser diagnostics, official HashiCorp HCL
   byte parsing, or controlled GNU Bash non-executing syntax mode.
2. **Resource mappings:** each declared ARM resource must map to a supported
   canonical service identity, not an editable label or generic primitive.
3. **Coverage:** primary/support declarations, omitted services and unsupported
   products are shown separately. Declared configuration/business requirements
   that are not proven remain review items.
4. **Prerequisites:** selected explicit fields are checked, including App Service
   plan references, Function host identity/storage settings, Entra-only SQL
   administration and workspace-backed Application Insights.
5. **Code/ARM correspondence:** bounded comparison of declaration types, names,
   Bicep API versions, shared parameter defaults and selected explicit settings.
   This is **not general program or deployment equivalence**.
6. **Azure environment:** always **not verified**. No provider initialization,
   RBAC/policy/quota check, name lookup, What-If or resource deployment occurs.

Known syntax, mapping, prerequisite or correspondence failures trigger at most
one model correction inside the same deadline. Remaining failures do not expose
an accepted draft. Unsupported/indeterminate checks produce a clearly labelled
review-only draft, not an invented pass.

## Service readiness before generation

The canvas's **Clean / No issues detected** result checks diagram structure,
not Azure provisioning coverage. **Code & deploy** lists that coverage before
requesting generation, and the palette distinguishes mapped services from
diagram-only symbols.

The catalog's `APP Service API Management` illustration maps to API Management
alongside the primary API Management service icon. The distinct
`APP Service Management` operation symbol is not silently converted to an app
because it was renamed. If it represents an application, **Use Azure App Service
for ...** explicitly corrects that node to the primary service identity. This
preserves its name, position, connections and metadata and is undoable and saved.
The generated Bicep/ARM/Terraform then uses the existing audited App Service
mapping and validation. Unsupported products and generic client annotations
still do not become arbitrary deployable resources.

## Important limits

- Bicep parsing is not full symbol binding, type checking or compilation.
- HCL parsing is not `terraform validate`, provider schema validation or a plan.
- Static correspondence handles a bounded subset of expressions/declarations.
  Modules, external files/environment data, provisioners, dynamic expansion,
  lifecycle behavior, nested-resource normalization and unknown constructs
  remain indeterminate rather than being evaluated.
- Terraform provider-expanded defaults and every resource property are not
  compared. Parameter naming/default differences can require manual review.
- The initial resource profile uses the 14 audited Azure service families shared
  with offline generation. It is not support for every Azure catalog icon.
- Function role scope/existence/propagation, additional trigger access and other
  unresolved prerequisites require review. Mapping a primary resource does not
  certify a working workload.
- **AI PowerShell syntax is deliberately not certified.** The public PowerShell
  `Parser.ParseInput` API can resolve assemblies/modules and initialize DSC,
  even without a caller-created runspace. The app does not invoke it on model
  text. PowerShell remains a review-only AI draft; the separately selected,
  deterministic offline `preview.ps1` retains its tested read-only guarantee.
- Bash `-n` is noninteractive, receives only stdin, uses fixed arguments and a
  fresh environment, and rejects stderr warnings as well as syntax errors.
  Successful parsing does not prove command availability or script/ARM effects.

## Publication boundary

The preview shows the server-derived report, coverage table, parser version and
artifact fingerprint. A downloadable JSON report records the checks and limits.
Automatic Portal publication requires all supported static checks to pass,
separate user consent, and **server-side revalidation of the complete reviewed
code/ARM/mappings/evidence set**. Legacy ARM-only AI publication requests and
client-authored validation flags are rejected. Offline deterministic publication
continues to regenerate its own template from validated architecture input.

Publication is not deployment. It retains the existing short-lived public bearer
link policy; Azure Portal still requires the user's separate review, parameters
and final cost/deployment approval. An unverified download is for independent
engineering review, not permission to execute it.

`POST /api/deploy/validate` is an authenticated, bounded, rate-limited static
validation endpoint. It does not invoke a model, publish a template or execute
infrastructure. It accepts the versioned architecture payload plus an artifact
containing `format`, `code`, `armTemplate` and `resourceMappings`.

## Trusted parser implementation

- Bicep: `Azure.Bicep.Core` **0.47.16**, using only `Parser(text).Program()`,
  `LexingErrorLookup`, `ParsingErrorLookup` and syntax nodes.
- HCL: `github.com/hashicorp/hcl/v2` **v2.25.0**, using `LexConfig` and
  `hclsyntax.ParseConfig` over bytes. No expression evaluation context is created.
- Helpers are compiled from repository-owned adapters in controlled builds, not
  during HTTP requests. Dependencies are pinned by NuGet and Go lock files.
- Requests supply text through stdin, never command names, arguments or source
  paths. Environment variables are allowlisted; Azure credentials, startup hooks
  and loader overrides are not inherited.
- The host limits input/output, parser concurrency and execution time, terminates
  timed-out/cancelled helpers, and treats unavailable or malformed helper output
  as failure rather than success. Parser processes do not share customer state.
- No full Bicep compiler, module restore, Terraform provider, PowerShell runspace
  or generated script is executed for validation.

## Build and test

Build prerequisites are **.NET SDK 10.0.400** and **Go 1.27.1**.

```powershell
npm run build:validators
npm run test:artifact-parsers
npm run test:playground
npm run build
```

`GO_BINARY` and `DOTNET_BINARY` can select explicit installed tool paths.
`DIAGRAMMATIC_NUGET_SOURCE` permits only the documented official NuGet v3 or
v2 endpoint. The v2 option is useful where the v3 TLS handshake fails; certificate
validation is never disabled.

Outputs live under ignored `node_modules/.cache/artifact-validation`.
The application build checks the helper source fingerprint/platform and copies
the trusted binaries and dependency notices into the standalone artifact.
The existing GitHub workflow builds and smoke-tests Linux helpers, deploys the
application, then verifies the hosted validation endpoint with synthetic fixtures.
No live model call or customer resource provisioning is part of that smoke.

## Source references

- [Official Bicep parser](https://github.com/Azure/bicep/blob/v0.47.16/src/Bicep.Core/Parsing/Parser.cs)
- [Official HCL byte parser](https://github.com/hashicorp/hcl/blob/v2.25.0/hclsyntax/public.go)
- [PowerShell parser and post-parse resolution](https://github.com/PowerShell/PowerShell/blob/v7.6.6/src/System.Management.Automation/engine/parser/Parser.cs)
- [PowerShell symbol resolution](https://github.com/PowerShell/PowerShell/blob/v7.6.6/src/System.Management.Automation/engine/parser/SymbolResolver.cs)
- [GNU Bash manual](https://www.gnu.org/software/bash/manual/bash.html)
- [Azure What-If validation levels and limits](https://learn.microsoft.com/azure/azure-resource-manager/bicep/deploy-what-if)

Dependency attribution and notices are included with the parser distribution.
The Bicep NuGet API is version-unstable; upgrades require the full parser,
artifact and hosted regression corpus rather than a floating version change.
