"use client";

import { useSyncExternalStore, type ReactNode } from "react";
import { X } from "lucide-react";
import { useDialogFocus } from "./useDialogFocus";

const mediaQuery = "(max-width: 1279px)";
function subscribe(change: () => void) {
  const media = window.matchMedia(mediaQuery);
  media.addEventListener("change", change);
  return () => media.removeEventListener("change", change);
}
const compactSnapshot = () => window.matchMedia(mediaQuery).matches;
const serverSnapshot = () => false;

interface Props {
  id: string;
  title: string;
  open: boolean;
  onClose: () => void;
  side?: "left" | "right";
  desktopVisible?: boolean;
  children: ReactNode;
}

export function ResponsivePanel({ id, title, open, onClose, side = "right", desktopVisible = true, children }: Props) {
  const compact = useSyncExternalStore(subscribe, compactSnapshot, serverSnapshot);
  const active = compact && open;
  const ref = useDialogFocus({ open: active, onClose });
  return <>
    {active && <div className="fixed inset-0 z-[90] bg-slate-950/70 backdrop-blur-sm" onMouseDown={onClose} />}
    <div ref={ref} id={id} role={active ? "dialog" : undefined} aria-modal={active ? true : undefined}
      aria-label={active ? title : undefined} tabIndex={active ? -1 : undefined}
      className={active
        ? `fixed inset-y-2 z-[95] flex w-[min(340px,calc(100vw-16px))] flex-col overflow-hidden rounded-xl border border-slate-700 bg-[#0b1220] shadow-2xl ${side === "left" ? "left-2" : "right-2"}`
        : desktopVisible ? "hidden h-full shrink-0 flex-col xl:flex" : "hidden"}>
      {active && <header className="flex shrink-0 items-center justify-between gap-2 border-b border-slate-700 px-3 py-2">
        <h2 className="text-sm font-semibold text-slate-100">{title}</h2>
        <button type="button" onClick={onClose} aria-label={`Close ${title}`} className="rounded-lg p-2 text-slate-300 hover:bg-slate-800 focus-visible:outline-2 focus-visible:outline-cyan-400">
          <X className="h-4 w-4" />
        </button>
      </header>}
      <div className={`min-h-0 flex-1 ${active ? "[&>aside]:w-full" : ""}`}>{children}</div>
    </div>
  </>;
}
