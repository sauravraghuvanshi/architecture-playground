import type { CanvasTheme, DiagrammaticMode } from "../components/diagrammatic/shared/types";

export const DIAGRAM_LIBRARY_DATABASE = "diagrammatic.library";
export const DIAGRAM_LIBRARY_VERSION = 1;

export interface DiagramComment {
  id: string;
  body: string;
  author: string;
  createdAt: number;
}

export interface DiagramVersion {
  id: string;
  label: string;
  payload: unknown;
  createdAt: number;
}

export interface DiagramRecord {
  schemaVersion: 1;
  id: string;
  name: string;
  mode: DiagrammaticMode;
  payload: unknown;
  canvasTheme: CanvasTheme;
  comments: DiagramComment[];
  versions: DiagramVersion[];
  createdAt: number;
  updatedAt: number;
  revision: number;
}

export type DiagramDocument = DiagramRecord;

export type DiagramSummary = Omit<DiagramRecord, "payload" | "comments" | "versions"> & {
  commentCount: number;
  versionCount: number;
};

export interface DiagramSaveInput {
  /** Omit to create a separate document. Supplying a missing ID is an error. */
  id?: string;
  name: string;
  mode: DiagrammaticMode;
  payload: unknown;
  canvasTheme: CanvasTheme;
  /** Omitted metadata is preserved on updates; new documents start empty. */
  comments?: DiagramComment[];
  versions?: DiagramVersion[];
  /** Prevent overwriting another tab's newer save. */
  expectedRevision?: number;
}

export type DiagramLibraryErrorCode = "unavailable" | "blocked" | "quota" | "storage" | "invalid" | "not-found" | "conflict";

export class DiagramLibraryError extends Error {
  readonly code: DiagramLibraryErrorCode;
  constructor(code: DiagramLibraryErrorCode, message: string) {
    super(message);
    this.name = "DiagramLibraryError";
    this.code = code;
  }
}

function object(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function invalid(message: string): never {
  throw new DiagramLibraryError("invalid", message);
}

function text(value: unknown, label: string, allowEmpty = false): string {
  if (typeof value !== "string" || (!allowEmpty && !value.trim())) invalid(`${label} must be text${allowEmpty ? "" : " and cannot be empty"}.`);
  return value;
}

function timestamp(value: unknown): number {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 0) invalid("Document timestamps must be nonnegative integer milliseconds.");
  return value;
}

function revision(value: unknown): number {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 1) invalid("Document revision must be a positive integer.");
  return value;
}

export function normalizeDiagramName(value: unknown): string {
  const name = text(value, "Diagram name").trim();
  if (name.length > 200) invalid("Diagram name must be at most 200 characters.");
  return name;
}

function documentId(value: unknown): string {
  const id = text(value, "Document ID");
  if (!/^[a-zA-Z0-9_-]{1,128}$/.test(id)) invalid("Document ID is invalid.");
  return id;
}

function mode(value: unknown): DiagrammaticMode {
  switch (value) {
    case "architecture": case "flowchart": case "mindmap": case "sequence": case "er":
    case "uml": case "whiteboard": case "kanban": case "c4": return value;
    default: return invalid("Document mode is not supported.");
  }
}

function theme(value: unknown): CanvasTheme {
  if (value !== "light" && value !== "dark") invalid("Canvas theme must be light or dark.");
  return value;
}

function payload(value: unknown): unknown {
  if (!object(value)) invalid("A document payload must be a non-null object.");
  return value;
}

function comments(value: unknown): DiagramComment[] {
  if (!Array.isArray(value)) invalid("Document comments must be an array.");
  const result = value.map((entry: unknown) => {
    if (!object(entry)) invalid("Document comment is invalid.");
    return {
      id: text(entry.id, "Comment ID"), body: text(entry.body, "Comment body", true),
      author: text(entry.author, "Comment author", true), createdAt: timestamp(entry.createdAt),
    };
  });
  if (new Set(result.map((entry) => entry.id)).size !== result.length) invalid("Comment IDs must be unique within a document.");
  return result;
}

function versions(value: unknown): DiagramVersion[] {
  if (!Array.isArray(value)) invalid("Document versions must be an array.");
  const result = value.map((entry: unknown) => {
    if (!object(entry)) invalid("Document version is invalid.");
    return {
      id: text(entry.id, "Version ID"), label: text(entry.label, "Version label", true),
      payload: payload(entry.payload), createdAt: timestamp(entry.createdAt),
    };
  });
  if (new Set(result.map((entry) => entry.id)).size !== result.length) invalid("Version IDs must be unique within a document.");
  return result;
}

function clone<T>(value: T): T {
  try {
    return structuredClone(value);
  } catch {
    throw new DiagramLibraryError("invalid", "Diagram data could not be copied. Remove unsupported runtime values before saving.");
  }
}

