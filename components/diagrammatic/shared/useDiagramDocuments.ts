"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  getDiagram, listDiagrams, saveDiagram, validateDiagramRecord,
  type DiagramDocument, type DiagramSaveInput, type DiagramComment, type DiagramVersion,
} from "@/lib/diagram-library";
import { parseArchitectureDocument, hasArchitectureContent } from "@/lib/architecture-document";
import { parseDiagramPayload } from "@/lib/diagram-payload";
import { CanvasEditPendingError } from "@/lib/canvas-edit-state";
import { getWhiteboardSceneTransientElementIds, parseWhiteboardScene } from "@/lib/whiteboard-scene";
import { MODE_META, type CanvasTheme, type DiagrammaticMode } from "./types";

const ACTIVE_KEY = "diagrammatic.active-documents";
const draftKey = (mode: DiagrammaticMode) => mode === "architecture" ? "diagrammatic.draft" : `diagrammatic.draft.${mode}`;
type Documents = Partial<Record<DiagrammaticMode, DiagramDocument>>;
type BlockedDrafts = Partial<Record<DiagrammaticMode, true>>;
export interface DiagramRecoveryIssue {
  mode: DiagrammaticMode;
  message: string;
  storageKey?: string;
  documentId?: string;
}
interface LoadedDocuments {
  documents: Documents;
  blocked: BlockedDrafts;
  issues: DiagramRecoveryIssue[];
}

interface Options {
  mode: DiagrammaticMode;
  revision: number;
  externalSeed: boolean;
  suspended: boolean;
  requestedId?: string | null;
  capture: (mode: DiagrammaticMode) => unknown;
  theme: (mode: DiagrammaticMode) => CanvasTheme;
  apply: (document: DiagramDocument, activate: boolean) => void;
  onError: (message: string) => void;
}

function readAnnotations(mode: DiagrammaticMode, onError?: (issue: DiagramRecoveryIssue) => void) {
  const result: { comments: DiagramComment[]; versions: DiagramVersion[] } = { comments: [], versions: [] };
  for (const field of ["comments", "versions"] as const) {
    const storageKey = `diagrammatic.${field}.${mode}:draft`;
    try {
      const checked = validateDiagramRecord({
        schemaVersion: 1, id: "annotations", name: "Annotations", mode, payload: {}, canvasTheme: "light",
        comments: [], versions: [], [field]: JSON.parse(localStorage.getItem(storageKey) ?? "[]"),
        createdAt: 0, updatedAt: 0, revision: 1,
      });
      if (field === "comments") result.comments = checked.comments;
      else result.versions = checked.versions;
    } catch (cause) {
      if (!onError) throw cause;
      onError({ mode, storageKey, message: `${MODE_META[mode].label} draft ${field} could not be recovered. The original data is unchanged.` });
    }
  }
  return result;
}

function writeActive(documents: Documents) {
  localStorage.setItem(ACTIVE_KEY, JSON.stringify(Object.fromEntries(
    Object.entries(documents).map(([mode, document]) => [mode, document.id]),
  )));
}

function persistedJson(value: unknown): string | undefined {
  return JSON.stringify(value, (_key, item: unknown) =>
    item && typeof item === "object" && !Array.isArray(item)
      ? Object.fromEntries(Object.entries(item).sort(([left], [right]) => left.localeCompare(right)))
      : item,
  );
}

function prepareDocument(document: DiagramDocument): DiagramDocument {
  const payload = parseDiagramPayload(document.mode, document.payload);
  if (document.mode !== "whiteboard" || !getWhiteboardSceneTransientElementIds(parseWhiteboardScene(document.payload)).length) {
    return { ...document, payload };
  }
  const id = `before-native-restoration-${document.revision}`;
  return {
    ...document, payload,
    versions: document.versions.some((version) => version.id === id) ? document.versions : [
      ...document.versions,
      { id, label: "Original before unfinished drawing cleanup", payload: document.payload, createdAt: document.updatedAt },
    ],
  };
}

