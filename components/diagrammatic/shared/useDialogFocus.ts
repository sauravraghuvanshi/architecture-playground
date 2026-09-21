"use client";

import { useLayoutEffect, useRef, type RefObject } from "react";

export interface DialogFocusOptions {
  open: boolean;
  onClose: () => void;
  initialFocusRef?: RefObject<HTMLElement | null>;
  /** Capture before an async opener temporarily makes the workspace inert. */
  returnFocusRef?: RefObject<HTMLElement | null>;
  /** Read a synchronous commit guard, not only its rendered disabled state. */
  canClose?: () => boolean;
}

interface DialogEntry {
  element: HTMLElement;
  restore: HTMLElement | null;
  lastFocus: HTMLElement | null;
  layer: number;
  modal: string | null;
  hidden: string | null;
  inert: boolean;
}

const dialogs: DialogEntry[] = [];
const retiredDialogs = new WeakMap<HTMLElement, DialogEntry>();
let lastFocused: HTMLElement | null = null;
let focusObservers = 0;
let cancelPendingRestore: (() => void) | undefined;
const selector = "a[href], area[href], button, input, select, textarea, summary, iframe, audio[controls], video[controls], [contenteditable], [tabindex]";

function rememberFocus(event: FocusEvent) {
  if (event.target instanceof HTMLElement && event.target !== document.body) lastFocused = event.target;
}

function originalInvoker(element: HTMLElement | null, visited = new Set<HTMLElement>()): HTMLElement | null {
  if (!element || visited.has(element)) return null;
  visited.add(element);
  for (let parent: HTMLElement | null = element; parent; parent = parent.parentElement) {
    const retired = retiredDialogs.get(parent);
    if (retired) return originalInvoker(retired.restore, visited);
  }
  return element;
}

function available(element: HTMLElement): boolean {
  if (!element.isConnected || element.matches(":disabled") || element.closest("[hidden], [inert], [aria-hidden='true'], [aria-disabled='true']")) return false;
  const style = getComputedStyle(element);
  if (style.visibility === "hidden" || style.visibility === "collapse" || style.opacity === "0" || !element.getClientRects().length) return false;
  for (let parent = element.parentElement; parent; parent = parent.parentElement) {
    if (parent instanceof HTMLDetailsElement && !parent.open && !parent.querySelector("summary")?.contains(element)) return false;
  }
  return true;
}

function focusables(element: HTMLElement): HTMLElement[] {
  return Array.from(element.querySelectorAll<HTMLElement>(selector))
    .filter((candidate) => candidate.tabIndex >= 0 && available(candidate))
    .filter((candidate, _, candidates) => {
      if (!(candidate instanceof HTMLInputElement) || candidate.type !== "radio" || !candidate.name) return true;
      const group = candidates.filter((other): other is HTMLInputElement =>
        other instanceof HTMLInputElement && other.type === "radio" && other.name === candidate.name && other.form === candidate.form);
      return candidate === (group.find((radio) => radio.checked) ?? group[0]);
    })
    .sort((a, b) => (a.tabIndex || Infinity) - (b.tabIndex || Infinity));
}

function topDialog(): DialogEntry | undefined {
  return dialogs.reduce<DialogEntry | undefined>((top, entry) => !top || entry.layer >= top.layer ? entry : top, undefined);
}

function restoreAttribute(element: HTMLElement, name: string, value: string | null) {
  if (value === null) element.removeAttribute(name);
  else element.setAttribute(name, value);
}

function syncDialogs() {
  const top = topDialog();
  for (const entry of dialogs) {
    entry.element.inert = entry === top ? entry.inert : true;
    entry.element.setAttribute("aria-modal", entry === top ? "true" : "false");
    if (entry === top) restoreAttribute(entry.element, "aria-hidden", entry.hidden);
    else entry.element.setAttribute("aria-hidden", "true");
  }
}

function focusInside(entry: DialogEntry, preferred?: HTMLElement | null) {
  const target = preferred && entry.element.contains(preferred) && available(preferred)
    ? preferred : focusables(entry.element)[0] ?? entry.element;
  target.focus({ preventScroll: true });
}

function restoreWhenReady(entry: DialogEntry) {
  cancelPendingRestore?.();
  const target = entry.restore;
  if (!target?.isConnected || topDialog()) return;
  const observer = new MutationObserver(restore);
  const timeout = window.setTimeout(cleanup, 5_000);
  const onFocus = (event: FocusEvent) => {
    if (event.target !== document.body && event.target !== target && !entry.element.contains(event.target as Node)) cleanup();
  };
  function cleanup() {
    observer.disconnect();
    window.clearTimeout(timeout);
    document.removeEventListener("focusin", onFocus);
    if (cancelPendingRestore === cleanup) cancelPendingRestore = undefined;
  }
  function restore() {
    if (!target?.isConnected || topDialog()) { cleanup(); return; }
    if (available(target)) { cleanup(); target.focus({ preventScroll: true }); }
  }
  // A committed document save can keep the workspace inert through hydration,
  // beyond the closing render. Wait for its existing lock, never remove it.
  for (let parent: HTMLElement | null = target; parent; parent = parent.parentElement) {
    observer.observe(parent, { attributes: true, childList: true,
      attributeFilter: ["disabled", "hidden", "inert", "aria-hidden", "style", "class"] });
  }
  document.addEventListener("focusin", onFocus);
  cancelPendingRestore = cleanup;
  restore();
}

/**
 * Attach the returned ref to a role="dialog" container with tabIndex={-1}.
 * The highest visible overlay owns keyboard focus; closing it restores its
 * invoker (or the underlying dialog), including command-to-dialog handoffs.
 */
