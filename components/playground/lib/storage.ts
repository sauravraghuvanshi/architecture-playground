/**
 * Versioned localStorage helpers for the playground.
 * Catches QuotaExceededError; caps named slots; payload carries its own version
 * so future migrations are clean.
 */
import type { PlaygroundGraph, StoredPayload } from "./types";

export const STORAGE_VERSION = 1;
const AUTOSAVE_KEY = "playground:autosave:v1";
const SLOT_PREFIX = "playground:slot:";
const MAX_SLOTS = 10;

function safeGet(key: string): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function safeSet(key: string, value: string): { ok: boolean; quota?: boolean } {
  if (typeof window === "undefined") return { ok: false };
  try {
    window.localStorage.setItem(key, value);
    return { ok: true };
  } catch (err) {
    const isQuota =
      err instanceof Error &&
      (err.name === "QuotaExceededError" || /quota/i.test(err.message));
    return { ok: false, quota: isQuota };
  }
}

function migrate(payload: unknown): StoredPayload | null {
  if (!payload || typeof payload !== "object") return null;
  const p = payload as Partial<StoredPayload>;
  if (typeof p.version !== "number") return null;
  // Future migrations: switch on p.version → upgrade to STORAGE_VERSION.
  if (p.version === STORAGE_VERSION && p.graph) {
    return p as StoredPayload;
  }
  return null;
}

function packPayload(graph: PlaygroundGraph): string {
  const payload: StoredPayload = {
    version: STORAGE_VERSION,
    savedAt: new Date().toISOString(),
    graph,
  };
  return JSON.stringify(payload);
}

function unpackPayload(raw: string | null): PlaygroundGraph | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    const migrated = migrate(parsed);
    return migrated?.graph ?? null;
  } catch {
    return null;
  }
}

// Autosave (single slot)
export function saveAutosave(graph: PlaygroundGraph): { ok: boolean; quota?: boolean } {
  return safeSet(AUTOSAVE_KEY, packPayload(graph));
}

export function loadAutosave(): PlaygroundGraph | null {
  return unpackPayload(safeGet(AUTOSAVE_KEY));
}

export function clearAutosave(): void {
  if (typeof window === "undefined") return;
  try { window.localStorage.removeItem(AUTOSAVE_KEY); } catch { /* noop */ }
}

// Named slots
export interface SlotMeta { name: string; savedAt: string; }

export function saveSlot(name: string, graph: PlaygroundGraph): { ok: boolean; quota?: boolean; tooMany?: boolean } {
  const trimmed = name.trim().slice(0, 60);
  if (!trimmed) return { ok: false };
  const existing = listSlots();
  if (!existing.find((s) => s.name === trimmed) && existing.length >= MAX_SLOTS) {
    return { ok: false, tooMany: true };
  }
  return safeSet(SLOT_PREFIX + trimmed, packPayload(graph));
}

export function loadSlot(name: string): PlaygroundGraph | null {
  return unpackPayload(safeGet(SLOT_PREFIX + name));
}

export function deleteSlot(name: string): void {
  if (typeof window === "undefined") return;
  try { window.localStorage.removeItem(SLOT_PREFIX + name); } catch { /* noop */ }
}

export function listSlots(): SlotMeta[] {
  if (typeof window === "undefined") return [];
  const slots: SlotMeta[] = [];
  try {
    for (let i = 0; i < window.localStorage.length; i++) {
      const key = window.localStorage.key(i);
      if (!key || !key.startsWith(SLOT_PREFIX)) continue;
      const raw = window.localStorage.getItem(key);
      if (!raw) continue;
      try {
        const parsed = JSON.parse(raw);
        const migrated = migrate(parsed);
        if (migrated) {
          slots.push({ name: key.slice(SLOT_PREFIX.length), savedAt: migrated.savedAt });
        }
      } catch { /* skip */ }
    }
  } catch { /* noop */ }
  slots.sort((a, b) => b.savedAt.localeCompare(a.savedAt));
  return slots;
}
