# Whiteboard conversion and restoration

## Analysis versus document creation

**To architecture** analyzes a PNG and explicit service identities, then displays
a preview. Analysis does not change either canvas. Cancel, Escape, closing the
dialog, or changing modes discards pending analysis and ignores late responses.
Reopening starts without a preview or consent.

After reviewing the preview, **Create architecture document** starts a committed
local save. It preserves the current Whiteboard and previous architecture in
**My diagrams**, creates a separate architecture document, then opens it.
It does not merge or overwrite the old architecture.

During the committed save, dismissal, reanalysis and duplicate submission are
disabled. This is not a cancellable AI operation. If persistence fails, the
preview and error remain available for explicit retry; the app does not pretend
the save succeeded. Browser navigation/unload cannot roll back writes that have
already completed.

AI results remain interpretations, not a guaranteed reconstruction. Verify
components, identity, grouping and connections before creating the new document.
Editable source-linked conversion remains a later roadmap item.

## Scene intake

Persisted Whiteboard data is validated before recovery, opening, creating,
capturing, mounting or restoring a snapshot. Invalid content must not reach the
drawing engine or mutate its binary files/history first.

The shared contract checks element identity/type, finite geometry, shape-specific
fields, references/bindings, app-state structure and embedded binary records.
It preserves legitimate metadata and known historical runtime-state artifacts;
it does not invent missing relationships or silently discard broken elements.

Native arrow binding coordinates are ratios, not clamped percentages. Excalidraw
can legitimately emit fixed points such as `[1.025, 0.5001]` and
`[-0.025, 0.5001]`, and signed focus values outside `[-1, 1]`, to bind arrows
just outside their target's outline. These finite values are preserved exactly.
Missing mandatory elbow points, malformed tuples, nonfinite values, negative
gaps, invalid references and scene-budget violations are still rejected.
Clamping these values would change the user's geometry and is not a repair.

Native PNG/JPEG/WebP/GIF/BMP/ICO/AVIF/JFIF and static SVG files remain supported.
Known image octet-stream records and native PNG encoder fallback labels receive
explicit MIME-only migration; the image bytes are unchanged. SVGs support static
shapes/text, local gradients/clips/masks and validated inline rasters, not scripts,
foreign objects, animation, stylesheets or external resources.

Bounds include 5,000 elements, 1,000 files, 5 MiB per binary, 25 MiB combined
binaries, 40 MiB scene data, depth 32, 20,000 points per element/100,000 total,
and coordinates within +/-1,000,000. Raster bounds are 8192 pixels per side and
16 million pixels, with bounded animation/container processing. Oversized data
fails explicitly rather than being truncated.

Automatic checkpoints wait for drawing gestures to finish. An in-progress
gesture is a typed transient capture state, not a storage failure: the shared
autosave hook keeps changes unsaved and retries after 650ms without a recovery
banner. Manual save allows up to five seconds for native commits before making
the canvas inert for the database write. If editing is still unfinished, the
save/navigation does not succeed or discard the outgoing canvas.

Pointer-up and cancellation are observed at the window as well as the native
canvas boundary. Starting another gesture invalidates an earlier queued
notification. Live captures and change notifications defer incomplete elements
rather than checkpointing an in-progress action.

Saved-scene restoration is different: a historical empty shape/text or pending
image must not reject the entire board. Only native unfinished placeholders are
omitted from the editable scene; references to those placeholders are detached,
and valid geometry, bindings and image files are retained. Zero-dimension paths
with two points, including legitimate pen dots, remain valid.

Before a named document or recovered draft with placeholders can be overwritten,
library intake carries its unmodified original payload in a version labeled
**Original before unfinished drawing cleanup**. The next document write saves
that version and the editable scene together. Original scratch bytes are left
unchanged. Reloading a settled scene does not create repeated backup versions.

There is no persistent saved-data recovery banner on diagram pages. Truly
malformed saved records are still rejected before mounting and are retained;
details and **Download recovery data** live in **My diagrams > Retained original
data**. Downloads include original draft bytes or the named document, not merely
an error description. **Save recovery copy** there can preserve fresh work while
leaving an unreadable source untouched. Quota, conflict and other actual save
failures still produce actionable notifications; unfinished edits are not storage
failures. A malformed version fails explicitly and leaves the current canvas
untouched. Navigation/unload protection continues to protect unsaved work.

Restoring a valid scene invalidates pending notifications and image decodes.
An image started on an earlier scene cannot appear after restoring another scene,
even when the drawing-engine instance is reused.

Native `isLoading` callbacks are not document changes. Their default background,
elements and preferences are ignored until restoration finishes, and the loading
flag is never persisted. Workspace controls remain unavailable until the native
Whiteboard is ready; live captures during restoration defer rather than
overwriting a saved scene with initialization defaults.

## Verification boundaries

Synthetic AI responses exercise the conversion contract and UI without model
cost or customer data. Browser tests cover native drawing, bundled assets,
image binaries, persistence, snapshots, cancellation, slow saves and failed saves.
The synchronous scene contract validates binary transport, containers and image
headers; it does not fully decompress every persisted pixel. Browser image
decoding and the server's separate AI-evidence pixel validation remain distinct.
These checks do not certify live model accuracy, provider retention or the
deployability of the resulting architecture.

See [AI privacy](ai-privacy.md), [the roadmap](implementation-roadmap.md) and
[release evidence](../.azure/deployment-plan.md) for current delivery status.