export function validateDiagramRecord(value: unknown): DiagramRecord {
  if (!object(value) || value.schemaVersion !== 1) invalid("Stored document format is not supported.");
  const createdAt = timestamp(value.createdAt);
  const updatedAt = timestamp(value.updatedAt);
  if (updatedAt < createdAt) invalid("Document update time cannot precede its creation time.");
  return {
    schemaVersion: 1, id: documentId(value.id), name: normalizeDiagramName(value.name),
    mode: mode(value.mode), payload: payload(value.payload), canvasTheme: theme(value.canvasTheme),
    comments: comments(value.comments), versions: versions(value.versions),
    createdAt, updatedAt, revision: revision(value.revision),
  };
}

export function summarizeDiagram(record: DiagramRecord): DiagramSummary {
  return {
    schemaVersion: 1, id: record.id, name: record.name, mode: record.mode, canvasTheme: record.canvasTheme,
    createdAt: record.createdAt, updatedAt: record.updatedAt, revision: record.revision,
    commentCount: record.comments.length, versionCount: record.versions.length,
  };
}

function validateSummary(value: unknown): DiagramSummary {
  if (!object(value) || value.schemaVersion !== 1) invalid("Stored document summary is invalid.");
  const createdAt = timestamp(value.createdAt);
  const updatedAt = timestamp(value.updatedAt);
  if (updatedAt < createdAt) invalid("Stored document summary timestamps are invalid.");
  return {
    schemaVersion: 1, id: documentId(value.id), name: normalizeDiagramName(value.name),
    mode: mode(value.mode), canvasTheme: theme(value.canvasTheme),
    createdAt, updatedAt, revision: revision(value.revision),
    commentCount: timestamp(value.commentCount), versionCount: timestamp(value.versionCount),
  };
}

export function filterDiagramSummaries(records: readonly DiagramSummary[], query = ""): DiagramSummary[] {
  const needle = query.trim().toLocaleLowerCase();
  return records.filter((record) => `${record.name} ${record.mode}`.toLocaleLowerCase().includes(needle))
    .sort((left, right) => right.updatedAt - left.updatedAt || left.name.localeCompare(right.name) || left.id.localeCompare(right.id));
}

function storageError(error: unknown): DiagramLibraryError {
  if (error instanceof DiagramLibraryError) return error;
  const name = object(error) && typeof error.name === "string" ? error.name : "";
  if (name === "QuotaExceededError") return new DiagramLibraryError("quota", "Browser storage is full. Free space or remove unneeded saved diagrams, then retry.");
  if (name === "SecurityError" || name === "InvalidStateError") return new DiagramLibraryError("unavailable", "Browser storage is unavailable. Check browser privacy settings and retry.");
  return new DiagramLibraryError("storage", "The diagram library operation failed. Nothing was saved by this operation. Please retry.");
}

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    let request: IDBOpenDBRequest;
    try {
      if (!globalThis.indexedDB) throw new DiagramLibraryError("unavailable", "The diagram library needs IndexedDB in this browser. No download or temporary storage fallback was used.");
      request = globalThis.indexedDB.open(DIAGRAM_LIBRARY_DATABASE, DIAGRAM_LIBRARY_VERSION);
    } catch (error) {
      reject(storageError(error));
      return;
    }
    let rejected = false;
    request.onblocked = () => {
      rejected = true;
      reject(new DiagramLibraryError("blocked", "The diagram library is blocked by another tab. Close other tabs using this platform and retry."));
    };
    request.onerror = () => reject(storageError(request.error));
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains("documents")) db.createObjectStore("documents", { keyPath: "id" });
      if (!db.objectStoreNames.contains("summaries")) db.createObjectStore("summaries", { keyPath: "id" });
    };
    request.onsuccess = () => {
      const db = request.result;
      db.onversionchange = () => db.close();
      if (rejected) db.close();
      else resolve(db);
    };
  });
}

type TransactionWork<T> = (
  transaction: IDBTransaction,
  result: (value: T) => void,
  fail: (error: unknown) => void,
) => void;

async function transaction<T>(stores: string[], access: IDBTransactionMode, work: TransactionWork<T>): Promise<T> {
  const db = await openDatabase();
  return new Promise<T>((resolve, reject) => {
    let tx: IDBTransaction;
    try {
      tx = db.transaction(stores, access);
    } catch (error) {
      db.close();
      reject(storageError(error));
      return;
    }
    let result: { value: T } | undefined;
    let failure: unknown;
    const fail = (error: unknown) => { failure = error; tx.abort(); };
    tx.oncomplete = () => {
      db.close();
      if (result) resolve(result.value);
      else reject(new DiagramLibraryError("storage", "The diagram library completed without a result. Reload the library before retrying."));
    };
    tx.onabort = () => { db.close(); reject(storageError(failure ?? tx.error)); };
    tx.onerror = () => { failure ??= tx.error; };
    try {
      work(tx, (value) => { result = { value }; }, fail);
    } catch (error) {
      fail(error);
    }
  });
}

export async function listDiagrams(): Promise<DiagramSummary[]> {
  return transaction(["summaries"], "readonly", (tx, result, fail) => {
    const request = tx.objectStore("summaries").getAll();
    request.onsuccess = () => {
      try {
        const values: unknown = request.result;
        if (!Array.isArray(values)) invalid("Stored diagram summaries are invalid.");
        result(filterDiagramSummaries(values.map(validateSummary)));
      } catch (error) { fail(error); }
    };
  });
}

