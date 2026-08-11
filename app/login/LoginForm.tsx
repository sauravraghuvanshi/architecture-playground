"use client";

import { FormEvent, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  Boxes,
  CloudCog,
  Eye,
  EyeOff,
  KeyRound,
  Loader2,
  LockKeyhole,
  ShieldCheck,
  Workflow,
} from "lucide-react";
import { safeReturnPath } from "@/lib/auth-redirect";

const PROOF_POINTS = [
  { icon: Boxes, value: "1,433", label: "cloud service assets" },
  { icon: Workflow, value: "9", label: "diagram modes" },
  { icon: ShieldCheck, value: "Local", label: "browser-first drafts" },
] as const;

export function LoginForm() {
  const searchParams = useSearchParams();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const destination = safeReturnPath(searchParams.get("next"));

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (busy || !username.trim() || !password) return;
    setBusy(true);
    setError(null);
    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      const result = (await response.json()) as { error?: string };
      if (!response.ok) {
        setError(result.error ?? "Sign-in failed.");
        return;
      }
      window.location.assign(destination);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unable to reach the server.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="relative min-h-dvh overflow-hidden bg-[#07101e] text-slate-100">
      <div
        aria-hidden
        className="absolute inset-0 bg-[linear-gradient(to_right,rgba(148,163,184,0.06)_1px,transparent_1px),linear-gradient(to_bottom,rgba(148,163,184,0.06)_1px,transparent_1px)] bg-[size:48px_48px] [mask-image:radial-gradient(ellipse_at_center,black_25%,transparent_78%)]"
      />
      <div
        aria-hidden
        className="absolute -left-32 top-24 h-96 w-96 rounded-full bg-cyan-500/10 blur-[120px]"
      />
      <div className="relative mx-auto grid min-h-dvh max-w-[1400px] lg:grid-cols-[1.15fr_0.85fr]">
        <section className="flex flex-col justify-between border-b border-slate-800 px-6 py-8 sm:px-10 lg:border-b-0 lg:border-r lg:px-16 lg:py-12">
          <div className="flex items-center gap-3">
            <span className="grid h-10 w-10 place-items-center rounded-2xl bg-cyan-400 text-slate-950 shadow-lg shadow-cyan-500/20">
              <CloudCog className="h-5 w-5" />
            </span>
            <div>
              <p className="text-sm font-semibold text-white">Diagrammatic</p>
              <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-500">
                Architecture workspace
              </p>
            </div>
          </div>

          <div className="max-w-2xl py-16 lg:py-8">
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-cyan-400">
              Controlled access
            </p>
            <h1 className="mt-5 text-balance text-4xl font-semibold leading-[1.05] tracking-[-0.04em] text-white sm:text-6xl">
              Design the system.
              <br />
              <span className="text-slate-500">Control the narrative.</span>
            </h1>
            <p className="mt-6 max-w-xl text-sm leading-7 text-slate-400 sm:text-base">
              Build enterprise cloud architecture, explain request flows, and export
              presentation-ready artifacts from one local-first studio.
            </p>

            <div className="mt-10 grid gap-3 sm:grid-cols-3">
              {PROOF_POINTS.map(({ icon: Icon, value, label }) => (
                <div
                  key={label}
                  className="rounded-2xl border border-slate-800 bg-[#0b1220]/80 p-4"
                >
                  <Icon className="h-4 w-4 text-cyan-400" />
                  <p className="mt-4 text-xl font-semibold text-white">{value}</p>
                  <p className="mt-1 text-[11px] text-slate-500">{label}</p>
                </div>
              ))}
            </div>
          </div>

          <p className="text-[10px] uppercase tracking-[0.15em] text-slate-600">
            Authorized users only · Session expires after 8 hours
          </p>
        </section>

        <section className="flex items-center justify-center px-6 py-12 sm:px-12">
          <div className="w-full max-w-md">
            <div className="mb-8 flex items-center gap-3">
              <span className="grid h-10 w-10 place-items-center rounded-xl border border-cyan-400/20 bg-cyan-400/10 text-cyan-300">
                <LockKeyhole className="h-5 w-5" />
              </span>
              <div>
                <h2 className="text-xl font-semibold text-white">Sign in</h2>
                <p className="text-xs text-slate-500">Enter your workspace credentials.</p>
              </div>
            </div>

            <form onSubmit={submit} className="space-y-5">
              <label className="block">
                <span className="mb-2 block text-[10px] font-bold uppercase tracking-[0.14em] text-slate-500">
                  Username
                </span>
                <input
                  value={username}
                  onChange={(event) => setUsername(event.target.value)}
                  autoComplete="username"
                  autoCapitalize="none"
                  spellCheck={false}
                  required
                  className="w-full rounded-xl border border-slate-700 bg-slate-950/70 px-4 py-3 text-sm text-white outline-none transition placeholder:text-slate-600 focus:border-cyan-400 focus:ring-4 focus:ring-cyan-400/10"
                  placeholder="Workspace username"
                />
              </label>

              <label className="block">
                <span className="mb-2 block text-[10px] font-bold uppercase tracking-[0.14em] text-slate-500">
                  Password
                </span>
                <span className="relative block">
                  <KeyRound className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-600" />
                  <input
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    autoComplete="current-password"
                    required
                    className="w-full rounded-xl border border-slate-700 bg-slate-950/70 py-3 pl-11 pr-12 text-sm text-white outline-none transition placeholder:text-slate-600 focus:border-cyan-400 focus:ring-4 focus:ring-cyan-400/10"
                    placeholder="Workspace password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((visible) => !visible)}
                    aria-label={showPassword ? "Hide password" : "Show password"}
                    className="absolute right-3 top-1/2 -translate-y-1/2 rounded-lg p-1.5 text-slate-500 transition hover:bg-slate-800 hover:text-white"
                  >
                    {showPassword ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </button>
                </span>
              </label>

              {error && (
                <div
                  role="alert"
                  className="rounded-xl border border-rose-900/70 bg-rose-950/30 px-4 py-3 text-xs leading-relaxed text-rose-200"
                >
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={busy || !username.trim() || !password}
                className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-cyan-400 px-4 py-3 text-sm font-bold text-slate-950 transition hover:bg-cyan-300 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {busy && <Loader2 className="h-4 w-4 animate-spin" />}
                {busy ? "Signing in…" : "Enter workspace"}
              </button>
            </form>

            <p className="mt-6 text-center text-[10px] leading-relaxed text-slate-600">
              Credentials are validated on the server and never stored in browser
              storage. This device receives a signed, HttpOnly session cookie.
            </p>
          </div>
        </section>
      </div>
    </main>
  );
}
