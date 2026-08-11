"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ChevronRight,
  ChevronDown,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Lightbulb,
  Info,
  Route,
  Server,
  Shapes,
  Trash2,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type {
  ArchitectureSelection,
  ArchitectureSelectionPatch,
  ArchEdgeStyle,
} from "../modes/architecture/ArchitectureCanvas";

type Severity = "error" | "warning" | "info" | "success";

export type ValidationIssue = {
  id: string;
  severity: Severity;
  title: string;
  detail?: string;
  nodeId?: string;
};

const SEVERITY: Record<Severity, { icon: LucideIcon; color: string; bg: string; label: string }> = {
  error: { icon: XCircle, color: "text-rose-400", bg: "bg-rose-500/10", label: "Error" },
  warning: { icon: AlertTriangle, color: "text-amber-400", bg: "bg-amber-500/10", label: "Warning" },
  info: { icon: Info, color: "text-sky-400", bg: "bg-sky-500/10", label: "Info" },
  success: { icon: CheckCircle2, color: "text-emerald-400", bg: "bg-emerald-500/10", label: "OK" },
};

interface Props {
  issues: ValidationIssue[];
  selection?: ArchitectureSelection | null;
  onUpdateSelection?: (id: string, patch: ArchitectureSelectionPatch) => void;
  onDeleteSelection?: () => void;
  /** Called when the user clicks an issue with a nodeId so the canvas can focus/zoom to it. */
  onFocusNode?: (nodeId: string) => void;
}

/**
 * Right-rail Inspector with two collapsible sections: Properties (selection)
 * and Validation (linter results). For R1, properties is a placeholder until
 * the canvas surfaces selection events; validation is fully functional.
 */
export function Inspector({
  issues,
  selection,
  onUpdateSelection,
  onDeleteSelection,
  onFocusNode,
}: Props) {
  const [propsOpen, setPropsOpen] = useState(true);
  const [valOpen, setValOpen] = useState(true);

  const counts = issues.reduce(
    (acc, i) => ({ ...acc, [i.severity]: (acc[i.severity] ?? 0) + 1 }),
    {} as Record<Severity, number>
  );

  return (
    <aside className="hidden w-[304px] shrink-0 flex-col border-l border-slate-800 bg-[#0b1220] text-slate-300 xl:flex">
      {/* Properties */}
      <Section
        open={propsOpen}
        onToggle={() => setPropsOpen((v) => !v)}
        title="Properties"
        badge={null}
      >
        {selection ? (
          <SelectionProperties
            key={selection.id}
            selection={selection}
            onUpdate={onUpdateSelection}
            onDelete={onDeleteSelection}
          />
        ) : (
          <div className="px-3 py-4 text-xs text-slate-500">
            <div className="grid place-items-center rounded-xl border border-dashed border-slate-700 px-4 py-8">
              <Lightbulb className="mb-2 h-5 w-5 text-slate-600" />
              <p className="text-center font-medium text-slate-400">Select a service or connection</p>
              <p className="mt-1 text-center text-[10px] leading-relaxed text-slate-600">
                Rename elements, document intent, and set animation order here.
              </p>
            </div>
          </div>
        )}
      </Section>

      {/* Validation */}
      <Section
        open={valOpen}
        onToggle={() => setValOpen((v) => !v)}
        title="Validation"
        badge={
          issues.length === 0 ? (
            <span className="px-1.5 py-0.5 text-[10px] font-bold text-emerald-300 bg-emerald-500/10 rounded">
              Clean
            </span>
          ) : (
            <span className="flex items-center gap-1">
              {counts.error ? (
                <span className="px-1.5 py-0.5 text-[10px] font-bold text-rose-300 bg-rose-500/10 rounded">
                  {counts.error}
                </span>
              ) : null}
              {counts.warning ? (
                <span className="px-1.5 py-0.5 text-[10px] font-bold text-amber-300 bg-amber-500/10 rounded">
                  {counts.warning}
                </span>
              ) : null}
              {counts.info ? (
                <span className="px-1.5 py-0.5 text-[10px] font-bold text-sky-300 bg-sky-500/10 rounded">
                  {counts.info}
                </span>
              ) : null}
            </span>
          )
        }
      >
        <div className="max-h-[40vh] overflow-y-auto">
          {issues.length === 0 ? (
            <div className="px-3 py-6 text-center text-xs text-slate-500">
              <CheckCircle2 className="w-5 h-5 text-emerald-400 mx-auto mb-2" />
              No issues detected.
            </div>
          ) : (
            <ul className="px-1.5 py-1 space-y-0.5">
              <AnimatePresence initial={false}>
                {issues.map((issue) => {
                  const meta = SEVERITY[issue.severity];
                  const Icon = meta.icon;
                  return (
                    <motion.li
                      key={issue.id}
                      initial={{ opacity: 0, x: 8 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: 8 }}
                      transition={{ duration: 0.15 }}
                    >
                      <button
                        type="button"
                        onClick={() => issue.nodeId && onFocusNode?.(issue.nodeId)}
                        className="flex w-full cursor-pointer items-start gap-2 rounded-lg p-2 text-left transition-colors hover:bg-slate-900"
                      >
                        <Icon className={`w-3.5 h-3.5 mt-0.5 shrink-0 ${meta.color}`} />
                        <div className="flex-1 min-w-0">
                          <div className="truncate text-xs font-semibold text-slate-200">{issue.title}</div>
                          {issue.detail && (
                            <div className="mt-0.5 line-clamp-2 text-[11px] text-slate-500">{issue.detail}</div>
                          )}
                        </div>
                      </button>
                    </motion.li>
                  );
                })}
              </AnimatePresence>
            </ul>
          )}
        </div>
      </Section>
    </aside>
  );
}

