"use client";

import { useLayoutEffect, useRef, useState, type ReactNode } from "react";

interface Props {
  id: string;
  label: string;
  title: string;
  trigger: ReactNode;
  buttonClassName: string;
  panelClassName: string;
  children: ReactNode;
}

export function moveActionFocus(container: HTMLElement | null, key: string): boolean {
  if (!["ArrowDown", "ArrowUp", "Home", "End"].includes(key)) return false;
  const available = Array.from(container?.querySelectorAll<HTMLButtonElement>("button:not(:disabled)") ?? [])
    .filter((item) => item.getClientRects().length > 0);
  if (!available.length) return false;
  const index = available.findIndex((item) => item === document.activeElement);
  const next = key === "Home" ? 0 : key === "End" ? available.length - 1
    : (index + (key === "ArrowDown" ? 1 : -1) + available.length) % available.length;
  available[next].focus();
  return true;
}

export function hasActiveModal(): boolean {
  return Array.from(document.querySelectorAll<HTMLElement>('[role="dialog"][aria-modal="true"]'))
    .some((element) => element.getClientRects().length > 0 && !element.closest('[inert], [aria-hidden="true"]'));
}

export function ActionDropdown({ id, label, title, trigger, buttonClassName, panelClassName, children }: Props) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const firstFocus = useRef<"first" | "last" | null>(null);
  const items = () => Array.from(panel.current?.querySelectorAll<HTMLButtonElement>("button:not(:disabled)") ?? []);

  function close() {
    setOpen(false);
    button.current?.focus({ preventScroll: true });
  }

  useLayoutEffect(() => {
    if (!open) return;
    function position() {
      if (!button.current || !panel.current) return;
      const anchor = button.current.getBoundingClientRect();
      const popup = panel.current;
      popup.style.maxWidth = `${window.innerWidth - 16}px`;
      popup.style.left = `${Math.max(8, Math.min(anchor.right - popup.offsetWidth, window.innerWidth - popup.offsetWidth - 8))}px`;
      const below = window.innerHeight - anchor.bottom - 8;
      const above = anchor.top - 8;
      const upwards = below < 160 && above > below;
      popup.style.top = upwards ? "auto" : `${anchor.bottom + 4}px`;
      popup.style.bottom = upwards ? `${window.innerHeight - anchor.top + 4}px` : "auto";
      popup.style.maxHeight = `${Math.max(40, (upwards ? above : below) - 4)}px`;
    }
    function outside(event: PointerEvent) {
      if (event.target instanceof Node && !root.current?.contains(event.target)) setOpen(false);
    }
    function escape(event: KeyboardEvent) {
      if (event.key !== "Escape" || event.defaultPrevented) return;
      if (hasActiveModal()) return;
      event.preventDefault();
      event.stopPropagation();
      setOpen(false);
      button.current?.focus({ preventScroll: true });
    }
    position();
    if (firstFocus.current) {
      const available = items();
      (firstFocus.current === "last" ? available.at(-1) : available[0])?.focus({ preventScroll: true });
    }
    document.addEventListener("pointerdown", outside, true);
    document.addEventListener("keydown", escape, true);
    window.addEventListener("resize", position);
    window.addEventListener("scroll", position, true);
    return () => {
      document.removeEventListener("pointerdown", outside, true);
      document.removeEventListener("keydown", escape, true);
      window.removeEventListener("resize", position);
      window.removeEventListener("scroll", position, true);
    };
  }, [open]);

  return (
    <div ref={root} className="relative" onBlur={(event) => {
      if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false);
    }} onKeyDown={(event) => {
      if (open && event.key === "Escape") {
        event.preventDefault();
        event.stopPropagation();
        close();
      }
    }}>
      <button ref={button} type="button" title={title} aria-expanded={open} aria-controls={id}
        className={`${buttonClassName} focus-visible:outline-2 focus-visible:outline-cyan-400`}
        onClick={() => { firstFocus.current = null; setOpen((value) => !value); }}
        onKeyDown={(event) => {
          if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return;
          event.preventDefault();
          firstFocus.current = event.key === "ArrowUp" ? "last" : "first";
          if (open) {
            const available = items();
            (firstFocus.current === "last" ? available.at(-1) : available[0])?.focus();
          } else setOpen(true);
        }}>{trigger}</button>
      {open && <div ref={panel} id={id} role="group" aria-label={label}
        className={`fixed z-50 overflow-y-auto ${panelClassName}`}
        onClick={(event) => {
          if (event.target instanceof Element && event.target.closest("button:not(:disabled)")) close();
        }}
        onKeyDown={(event) => {
          if (moveActionFocus(panel.current, event.key)) event.preventDefault();
        }}>{children}</div>}
    </div>
  );
}
