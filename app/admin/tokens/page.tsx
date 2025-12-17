"use client";

import { useMemo, useState } from "react";
import Link from "next/link";

type LicenseToken = {
  token: string;
  resellerId: string;
  status: "NEW" | "ACTIVATED" | "EXPIRED" | "REVOKED" | string;
  durationDays: number;
  createdAt: string;
  activatedAt?: string | null;
  expiresAt?: string | null;
  clientId?: string | null;
  deviceId?: string | null;
  notes?: string | null;
};

type BatchResponse = {
  ok: boolean;
  resellerId?: string;
  count?: number;
  tokens?: LicenseToken[];
  error?: string;
};

type TokensByResellerResponse = {
  ok: boolean;
  resellerId?: string;
  items?: LicenseToken[];
  error?: string;
};

export default function AdminTokensPage() {
  // Formulaire création de pack
  const [resellerId, setResellerId] = useState("R-0001");
  const [count, setCount] = useState(5);
  const [durationDays, setDurationDays] = useState(90);
  const [notes, setNotes] = useState("Pack standard SahelGuard");

  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [createdTokens, setCreatedTokens] = useState<LicenseToken[]>([]);

  // Chargement / liste tokens existants
  const [queryResellerId, setQueryResellerId] = useState("R-0001");
  const [loadingList, setLoadingList] = useState(false);
  const [listError, setListError] = useState<string | null>(null);
  const [tokensList, setTokensList] = useState<LicenseToken[]>([]);

  const [copyMessage, setCopyMessage] = useState<string | null>(null);

  // -----------------------------
  // Statistiques (pour la barre)
  // -----------------------------
  const stats = useMemo(() => {
    const total = tokensList.length;
    const disponibles = tokensList.filter((t) => t.status === "NEW").length;
    const activees = tokensList.filter((t) => t.status === "ACTIVATED").length;
    const expirees = tokensList.filter((t) => t.status === "EXPIRED").length;
    const revoquees = tokensList.filter((t) => t.status === "REVOKED").length;

    return { total, disponibles, activees, expirees, revoquees };
  }, [tokensList]);

  // ------------------------------------------------------------------
  //  Création d’un pack de tokens (appel robuste)
  // ------------------------------------------------------------------
  const handleCreateBatch = async () => {
    try {
      setCreating(true);
      setCreateError(null);
      setCreatedTokens([]);
      setCopyMessage(null);

      const payload = {
        resellerId: resellerId.trim(),
        count,
        durationDays,
        notes: notes.trim(),
      };

      // ⚠️ Garde ce chemin si tu as bien la route Next :
      // app/api/admin/tokens/batch/route.ts
      const res = await fetch("/api/admin/tokens/batch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const text = await res.text();
      let data: BatchResponse;

      try {
        data = JSON.parse(text) as BatchResponse;
      } catch {
        throw new Error(
          `Réponse non JSON (${res.status}) : ${text.slice(0, 100)}…`,
        );
      }

      if (!res.ok || !data?.ok) {
        const msg = data?.error ?? `Erreur HTTP ${res.status}`;
        throw new Error(msg);
      }

      setCreatedTokens(data.tokens ?? []);
    } catch (e: any) {
      console.error("Erreur création pack tokens:", e);
      setCreateError(e?.message ?? "Erreur inconnue");
    } finally {
      setCreating(false);
    }
  };

  // ------------------------------------------------------------------
  //  Chargement des tokens d’un revendeur (appel robuste)
  // ------------------------------------------------------------------
  const handleLoadTokens = async () => {
    try {
      setLoadingList(true);
      setListError(null);
      setTokensList([]);
      setCopyMessage(null);

      const id = queryResellerId.trim();
      if (!id) {
        throw new Error("Veuillez indiquer un ID revendeur.");
      }

      const res = await fetch(
        `/api/admin/tokens/by-reseller?resellerId=${encodeURIComponent(id)}`,
        { method: "GET" },
      );

      const text = await res.text();
      let data: TokensByResellerResponse;

      try {
        data = JSON.parse(text) as TokensByResellerResponse;
      } catch {
        throw new Error(
          `Réponse non JSON (${res.status}) : ${text.slice(0, 100)}…`,
        );
      }

      if (!res.ok || !data?.ok) {
        const msg = data?.error ?? `Erreur HTTP ${res.status}`;
        throw new Error(msg);
      }

      setTokensList(data.items ?? []);
    } catch (e: any) {
      console.error("Erreur chargement tokens revendeur:", e);
      setListError(e?.message ?? "Erreur inconnue");
    } finally {
      setLoadingList(false);
    }
  };

  const handleCopyToken = async (token: string) => {
    try {
      await navigator.clipboard.writeText(token);
      setCopyMessage(`Token copié: ${token}`);
      setTimeout(() => setCopyMessage(null), 2500);
    } catch {
      setCopyMessage("Impossible de copier dans le presse-papier.");
      setTimeout(() => setCopyMessage(null), 2500);
    }
  };

  const formatDateTime = (iso?: string | null) => {
    if (!iso) return "—";
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso;
    return d.toLocaleString();
  };

  const statusLabel = (s: string) => {
    switch (s) {
      case "NEW":
        return "Non utilisé";
      case "ACTIVATED":
        return "Activé";
      case "EXPIRED":
        return "Expiré";
      case "REVOKED":
        return "Révoqué";
      default:
        return s;
    }
  };

  const statusClass = (s: string) => {
    switch (s) {
      case "NEW":
        return "bg-slate-800 text-slate-100";
      case "ACTIVATED":
        return "bg-emerald-600/20 text-emerald-100";
      case "EXPIRED":
        return "bg-slate-800/80 text-slate-300";
      case "REVOKED":
        return "bg-rose-700/30 text-rose-100";
      default:
        return "bg-slate-800 text-slate-100";
    }
  };

  return (
    <div className="relative flex min-h-[calc(100vh-80px)] flex-col gap-4 bg-slate-950 px-4 pb-6 pt-4 text-slate-100">
      {/* En-tête style Command Center */}
      <header className="flex items-center justify-between gap-3 rounded-2xl border border-slate-800 bg-gradient-to-r from-slate-950 via-slate-900 to-slate-950 px-4 py-3 shadow-lg shadow-black/40">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">
            Yarmotek GuardCloud •{" "}
            <span className="text-emerald-400">Licences SahelGuard</span>
          </h1>
          <p className="text-xs text-slate-400">
            Crée, distribue et contrôle les tokens de licence fournis aux
            revendeurs et aux clients finaux.
          </p>
        </div>

        <div className="flex flex-wrap items-center justify-end gap-2 text-xs">
          {/* Navigation cohérente avec le Command Center */}
          <Link
            href="/reseller/tokens"
            className="rounded-full border border-slate-700 bg-slate-900 px-3 py-1 text-xs text-slate-200 hover:border-emerald-400"
          >
            Espace revendeur
          </Link>

          <Link
            href="/client/activate"
            className="rounded-full border border-emerald-500/60 bg-emerald-500/10 px-3 py-1 text-xs text-emerald-100 hover:bg-emerald-500/20"
          >
            Activer une licence
          </Link>

          <Link
            href="/admin/devices"
            className="rounded-full border border-sky-500/70 bg-sky-500/10 px-3 py-1 text-xs text-sky-100 hover:bg-sky-500/20"
          >
            Command Center (devices)
          </Link>
        </div>
      </header>

      {/* Bandeau stats */}
      <section className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-800 bg-slate-950/90 px-4 py-3 shadow-[0_18px_40px_rgba(0,0,0,0.65)]">
        <div>
          <div className="text-sm font-semibold">
            Gestion des licences SahelGuard
          </div>
          <p className="text-xs text-slate-400">
            Vue actuelle basée sur les tokens du revendeur recherché
            (champ &quot;ID revendeur&quot; ci-dessous).
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 text-xs">
          <StatPill label="Total" value={stats.total} />
          <StatPill
            label="Disponibles"
            value={stats.disponibles}
            variant="green"
          />
          <StatPill label="Activées" value={stats.activees} variant="blue" />
          <StatPill label="Expirées" value={stats.expirees} variant="amber" />
          <StatPill label="Révoquées" value={stats.revoquees} variant="red" />

          <button
            type="button"
            onClick={() => void handleLoadTokens()}
            disabled={loadingList}
            className="inline-flex items-center gap-1 rounded-full border border-slate-700 bg-slate-900 px-3 py-1 text-[11px] text-slate-200 hover:border-emerald-400 disabled:opacity-50"
          >
            <span role="img" aria-hidden="true">
              🔄
            </span>
            {loadingList ? "Rafraîchissement…" : "Rafraîchir"}
          </button>
        </div>
      </section>

      {/* Grille 2 colonnes : création de pack / liste tokens */}
      <main className="grid flex-1 gap-6 md:grid-cols-2">
        {/* Colonne gauche : création de pack */}
        <section className="flex flex-col gap-3 rounded-2xl border border-slate-800 bg-slate-950/85 p-4 text-xs shadow-[0_18px_40px_rgba(0,0,0,0.65)]">
          <h2 className="text-sm font-semibold">
            Créer un pack de tokens pour un revendeur
          </h2>
          <p className="text-xs text-slate-400">
            Génère un lot de licences SahelGuard pour un revendeur précis (ex :
            <span className="font-mono"> R-0001</span>). Les tokens sont
            stockés dans le Worker et visibles dans les espaces Admin et
            Revendeur.
          </p>

          <div className="mt-1 grid grid-cols-2 gap-3 text-xs">
            <div className="col-span-2">
              <label className="mb-1 block text-[11px] text-slate-400">
                ID revendeur
              </label>
              <input
                type="text"
                value={resellerId}
                onChange={(e) => setResellerId(e.target.value)}
                className="w-full rounded-full border border-slate-700 bg-slate-900 px-3 py-1.5 text-xs text-slate-100 placeholder:text-slate-500 focus:border-emerald-400 focus:outline-none"
                placeholder="Ex: R-0001"
              />
            </div>

            <div>
              <label className="mb-1 block text-[11px] text-slate-400">
                Nombre de licences
              </label>
              <input
                type="number"
                min={1}
                max={500}
                value={count}
                onChange={(e) =>
                  setCount(Math.max(1, Number(e.target.value) || 1))
                }
                className="w-full rounded-full border border-slate-700 bg-slate-900 px-3 py-1.5 text-xs text-slate-100 focus:border-emerald-400 focus:outline-none"
              />
            </div>

            <div>
              <label className="mb-1 block text-[11px] text-slate-400">
                Durée de validité (jours)
              </label>
              <input
                type="number"
                min={7}
                max={3650}
                value={durationDays}
                onChange={(e) =>
                  setDurationDays(Math.max(1, Number(e.target.value) || 1))
                }
                className="w-full rounded-full border border-slate-700 bg-slate-900 px-3 py-1.5 text-xs text-slate-100 focus:border-emerald-400 focus:outline-none"
              />
            </div>

            <div className="col-span-2">
              <label className="mb-1 block text-[11px] text-slate-400">
                Label / notes internes
              </label>
              <input
                type="text"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="w-full rounded-full border border-slate-700 bg-slate-900 px-3 py-1.5 text-xs text-slate-100 placeholder:text-slate-500 focus:border-emerald-400 focus:outline-none"
                placeholder="Ex: Pack Lancement Décembre 2025 – 45 licences / 90 jours"
              />
            </div>
          </div>

          {createError && (
            <div className="rounded-xl bg-red-900/50 p-2 text-xs text-red-100">
              {createError}
            </div>
          )}

          <button
            type="button"
            disabled={creating}
            onClick={() => void handleCreateBatch()}
            className="mt-1 inline-flex items-center justify-center rounded-full border border-emerald-500/70 bg-emerald-600/20 px-4 py-2 text-xs font-semibold text-emerald-100 shadow-md shadow-emerald-900/40 hover:bg-emerald-600/30 disabled:opacity-50"
          >
            {creating ? "Création en cours…" : "Créer le pack de tokens"}
          </button>

          {/* Affichage des tokens créés */}
          {createdTokens.length > 0 && (
            <div className="mt-3 rounded-xl border border-emerald-500/60 bg-slate-900/80 p-3 text-xs">
              <div className="mb-2 flex items-center justify-between">
                <div>
                  <div className="text-[11px] uppercase tracking-wide text-emerald-300">
                    Pack créé avec succès
                  </div>
                  <div className="text-[11px] text-slate-300">
                    {createdTokens.length} token(s) généré(s) pour le revendeur{" "}
                    <span className="font-semibold">
                      {createdTokens[0]?.resellerId}
                    </span>
                    .
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() =>
                    void handleCopyToken(
                      createdTokens.map((t) => t.token).join("\n"),
                    )
                  }
                  className="rounded-full border border-emerald-500/60 bg-emerald-500/10 px-3 py-1 text-[11px] text-emerald-100 hover:bg-emerald-500/20"
                >
                  Copier tous les tokens
                </button>
              </div>

              <ul className="space-y-1">
                {createdTokens.map((t) => (
                  <li
                    key={t.token}
                    className="flex items-center justify-between rounded-lg bg-slate-950/90 px-3 py-1.5"
                  >
                    <span className="font-mono text-[11px] text-slate-100">
                      {t.token}
                    </span>
                    <button
                      type="button"
                      onClick={() => void handleCopyToken(t.token)}
                      className="rounded-full border border-slate-700 bg-slate-900 px-2 py-0.5 text-[10px] text-slate-200 hover:border-emerald-400"
                    >
                      Copier
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </section>

        {/* Colonne droite : liste des tokens par revendeur */}
        <section className="flex flex-col gap-3 rounded-2xl border border-slate-800 bg-slate-950/85 p-4 text-xs shadow-[0_18px_40px_rgba(0,0,0,0.65)]">
          <h2 className="text-sm font-semibold">
            Consulter les tokens d&apos;un revendeur
          </h2>
          <p className="text-xs text-slate-400">
            Saisis l&apos;ID du revendeur pour visualiser tous ses tokens, leur
            statut, la date de création, la date d&apos;expiration et les
            clients / devices associés.
          </p>

          <div className="mt-1 flex items-center gap-2 text-xs">
            <input
              type="text"
              value={queryResellerId}
              onChange={(e) => setQueryResellerId(e.target.value)}
              className="flex-1 rounded-full border border-slate-700 bg-slate-900 px-3 py-1.5 text-xs text-slate-100 placeholder:text-slate-500 focus:border-emerald-400 focus:outline-none"
              placeholder="Ex: R-0001"
            />
            <button
              type="button"
              disabled={loadingList}
              onClick={() => void handleLoadTokens()}
              className="rounded-full border border-emerald-500/60 bg-emerald-500/15 px-3 py-1.5 text-[11px] font-semibold text-emerald-100 hover:bg-emerald-500/25 disabled:opacity-50"
            >
              {loadingList ? "Chargement…" : "Charger les tokens"}
            </button>
          </div>

          {listError && (
            <div className="mt-1 rounded-xl bg-red-900/50 p-2 text-xs text-red-100">
              {listError}
            </div>
          )}

          {/* Tableau tokens existants */}
          <div className="mt-2 max-h-[360px] overflow-auto rounded-xl border border-slate-800 bg-slate-950/90 text-[11px]">
            {tokensList.length === 0 && !loadingList && (
              <div className="p-4 text-center text-[11px] text-slate-400">
                Aucun token à afficher pour cet ID revendeur.
                <br />
                Vérifie l&apos;identifiant ou crée un pack de tokens.
              </div>
            )}

            {tokensList.length > 0 && (
              <table className="min-w-full border-collapse text-left">
                <thead className="sticky top-0 bg-slate-950/95">
                  <tr className="border-b border-slate-800 text-[10px] uppercase tracking-wide text-slate-400">
                    <th className="px-3 py-2">Token</th>
                    <th className="px-3 py-2">Statut</th>
                    <th className="px-3 py-2">Client</th>
                    <th className="px-3 py-2">Device</th>
                    <th className="px-3 py-2">Validité</th>
                    <th className="px-3 py-2"></th>
                  </tr>
                </thead>
                <tbody>
                  {tokensList.map((t) => (
                    <tr
                      key={t.token}
                      className="border-b border-slate-900/70 hover:bg-slate-900/70"
                    >
                      <td className="px-3 py-2 align-top font-mono text-[10px] text-slate-100">
                        {t.token}
                      </td>
                      <td className="px-3 py-2 align-top">
                        <span
                          className={`inline-flex rounded-full px-2 py-0.5 text-[10px] ${statusClass(
                            t.status,
                          )}`}
                        >
                          {statusLabel(t.status)}
                        </span>
                      </td>
                      <td className="px-3 py-2 align-top text-[10px] text-slate-200">
                        {t.clientId || "—"}
                      </td>
                      <td className="px-3 py-2 align-top text-[10px] text-slate-200">
                        {t.deviceId || "—"}
                      </td>
                      <td className="px-3 py-2 align-top text-[10px] text-slate-300">
                        <div>Créé : {formatDateTime(t.createdAt)}</div>
                        {t.expiresAt && (
                          <div>Expire : {formatDateTime(t.expiresAt)}</div>
                        )}
                      </td>
                      <td className="px-3 py-2 align-top">
                        <button
                          type="button"
                          onClick={() => void handleCopyToken(t.token)}
                          className="rounded-full border border-slate-700 bg-slate-900 px-2 py-0.5 text-[10px] text-slate-200 hover:border-emerald-400"
                        >
                          Copier
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {copyMessage && (
            <div className="mt-1 rounded-xl bg-slate-900/80 px-3 py-1.5 text-[11px] text-slate-100">
              {copyMessage}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}

// Petit composant pour les pastilles de stats
function StatPill({
  label,
  value,
  variant,
}: {
  label: string;
  value: number;
  variant?: "green" | "blue" | "amber" | "red";
}) {
  let cls = "border-slate-700 bg-slate-900 text-slate-100"; // default

  if (variant === "green") {
    cls = "border-emerald-500/60 bg-emerald-500/10 text-emerald-100";
  } else if (variant === "blue") {
    cls = "border-sky-500/60 bg-sky-500/10 text-sky-100";
  } else if (variant === "amber") {
    cls = "border-amber-500/70 bg-amber-500/10 text-amber-100";
  } else if (variant === "red") {
    cls = "border-rose-500/70 bg-rose-500/10 text-rose-100";
  }

  return (
    <div className={`rounded-full border px-3 py-1 text-[11px] ${cls}`}>
      <span className="mr-1 font-medium">{label}</span>
      <span className="font-semibold">{value}</span>
    </div>
  );
}