function SelectionProperties({
  selection,
  onUpdate,
  onDelete,
}: {
  selection: ArchitectureSelection;
  onUpdate?: (id: string, patch: ArchitectureSelectionPatch) => void;
  onDelete?: () => void;
}) {
  const commitText = (field: "label" | "subtitle", value: string) => {
    const normalized = value.trim();
    if (normalized !== (selection[field] ?? "")) {
      onUpdate?.(selection.id, { [field]: normalized });
    }
  };

  return (
    <div className="space-y-4 px-3 pb-4">
      <div className="flex items-center gap-2 rounded-xl border border-slate-800 bg-slate-900/60 px-3 py-2.5">
        {selection.kind === "edge" ? (
          <Route className="h-4 w-4 text-cyan-400" />
        ) : selection.nodeKind === "shape" ? (
          <Shapes className="h-4 w-4 text-cyan-400" />
        ) : (
          <Server className="h-4 w-4 text-cyan-400" />
        )}
        <div className="min-w-0">
          <p className="truncate text-xs font-semibold text-white">
            {selection.kind === "edge" ? "Connection" : selection.nodeKind === "group" ? "Boundary" : "Component"}
          </p>
          <p className="truncate font-mono text-[9px] text-slate-600">{selection.id}</p>
        </div>
      </div>

      <Field label={selection.kind === "edge" ? "Protocol / label" : "Display name"}>
        <input
          defaultValue={selection.label}
          onBlur={(event) => commitText("label", event.currentTarget.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") event.currentTarget.blur();
          }}
          className="w-full rounded-lg border border-slate-700 bg-slate-950 px-2.5 py-2 text-xs text-white outline-none focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/10"
          placeholder={selection.kind === "edge" ? "HTTPS, gRPC, async…" : "Component name"}
        />
      </Field>

      {selection.kind === "node" && selection.nodeKind !== "group" && (
        <Field label="Context / responsibility">
          <input
            defaultValue={selection.subtitle ?? ""}
            onBlur={(event) => commitText("subtitle", event.currentTarget.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") event.currentTarget.blur();
            }}
            className="w-full rounded-lg border border-slate-700 bg-slate-950 px-2.5 py-2 text-xs text-white outline-none focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/10"
            placeholder="Public endpoint, private subnet…"
          />
        </Field>
      )}

      {selection.kind === "edge" && (
        <>
          <Field label="GIF / playback order" hint="1 animates first">
            <input
              type="number"
              min={1}
              step={1}
              defaultValue={selection.step ?? 1}
              onBlur={(event) => {
                const step = Number(event.currentTarget.value);
                if (Number.isFinite(step) && step > 0 && step !== selection.step) {
                  onUpdate?.(selection.id, { step });
                }
              }}
              className="w-full rounded-lg border border-slate-700 bg-slate-950 px-2.5 py-2 font-mono text-xs text-white outline-none focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/10"
            />
          </Field>
          <Field label="Line behavior">
            <div className="grid grid-cols-3 gap-1">
              {(["solid", "dashed", "flow"] as ArchEdgeStyle[]).map((style) => (
                <button
                  key={style}
                  type="button"
                  onClick={() => onUpdate?.(selection.id, { style })}
                  className={`rounded-lg border px-2 py-2 text-[10px] font-semibold capitalize transition ${
                    selection.style === style
                      ? "border-cyan-400 bg-cyan-400 text-slate-950"
                      : "border-slate-700 bg-slate-900 text-slate-400 hover:text-white"
                  }`}
                >
                  {style}
                </button>
              ))}
            </div>
          </Field>
          <div className="rounded-lg border border-cyan-900/70 bg-cyan-950/30 px-3 py-2 text-[10px] leading-relaxed text-cyan-200/80">
            Exported GIFs animate connections in ascending order. Arrows sharing the same step animate together in the same frame.
          </div>
        </>
      )}

      <button
        type="button"
        onClick={onDelete}
        className="flex w-full items-center justify-center gap-2 rounded-lg border border-rose-900/70 bg-rose-950/20 px-3 py-2 text-[11px] font-semibold text-rose-300 transition hover:bg-rose-950/40"
      >
        <Trash2 className="h-3.5 w-3.5" />
        Delete selection
      </button>
    </div>
  );
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 flex items-center justify-between text-[10px] font-bold uppercase tracking-[0.12em] text-slate-500">
        {label}
        {hint && <span className="font-normal normal-case tracking-normal text-slate-600">{hint}</span>}
      </span>
      {children}
    </label>
  );
}

