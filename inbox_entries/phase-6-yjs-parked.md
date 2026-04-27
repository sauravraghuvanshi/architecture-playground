# Phase 6 — Y.js real-time collaboration (PARKED)

**Status**: parked at v1; revisit when persistent backend returns.

## Why parked

Phase 6 of `task/implementation.md` calls for full Y.js + y-websocket + Postgres
snapshotting. That work depends on the auth/diagrams/comments/versions API
subsystem that was removed in commit `3ee1b43` ("Rip out auth subsystem"). With
no auth, no diagrams table, and no per-user identity, real-time collaboration
has no anchor to attach to:

- No **diagram id** server-side → no Y.Doc room key.
- No **user identity** → no presence cursor name/color.
- No **persistence** → updates would be lost on refresh.

Bringing back any one of those is a non-trivial effort that should land as its
own milestone (see also `phase-8-enterprise-parked.md` for Postgres / Stripe).

## What we shipped instead (local-first replacements)

| Plan item                     | Local-first delivered                                          |
|-------------------------------|----------------------------------------------------------------|
| Comments panel UI             | `components/diagrammatic/shared/CommentsPanel.tsx` (localStorage `diagrammatic.comments.<scope>`) |
| Version history UI            | `components/diagrammatic/shared/VersionsPanel.tsx` (localStorage `diagrammatic.versions.<scope>`, capped at 32) |
| Cursor presence + awareness   | n/a (single-user)                                              |
| `y-websocket` server          | n/a                                                            |
| Sharing modal w/ permissions  | n/a (no accounts)                                              |

Both panels key by `${mode}:${diagramId | "draft"}` so when persistent
diagrams come back, the same UI works unchanged — just pass the real GUID.

## Migration path when collaboration ships

1. Re-introduce diagrams + comments + versions tables in Prisma.
2. Add a thin REST adapter (POST/GET) behind the same panel components — swap
   the `localStorage` calls inside `loadComments` / `saveComments` and the
   matching helpers in `VersionsPanel.tsx`. The component API does not change.
3. Layer `y-websocket` on top: each canvas hook subscribes to a `Y.Doc` room
   keyed by diagram id; mirror nodes/edges into `Y.Map`s. Excalidraw has its
   own collab API — wire that separately.
4. Add a presence avatar strip to the toolbar (we already reserved the slot
   between the AI and Templates buttons).

No throwaway code: the current panels graduate cleanly into the multiplayer
model. Until then, single-user comment + snapshot workflow is shipped.
