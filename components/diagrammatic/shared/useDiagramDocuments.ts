"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  getDiagram, listDiagrams, saveDiagram, validateDiagramRecord,
  type DiagramDocument, type DiagramSaveInput, type DiagramComment, type DiagramVersion,
} from "@/lib/diagram-library";
import { parseArchitectureDocument } from "@/lib/architecture-document";
import { MODE_META, type CanvasTheme, type DiagrammaticMode } from "./types";

const ACTIVE_KEY = "diagrammatic.active-documents";
const draftKey = (mode: DiagrammaticMode) => mode === "architecture" ? "diagrammatic.draft" : `diagrammatic.draft.${mode}`;
type Documents = Partial<Record<DiagrammaticMode, DiagramDocument>>;

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

function readAnnotations(mode: DiagrammaticMode) {
  const comments: unknown = JSON.parse(localStorage.getItem(`diagrammatic.comments.${mode}:draft`) ?? "[]");
  const versions: unknown = JSON.parse(localStorage.getItem(`diagrammatic.versions.${mode}:draft`) ?? "[]");
  const checked = validateDiagramRecord({
    schemaVersion: 1, id: "annotations", name: "Annotations", mode, payload: {}, canvasTheme: "light",
    comments, versions, createdAt: 0, updatedAt: 0, revision: 1,
  });
  return {
    comments: checked.comments,
    versions: checked.versions,
  };
}

function writeActive(documents: Documents) {
  localStorage.setItem(ACTIVE_KEY, JSON.stringify(Object.fromEntries(
    Object.entries(documents).map(([mode, document]) => [mode, document.id]),
  )));
}

