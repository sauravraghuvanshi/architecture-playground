# AI destinations, local history and retention

## Deliberate destinations

AI requests use server/operator configuration, not an endpoint supplied inside a
customer request. Missing configuration means unavailable; the application never
selects the public demo as an implicit fallback.

- Chat generation, description and Whiteboard conversion use configured Azure
  chat credentials.
- Image generation uses configured image credentials (or explicitly configured
  shared Azure credentials plus an image deployment).
- An image proxy is used only when its origin is explicitly configured through
  `DIAGRAMMATIC_AI_PROXY_URL`. It is never inferred from development mode.
- Review and deployment generation use their separately configured Foundry
  agents. Offline assessment/export/static artifact validation do not invoke AI.

Chat/image origins must be HTTPS without embedded credentials, URL query,
fragment or path. Explicit HTTP loopback is supported only outside production.
Proxy requests neither forward browser cookies/authorization nor follow
redirects. Self-proxy and chained-proxy requests are rejected.

`GET /api/ai/privacy` returns each capability's selected destination **origin**,
transport, submitted-data description and retention limitations with `no-store`.
It shares the application authentication gate. It does not return API keys,
deployment names, agent names or Foundry project paths.

AI dialogs and the legacy panel show this information before the user requests
processing. If disclosure cannot be loaded, the notice reports that failure;
verify server configuration before submitting sensitive content.

## What leaves the application

| Action | Submitted data |
| --- | --- |
| Generate architecture/diagram | Prompt, applicable business constraints and application catalog/instructions |
| Describe | Selected graph |
| Review | Selected graph, image or description, customer context and bounded correction feedback |
| Whiteboard conversion | PNG plus bounded explicit source service identities |
| Generate image | Prompt, style, size and canvas colors; not the existing Whiteboard scene |
| Generate deployment artifact | Selected architecture, declared intent/requirements, context and correction feedback |

An explicitly configured proxy sees the request and may send it to another
provider. Its downstream configuration/logging/retention is outside this app's
verification boundary. A first-hop disclosure is not a guarantee about every
downstream processor.

## Local controls

- Native generation, review and deployment dialogs provide **Clear AI session**:
  abort pending requests and clear their prompt/context/results. Clearing a
  review also clears its selected upload/imported review copy, not the canvas.
- Whiteboard conversion previews are transient; closing discards the preview
  and aborts pending analysis.
- Legacy prompt-history storage is **off by default**. An explicit **Remember
  prompts on this device** preference permits up to ten local prompts.
- Existing local history is not silently destroyed during migration. Users can
  inspect it and deliberately clear it; its existence does not opt them into
  retaining future prompts.
- Legacy generated candidates are held in memory rather than newly persisted
  in sessionStorage. Clearing local AI history removes only AI-specific keys,
  current drafts/results and any old parked candidate.
- Storage access/deletion failures are reported; a failed erase is not presented
  as successful. Clearing cancels in-flight work so a late response cannot
  silently repopulate the cleared panel.

## What clearing does not do

Clearing AI history/session is **not a global data-erasure request**. It does not
delete saved diagrams, inserted Whiteboard images, comments, versions, exported
files, browser URL/history entries or provider-side data. Generated architecture
intent and evidence that were accepted onto the canvas become diagram content
and retain the diagram's normal local persistence.

Remove those copies separately using their respective controls. No local
control claims to erase provider logs, abuse-monitoring records or diagnostics.

Foundry requests use `store:false` and create no app-managed conversation.
Ordinary chat requests do not create an app-managed provider conversation either.
Neither statement guarantees zero provider retention: service policy, configured
agent features, infrastructure diagnostics and proxy operators may retain data.
Only send content you are authorized to process; never include secrets.