function Section({
  title,
  badge,
  open,
  onToggle,
  children,
}: {
  title: string;
  badge: React.ReactNode;
  open: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="border-b border-slate-800">
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full cursor-pointer items-center gap-2 px-3 py-2.5 text-xs font-semibold uppercase tracking-wider text-slate-500 transition-colors hover:text-slate-200"
      >
        {open ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
        <span className="flex-1 text-left">{title}</span>
        {badge}
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            {children}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/** Pure derive validation issues from the architecture payload. */
export function deriveArchIssues(payload: { nodes: Array<{ id: string; label?: string; kind?: string }>; edges: Array<{ source: string; target: string }> }): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const nodes = (payload.nodes ?? []).filter((node) => node.kind !== "group");
  const edges = payload.edges ?? [];

  if (nodes.length === 0) {
    issues.push({
      id: "empty-canvas",
      severity: "info",
      title: "Empty canvas",
      detail: "Drag an icon from the palette or use ⌘K → Generate to scaffold from a prompt.",
    });
    return issues;
  }

  const connected = new Set<string>();
  edges.forEach((e) => {
    connected.add(e.source);
    connected.add(e.target);
  });

  // Orphaned nodes
  nodes.forEach((n) => {
    if (!connected.has(n.id) && nodes.length > 1) {
      issues.push({
        id: `orphan-${n.id}`,
        severity: "warning",
        title: `Disconnected: ${n.label ?? n.id}`,
        detail: "This node has no edges. Either connect it or remove it.",
        nodeId: n.id,
      });
    }
  });

  // Unlabeled nodes
  nodes.forEach((n) => {
    if (!n.label || n.label.trim() === "") {
      issues.push({
        id: `unlabeled-${n.id}`,
        severity: "info",
        title: "Unlabeled node",
        detail: "Add a label so reviewers know what this represents.",
        nodeId: n.id,
      });
    }
  });

  return issues;
}