export function useDiagramDocuments(options: Options) {
  const optionsRef = useRef(options);
  useEffect(() => { optionsRef.current = options; });
  const [documents, setDocuments] = useState<Documents>({});
  const documentsRef = useRef<Documents>({});
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [savedRevision, setSavedRevision] = useState(-1);
  const operation = useRef(false);
  const saveQueue = useRef<Promise<unknown>>(Promise.resolve());
  const latestRevisions = useRef(new Map<string, number>());
  const initialization = useRef<Promise<Documents> | null>(null);
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
        for (const mode of Object.keys(MODE_META) as DiagrammaticMode[]) {
          const id: unknown = Reflect.get(active, mode);
          const found = typeof id === "string" ? existing.find((document) => document.id === id && document.mode === mode) : undefined;
          if (found) next[mode] = await getDiagram(found.id);
          if (id !== undefined) continue;
          const raw = localStorage.getItem(draftKey(mode));
          if (!raw) continue;
          const draft = JSON.parse(raw);
          if (draft?.payload === undefined) throw new Error(`The ${MODE_META[mode].label} draft has no diagram data.`);
          const markerKey = `diagrammatic.recovered.${mode}`;
          const legacyId = localStorage.getItem(markerKey);
          const priorRecovery = existing.find((document) => document.id === legacyId);
          const recovered = priorRecovery && priorRecovery.updatedAt >= draft.savedAt ? await getDiagram(priorRecovery.id) : await saveDiagram({
            name: `${MODE_META[mode].label} (recovered draft)`, mode,
            payload: draft.payload, canvasTheme: optionsRef.current.theme(mode),
            ...readAnnotations(mode),
          });
          localStorage.setItem(markerKey, recovered.id);
          next[mode] = recovered;
        }
        if (optionsRef.current.externalSeed) delete next.architecture;
        if (optionsRef.current.requestedId) {
          const selected = await getDiagram(optionsRef.current.requestedId);
          next[selected.mode] = selected;
        }
        return next;
    }
    initialization.current ??= load();
    void initialization.current.then((next) => {
        if (cancelled) return;
        const applied: Documents = {};
        for (const document of Object.values(next)) {
          try {
            optionsRef.current.apply(document, document.id === optionsRef.current.requestedId);
            applied[document.mode] = document;
            latestRevisions.current.set(document.id, document.revision);
          } catch (cause) {
            optionsRef.current.onError(`"${document.name}" could not be opened: ${cause instanceof Error ? cause.message : "Canvas unavailable."} Its saved data has not been changed.`);
          }
        }
        updateDocuments(applied);
        setReady(true);
      }).catch((cause) => {
        if (!cancelled) {
          optionsRef.current.onError(`My diagrams could not be loaded: ${cause instanceof Error ? cause.message : "Browser database unavailable."} Your existing drafts have not been deleted.`);
          setReady(true);
        }
      });
    return () => { cancelled = true; };
  }, [updateDocuments]);

  const captureDocument = useCallback((mode: DiagrammaticMode, name?: string): DiagramSaveInput => {
    const current = documentsRef.current[mode];
    const captured = optionsRef.current.capture(mode);
    if (captured === undefined) throw new Error("The canvas is still loading. Wait before saving or switching diagrams.");
    const payload = mode === "architecture" ? parseArchitectureDocument(captured) : captured;
    return {
      ...(current ? { id: current.id, expectedRevision: current.revision } : {}),
      name: name?.trim() || current?.name || `Untitled ${MODE_META[mode].label}`,
      mode, payload, canvasTheme: optionsRef.current.theme(mode),
      ...(current ? { comments: current.comments, versions: current.versions } : readAnnotations(mode)),
    };
  }, []);

  const mergeWorkingAnnotations = useCallback((saved: DiagramDocument) => {
    const working = documentsRef.current[saved.mode];
    return working?.id === saved.id
      ? { ...saved, comments: working.comments, versions: working.versions }
      : saved;
  }, []);

  const persist = useCallback(async (input: DiagramSaveInput) => {
    const pending = saveQueue.current.then(async () => {
      const saved = await saveDiagram({
        ...input,
        ...(input.id ? { expectedRevision: latestRevisions.current.get(input.id) ?? input.expectedRevision } : {}),
      });
      latestRevisions.current.set(saved.id, saved.revision);
      return saved;
    });
    // A failed operation must not prevent a later explicit retry.
    saveQueue.current = pending.then(() => undefined, () => undefined);
    return pending;
  }, []);

  const save = useCallback(async (name?: string) => {
    if (!ready || operation.current) throw new Error("A diagram is still loading or saving. Please wait.");
    operation.current = true;
    setBusy(true);
    const revision = optionsRef.current.revision;
    const annotations = annotationRevision.current;
    try {
      const document = mergeWorkingAnnotations(await persist(captureDocument(optionsRef.current.mode, name)));
      updateDocuments({ ...documentsRef.current, [document.mode]: document });
      setSavedRevision(annotations === annotationRevision.current ? revision : -1);
    } finally { operation.current = false; setBusy(false); }
  }, [captureDocument, persist, ready, updateDocuments, mergeWorkingAnnotations]);

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
      optionsRef.current.apply(fresh, true);
      updateDocuments({ ...documentsRef.current, [fresh.mode]: fresh });
      latestRevisions.current.set(fresh.id, fresh.revision);
      setSavedRevision(optionsRef.current.revision);
    } finally { operation.current = false; setBusy(false); }
  }, [captureDocument, persist, ready, updateDocuments, mergeWorkingAnnotations]);

  const create = useCallback(async (mode: DiagrammaticMode, name: string, payload: unknown) => {
    if (!ready || operation.current) throw new Error("A diagram is still loading or saving. Please wait.");
    operation.current = true;
    setBusy(true);
    try {
      const checkedPayload = mode === "architecture" ? parseArchitectureDocument(payload) : payload;
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
    const timer = setTimeout(() => {
      if (operation.current) return;
      void Promise.resolve().then(async () => {
        const annotations = annotationRevision.current;
        const current = mergeWorkingAnnotations(await persist(captureDocument(optionsRef.current.mode)));
        if (documentsRef.current[current.mode]?.id === current.id) {
          const next = { ...documentsRef.current, [current.mode]: current };
          documentsRef.current = next;
          setDocuments(next);
          setSavedRevision(annotations === annotationRevision.current ? revision : -1);
        }
      }).catch((cause) => optionsRef.current.onError(`Diagram autosave failed: ${cause instanceof Error ? cause.message : "Browser database unavailable."}`));
    }, 650);
    return () => clearTimeout(timer);
  }, [options.mode, options.revision, options.suspended, ready, busy, documents, savedRevision, captureDocument, persist, mergeWorkingAnnotations]);

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
      updateDocuments({ ...documentsRef.current, [document.mode]: mergeWorkingAnnotations(document) });
    }
  }, [updateDocuments, mergeWorkingAnnotations]);

  return { documents, ready, busy, saved: savedRevision === options.revision, save, saveCopy, open, create, annotate, deleted, renamed };
}
