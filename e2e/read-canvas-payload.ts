import type { Page } from "@playwright/test";

export async function readCanvasPayload(page: Page, mode: "architecture" | "whiteboard"): Promise<unknown> {
  return page.evaluate(async (mode) => {
    const active = JSON.parse(localStorage.getItem("diagrammatic.active-documents") ?? "{}") as Record<string, string>;
    const id = active[mode];
    if (!id) {
      const key = mode === "architecture" ? "diagrammatic.draft" : `diagrammatic.draft.${mode}`;
      return JSON.parse(localStorage.getItem(key) ?? "{}").payload;
    }
    return new Promise<unknown>((resolve, reject) => {
      const request = indexedDB.open("diagrammatic.library");
      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        const db = request.result;
        const query = db.transaction("documents", "readonly").objectStore("documents").get(id);
        query.onerror = () => { db.close(); reject(query.error); };
        query.onsuccess = () => {
          const record: unknown = query.result;
          db.close();
          if (!record || typeof record !== "object" || !("payload" in record)) {
            reject(new Error(`Active ${mode} document is missing from IndexedDB.`));
            return;
          }
          resolve(record.payload);
        };
      };
    });
  }, mode);
}
