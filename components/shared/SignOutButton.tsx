"use client";

import { useEffect, useState } from "react";
import { LogOut } from "lucide-react";

export function SignOutButton() {
  const [visible, setVisible] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let active = true;
    fetch("/api/auth/status")
      .then((response) => response.json())
      .then((result: { enabled?: boolean; authenticated?: boolean }) => {
        if (active) setVisible(!!result.enabled && !!result.authenticated);
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, []);

  if (!visible) return null;

  return (
    <button
      type="button"
      disabled={busy}
      onClick={async () => {
        setBusy(true);
        try {
          await fetch("/api/auth/logout", { method: "POST" });
        } finally {
          window.location.assign("/login");
        }
      }}
      className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium text-slate-500 transition hover:bg-slate-900 hover:text-white disabled:opacity-50"
      title="Sign out"
    >
      <LogOut className="h-3.5 w-3.5" />
      <span className="hidden lg:inline">Sign out</span>
    </button>
  );
}
