"use client";

import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { TrendingDown, Sparkles } from "lucide-react";
import { REPLACED_APPS } from "./copy";

// Approximate per-user/month list prices for comparison (US$, public list).
const APP_PRICES: Record<string, number> = {
  Lucidchart: 9,
  Miro: 10,
  Visio: 5,
  "draw.io": 0,
  Whimsical: 10,
  Excalidraw: 6,
  FigJam: 5,
  Mural: 12,
  "ChatGPT (for diagrams)": 20,
  Gliffy: 8,
  Cacoo: 6,
  SmartDraw: 10,
};

const OUR_PRICE = 8;

export function CostCalculator() {
  const [selected, setSelected] = useState<string[]>(["Lucidchart", "Miro", "ChatGPT (for diagrams)"]);
  const [team, setTeam] = useState(100);

  const totals = useMemo(() => {
    const competitorMonthly = selected.reduce((s, n) => s + (APP_PRICES[n] ?? 0), 0) * team;
    const ours = OUR_PRICE * team;
    const monthlySavings = Math.max(0, competitorMonthly - ours);
    const yearly = monthlySavings * 12;
    return { competitorMonthly, ours, monthlySavings, yearly };
  }, [selected, team]);

  const toggle = (name: string) =>
    setSelected((arr) => (arr.includes(name) ? arr.filter((n) => n !== name) : [...arr, name]));

  return (
    <section id="pricing" className="py-24 bg-gradient-to-b from-slate-50 to-white">
      <div className="mx-auto max-w-6xl px-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="text-center max-w-2xl mx-auto mb-12"
        >
          <span className="inline-block px-3 py-1 rounded-full bg-emerald-50 text-emerald-700 text-xs font-semibold mb-4">
            Cost calculator
          </span>
          <h2 className="text-4xl md:text-5xl font-black tracking-tight text-slate-900">
            See how much you save
            <br />
            <span className="bg-gradient-to-r from-emerald-600 to-teal-600 bg-clip-text text-transparent">
              by switching.
            </span>
          </h2>
          <p className="mt-4 text-lg text-slate-600">
            Indicative public pricing. Your enterprise quotes will look worse for them, not us.
          </p>
        </motion.div>

        <div className="grid lg:grid-cols-[1fr_400px] gap-8 items-start">
          {/* Picker */}
          <div className="rounded-2xl bg-white border border-slate-200 p-6 shadow-sm">
            <h3 className="text-sm font-bold text-slate-900 mb-4">Which tools are you replacing?</h3>
            <div className="flex flex-wrap gap-2">
              {REPLACED_APPS.map((name) => {
                const on = selected.includes(name);
                return (
                  <button
                    key={name}
                    type="button"
                    onClick={() => toggle(name)}
                    className={`px-3 py-1.5 text-xs font-semibold rounded-full border transition-colors cursor-pointer ${
                      on
                        ? "bg-slate-900 text-white border-slate-900"
                        : "bg-white text-slate-700 border-slate-200 hover:border-slate-400"
                    }`}
                  >
                    {name}
                    {APP_PRICES[name] ? (
                      <span className={`ml-1.5 ${on ? "text-slate-300" : "text-slate-400"}`}>
                        ${APP_PRICES[name]}/u
                      </span>
                    ) : null}
                  </button>
                );
              })}
            </div>

            <div className="mt-8">
              <div className="flex items-center justify-between mb-3">
                <label className="text-sm font-bold text-slate-900">Team size</label>
                <span className="text-sm font-mono font-bold text-violet-700">{team} users</span>
              </div>
              <input
                type="range"
                min={1}
                max={500}
                step={1}
                value={team}
                onChange={(e) => setTeam(Number(e.target.value))}
                className="w-full accent-violet-600 cursor-pointer"
              />
              <div className="flex justify-between text-xs text-slate-500 mt-1">
                <span>1</span>
                <span>500</span>
              </div>
            </div>
          </div>

          {/* Totals */}
          <motion.div
            initial={{ opacity: 0, scale: 0.96 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
            className="rounded-2xl bg-gradient-to-br from-slate-900 to-slate-800 text-white p-6 shadow-[0_30px_80px_-20px_rgba(15,23,42,0.4)]"
          >
            <div className="flex items-center gap-2 text-xs uppercase tracking-widest text-slate-400 font-semibold">
              <TrendingDown className="w-3.5 h-3.5" />
              Estimated yearly savings
            </div>
            <motion.div
              key={totals.yearly}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className="mt-2 text-5xl font-black bg-gradient-to-r from-emerald-300 to-teal-300 bg-clip-text text-transparent"
            >
              ${totals.yearly.toLocaleString()}
            </motion.div>
            <div className="mt-6 space-y-3 text-sm">
              <Row label="Competitor stack / mo" value={`$${totals.competitorMonthly.toLocaleString()}`} />
              <Row label="Diagrammatic / mo" value={`$${totals.ours.toLocaleString()}`} highlight />
              <div className="border-t border-white/10 pt-3">
                <Row
                  label="Monthly savings"
                  value={`$${totals.monthlySavings.toLocaleString()}`}
                  big
                />
              </div>
            </div>
            <button
              type="button"
              className="mt-6 w-full inline-flex items-center justify-center gap-1.5 px-4 py-3 text-sm font-semibold text-slate-900 rounded-xl bg-white hover:bg-slate-100 transition-colors cursor-pointer"
            >
              <Sparkles className="w-4 h-4" />
              Talk to us about migrating
            </button>
          </motion.div>
        </div>
      </div>
    </section>
  );
}

function Row({
  label,
  value,
  highlight,
  big,
}: {
  label: string;
  value: string;
  highlight?: boolean;
  big?: boolean;
}) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-slate-400">{label}</span>
      <span
        className={`font-mono font-bold ${
          big ? "text-2xl text-emerald-300" : highlight ? "text-violet-300" : "text-white"
        }`}
      >
        {value}
      </span>
    </div>
  );
}
