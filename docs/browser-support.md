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

The release pipeline runs the selected production-build suites declared in
`scripts/release-browser-suites.mjs` before any Azure upload. Chromium covers
architecture modeling/roundtrips/boundaries, Undo, persistence, Whiteboard
restoration/conversion/fidelity and AI streaming/privacy/review/deployment
contracts. Firefox and WebKit additionally run the core editing and exact
screenshot-regression journeys. The existing single-engine screenshot command
remains available for a narrower local check.

```powershell
node scripts\verify-screenshot-regressions.mjs --release
```

This runner starts and stops only its own loopback production server, disables
real AI destinations, and verifies its built release identity before testing.
CI also runs lint/types, application contracts, official parser checks, isolated
script-safety mocks and Bicep/Terraform compiler/provider fixtures. Pull requests
run these gates without deployment credentials or Azure publication. Production
rollouts are serialized rather than cancelling an in-progress upload.

An authenticated, no-store `/api/version` endpoint reports a build-time revision,
unique build ID and timestamp from the packaged manifest, never a runtime
revision environment override. After the SCM operation completes, promotion
requires three consecutive probes matching both the expected commit and build
ID; HTTP health from an older deployment is insufficient. This is release
identity evidence, not a guarantee that every scaled-out instance has drained.
All subsequent hosted parser/API/browser checks must still pass.

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
