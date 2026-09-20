# Versioned architecture model

The UI-independent contract is defined in
[`architecture-model.ts`](../lib/architecture-model.ts). Runtime schemas and
TypeScript types share that definition. The native canvas re-exports its old
type names for compatibility, but no longer owns their definitions.

## Versions and migration

Native JSON exports now include `schemaVersion: 1`. Unversioned native diagrams
migrate on import without mutating the original input. Known legacy service
aliases resolve through the finite catalog identity table; display labels never
change identity. Unknown products remain unresolved rather than being guessed.
Service provider is derived only from an explicit provider-qualified identity,
not from a label, boundary or region.

Unsupported versions, malformed metadata, conflicting providers, duplicate IDs
and missing references fail before replacing the current canvas. Re-reading a
current document is idempotent. Loading an old valid document does not cause
autosave revision churn solely because the in-memory representation was upgraded;
an explicit save or a real edit persists the current representation.

These version numbers have different scopes:

| Scope | Version |
| --- | --- |
| Native architecture payload | `schemaVersion: 1` |
| IndexedDB diagram-library envelope | Existing `schemaVersion: 1`, unchanged |
| Legacy playground storage envelope | Existing `version: 2`, unchanged |

The legacy adapter shares semantic schemas and projects provider, properties,
metadata and relationships into the native model. Legacy storage versions below
1, fractional versions and future versions cannot silently migrate.
Legacy file imports check their envelope version before unwrapping the graph.
An unreadable/future autosave pauses automatic writes, displays a recovery
warning, and keeps the original key intact even when a user edits a new graph.
Valid older data migrates in memory; its legacy source key is retained rather
than deleted before a verified restore.

## Document context

Optional `metadata` contains `name`, `description`, `author`, `tags`, timestamps,
the original `designIntent`, and these bounded collections:

- `environments`: stable `id`, display `name`, optional `description`.
- `requirements`: stable `id`, `category`, `statement`, optional `evidenceIds`.
  Categories: functional, reliability, security, cost, performance, operations,
  compliance and other.
- `evidence`: stable `id`, `source`, `summary`, and optional HTTPS `uri`,
  `sourceElementId` and ISO-8601 `capturedAt`.
  Sources: user, document, configuration, test, whiteboard-model and ai-assumption.

IDs are unique within each collection. Node environment/requirement/evidence
references, edge requirement/evidence references and requirement evidence
references must resolve. Data is bounded to 500 nodes, 1,000 edges, 50
environments, 100 requirements and 1,000 evidence entries. Each reference list
has at most 100 unique IDs. Evidence sources are declarations, **not proof that
Diagrammatic independently verified the claim**.

## Nodes, relationships and boundaries

Existing `icon`, `shape` and `group` discriminators, IDs, geometry, parent-relative
coordinates, handles and visual style fields are preserved.

Optional node `semantics` contains:

- `provider`: azure, aws or gcp; must match a service's provider-qualified icon ID.
- `region`, `sku`, `environmentId`.
- `properties`: at most 32 bounded scalar string/number/boolean values.
- `requirementIds`, `evidenceIds`.

Named semantic fields cannot also appear as free-form property keys.
Legacy string `properties.region` and `properties.sku` become the corresponding
named semantic fields. Other properties are retained. Contradictory legacy and
semantic values are rejected rather than arbitrarily selected.

Optional edge `semantics` contains `connectionType`, `protocol`, `description`,
`lineStyle`, `arrowStyle`, `requirementIds` and `evidenceIds`. Connection types
are data-flow, network, dependency, sequence and custom. Legacy relationship
details remain in the JSON even when the native visual editor does not expose
every legacy rendering option.

Groups continue to use `tier` and `parentId` for named, nested boundaries such
as Landing Zone, Virtual Network and Subnet. Containment expresses design intent;
it does not infer deployment scope, network integration or access controls.

## Example

```json
{
  "schemaVersion": 1,
  "metadata": {
    "name": "Payments",
    "designIntent": "Keep customer data in Europe.",
    "environments": [{ "id": "prod", "name": "Production" }],
    "requirements": [{
      "id": "residency",
      "category": "compliance",
      "statement": "EU residency",
      "evidenceIds": ["owner"]
    }],
    "evidence": [{
      "id": "owner",
      "source": "user",
      "summary": "Workload owner's declared residency requirement."
    }]
  },
  "nodes": [{
    "kind": "icon",
    "id": "api",
    "label": "Payments API",
    "iconId": "azure/application/application-service",
    "iconPath": "/cloud-icons/azure/application/application-service.svg",
    "x": 100,
    "y": 100,
    "semantics": {
      "provider": "azure",
      "region": "westeurope",
      "sku": "P1v3",
      "environmentId": "prod",
      "requirementIds": ["residency"],
      "evidenceIds": ["owner"]
    }
  }],
  "edges": []
}
```

## Editing and downstream behavior

The Inspector shows document context, linked requirements and source-labelled
evidence. It edits declared region/SKU, selects a declared environment, and
edits relationship type and protocol. These edits participate in Undo/Redo.
Environment definitions, requirements, evidence and additional properties can
be supplied through the versioned JSON contract; a complete structured context
authoring UI is not implied by this foundational model.

Canvas serialization, history, named saves, reload, versions and JSON export
preserve the context. Serialized metadata is copied, not shared with live state.
Original generation prompts and user business constraints are retained separately
from model prose. Whiteboard conversion keeps bounded textual model observations
and source element IDs, not the transient source PNG or scene binaries.

Review and deployment requests carry this same context. A changed region, SKU
or root requirement makes an earlier AI review stale. Metadata is untrusted
evidence, never instructions to execute. Review/deployment egress and privacy
notices still apply; do not put credentials or secrets into properties or evidence.

Offline IaC remains a starter generator. It explicitly warns when per-service
configuration or requirements are not implemented/evaluated instead of silently
claiming equivalence. Keep the source architecture JSON alongside exported code.
Compiler validity is not proof that a customer's architectural requirements,
networking, permissions or workload deployment are satisfied.