export async function loadDiagram(id: string): Promise<DiagramRecord> {
  documentId(id);
  return transaction(["documents"], "readonly", (tx, result, fail) => {
    const request = tx.objectStore("documents").get(id);
    request.onsuccess = () => {
      try {
        if (request.result === undefined) throw new DiagramLibraryError("not-found", "This diagram no longer exists. Refresh the library.");
        result(validateDiagramRecord(request.result));
      } catch (error) { fail(error); }
    };
  });
}

export const getDiagram = loadDiagram;

export async function saveDiagram(input: DiagramSaveInput): Promise<DiagramRecord> {
  if (!object(input)) invalid("Document save input is invalid.");
  const name = normalizeDiagramName(input.name);
  const selectedMode = mode(input.mode);
  const canvasTheme = theme(input.canvasTheme);
  const savedPayload = clone(payload(input.payload));
  const savedComments = input.comments === undefined ? undefined : clone(comments(input.comments));
  const savedVersions = input.versions === undefined ? undefined : clone(versions(input.versions));
  const expectedRevision = input.expectedRevision === undefined ? undefined : revision(input.expectedRevision);
  const updating = input.id !== undefined;
  if (!updating && expectedRevision !== undefined) invalid("A new diagram cannot have an expected revision.");
  if (!updating && !globalThis.crypto?.randomUUID) throw new DiagramLibraryError("unavailable", "Secure document IDs are unavailable. Open the platform in a secure browser context.");
  const id = updating ? documentId(input.id) : globalThis.crypto.randomUUID();
  return transaction(["documents", "summaries"], "readwrite", (tx, result, fail) => {
    const documents = tx.objectStore("documents");
    const request = documents.get(id);
    request.onsuccess = () => {
      try {
        const previous = request.result === undefined ? undefined : validateDiagramRecord(request.result);
        if (updating && !previous) throw new DiagramLibraryError("not-found", "This diagram was deleted. Save the canvas as a new diagram instead.");
        if (!updating && previous) throw new DiagramLibraryError("conflict", "A document ID collision occurred. Please retry saving.");
        if (previous && expectedRevision !== undefined && previous.revision !== expectedRevision) {
          throw new DiagramLibraryError("conflict", "This diagram changed in another tab. Reopen it or save your canvas as a new diagram.");
        }
        const now = Math.max(Date.now(), previous?.updatedAt ?? 0);
        const record: DiagramRecord = {
          schemaVersion: 1, id, name, mode: selectedMode, payload: savedPayload, canvasTheme,
          comments: savedComments ?? previous?.comments ?? [],
          versions: savedVersions ?? previous?.versions ?? [],
          createdAt: previous?.createdAt ?? now, updatedAt: now, revision: (previous?.revision ?? 0) + 1,
        };
        documents.put(record);
        tx.objectStore("summaries").put(summarizeDiagram(record));
        result(record);
      } catch (error) { fail(error); }
    };
  });
}

export async function renameDiagram(id: string, name: string, expectedRevision?: number): Promise<DiagramRecord> {
  documentId(id);
  const normalized = normalizeDiagramName(name);
  if (expectedRevision !== undefined) revision(expectedRevision);
  return transaction(["documents", "summaries"], "readwrite", (tx, result, fail) => {
    const documents = tx.objectStore("documents");
    const request = documents.get(id);
    request.onsuccess = () => {
      try {
        if (request.result === undefined) throw new DiagramLibraryError("not-found", "This diagram no longer exists. Refresh the library.");
        const previous = validateDiagramRecord(request.result);
        if (expectedRevision !== undefined && previous.revision !== expectedRevision) throw new DiagramLibraryError("conflict", "This diagram changed in another tab. Refresh before renaming.");
        const record: DiagramRecord = { ...previous, name: normalized, updatedAt: Math.max(Date.now(), previous.updatedAt), revision: previous.revision + 1 };
        documents.put(record);
        tx.objectStore("summaries").put(summarizeDiagram(record));
        result(record);
      } catch (error) { fail(error); }
    };
  });
}

export async function deleteDiagram(id: string, expectedRevision?: number): Promise<void> {
  documentId(id);
  if (expectedRevision !== undefined) revision(expectedRevision);
  return transaction(["documents", "summaries"], "readwrite", (tx, result, fail) => {
    const documents = tx.objectStore("documents");
    const request = documents.get(id);
    request.onsuccess = () => {
      try {
        if (request.result === undefined) throw new DiagramLibraryError("not-found", "This diagram no longer exists. Refresh the library.");
        const previous = validateDiagramRecord(request.result);
        if (expectedRevision !== undefined && previous.revision !== expectedRevision) throw new DiagramLibraryError("conflict", "This diagram changed in another tab. Refresh before deleting.");
        documents.delete(id);
        tx.objectStore("summaries").delete(id);
        result(undefined);
      } catch (error) { fail(error); }
    };
  });
}
