# Parked Manual Tasks — Phase 4-8 Autonomous Run

These items require human/admin involvement (provisioning, OAuth config,
billing, etc.) so they were parked here while the autonomous code work was
completed. Each section is self-contained: do them in any order.

---

## 1. Azure OpenAI for AI Assist (Phase 6)

The AI Assist panel and `/api/ai/*` routes are fully wired but disabled at
runtime until env vars are set. The floating "✨ AI Assist" button only
appears after `/api/ai/status` returns `configured: true`.

**Steps:**
1. Provision an Azure OpenAI resource: `az cognitiveservices account create
   --kind OpenAI --sku S0 --location eastus -g <rg> -n architecture-playground-aoai`
2. Deploy a chat model (recommend `gpt-4o` or `gpt-4o-mini`):
   - Azure portal → resource → "Model deployments" → Create
   - Note the **deployment name** (you choose it)
3. Set these env vars in Azure App Service (or `.env.local` for dev):
   ```
   AZURE_OPENAI_ENDPOINT=https://<resource-name>.openai.azure.com
   AZURE_OPENAI_API_KEY=<key>
   AZURE_OPENAI_DEPLOYMENT=<deployment-name>
   AZURE_OPENAI_API_VERSION=2024-10-21
   ```
4. Restart the app. Visit `/`, click "✨ AI Assist", try
   "Build a 3-tier web app on Azure" → "Generate".

Files: `lib/ai.ts`, `app/api/ai/*`, `components/playground/AiAssistPanel.tsx`.

---

## 2. Save-as-template (Phase 4 follow-up)

Backend deferred. Implementation idea:
- Add `isTemplate Boolean @default(false)` and `templateCategory String?`
  to `Diagram` model.
- New API: `POST /api/diagrams/[id]/save-as-template { category }`
- New tab on `/templates` page: "My templates" listing user's saved ones.
- Toolbar action "Save as Template" → calls API + toasts confirmation.

Workaround today: users can `Export JSON` and drop the file into
`content/playground-templates/` for a built-in template.

---

## 3. Real-time multi-user collaboration (Phase 7)

Backend (versions, comments) is complete. Real-time CRDT was deferred
because it needs a hosted provider (Yjs y-websocket / PartyKit / Liveblocks).

**Recommended path:** Liveblocks (managed, has Y.js adapter).
1. `npm i @liveblocks/client @liveblocks/react @liveblocks/yjs y-protocols yjs`
2. Sign up at liveblocks.io, create a project, get the secret key.
3. Add `LIVEBLOCKS_SECRET_KEY` env var.
4. Wrap `<Playground>` in `<RoomProvider id={diagramId}>` and replace the
   local React state for nodes/edges with a y-doc-backed shared map.

Affected files when you do this: `components/playground/Playground.tsx`,
`hooks/useAutosave.ts`.

---

## 4. Comments + Version-history UI (Phase 7)

APIs are live (`/api/diagrams/[id]/versions`, `/api/diagrams/[id]/comments`,
`/api/comments/[id]`). UI panels were not built in this autonomous run.

Suggested implementation:
- `components/playground/VersionsPanel.tsx`: timeline list, "Restore" button
  per version → calls `POST /api/diagrams/[id]/versions/[v]`.
- `components/playground/CommentsPanel.tsx`: list of resolved/unresolved
  threads anchored to nodes (highlight the node on hover).
- Add toolbar buttons "💬 Comments" and "🕓 History" that toggle these panels.

Auto-snapshot on `PUT /api/diagrams/[id]` is already wired, so versions
will accumulate automatically.

---

## 5. Organizations + RBAC enforcement (Phase 8)

Schema models (`Organization`, `Membership`, `AuditLog`) and helper
`lib/rbac.ts` (`requireRole`, `meetsRole`) are in place. Audit logging is
hooked into all mutating routes.

Remaining work to **expose** orgs in the product:
1. Add `app/orgs/page.tsx` (list user's orgs, create new).
2. Add `app/orgs/[slug]/page.tsx` (members table, invite by email).
3. Create `POST /api/orgs` and `POST /api/orgs/[id]/members`.
4. Optional: per-diagram `organizationId` for sharing within an org.

---

## 6. SAML / SCIM (Phase 8)

Not implemented. Use `@auth/keycloak-provider` or commercial provider
(WorkOS, Stytch). Requires admin coordination with each customer's IdP.

---

## 7. Stripe billing (Phase 8)

Not implemented. `Organization.stripeCustomerId` field is provisioned for
when you wire it. Steps when ready:
1. `npm i stripe`
2. Create products/prices in Stripe dashboard (Free / Team / Enterprise).
3. Add `/api/stripe/webhook` to receive subscription events.
4. Add billing page at `/orgs/[slug]/billing`.

---

## 8. Custom domains

Add CNAME → `architecture-playground.azurewebsites.net` and configure
custom domain + managed certificate in Azure App Service portal.

---

## 9. (Nice to have) Visio import + MP4 export

Skipped due to complexity (binary parsers / ffmpeg.wasm bundle bloat).
Revisit only if customers actually request these.

---

## What was completed autonomously

- ✅ Phase 0: Typed `ServiceProperties` slot + Zod schema
- ✅ Phase 4: Template engine + parameterized templates + 12 new templates
        + `/templates` gallery page
- ✅ Phase 5: SVG, high-DPI PNG (2x/4x), Mermaid, draw.io export+import,
        IaC framework (Bicep + Terraform emitters), IaC export modal
- ✅ Phase 6: Azure-OpenAI-backed `/api/ai/*` routes + AI Assist panel
        (env-var gated, hidden when not configured)
- ✅ Phase 7 (backend): Versions API + auto-snapshot, Comments API
- ✅ Phase 8: Audit log + helper, RBAC helpers, Org/Membership/ApiKey
        Prisma models + migration, REST `/api/v1/diagrams[/...]` with API
        key auth, API key management UI endpoints, presentation mode
        page (`/presentation/[id]`).