export function useDialogFocus<T extends HTMLElement = HTMLDivElement>({
  open, onClose, initialFocusRef, returnFocusRef, canClose,
}: DialogFocusOptions): RefObject<T | null> {
  const ref = useRef<T>(null);
  const invoker = useRef<HTMLElement | null>(null);
  const options = useRef({ onClose, initialFocusRef, returnFocusRef, canClose });
  useLayoutEffect(() => {
    options.current = { onClose, initialFocusRef, returnFocusRef, canClose };
  }, [onClose, initialFocusRef, returnFocusRef, canClose]);
  useLayoutEffect(() => {
    if (focusObservers++ === 0) document.addEventListener("focusin", rememberFocus, true);
    return () => {
      if (--focusObservers === 0) {
        document.removeEventListener("focusin", rememberFocus, true);
        lastFocused = null;
      }
    };
  }, []);

  useLayoutEffect(() => {
    const element = ref.current;
    const retired = element && retiredDialogs.get(element);
    if (element && retired && (open || element.getAttribute("role") !== "dialog")) {
      element.inert = retired.inert;
      restoreAttribute(element, "aria-modal", open ? retired.modal : null);
      restoreAttribute(element, "aria-hidden", retired.hidden);
      retiredDialogs.delete(element);
    }
    if (!open) { invoker.current = null; return; }
    if (!element) return;
    // Opening a dialog can briefly disable its invoker, moving native focus to
    // body. Retain that invoker across loading renders and Strict Mode replays.
    if (!invoker.current) {
      const active = document.activeElement;
      invoker.current = originalInvoker(options.current.returnFocusRef?.current ??
        (active instanceof HTMLElement && active !== document.body && !element.contains(active) ? active : lastFocused));
    }
    let layer = 0;
    for (let parent: HTMLElement | null = element; parent; parent = parent.parentElement) {
      const value = Number.parseInt(getComputedStyle(parent).zIndex, 10);
      if (Number.isFinite(value)) layer = Math.max(layer, value);
    }
    const entry: DialogEntry = {
      element,
      restore: invoker.current,
      lastFocus: null,
      layer,
      modal: element.getAttribute("aria-modal"),
      hidden: element.getAttribute("aria-hidden"),
      inert: element.inert,
    };
    cancelPendingRestore?.();
    dialogs.push(entry);
    syncDialogs();
    if (topDialog() === entry) focusInside(entry, options.current.initialFocusRef?.current);

    const keydown = (event: KeyboardEvent) => {
      if (topDialog() !== entry || event.isComposing) return;
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopImmediatePropagation();
        if (options.current.canClose?.() !== false) options.current.onClose();
      } else if (event.key === "Tab") {
        const candidates = focusables(element);
        const current = candidates.indexOf(document.activeElement as HTMLElement);
        const next = event.shiftKey
          ? candidates[(current <= 0 ? candidates.length : current) - 1]
          : candidates[(current + 1) % candidates.length];
        event.preventDefault();
        event.stopImmediatePropagation();
        (next ?? element).focus();
      }
    };
    const focusin = (event: FocusEvent) => {
      if (topDialog() !== entry) return;
      if (event.target instanceof HTMLElement && element.contains(event.target)) entry.lastFocus = event.target;
      else focusInside(entry, entry.lastFocus);
    };
    const observer = new MutationObserver(() => {
      if (topDialog() !== entry) return;
      const active = document.activeElement;
      if (!(active instanceof HTMLElement) || !element.contains(active) || !available(active)) {
        focusInside(entry, entry.lastFocus);
      }
    });
    observer.observe(element, {
      subtree: true, childList: true, attributes: true,
      attributeFilter: ["disabled", "hidden", "inert", "aria-hidden", "tabindex", "style", "class"],
    });
    document.addEventListener("keydown", keydown, true);
    document.addEventListener("focusin", focusin);
    return () => {
      observer.disconnect();
      document.removeEventListener("keydown", keydown, true);
      document.removeEventListener("focusin", focusin);
      const wasTop = topDialog() === entry;
      dialogs.splice(dialogs.indexOf(entry), 1);
      // An exiting command palette may still exist during its exit animation.
      for (const other of dialogs) {
        if (other.restore && element.contains(other.restore)) other.restore = entry.restore;
      }
      if (element.getAttribute("role") === "dialog") {
        // AnimatePresence may retain an exiting modal during its animation.
        retiredDialogs.set(element, entry);
        element.inert = true;
        element.setAttribute("aria-modal", "false");
        element.setAttribute("aria-hidden", "true");
      } else {
        // Responsive drawers keep the same DOM mounted as desktop panels.
        element.inert = entry.inert;
        restoreAttribute(element, "aria-hidden", entry.hidden);
        element.removeAttribute("aria-modal");
      }
      syncDialogs();
      if (!wasTop) return;
      const top = topDialog();
      if (top) focusInside(top, entry.restore && top.element.contains(entry.restore) ? entry.restore : top.lastFocus);
      else {
        const active = document.activeElement;
        if (element.getAttribute("role") !== "dialog" && active instanceof HTMLElement &&
            element.contains(active) && available(active)) return;
        const restore = () => {
          if (!topDialog() && entry.restore && available(entry.restore)) entry.restore.focus({ preventScroll: true });
        };
        restore();
        // Finish after React removes the dialog and re-enables its toolbar.
        const restoreAfterCommit = () => {
          if (document.activeElement === document.body || element.contains(document.activeElement)) restoreWhenReady(entry);
        };
        queueMicrotask(restoreAfterCommit);
      }
    };
  }, [open]);

  return ref;
}
