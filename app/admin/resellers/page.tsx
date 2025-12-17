"use client";

import { useEffect, useState } from "react";

type Reseller = {
  resellerId: string;
  name?: string;
  contactPhone?: string;
  contactEmail?: string;
  tokensTotal?: number;
  tokensActive?: number;
  tokensUsed?: number;
};

type ResellersResponse = {
  ok: boolean;
  items?: Reseller[];
  error?: string;
};

export default function AdminResellersPage() {
  const [resellers, setResellers] = useState<Reseller[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchResellers = async () => {
      try {
        setLoading(true);
        setError(null);

        const res = await fetch("/api/admin/resellers", {
          method: "GET",
          cache: "no-store",
        });

        const json: ResellersResponse = await res.json();
        if (!json.ok) throw new Error(json.error ?? "API ok=false");

        setResellers(json.items ?? []);
      } catch (e: any) {
        console.error("Erreur chargement revendeurs:", e);
        setError(e?.message ?? "Erreur chargement des revendeurs");
      } finally {
        setLoading(false);
      }
    };

    void fetchResellers();
  }, []);

  const totalTokens = resellers.reduce(
    (acc, r) => acc + (r.tokensTotal ?? 0),
    0,
  );
  const totalActive = resellers.reduce(
    (acc, r) => acc + (r.tokensActive ?? 0),
    0,
  );
  const totalUsed = resellers.reduce(
    (acc, r) => acc + (r.tokensUsed ?? 0),
    0,
  );

  return (
    <main className="flex h-[calc(100vh-80px)] flex-col gap-4 bg-slate-950/95 px-4 pb-4 pt-2 text-slate-100">
      {/* Header */}
      <div className="flex items-center justify-between rounded-2xl border border-slate-800 bg-gradient-to-r from-slate-950 via-slate-900 to-slate-950 px-4 py-3 shadow-lg shadow-black/40">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">
            Revendeurs • SahelGuard
          </h1>
          <p className="text-xs text-slate-400">
            Vue globale des revendeurs, de leurs coordonnées et de leurs packs
            de tokens anti-vol.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <div className="rounded-full bg-slate-900 px-3 py-1">
            {loading ? "Chargement…" : `Revendeurs : ${resellers.length}`}
          </div>
          <div className="rounded-full bg-slate-900 px-3 py-1">
            Tokens totaux : <span className="font-semibold">{totalTokens}</span>
          </div>
          <div className="rounded-full bg-slate-900 px-3 py-1">
            Actifs :{" "}
            <span className="font-semibold text-emerald-400">
              {totalActive}
            </span>
          </div>
          <div className="rounded-full bg-slate-900 px-3 py-1">
            Utilisés : <span className="font-semibold">{totalUsed}</span>
          </div>
        </div>
      </div>

      {/* Contenu */}
      <div className="flex-1 overflow-auto rounded-2xl border border-slate-800 bg-slate-950/80 p-4">
        {error && (
          <div className="mb-3 rounded-xl bg-red-950/60 p-3 text-sm text-red-100">
            Impossible de charger la liste des revendeurs : {error}
          </div>
        )}

        {!error && !loading && resellers.length === 0 && (
          <div className="text-center text-sm text-slate-400">
            Aucun revendeur enregistré pour l’instant.
          </div>
        )}

        {resellers.length > 0 && (
          <table className="w-full border-collapse text-xs">
            <thead>
              <tr className="border-b border-slate-800 text-[11px] uppercase text-slate-400">
                <th className="px-2 py-2 text-left">ID revendeur</th>
                <th className="px-2 py-2 text-left">Nom</th>
                <th className="px-2 py-2 text-left">Téléphone</th>
                <th className="px-2 py-2 text-left">Email</th>
                <th className="px-2 py-2 text-right">Tokens totaux</th>
                <th className="px-2 py-2 text-right">Actifs</th>
                <th className="px-2 py-2 text-right">Utilisés</th>
              </tr>
            </thead>
            <tbody>
              {resellers.map((r) => (
                <tr
                  key={r.resellerId}
                  className="border-b border-slate-900/70 hover:bg-slate-900/70"
                >
                  <td className="px-2 py-2 font-mono text-[11px] text-slate-100">
                    {r.resellerId}
                  </td>
                  <td className="px-2 py-2 text-slate-100">
                    {r.name ?? "—"}
                  </td>
                  <td className="px-2 py-2 text-slate-200">
                    {r.contactPhone ?? "—"}
                  </td>
                  <td className="px-2 py-2 text-slate-200">
                    {r.contactEmail ?? "—"}
                  </td>
                  <td className="px-2 py-2 text-right">
                    {r.tokensTotal ?? 0}
                  </td>
                  <td className="px-2 py-2 text-right">
                    {r.tokensActive ?? 0}
                  </td>
                  <td className="px-2 py-2 text-right">
                    {r.tokensUsed ?? 0}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </main>
  );
}
