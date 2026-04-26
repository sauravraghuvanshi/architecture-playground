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
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

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
  /** Called when the user clicks an issue with a nodeId so the canvas can focus/zoom to it. */
  onFocusNode?: (nodeId: string) => void;
}

/**
 * Right-rail Inspector with two collapsible sections: Properties (selection)
 * and Validation (linter results). For R1, properties is a placeholder until
 * the canvas surfaces selection events; validation is fully functional.
 */
export function Inspector({ issues, onFocusNode }: Props) {
  const [propsOpen, setPropsOpen] = useState(true);
  const [valOpen, setValOpen] = useState(true);

  const counts = issues.reduce(
    (acc, i) => ({ ...acc, [i.severity]: (acc[i.severity] ?? 0) + 1 }),
    {} as Record<Severity, number>
  );

  return (
    <aside className="hidden lg:flex w-72 shrink-0 flex-col border-l border-zinc-800 bg-zinc-950 text-zinc-300">
      {/* Properties */}
      <Section
        open={propsOpen}
        onToggle={() => setPropsOpen((v) => !v)}
        title="Properties"
        badge={null}
      >
        <div className="px-3 py-4 text-xs text-zinc-500">
          <div className="grid place-items-center py-6 rounded-md border border-dashed border-zinc-800">
            <Lightbulb className="w-5 h-5 text-zinc-600 mb-2" />
            <p className="text-center">Select a node to inspect &amp; edit properties</p>
          </div>
        </div>
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
            <div className="px-3 py-6 text-center text-xs text-zinc-500">
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
                        className="w-full text-left flex items-start gap-2 p-2 rounded-md hover:bg-zinc-900 transition-colors cursor-pointer"
                      >
                        <Icon className={`w-3.5 h-3.5 mt-0.5 shrink-0 ${meta.color}`} />
                        <div className="flex-1 min-w-0">
                          <div className="text-xs font-semibold text-zinc-200 truncate">{issue.title}</div>
                          {issue.detail && (
                            <div className="mt-0.5 text-[11px] text-zinc-500 line-clamp-2">{issue.detail}</div>
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
    <div className="border-b border-zinc-800">
      <button
        type="button"
        onClick={onToggle}
        className="w-full flex items-center gap-2 px-3 py-2 text-xs font-semibold uppercase tracking-wider text-zinc-400 hover:text-zinc-200 transition-colors cursor-pointer"
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
export function deriveArchIssues(payload: { nodes: Array<{ id: string; label?: string }>; edges: Array<{ source: string; target: string }> }): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const nodes = payload.nodes ?? [];
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
