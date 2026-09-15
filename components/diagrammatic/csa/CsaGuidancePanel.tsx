"use client";

import { useMemo, useState } from "react";
import {
  ArrowUpRight,
  BookOpenCheck,
  CheckCircle2,
  CloudCog,
  GitBranch,
  Layers3,
  ShieldCheck,
  Search,
  Sparkles,
  TriangleAlert,
  X,
} from "lucide-react";
import {
  ARCHITECTURE_CENTER_ITEMS,
  filterArchitectureCenterItems,
  type ArchitectureCenterItemKind,
} from "./architecture-center";
import {
  getLandingZoneRecommendation,
  LANDING_ZONE_BLUEPRINT_PROMPT,
  LANDING_ZONE_DESIGN_AREAS,
  type LandingZoneIac,
  type LandingZoneVcs,
} from "./landing-zones";
import {
  CAF_METHODOLOGIES,
  getCafProgress,
  type CafMethodologyId,
} from "./cloud-adoption-framework";
import {
  assessWellArchitected,
  assessDiagramWellArchitected,
  diffWafAssessments,
  WAF_DIAGRAM_METHODOLOGY,
  WAF_PILLARS,
  type WafDiagramPayload,
  type WafDiagramAssessment,
} from "./well-architected";

interface Props {
  open: boolean;
  onClose: () => void;
  onApplyPattern: (prompt: string) => void;
  /** Current serialized architecture, updated by the parent on every canvas change. */
  payload?: WafDiagramPayload;
}

