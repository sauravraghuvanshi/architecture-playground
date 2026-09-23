# Container Apps and Azure AI Search starter coverage

The offline exporter recognizes the exact Azure Container App catalog asset and both
Azure AI Search assets (`azure/ai/search-service` and
`azure/ai/cognitive-services-search`). Display labels never change the selected
product or artwork. Provider conflicts remain unsupported. WAF recognition means
only that a workload is depicted, not that controls are implemented.

## What is generated

| Service | Bicep / ARM | Terraform | Deliberate limits |
| --- | --- | --- | --- |
| Container Apps | `Microsoft.App/containerApps@2025-01-01` | `azurerm_container_app` | Requires an **existing same-region managed environment** and an explicitly supplied reviewed Linux image. One 1-vCPU/2Gi replica; internal HTTPS ingress to HTTP port 8080; system identity. |
| Azure AI Search | `Microsoft.Search/searchServices@2025-05-01` | `azurerm_search_service` | Basic, one replica/partition; system identity; API keys and public network access disabled. Service shell only. |

Container App Bicep/ARM inputs are `containerAppEnvironmentId` and
`containerAppImage`; Terraform uses `container_app_environment_id` and
`container_app_image`. CLI and preview-only PowerShell wrappers pass the same
Bicep inputs from `CONTAINER_APP_ENVIRONMENT_ID` and `CONTAINER_APP_IMAGE`. These
inputs have **no default** and are shared by all generated Container Apps. Supply an
anonymously pullable image; private-registry identity/permissions require explicit
additional configuration. Bicep/ARM location must match the existing environment;
Terraform derives app location from that environment.

This does not build an orchestrator, implement agents or business actions, connect
diagram edges, publish images, configure probes or diagnostics, or verify a running
workload. Existing-environment availability, region/capacity, workload health and
RBAC remain independent checks. Search requires private endpoints/DNS and caller
data-plane roles before use. Indexes, approved content, ingestion, semantic/vector
configuration, model integration and retrieval quality are **not generated**.

## Validation scope

Both services participate in the canonical engineering coverage table, explicit
prerequisite checks, Bicep/ARM selected-field consistency and Terraform type/field
mapping. Prerequisites remain `not-verified` for valid service shells: resource
declarations cannot establish environment, image, permission or data-plane facts.
The offline Terraform exporter retains the existing snake_case parameter contract
and nullable location default. These differ from the ARM input contract: passing
that raw pair to the hosted equivalence validator can fail its exact-name/default
checks. This change does not alias parameters or claim cross-format equivalence.
Provider/compiler validation and literal-fixture selected-field comparisons are
tested independently; an environment-derived location remains `not-verified`.

`scripts/iac-fixtures.mjs` includes individual, repeated and combined service graphs
and both Search assets in the existing Bicep build/Terraform provider-validation
harness. Run `node --test scripts/test-support-service-coverage.mjs` after building
the existing non-executing parsers. `npm run test:iac-compilers` independently checks
Bicep build, ARM inventories, Terraform formatting and provider schemas. Neither
test provisions resources or makes model calls.

## Schema research

Reviewed on 2026-09-23 using the Azure Bicep schema tool and first-party references:

- [Container Apps schema](https://learn.microsoft.com/azure/templates/microsoft.app/2025-01-01/containerapps)
- [Managed environment schema](https://learn.microsoft.com/azure/templates/microsoft.app/2025-01-01/managedenvironments)
- [Azure AI Search schema](https://learn.microsoft.com/azure/templates/microsoft.search/2025-05-01/searchservices)
- [AzureRM Container App](https://registry.terraform.io/providers/hashicorp/azurerm/latest/docs/resources/container_app)
- [AzureRM Search Service](https://registry.terraform.io/providers/hashicorp/azurerm/latest/docs/resources/search_service)

Azure Terraform best practices were consulted before extending the existing pinned
AzureRM provider emitter. Compiler validation is not an Azure deployment, What-If,
availability guarantee or production-readiness certification.
