# Responsive and keyboard editing

## Studio layout

Below 1280 CSS pixels, **Assets** opens architecture components or Whiteboard
symbols in a drawer. **Properties** opens the architecture Inspector. These
surfaces overlay the canvas rather than reducing it to an unusable strip.
Selecting a component/symbol inserts it and closes the drawer.

The canvas remains mounted: opening and closing panels must not reset its content,
history or selection. Drawer content remains mounted too, retaining its search
and section state. At desktop widths, palettes and Inspector remain inline.

Comments and versions use the same compact overlay pattern. Opening one closes
the other utility panel. On desktop they use the Inspector's context-rail space,
instead of consuming several sidebars' worth of canvas width.

## Keyboard behavior

- Dialogs/drawers move focus inside on opening, keep Tab/Shift+Tab inside the
  visible enabled controls, close on Escape when dismissal is allowed, and return
  focus to the invoking element.
- Deliberate document commits remain non-dismissible until persistence finishes.
  Keyboard accessibility does not turn a committed save into a cancellable
  inference request.
- Boundary and export disclosures open with ArrowDown/ArrowUp, focus their first/
  last action, support arrow navigation and Home/End, and close with Escape.
  Their actions remain ordinary buttons; Tab works without a fake application
  menu role. Enter/Space retains the disclosure trigger focus so Tab reaches
  its first action, preserving the existing interaction.
- Workspace tabs use Left/Right and Home/End to move focus. Enter/Space activates
  the focused mode, preserving the existing save-before-switch workflow and
  returning focus after that asynchronous save.
- Canvas shortcuts do not mutate the document behind a focused dialog.
- Compatibility-route export/help/command/context surfaces share the keyboard
  foundations; Space on a toolbar button activates it instead of starting playback.
  Focus the compatibility canvas and press Shift+F10 to open its context actions.

Opening the diagram library records its invoking control before any save makes
the workspace inert. Closing the library can therefore restore focus correctly
even when opening it required saving a dirty draft.

## Scope and checks

The existing technical-studio typography, palette and canvas themes are retained.
This is a layout/interaction change, not a visual rebrand or a device-support
certification. Validation must measure real canvas/drawer geometry at 390x844 and
844x390, check desktop behavior and exercise keyboard focus rather than merely
asserting ARIA attributes.

Current implementation/release status is recorded in the
[roadmap](implementation-roadmap.md) and [deployment plan](../.azure/deployment-plan.md).
Cross-browser/device certification remains priority 15.