export function CsaGuidancePanel({ open, onClose, onApplyPattern, payload }: Props) {
  const [section, setSection] = useState<
    "architecture-center" | "landing-zones" | "cloud-adoption" | "well-architected"
  >("architecture-center");
  const [kind, setKind] = useState<ArchitectureCenterItemKind>("pattern");
  const [query, setQuery] = useState("");
  const [iac, setIac] = useState<LandingZoneIac>("bicep");
  const [vcs, setVcs] = useState<LandingZoneVcs>("github");
  const [completedAreas, setCompletedAreas] = useState<string[]>([]);
  const [completedCaf, setCompletedCaf] = useState<CafMethodologyId[]>([]);
  const [confirmedWafQuestions, setConfirmedWafQuestions] = useState<string[]>([]);
  const items = useMemo(
    () => filterArchitectureCenterItems(ARCHITECTURE_CENTER_ITEMS, kind, query),
    [kind, query]
  );
  const landingZoneRecommendation = useMemo(
    () => getLandingZoneRecommendation(iac, vcs),
    [iac, vcs]
  );
  const cafProgress = useMemo(() => getCafProgress(completedCaf), [completedCaf]);
  const wafAssessment = useMemo(
    () => assessWellArchitected(confirmedWafQuestions),
    [confirmedWafQuestions]
  );

  if (!open) return null;

  return (
    <aside
      aria-label="Microsoft CSA guidance"
      className="flex h-full w-[25rem] shrink-0 flex-col border-l border-slate-800 bg-[#08111f]"
    >
      <header className="border-b border-slate-800 px-4 py-3">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 text-sm font-semibold text-white">
              <BookOpenCheck className="h-4 w-4 text-cyan-300" />
              Microsoft CSA guidance
            </div>
            <p className="mt-1 text-[11px] leading-relaxed text-slate-400">
              Apply official Azure architecture and platform guidance to customer designs.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close Microsoft CSA guidance"
            className="cursor-pointer rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-800 hover:text-white"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="mt-3 grid grid-cols-4 rounded-xl border border-slate-800 bg-slate-950/60 p-1">
          {([
            ["architecture-center", "Architecture Center"],
            ["landing-zones", "Landing zones"],
            ["cloud-adoption", "CAF"],
            ["well-architected", "WAF"],
          ] as const).map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => setSection(id)}
              aria-pressed={section === id}
              className={`cursor-pointer rounded-lg px-3 py-1.5 text-[11px] font-semibold transition ${
                section === id
                  ? "bg-cyan-400 text-slate-950"
                  : "text-slate-400 hover:bg-slate-800 hover:text-white"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {section === "architecture-center" && (
          <>
            <div className="mt-3 grid grid-cols-2 rounded-xl border border-slate-800 bg-slate-950/60 p-1">
              {([
                ["pattern", "Patterns"],
                ["principle", "Principles"],
              ] as const).map(([id, label]) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => setKind(id)}
                  aria-pressed={kind === id}
                  className={`cursor-pointer rounded-lg px-3 py-1.5 text-[11px] font-semibold transition ${
                    kind === id
                      ? "bg-slate-700 text-white"
                      : "text-slate-400 hover:bg-slate-800 hover:text-white"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
            <label className="mt-3 flex items-center gap-2 rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-slate-400 focus-within:border-cyan-400/60">
              <Search className="h-3.5 w-3.5" />
              <input
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder={`Search ${kind === "pattern" ? "patterns" : "principles"}`}
                className="min-w-0 flex-1 bg-transparent text-xs text-white outline-none placeholder:text-slate-600"
              />
            </label>
          </>
        )}
      </header>

      <div className="flex-1 overflow-y-auto p-3">
        {section === "well-architected" ? (
          <div className="space-y-4">
            {payload ? (
              <WafDiagramScorecard payload={payload} />
            ) : (
              <p role="status" className="rounded-xl border border-amber-400/20 p-3 text-xs text-amber-200">
                Current canvas evidence is unavailable. Connect a diagram to assess its five pillars.
              </p>
            )}
            <details>
              <summary className="cursor-pointer rounded-xl border border-slate-700 p-3 text-xs font-semibold text-cyan-200">
                Discovery questionnaire (self-reported, separate from canvas scores)
              </summary>
            <section className="rounded-2xl border border-emerald-400/20 bg-emerald-400/5 p-4">
              <div className="flex items-center gap-2">
                <ShieldCheck className="h-4 w-4 text-emerald-300" />
                <p className="text-[9px] font-bold uppercase tracking-[0.16em] text-emerald-300">
                  Azure Well-Architected Framework
                </p>
              </div>
              <h2 className="mt-2 text-base font-semibold text-white">
                Self-reported discovery checklist
              </h2>
              <p className="mt-1.5 text-[11px] leading-relaxed text-slate-400">
                These answers track discovery only and never change the actual-diagram score.
                They do not verify deployed settings or provide certification.
              </p>
              <div className="mt-3 flex items-end justify-between gap-4 rounded-xl border border-slate-700 bg-slate-950/60 p-3">
                <div>
                  <p className="text-2xl font-semibold text-white">{wafAssessment.percentage}%</p>
                  <p className="text-[9px] uppercase tracking-wide text-slate-500">
                    {wafAssessment.confirmed}/{wafAssessment.total} evidence points confirmed
                  </p>
                </div>
                <p className="max-w-40 text-right text-[9px] leading-relaxed text-slate-500">
                  {wafAssessment.gaps.length} discovery gaps remain
                </p>
              </div>
            </section>

            <section className="grid grid-cols-2 gap-2">
              {WAF_PILLARS.map((pillar) => (
                <div
                  key={pillar.id}
                  className="rounded-xl border border-slate-800 bg-slate-900/70 p-2.5"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[10px] font-semibold text-slate-200">{pillar.title}</span>
                    <span className="text-[10px] font-bold text-emerald-300">
                      {wafAssessment.pillarScores[pillar.id]}%
                    </span>
                  </div>
                  <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-slate-800">
                    <div
                      className="h-full rounded-full bg-emerald-400 transition-[width]"
                      style={{ width: `${wafAssessment.pillarScores[pillar.id]}%` }}
                    />
                  </div>
                </div>
              ))}
            </section>

            <section className="space-y-3">
              {WAF_PILLARS.map((pillar) => (
                <article
                  key={pillar.id}
                  className="rounded-2xl border border-slate-800 bg-slate-900/70 p-3"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h3 className="text-xs font-semibold text-white">{pillar.title}</h3>
                      <p className="mt-1 text-[10px] leading-relaxed text-slate-400">
                        {pillar.objective}
                      </p>
                    </div>
                    <a
                      href={pillar.sourceUrl}
                      target="_blank"
                      rel="noreferrer"
                      aria-label={`Official ${pillar.title} guidance`}
                      className="shrink-0 text-slate-500 hover:text-emerald-300"
                    >
                      <ArrowUpRight className="h-3.5 w-3.5" />
                    </a>
                  </div>
                  <div className="mt-3 space-y-2">
                    {pillar.questions.map((question) => {
                      const confirmed = confirmedWafQuestions.includes(question.id);
                      return (
                        <label
                          key={question.id}
                          className={`flex cursor-pointer gap-2 rounded-xl border p-2.5 ${
                            confirmed
                              ? "border-emerald-400/30 bg-emerald-400/5"
                              : "border-slate-800 bg-slate-950/40"
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={confirmed}
                            onChange={() =>
                              setConfirmedWafQuestions((current) =>
                                confirmed
                                  ? current.filter((id) => id !== question.id)
                                  : [...current, question.id]
                              )
                            }
                            aria-label={question.text}
                            className="mt-0.5 accent-emerald-400"
                          />
                          <span className="text-[10px] leading-relaxed text-slate-300">
                            {question.text}
                          </span>
                        </label>
                      );
                    })}
                  </div>
                </article>
              ))}
            </section>

            {wafAssessment.gaps.length > 0 && (
              <section className="rounded-2xl border border-amber-400/20 bg-amber-400/5 p-3">
                <h2 className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.14em] text-amber-300">
                  <TriangleAlert className="h-3.5 w-3.5" />
                  Prioritized discovery gaps
                </h2>
                <ol className="mt-2 space-y-2">
                  {wafAssessment.gaps.slice(0, 5).map((gap) => (
                    <li key={`${gap.pillar}:${gap.text}`} className="text-[9px] leading-relaxed text-slate-400">
                      <span className="font-semibold text-slate-200">[{gap.pillar}]</span>{" "}
                      {gap.recommendation}
                    </li>
                  ))}
                </ol>
              </section>
            )}
            </details>
          </div>
        ) : section === "cloud-adoption" ? (
          <div className="space-y-4">
            <section className="rounded-2xl border border-violet-400/20 bg-violet-400/5 p-4">
              <div className="flex items-center gap-2">
                <CloudCog className="h-4 w-4 text-violet-300" />
                <p className="text-[9px] font-bold uppercase tracking-[0.16em] text-violet-300">
                  Cloud Adoption Framework
                </p>
              </div>
              <h2 className="mt-2 text-base font-semibold text-white">
                Turn cloud ambition into sustained outcomes
              </h2>
              <p className="mt-1.5 text-[11px] leading-relaxed text-slate-400">
                Progress through the foundational methodologies, then operate Govern, Secure,
                and Manage continuously alongside adoption.
              </p>
              <div className="mt-3 rounded-xl border border-slate-700 bg-slate-950/60 p-3">
                <div className="flex items-center justify-between text-[10px] font-semibold">
                  <span className="text-slate-300">Journey progress</span>
                  <span className="text-violet-300">
                    {cafProgress.completed}/{cafProgress.total} · {cafProgress.percentage}%
                  </span>
                </div>
                <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-800">
                  <div
                    className="h-full rounded-full bg-violet-400 transition-[width]"
                    style={{ width: `${cafProgress.percentage}%` }}
                  />
                </div>
                <p className="mt-2 text-[10px] text-slate-400">
                  {cafProgress.next
                    ? `Recommended next focus: ${cafProgress.next.title} — ${cafProgress.next.outcome}`
                    : "All methodologies have an initial outcome recorded. Continue iterative improvement."}
                </p>
              </div>
            </section>

            <section>
              <div className="mb-2 grid grid-cols-2 gap-2 px-1 text-[9px] font-bold uppercase tracking-[0.14em] text-slate-500">
                <span>Foundation · sequential</span>
                <span>Operations · continuous</span>
              </div>
              <div className="space-y-2">
                {CAF_METHODOLOGIES.map((methodology) => {
                  const completed = completedCaf.includes(methodology.id);
                  return (
                    <article
                      key={methodology.id}
                      className={`rounded-2xl border p-3 ${
                        methodology.type === "foundational"
                          ? "border-slate-800 bg-slate-900/70"
                          : "border-violet-400/20 bg-violet-400/5"
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <button
                          type="button"
                          onClick={() =>
                            setCompletedCaf((current) =>
                              completed
                                ? current.filter((id) => id !== methodology.id)
                                : [...current, methodology.id]
                            )
                          }

                          aria-label={`Mark ${methodology.title} ${completed ? "incomplete" : "complete"}`}
                          aria-pressed={completed}
                          className={`grid h-7 w-7 shrink-0 cursor-pointer place-items-center rounded-xl border text-[10px] font-bold ${
                            completed
                              ? "border-emerald-400 bg-emerald-400 text-slate-950"
                              : "border-slate-700 bg-slate-950 text-slate-400 hover:border-violet-300"
                          }`}
                        >
                          {completed ? <CheckCircle2 className="h-3.5 w-3.5" /> : methodology.order}
                        </button>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center justify-between gap-2">
                            <h3 className="text-xs font-semibold text-white">{methodology.title}</h3>
                            <span className="rounded-full border border-slate-700 px-1.5 py-0.5 text-[8px] font-semibold text-slate-500">
                              {methodology.type}
                            </span>
                          </div>
                          <p className="mt-1 text-[10px] leading-relaxed text-slate-400">
                            {methodology.outcome}
                          </p>
                          <details className="mt-2">
                            <summary className="cursor-pointer text-[9px] font-semibold uppercase tracking-wide text-violet-300">
                              Outcome evidence
                            </summary>
                            <ul className="mt-1.5 space-y-1 text-[9px] leading-relaxed text-slate-500">
                              {methodology.actions.map((action) => (
                                <li key={action}>• {action}</li>
                              ))}
                            </ul>
                          </details>
                          <a
                            href={methodology.sourceUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="mt-2 inline-flex items-center gap-1 text-[9px] font-semibold text-slate-400 hover:text-violet-300"
                          >
                            Official {methodology.title} guidance
                            <ArrowUpRight className="h-2.5 w-2.5" />
                          </a>
                        </div>
                      </div>
                    </article>
                  );
                })}
              </div>
            </section>
          </div>
        ) : section === "landing-zones" ? (
          <div className="space-y-4">
            <section className="rounded-2xl border border-cyan-400/20 bg-cyan-400/5 p-4">
              <p className="text-[9px] font-bold uppercase tracking-[0.16em] text-cyan-300">
                Recommended implementation
              </p>
              <h2 className="mt-1 text-base font-semibold text-white">
                Azure Landing Zones IaC Accelerator
              </h2>
              <p className="mt-1.5 text-[11px] leading-relaxed text-slate-400">
                Build the platform landing zone with Azure Verified Modules and a repeatable
                continuous-delivery workflow.
              </p>
              <button
                type="button"
                onClick={() => onApplyPattern(LANDING_ZONE_BLUEPRINT_PROMPT)}
                className="mt-3 inline-flex cursor-pointer items-center gap-1.5 rounded-lg bg-cyan-400 px-2.5 py-1.5 text-[10px] font-bold text-slate-950 hover:bg-cyan-300"
              >
                <Sparkles className="h-3 w-3" />
                Apply platform blueprint
              </button>
            </section>

            <section className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4">
              <div className="flex items-center gap-2">
                <GitBranch className="h-4 w-4 text-cyan-300" />
                <h2 className="text-sm font-semibold text-white">Accelerator path</h2>
              </div>
              <div className="mt-3 grid grid-cols-2 gap-3">
                <ChoiceGroup
                  label="Infrastructure as code"
                  value={iac}
                  options={[
                    ["bicep", "Bicep"],
                    ["terraform", "Terraform"],
                  ]}
                  onChange={(value) => setIac(value as LandingZoneIac)}
                />
                <ChoiceGroup
                  label="Version control"
                  value={vcs}
                  options={[
                    ["github", "GitHub"],
                    ["azure-devops", "Azure DevOps"],
                  ]}
                  onChange={(value) => setVcs(value as LandingZoneVcs)}
                />
              </div>
              <div className="mt-3 rounded-xl border border-slate-700 bg-slate-950/60 p-3">
                <p className="text-xs font-semibold text-white">{landingZoneRecommendation.title}</p>
                <p className="mt-1 text-[10px] leading-relaxed text-slate-400">
                  {landingZoneRecommendation.summary}
                </p>
                <ol className="mt-3 space-y-2">
                  {landingZoneRecommendation.steps.map((step) => (
                    <li key={step.phase} className="flex gap-2">
                      <span className="mt-0.5 h-fit rounded bg-cyan-400/10 px-1.5 py-0.5 text-[8px] font-bold text-cyan-300">
                        {step.phase}
                      </span>
                      <div>
                        <p className="text-[10px] font-semibold text-slate-200">{step.title}</p>
                        <p className="text-[9px] leading-relaxed text-slate-500">{step.detail}</p>
                      </div>
                    </li>
                  ))}
                </ol>
                <a
                  href={landingZoneRecommendation.acceleratorUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-3 inline-flex items-center gap-1 text-[10px] font-semibold text-cyan-300 hover:text-cyan-200"
                >
                  Open official accelerator
                  <ArrowUpRight className="h-3 w-3" />
                </a>
              </div>
            </section>

            <section>
              <div className="mb-2 flex items-center justify-between px-1">
                <h2 className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-500">
                  Design-area readiness
                </h2>
                <span className="text-[10px] font-semibold text-cyan-300">
                  {completedAreas.length}/{LANDING_ZONE_DESIGN_AREAS.length}
                </span>
              </div>
              <div className="space-y-2">
                {LANDING_ZONE_DESIGN_AREAS.map((area) => {
                  const completed = completedAreas.includes(area.id);
                  return (
                    <article
                      key={area.id}
                      className="rounded-xl border border-slate-800 bg-slate-900/70 p-3"
                    >
                      <div className="flex items-start gap-2.5">
                        <button
                          type="button"
                          onClick={() =>
                            setCompletedAreas((current) =>
                              completed
                                ? current.filter((id) => id !== area.id)
                                : [...current, area.id]
                            )
                          }
                          aria-label={`Mark ${area.title} ${completed ? "incomplete" : "complete"}`}
                          aria-pressed={completed}
                          className={`mt-0.5 grid h-4 w-4 shrink-0 cursor-pointer place-items-center rounded-full border ${
                            completed
                              ? "border-emerald-400 bg-emerald-400 text-slate-950"
                              : "border-slate-600 text-transparent hover:border-cyan-300"
                          }`}
                        >
                          <CheckCircle2 className="h-3 w-3" />
                        </button>
                        <div className="min-w-0">
                          <h3 className="text-xs font-semibold text-white">{area.title}</h3>
                          <p className="mt-1 text-[10px] leading-relaxed text-slate-400">{area.summary}</p>
                          <details className="mt-2">
                            <summary className="cursor-pointer text-[9px] font-semibold uppercase tracking-wide text-cyan-300">
                              Discovery questions
                            </summary>
                            <ul className="mt-1.5 space-y-1 text-[9px] leading-relaxed text-slate-500">
                              {area.questions.map((question) => (
                                <li key={question}>• {question}</li>
                              ))}
                            </ul>
                          </details>
                          <a
                            href={area.sourceUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="mt-2 inline-flex items-center gap-1 text-[9px] font-semibold text-slate-400 hover:text-cyan-300"
                          >
                            Official design area
                            <ArrowUpRight className="h-2.5 w-2.5" />
                          </a>
                        </div>
                      </div>
                    </article>
                  );
                })}
              </div>
            </section>
          </div>
        ) : (
          <>
        <div className="mb-3 flex items-center justify-between px-1 text-[10px] font-bold uppercase tracking-[0.16em] text-slate-500">
          <span>{kind === "pattern" ? "Architecture styles & patterns" : "Cloud design principles"}</span>
          <span>{items.length}</span>
        </div>

        {items.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-700 px-4 py-8 text-center text-xs text-slate-500">
            No guidance matches “{query}”.
          </div>
        ) : (
          <div className="space-y-3">
            {items.map((item) => (
              <article
                key={item.id}
                className="rounded-2xl border border-slate-800 bg-slate-900/70 p-3.5 shadow-lg shadow-slate-950/20"
              >
                <div className="flex items-start gap-3">
                  <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-cyan-400/10 text-cyan-300">
                    {item.kind === "pattern" ? (
                      <Layers3 className="h-4 w-4" />
                    ) : (
                      <CheckCircle2 className="h-4 w-4" />
                    )}
                  </div>
                  <div className="min-w-0">
                    <h3 className="text-sm font-semibold text-white">{item.title}</h3>
                    <p className="mt-1 text-[11px] leading-relaxed text-slate-400">{item.summary}</p>
                  </div>
                </div>

                <div className="mt-3 flex flex-wrap gap-1">
                  {item.tags.map((tag) => (
                    <span
                      key={tag}
                      className="rounded-full border border-slate-700 bg-slate-950/70 px-2 py-0.5 text-[9px] font-medium text-slate-400"
                    >
                      {tag}
                    </span>
                  ))}
                </div>

                <details className="mt-3 rounded-xl border border-slate-800 bg-slate-950/50">
                  <summary className="cursor-pointer px-3 py-2 text-[10px] font-semibold uppercase tracking-wide text-slate-300">
                    Decision guidance
                  </summary>
                  <div className="space-y-3 border-t border-slate-800 px-3 py-2.5">
                    <ul className="space-y-1.5">
                      {item.guidance.map((guidance) => (
                        <li key={guidance} className="flex gap-2 text-[11px] leading-relaxed text-slate-300">
                          <CheckCircle2 className="mt-0.5 h-3 w-3 shrink-0 text-emerald-400" />
                          {guidance}
                        </li>
                      ))}
                    </ul>
                    <div>
                      <div className="mb-1.5 flex items-center gap-1.5 text-[9px] font-bold uppercase tracking-[0.14em] text-amber-300">
                        <TriangleAlert className="h-3 w-3" />
                        Tradeoffs
                      </div>
                      <ul className="space-y-1 text-[10px] leading-relaxed text-slate-400">
                        {item.tradeoffs.map((tradeoff) => (
                          <li key={tradeoff}>• {tradeoff}</li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </details>

                <div className="mt-3 flex items-center gap-2">
                  {item.prompt && (
                    <button
                      type="button"
                      onClick={() => onApplyPattern(item.prompt!)}
                      className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg bg-cyan-400 px-2.5 py-1.5 text-[10px] font-bold text-slate-950 transition hover:bg-cyan-300"
                    >
                      <Sparkles className="h-3 w-3" />
                      Apply pattern
                    </button>
                  )}
                  <a
                    href={item.sourceUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 text-[10px] font-semibold text-cyan-300 transition hover:text-cyan-200"
                  >
                    Official guidance
                    <ArrowUpRight className="h-3 w-3" />
                  </a>
                </div>
              </article>
            ))}
          </div>
        )}
          </>
        )}
      </div>
    </aside>
  );
}

export type WafDiagramScorecardProps = { payload: WafDiagramPayload } & (
  | { baseline: WafDiagramAssessment; onBaselineChange: (assessment: WafDiagramAssessment) => void }
  | { baseline?: never; onBaselineChange?: never }
);

/** Modal callers own persistent baselines; the legacy panel keeps its local baseline. */
export function WafDiagramScorecard({ payload, baseline: controlledBaseline, onBaselineChange }: WafDiagramScorecardProps) {
  const assessment = useMemo(() => assessDiagramWellArchitected(payload), [payload]);
  const [localBaseline, setLocalBaseline] = useState(assessment);
  const baseline = controlledBaseline ?? localBaseline;
  const diff = useMemo(() => diffWafAssessments(baseline, assessment), [baseline, assessment]);
  const signed = (value: number) => `${value > 0 ? "+" : ""}${value}`;
  const changes: Array<[string, string[]]> = [
    ["Added nodes", diff.addedNodeIds], ["Removed nodes", diff.removedNodeIds], ["Changed nodes", diff.changedNodeIds],
    ["Added edges", diff.addedEdgeIds], ["Removed edges", diff.removedEdgeIds], ["Changed edges", diff.changedEdgeIds],
  ];
  return (
    <section aria-label="Actual diagram WAF assessment" className="space-y-3" data-testid="waf-diagram-assessment">
      <div className="rounded-2xl border border-cyan-400/25 bg-cyan-400/5 p-4">
        <h2 className="text-sm font-semibold text-white">Actual-diagram WAF assessment</h2>
        <p className="mt-2 text-[11px] leading-relaxed text-slate-400">
          Deterministic evidence coverage of the current canvas. Service icons and connections
          show design intent, not verified configuration. Unknown does not mean failed.
        </p>
        <p className="mt-3 text-2xl font-semibold text-cyan-200" data-testid="waf-overall-score">{assessment.score}/100</p>
        <p className="text-[10px] text-slate-400">
          {assessment.serviceCount} service icons · {assessment.observed} observed patterns · {assessment.unknown} unknown checks
        </p>
        <details className="mt-2 text-[10px] leading-relaxed text-slate-400">
          <summary className="cursor-pointer text-cyan-300">Scoring method and limitations</summary>
          <p className="mt-2">{WAF_DIAGRAM_METHODOLOGY}</p>
          <p className="mt-1">Rule set: {assessment.version}. Layout-only moves do not change evidence.</p>
        </details>
      </div>
      {assessment.warnings.map((warning) => (
        <p key={warning} role="status" className="rounded-xl border border-amber-400/20 p-3 text-[10px] text-amber-200">{warning}</p>
      ))}
      <div className="grid grid-cols-2 gap-2">
        {WAF_PILLARS.map((pillar) => (
          <div key={pillar.id} data-testid={`waf-pillar-${pillar.id}`} className="rounded-xl border border-slate-700 bg-slate-900/70 p-3">
            <p className="text-[10px] font-semibold text-slate-200">{pillar.title}</p>
            <p className="mt-1 text-lg font-semibold text-cyan-200">{assessment.pillarScores[pillar.id]}/100</p>
            <p className="text-[9px] text-slate-400">{signed(diff.pillarDeltas[pillar.id])} since baseline</p>
          </div>
        ))}
      </div>
      <div aria-live="polite" data-testid="waf-assessment-diff" className="rounded-xl border border-slate-700 p-3 text-[10px] text-slate-400">
        <h3 className="font-semibold text-cyan-200">Canvas change impact</h3>
        <p className="mt-1">{diff.changed ? `Rescored automatically: ${signed(diff.scoreDelta)} overall since baseline.` : "No evidence changes since baseline."}</p>
        {diff.changed && (
          <div className="mt-1 space-y-1">
            <p>Nodes: +{diff.addedNodeIds.length} / -{diff.removedNodeIds.length} / {diff.changedNodeIds.length} changed.
              {" "}Edges: +{diff.addedEdgeIds.length} / -{diff.removedEdgeIds.length} / {diff.changedEdgeIds.length} changed.</p>
            <p>{diff.improvedFindingIds.length} newly observed patterns; {diff.regressedFindingIds.length} lost patterns.</p>
            {changes.filter(([, ids]) => ids.length > 0).map(([label, ids]) => <p key={label}>{label}: {ids.join(", ")}</p>)}
          </div>
        )}
        <button type="button" onClick={() => {
          if (onBaselineChange) onBaselineChange(assessment);
          else setLocalBaseline(assessment);
        }} className="mt-2 cursor-pointer rounded-lg border border-cyan-400/30 px-2 py-1 text-cyan-200 hover:bg-cyan-400/10">
          Use current canvas as baseline
        </button>
      </div>
      <h3 className="text-xs font-semibold text-white">Prioritized evidence findings and remediation playbooks</h3>
      {assessment.findings.map((finding) => (
        <article key={finding.id} data-testid={`waf-finding-${finding.id}`} className="rounded-xl border border-slate-800 bg-slate-900/70 p-3">
          <div className="flex items-center justify-between gap-2 text-[9px]">
            <span className={finding.status === "observed" ? "text-cyan-300" : "text-amber-200"}>
              {finding.status === "observed" ? "Observed in diagram" : finding.status === "risk" ? "Diagram risk" : "Unknown evidence"}
              {" "}· {finding.priority} priority
            </span>
            <a href={finding.sourceUrl} target="_blank" rel="noreferrer" aria-label={`WAF guidance for ${finding.title}`} className="text-cyan-300 hover:underline">Guidance</a>
          </div>
          <h4 className="mt-1 text-[11px] font-semibold text-white">{finding.title}</h4>
          <p className="mt-1 text-[10px] leading-relaxed text-slate-400">{finding.evidence}</p>
          <p className="mt-1 text-[10px] text-slate-500">
            {finding.pillar} · Nodes: {finding.nodeIds.join(", ") || "none evidenced"} · Edges: {finding.edgeIds.join(", ") || "none evidenced"}
          </p>
          <details className="mt-2 text-[10px] leading-relaxed text-slate-300">
            <summary className="cursor-pointer font-semibold text-cyan-200">Remediation playbook</summary>
            <ol className="mt-2 list-decimal space-y-1 pl-4">
              {finding.playbook.steps.map((step) => <li key={step}>{step}</li>)}
            </ol>
            <p className="mt-2"><strong>Validate:</strong> {finding.playbook.validation}</p>
            <p className="mt-1"><strong>Tradeoff:</strong> {finding.playbook.tradeoff}</p>
          </details>
        </article>
      ))}
    </section>
  );
}

function ChoiceGroup({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: ReadonlyArray<readonly [string, string]>;
  onChange: (value: string) => void;
}) {
  return (
    <fieldset>
      <legend className="mb-1.5 text-[9px] font-bold uppercase tracking-wide text-slate-500">
        {label}
      </legend>
      <div className="space-y-1">
        {options.map(([id, optionLabel]) => (
          <label
            key={id}
            className={`flex cursor-pointer items-center gap-2 rounded-lg border px-2 py-1.5 text-[10px] ${
              value === id
                ? "border-cyan-400/50 bg-cyan-400/10 text-cyan-200"
                : "border-slate-800 text-slate-400 hover:border-slate-700"
            }`}
          >
            <input
              type="radio"
              name={label}
              value={id}
              checked={value === id}
              onChange={() => onChange(id)}
              className="accent-cyan-400"
            />
            {optionLabel}
          </label>
        ))}
      </div>
    </fieldset>
  );
}
