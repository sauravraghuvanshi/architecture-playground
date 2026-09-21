/** A transient editor state: retry capture without reporting a persistence failure. */
export class CanvasEditPendingError extends Error {
  constructor() {
    super("Canvas editing has not settled yet.");
    this.name = "CanvasEditPendingError";
  }
}