export function useDiagramDocuments(options: Options) {
  const optionsRef = useRef(options);
  useEffect(() => { optionsRef.current = options; });
  const [documents, setDocuments] = useState<Documents>({});
  const documentsRef = useRef<Documents>({});
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [savedRevision, setSavedRevision] = useState(-1);
  const [blockedDrafts, setBlockedDrafts] = useState<BlockedDrafts>({});
  const [recoveryIssues, setRecoveryIssues] = useState<DiagramRecoveryIssue[]>([]);
  const operation = useRef(false);
  const saveQueue = useRef<Promise<unknown>>(Promise.resolve());
  const latestRevisions = useRef(new Map<string, number>());
  const committedDocuments = useRef(new Map<string, DiagramDocument>());
  const initialization = useRef<Promise<LoadedDocuments> | null>(null);
  const annotationRevision = useRef(0);

  const updateDocuments = useCallback((next: Documents) => {
    writeActive(next);
    documentsRef.current = next;
    setDocuments(next);
  }, []);

  useEffect(() => {
    let cancelled = false;
    async function load() {
        const existing = await listDiagrams();
        const active: unknown = JSON.parse(localStorage.getItem(ACTIVE_KEY) ?? "{}");
        if (!active || typeof active !== "object" || Array.isArray(active)) throw new Error("The active-diagram index is invalid.");
        const next: Documents = {};
        const blocked: BlockedDrafts = {};
        const issues: DiagramRecoveryIssue[] = [];
        for (const mode of Object.keys(MODE_META) as DiagrammaticMode[]) {
          let storageKey: string | undefined;
          let documentId: string | undefined;
          try {
            const id: unknown = Reflect.get(active, mode);
            if (id !== undefined) {
              const found = typeof id === "string" ? existing.find((document) => document.id === id && document.mode === mode) : undefined;
              if (!found) throw new Error("The previously active diagram no longer exists. Choose another saved diagram or save a new copy.");
              documentId = found.id;
              const loaded = await getDiagram(found.id);
              next[mode] = prepareDocument(loaded);
              continue;
            }
            storageKey = draftKey(mode);
            const raw = localStorage.getItem(storageKey);
            if (!raw) continue;
            const draft = JSON.parse(raw);
            if (!draft?.payload || typeof draft.payload !== "object" || Array.isArray(draft.payload)) {
              throw new Error("The draft has no valid diagram data.");
            }
            const payload = parseDiagramPayload(mode, draft.payload);
            const annotations = readAnnotations(mode, (issue) => issues.push(issue));
            if (mode === "architecture" && !hasArchitectureContent(parseArchitectureDocument(payload)) && annotations.comments.length === 0 && annotations.versions.length === 0) continue;
            const markerKey = `diagrammatic.recovered.${mode}`;
            const legacyId = localStorage.getItem(markerKey);
            const priorRecovery = existing.find((document) => document.id === legacyId && document.mode === mode);
            const original = mode === "whiteboard" && getWhiteboardSceneTransientElementIds(parseWhiteboardScene(draft.payload)).length
              ? [{ id: "before-native-restoration-draft", label: "Original before unfinished drawing cleanup", payload: draft.payload, createdAt: Date.now() }]
              : [];
            const recovered = priorRecovery && priorRecovery.updatedAt >= draft.savedAt ? await getDiagram(priorRecovery.id) : await saveDiagram({
              name: `${MODE_META[mode].label} (recovered draft)`, mode,
              payload, canvasTheme: optionsRef.current.theme(mode),
              ...annotations, versions: [...annotations.versions, ...original],
            });
            localStorage.setItem(markerKey, recovered.id);
            next[mode] = prepareDocument(recovered);
          } catch (cause) {
            blocked[mode] = true;
            issues.push({
              mode, storageKey, documentId,
              message: `${MODE_META[mode].label} could not be recovered: ${cause instanceof Error ? cause.message : "Browser storage unavailable."} Its original data has not been changed.`,
            });
          }
        }
        if (optionsRef.current.externalSeed) delete next.architecture;
        if (optionsRef.current.requestedId) {
          try {
            const selected = await getDiagram(optionsRef.current.requestedId);
            next[selected.mode] = prepareDocument(selected);
          } catch (cause) {
            if (!issues.some((issue) => issue.documentId === optionsRef.current.requestedId)) {
              issues.push({ mode: optionsRef.current.mode, documentId: optionsRef.current.requestedId ?? undefined, message: `The requested diagram could not be opened: ${cause instanceof Error ? cause.message : "Browser storage unavailable."} Other recovered diagrams are still available.` });
            }
          }
        }
        return { documents: next, blocked, issues };
    }
    initialization.current ??= load();
    void initialization.current.then(({ documents: next, blocked, issues }) => {
        if (cancelled) return;
        const applied: Documents = {};
        for (const document of Object.values(next)) {
          try {
            optionsRef.current.apply(document, document.id === optionsRef.current.requestedId);
            applied[document.mode] = document;
            latestRevisions.current.set(document.id, document.revision);
            committedDocuments.current.set(document.id, document);
          } catch (cause) {
            blocked[document.mode] = true;
            issues.push({ mode: document.mode, message: `"${document.name}" could not be opened: ${cause instanceof Error ? cause.message : "Canvas unavailable."} Its saved data has not been changed.` });
          }
        }
        setBlockedDrafts(blocked);
        setRecoveryIssues(issues);
        updateDocuments(applied);
        setReady(true);
      }).catch((cause) => {
        if (!cancelled) {
          const message = `My diagrams could not be loaded: ${cause instanceof Error ? cause.message : "Browser database unavailable."} Your existing drafts have not been deleted. Export your canvas or retry saving before leaving.`;
          setBlockedDrafts(Object.fromEntries(Object.keys(MODE_META).map((mode) => [mode, true])));
          setRecoveryIssues([{ mode: optionsRef.current.mode, message }]);
          setReady(true);
        }
      });
    return () => { cancelled = true; };
  }, [updateDocuments]);

  const captureDocument = useCallback((mode: DiagrammaticMode, name?: string): DiagramSaveInput => {
    const current = documentsRef.current[mode];
    const captured = optionsRef.current.capture(mode);
    if (captured === undefined) throw new Error("The canvas is still loading. Wait before saving or switching diagrams.");
    const payload = parseDiagramPayload(mode, captured);
    return {
      ...(current ? { id: current.id, expectedRevision: current.revision } : {}),
      name: name?.trim() || current?.name || `Untitled ${MODE_META[mode].label}`,
      mode, payload, canvasTheme: optionsRef.current.theme(mode),
      ...(current ? { comments: current.comments, versions: current.versions } : readAnnotations(mode, (issue) => {
        setRecoveryIssues((previous) => previous.some((entry) => entry.storageKey === issue.storageKey) ? previous : [...previous, issue]);
      })),
    };
  }, []);

  const captureSettledDocument = useCallback(async (mode: DiagrammaticMode, name?: string) => {
    for (let attempt = 0; ; attempt++) {
      try { return captureDocument(mode, name); }
      catch (cause) {
        if (!(cause instanceof CanvasEditPendingError) || attempt >= 100) throw cause;
        await new Promise<void>((resolve) => setTimeout(resolve, 50));
      }
    }
  }, [captureDocument]);

  const mergeWorkingAnnotations = useCallback((saved: DiagramDocument) => {
    const working = documentsRef.current[saved.mode];
    return working?.id === saved.id
      ? { ...saved, comments: working.comments, versions: working.versions }
      : saved;
  }, []);

  const inputHasChanges = useCallback((input: DiagramSaveInput) => {
    const committed = input.id ? committedDocuments.current.get(input.id) : undefined;
    if (!committed) return true;
    const previousPayload = parseDiagramPayload(committed.mode, committed.payload);
    return input.name !== committed.name || input.canvasTheme !== committed.canvasTheme ||
      persistedJson(input.payload) !== persistedJson(previousPayload) ||
      persistedJson(input.comments) !== persistedJson(committed.comments) ||
      persistedJson(input.versions) !== persistedJson(committed.versions);
  }, []);

  const hasPendingChanges = useCallback(() => {
    try { return inputHasChanges(captureDocument(optionsRef.current.mode)); }
    catch (cause) {
      if (cause instanceof CanvasEditPendingError) return true;
      throw cause;
    }
  }, [captureDocument, inputHasChanges]);

  const persist = useCallback(async (input: DiagramSaveInput) => {
    const pending = saveQueue.current.then(async () => {
      const saved = await saveDiagram({
        ...input,
        ...(input.id ? { expectedRevision: latestRevisions.current.get(input.id) ?? input.expectedRevision } : {}),
      });
      latestRevisions.current.set(saved.id, saved.revision);
      committedDocuments.current.set(saved.id, saved);
      return saved;
    });
    // A failed operation must not prevent a later explicit retry.
    saveQueue.current = pending.then(() => undefined, () => undefined);
    return pending;
  }, []);

  const save = useCallback(async (name?: string) => {
    if (!ready || operation.current) throw new Error("A diagram is still loading or saving. Please wait.");
    operation.current = true;
    try {
      const captured = await captureSettledDocument(optionsRef.current.mode, name);
      setBusy(true);
      const revision = optionsRef.current.revision;
      const annotations = annotationRevision.current;
      const document = mergeWorkingAnnotations(await persist(captured));
      updateDocuments({ ...documentsRef.current, [document.mode]: document });
      setSavedRevision(annotations === annotationRevision.current ? revision : -1);
    } finally { operation.current = false; setBusy(false); }
  }, [captureSettledDocument, persist, ready, updateDocuments, mergeWorkingAnnotations]);

  const saveCopy = useCallback(async (name?: string) => {
    if (!ready || operation.current) throw new Error("A diagram is still loading or saving. Please wait.");
    operation.current = true;
    setBusy(true);
    const mode = optionsRef.current.mode;
    const revision = optionsRef.current.revision;
    const annotations = annotationRevision.current;
    try {
      const captured = captureDocument(mode, name?.trim() || `${documentsRef.current[mode]?.name ?? `Untitled ${MODE_META[mode].label}`} (copy)`);
      const { id: sourceId, expectedRevision, ...input } = captured;
      void expectedRevision;
      const saved = await persist(input);
      const working = documentsRef.current[mode];
      const document = working && working.id === sourceId
        ? { ...saved, comments: working.comments, versions: working.versions }
        : saved;
      updateDocuments({ ...documentsRef.current, [mode]: document });
      setSavedRevision(annotations === annotationRevision.current ? revision : -1);
      return document;
    } finally { operation.current = false; setBusy(false); }
  }, [captureDocument, persist, ready, updateDocuments]);

  const open = useCallback(async (document: DiagramDocument) => {
    if (!ready || operation.current) throw new Error("A diagram is still loading or saving. Please wait.");
    operation.current = true;
    setBusy(true);
    try {
      const old = mergeWorkingAnnotations(await persist(captureDocument(optionsRef.current.mode)));
      updateDocuments({ ...documentsRef.current, [old.mode]: old });
      const fresh = await getDiagram(document.id);
      if (!fresh) throw new Error("This diagram no longer exists. Refresh My diagrams.");
      const checked = prepareDocument(fresh);
      optionsRef.current.apply(checked, true);
      updateDocuments({ ...documentsRef.current, [fresh.mode]: checked });
      latestRevisions.current.set(fresh.id, fresh.revision);
      committedDocuments.current.set(fresh.id, fresh);
      setSavedRevision(optionsRef.current.revision);
    } finally { operation.current = false; setBusy(false); }
  }, [captureDocument, persist, ready, updateDocuments, mergeWorkingAnnotations]);

  const create = useCallback(async (mode: DiagrammaticMode, name: string, payload: unknown) => {
    if (!ready || operation.current) throw new Error("A diagram is still loading or saving. Please wait.");
    operation.current = true;
    setBusy(true);
    try {
      const checkedPayload = parseDiagramPayload(mode, payload);
      const old = mergeWorkingAnnotations(await persist(captureDocument(optionsRef.current.mode)));
      updateDocuments({ ...documentsRef.current, [old.mode]: old });
      // Preserve the target mode's working document as well when creating from another mode.
      const target = mode === old.mode ? old : mergeWorkingAnnotations(await persist(captureDocument(mode)));
      updateDocuments({ ...documentsRef.current, [target.mode]: target });
      const fresh = await persist({
        name: name.trim(), mode, payload: checkedPayload,
        canvasTheme: optionsRef.current.theme(mode), comments: [], versions: [],
      });
      optionsRef.current.apply(fresh, true);
      updateDocuments({ ...documentsRef.current, [fresh.mode]: fresh });
      setSavedRevision(optionsRef.current.revision);
    } finally { operation.current = false; setBusy(false); }
  }, [captureDocument, persist, ready, updateDocuments, mergeWorkingAnnotations]);

  useEffect(() => {
    if (!ready || !documents[options.mode] || busy || options.suspended || savedRevision === options.revision) return;
    const revision = options.revision;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout>;
    const schedule = () => { if (!cancelled) timer = setTimeout(attempt, 650); };
    const attempt = () => {
      if (cancelled) return;
      if (operation.current || optionsRef.current.suspended) { schedule(); return; }
      void Promise.resolve().then(async () => {
        if (cancelled) return;
        const annotations = annotationRevision.current;
        const input = captureDocument(optionsRef.current.mode);
        if (!inputHasChanges(input)) {
          setSavedRevision(revision);
          return;
        }
        const current = mergeWorkingAnnotations(await persist(input));
        if (documentsRef.current[current.mode]?.id === current.id) {
          const next = { ...documentsRef.current, [current.mode]: current };
          documentsRef.current = next;
          setDocuments(next);
          setSavedRevision(annotations === annotationRevision.current ? revision : -1);
        }
      }).catch((cause) => {
        if (cause instanceof CanvasEditPendingError) { schedule(); return; }
        optionsRef.current.onError(`Diagram autosave failed: ${cause instanceof Error ? cause.message : "Browser database unavailable."}`);
      });
    };
    schedule();
    return () => { cancelled = true; clearTimeout(timer); };
  }, [options.mode, options.revision, options.suspended, ready, busy, documents, savedRevision, captureDocument, persist, mergeWorkingAnnotations, inputHasChanges]);

  const annotate = useCallback((value: { comments: DiagramComment[] } | { versions: DiagramVersion[] }) => {
    const mode = optionsRef.current.mode;
    const current = documentsRef.current[mode];
    if (!current) return;
    annotationRevision.current += 1;
    const next = { ...documentsRef.current, [mode]: { ...current, ...value } };
    documentsRef.current = next;
    setDocuments(next);
    setSavedRevision(-1);
  }, []);

  const deleted = useCallback((id: string) => {
    const next = { ...documentsRef.current };
    for (const mode of Object.keys(next) as DiagrammaticMode[]) {
      if (next[mode]?.id === id) delete next[mode];
    }
    updateDocuments(next);
  }, [updateDocuments]);

  const renamed = useCallback((document: DiagramDocument) => {
    if (documentsRef.current[document.mode]?.id === document.id) {
      latestRevisions.current.set(document.id, document.revision);
      committedDocuments.current.set(document.id, document);
      updateDocuments({ ...documentsRef.current, [document.mode]: mergeWorkingAnnotations(document) });
    }
  }, [updateDocuments, mergeWorkingAnnotations]);

  return { documents, ready, busy, blockedDrafts, recoveryIssues, hasPendingChanges, saved: savedRevision === options.revision, save, saveCopy, open, create, annotate, deleted, renamed };
}
