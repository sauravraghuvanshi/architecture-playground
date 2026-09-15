import type { Page } from "@playwright/test";
import type { DiagramRecord } from "../lib/diagram-library";

export async function readSavedDiagram(page: Page, name: string): Promise<DiagramRecord | undefined> {
  return page.evaluate((name) => new Promise<DiagramRecord | undefined>((resolve, reject) => {
    const request = indexedDB.open("diagrammatic.library");
    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      const db = request.result;
      const query = db.transaction("documents", "readonly").objectStore("documents").getAll();
      query.onerror = () => { db.close(); reject(query.error); };
      query.onsuccess = () => {
        const records: DiagramRecord[] = query.result;
        resolve(records.find((record) => record.name === name));
        db.close();
      };
    };
  }), name);
}
