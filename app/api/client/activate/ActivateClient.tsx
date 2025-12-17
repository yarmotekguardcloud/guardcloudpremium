"use client";

import { useMemo } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";

export default function ActivateClient() {
  const sp = useSearchParams();

  const params = useMemo(() => {
    return {
      token: sp.get("token") ?? "",
      deviceId: sp.get("deviceId") ?? "",
      status: sp.get("status") ?? "",
      message: sp.get("message") ?? "",
    };
  }, [sp]);

  return (
    <div className="min-h-[calc(100vh-80px)] bg-slate-950 px-4 py-8 text-slate-100">
      <div className="mx-auto max-w-xl rounded-2xl border border-slate-800 bg-slate-950/80 p-5 shadow-[0_20px_45px_rgba(0,0,0,0.7)]">
        <h1 className="text-lg font-semibold">
          Activation licence • <span className="text-emerald-400">SahelGuard</span>
        </h1>

        <p className="mt-2 text-sm text-slate-400">
          Cette page lit les paramètres d’activation depuis l’URL.
        </p>

        <div className="mt-4 space-y-2 text-sm">
          <Row label="token" value={params.token || "—"} />
          <Row label="deviceId" value={params.deviceId || "—"} />
          <Row label="status" value={params.status || "—"} />
          <Row label="message" value={params.message || "—"} />
        </div>

        <div className="mt-5 flex gap-2">
          <Link
            href="/admin/devices"
            className="rounded-full border border-slate-700 bg-slate-900 px-4 py-2 text-xs hover:border-emerald-400"
          >
            Retour dashboard
          </Link>
        </div>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between rounded-xl border border-slate-800 bg-slate-900/60 px-3 py-2">
      <span className="text-[11px] uppercase tracking-wide text-slate-500">{label}</span>
      <span className="text-xs text-slate-100">{value}</span>
    </div>
  );
}
