# Browser support and release qualification

## Policy

Use a current desktop Chromium-family browser or Firefox for the primary editing
experience. Release qualification records the exact engines tested; it is not a
claim that every branded release, extension, operating system or device has been
certified.

| Engine | Pinned qualification version | Scope |
| --- | --- | --- |
| Chromium | 153.0.8010.12 | Primary automated desktop baseline on Windows |
| Firefox | 155.0 | Secondary automated desktop baseline on Windows |
| WebKit | 26.6 | Automated compatibility preview on Windows |

The runner is **Playwright 1.63.0**. Its bundled WebKit is **not real Safari or
iOS-device certification**. Real macOS Safari, iPhone/iPad touch and pen workflows
remain unqualified. The responsive portrait/landscape tests establish layout and
keyboard behavior in the tested engines, not a physical-device guarantee.

The authoritative passing counts, exact application commit and hosted checks
are recorded in the [deployment plan](../.azure/deployment-plan.md). A candidate
is not considered released merely because this policy file exists.

## Core requirements

- Allow the app's first-party IndexedDB and localStorage. Private browsing,
  storage denial or quota exhaustion may limit persistence; use the explicit
  recovery/export controls instead of assuming cloud backup.
- Native palette drag-and-drop carries both a custom MIME type and a marked,
  bounded standard-text envelope. The latter preserves app payloads when a
  browser's native drag transport drops custom MIME. Unmarked external text is
  not interpreted as an app command.
- Cloud primitives and official icons must preserve identity after native drag
  and reload. Whiteboard image bytes and bindings must survive reload and Undo.
- Font embedding uses standard CSS descriptor access, retains the fonts used by
  the diagram, and fails explicitly when a required resource cannot be fetched.
  It does not disable font rendering to make a browser test pass.
- PNG/PDF/GIF checks inspect actual downloaded file bytes, not only a success
  notification. Representative GIFs retain their full ordered frame count.
- Keep the canvas tab active during raster/GIF capture. Large-diagram throughput,
  background exports and physical-device memory limits are not certified by this
  compatibility gate; priority 21 retains broader performance/cancellation scope.
- WebKit may emit the standard ResizeObserver deferred-delivery notification
  during canvas reflow. It is not suppressed in the app. Qualification records
  bounded occurrences, rejects repeated loops or other errors, and requires
  stable layout plus unchanged scene/binary content. See the
  [standard notification algorithm](https://www.w3.org/TR/resize-observer/#deliver-resize-error).

## Testing

The default project remains Chromium. Opt in to the other engines:

```powershell
$env:PLAYWRIGHT_CROSS_BROWSER = "true"
npx playwright test browser-core.spec.ts architecture-enterprise.spec.ts whiteboard-assets.spec.ts whiteboard-flow-gif.spec.ts --project=chromium --project=firefox --project=webkit --workers=1
```

For an already-running production build, set `PLAYWRIGHT_SKIP_WEBSERVER=true`
and `PLAYWRIGHT_BASE_URL` to its URL. Hosted runs additionally use temporary
authenticated storage state, which must not be committed.

Serialize native-drag and raster qualification to avoid introducing simultaneous
browser focus/clipboard contention and to keep timings comparable. Do not replace
native gestures with synthetic drop events, reduce required GIF frames, increase
timeouts to conceal defects, clear persistence on reload, or skip a failing browser.

AI success paths use deterministic fixtures. These tests do not establish live
model accuracy, service latency, provider retention or customer deployability.

## Known diagnostic distinction

The former Playwright 1.59.1 Firefox runner could lose access to a page context
after reload while an independent same-origin observer confirmed that the app had
completed loading, restored both nodes and saved successfully. The runner and its
matching browser binaries were upgraded; normal full-load navigation and exact
restoration assertions remain in the gate. Cache-disabled and profiler probes
were diagnostic only and are not release evidence.
