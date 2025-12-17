"use client";

import { useEffect, useMemo, useState } from "react";

type TokenStatus = "NEW" | "ACTIVATED" | "EXPIRED";

type ResellerToken = {
  token: string;
  resellerId: string;
  status: TokenStatus;
  durationDays: number;
  createdAt: string;
  activatedAt: string | null;
  expiresAt: string | null;
  clientId: string | null;
  deviceId: string | null;
  notes?: string | null;
};

type ResellerTokensResponse = {
  ok: boolean;
  resellerId?: string;
  items?: ResellerToken[];
  error?: string;
};

export default function ResellerTokensPage() {
  const [resellerId, setResellerId] = useState("R-0001"); // démo
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tokens, setTokens] = useState<ResellerToken[]>([]);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const [autoRefresh, setAutoRefresh] = useState(true);

  const [selectedToken, setSelectedToken] = useState<ResellerToken | null>(
    null,
  );

  // ------------------------------------------------------------------
  //  Chargement + refresh intelligent (polling léger)
  // ------------------------------------------------------------------
  useEffect(() => {
    let cancelled = false;
    let interval: number | undefined;

    const fetchTokens = async () => {
      if (!resellerId.trim()) return;
      try {
        setLoading(true);
        setError(null);

        const url = `/api/reseller/tokens?resellerId=${encodeURIComponent(
          resellerId.trim(),
        )}`;

        const res = await fetch(url, { cache: "no-store" });
        const json = (await res.json()) as ResellerTokensResponse;

        if (!json.ok) {
          throw new Error(json.error || "Erreur API reseller/tokens");
        }

        if (!cancelled) {
          const items = json.items ?? [];
          // on tri : ACTIVATED en haut, puis NEW, puis EXPIRED
          const ordered = [...items].sort((a, b) => {
            const priority = (s: TokenStatus) =>
              s === "ACTIVATED" ? 0 : s === "NEW" ? 1 : 2;
            return priority(a.status) - priority(b.status);
          });

          setTokens(ordered);
          if (!selectedToken && ordered.length > 0) {
            setSelectedToken(ordered[0]);
          } else if (
            selectedToken &&
            !ordered.some((t) => t.token === selectedToken.token)
          ) {
            setSelectedToken(ordered[0] ?? null);
          }
          setLastUpdated(new Date());
        }
      } catch (e: any) {
        console.error("Erreur chargement tokens revendeur:", e);
        if (!cancelled) {
          setError(e?.message ?? "Erreur chargement tokens revendeur");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void fetchTokens();

    if (autoRefresh) {
      interval = window.setInterval(fetchTokens, 15_000);
    }

    return () => {
      cancelled = true;
      if (interval) window.clearInterval(interval);
    };
  }, [resellerId, autoRefresh, selectedToken?.token]);

  // ------------------------------------------------------------------
  //  Statistiques
  // ------------------------------------------------------------------
  const stats = useMemo(() => {
    const total = tokens.length;
    const activated = tokens.filter((t) => t.status === "ACTIVATED").length;
    const available = tokens.filter((t) => t.status === "NEW").length;
    const expired = tokens.filter((t) => t.status === "EXPIRED").length;
    return { total, activated, available, expired };
  }, [tokens]);

  const copyToClipboard = async (value: string) => {
    try {
      if (typeof navigator === "undefined" || !navigator.clipboard) return;
      await navigator.clipboard.writeText(value);
      alert("Copié dans le presse-papiers 👍");
    } catch (e) {
      console.error("Clipboard error:", e);
    }
  };

  const formatDateTime = (iso: string | null) => {
    if (!iso) return "—";
    try {
      const d = new Date(iso);
      return d.toLocaleString();
    } catch {
      return iso;
    }
  };

  const formatStatusLabel = (s: TokenStatus) => {
    switch (s) {
      case "NEW":
        return "Disponible";
      case "ACTIVATED":
        return "Activé";
      case "EXPIRED":
        return "Expiré";
      default:
        return s;
    }
  };

  const statusClass = (s: TokenStatus) => {
    switch (s) {
      case "NEW":
        return "bg-emerald-500/10 text-emerald-300 border-emerald-400/60";
      case "ACTIVATED":
        return "bg-sky-500/10 text-sky-300 border-sky-400/60";
      case "EXPIRED":
        return "bg-rose-500/10 text-rose-300 border-rose-400/60";
      default:
        return "bg-slate-700 text-slate-200 border-slate-500/60";
    }
  };

  return (
    <div className="flex min-h-[calc(100vh-80px)] flex-col gap-4 bg-slate-950/95 px-4 pb-6 pt-4 text-slate-100">
      {/* En-tête / branding revendeur */}
      <div className="flex items-center justify-between gap-4 rounded-2xl border border-slate-800 bg-gradient-to-r from-slate-950 via-slate-900 to-slate-950 px-4 py-3 shadow-xl shadow-black/40">
        <div>
          <div className="text-xs uppercase tracking-[0.18em] text-slate-500">
            Yarmotek GuardCloud • Programme Revendeurs
          </div>
          <h1 className="mt-1 text-xl font-semibold tracking-tight">
            Tableau de bord{" "}
            <span className="text-emerald-400">Licences SahelGuard</span>
          </h1>
          <p className="mt-1 text-xs text-slate-400">
            Suivi en temps réel des licences attribuées à chaque revendeur :
            stock de tokens, licences activées, durée de validité et
            association client / device.
          </p>
        </div>
        <div className="flex flex-col items-end gap-2 text-xs">
          <div className="flex items-center gap-2">
            <span className="rounded-full bg-slate-900 px-3 py-1 text-[11px]">
              ID Revendeur&nbsp;:{" "}
              <span className="font-semibold text-emerald-400">
                {resellerId || "—"}
              </span>
            </span>
            <label className="flex items-center gap-2 rounded-full bg-slate-900 px-3 py-1 text-[11px]">
              <input
                type="checkbox"
                className="h-3 w-3 rounded border-slate-500 bg-slate-900 text-emerald-500"
                checked={autoRefresh}
                onChange={(e) => setAutoRefresh(e.target.checked)}
              />
              <span>Refresh auto (15s)</span>
            </label>
          </div>
          <div className="flex items-center gap-2 text-[11px] text-slate-500">
            <span
              className={`inline-flex h-2 w-2 rounded-full ${
                loading ? "bg-amber-400" : "bg-emerald-400"
              }`}
            />
            {loading
              ? "Chargement des licences…"
              : lastUpdated
              ? `Mis à jour : ${lastUpdated.toLocaleTimeString()}`
              : "Prêt"}
          </div>
        </div>
      </div>

      {/* Ligne filtres + stats */}
      <div className="flex flex-wrap items-center gap-4">
        <div className="flex items-center gap-2 rounded-2xl border border-slate-800 bg-slate-900/80 px-3 py-2 text-xs">
          <span className="text-[11px] text-slate-400">Changer de revendeur</span>
          <input
            type="text"
            value={resellerId}
            onChange={(e) => setResellerId(e.target.value)}
            className="w-32 rounded-full border border-slate-700 bg-slate-950 px-3 py-1 text-[11px] text-slate-100 placeholder:text-slate-500 focus:border-emerald-400 focus:outline-none"
            placeholder="R-0001"
          />
          <button
            type="button"
            onClick={() => {
              // force refresh manuel
              setLastUpdated(null);
              setTokens([]);
              setSelectedToken(null);
            }}
            className="rounded-full border border-emerald-500/60 bg-emerald-500/10 px-3 py-1 text-[11px] font-medium text-emerald-100 hover:bg-emerald-500/20"
          >
            Recharger
          </button>
        </div>

        <div className="flex flex-wrap gap-2 text-xs">
          <StatBadge
            label="Total licences"
            value={stats.total}
            color="slate"
          />
          <StatBadge
            label="Disponibles"
            value={stats.available}
            color="emerald"
          />
          <StatBadge
            label="Activées"
            value={stats.activated}
            color="sky"
          />
          <StatBadge
            label="Expirées"
            value={stats.expired}
            color="rose"
          />
        </div>
      </div>

      {error && (
        <div className="rounded-xl border border-rose-700/80 bg-rose-950/70 px-3 py-2 text-xs text-rose-100">
          {error}
        </div>
      )}

      {/* Layout principal : tableau + détail token */}
      <div className="flex min-h-0 flex-1 gap-4">
        {/* Tableau licences */}
        <div className="flex min-h-0 flex-1 flex-col rounded-2xl border border-slate-800 bg-slate-950/85 p-3 text-xs shadow-[0_18px_40px_rgba(0,0,0,0.75)]">
          <div className="mb-2 flex items-center justify-between">
            <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
              Licences SahelGuard du revendeur
            </div>
            <div className="text-[11px] text-slate-500">
              Clique sur une ligne pour voir le détail complet.
            </div>
          </div>

          <div className="min-h-0 flex-1 overflow-auto rounded-xl border border-slate-800 bg-slate-950/90">
            <table className="min-w-full text-left text-[11px]">
              <thead className="sticky top-0 bg-slate-950/95 backdrop-blur">
                <tr className="border-b border-slate-800/80 text-[10px] uppercase tracking-wide text-slate-500">
                  <th className="px-3 py-2">Token</th>
                  <th className="px-3 py-2">Statut</th>
                  <th className="px-3 py-2">Client</th>
                  <th className="px-3 py-2">Device</th>
                  <th className="px-3 py-2">Créé le</th>
                  <th className="px-3 py-2">Expiration</th>
                </tr>
              </thead>
              <tbody>
                {tokens.length === 0 && !loading && (
                  <tr>
                    <td
                      colSpan={6}
                      className="px-3 py-4 text-center text-slate-500"
                    >
                      Aucune licence trouvée pour ce revendeur.
                    </td>
                  </tr>
                )}

                {tokens.map((t) => {
                  const isSelected =
                    selectedToken && selectedToken.token === t.token;
                  return (
                    <tr
                      key={t.token}
                      className={`cursor-pointer border-b border-slate-900/60 transition hover:bg-slate-900/80 ${
                        isSelected
                          ? "bg-gradient-to-r from-emerald-500/10 via-slate-900 to-slate-950"
                          : ""
                      }`}
                      onClick={() => setSelectedToken(t)}
                    >
                      <td className="px-3 py-2 font-mono text-[11px] text-emerald-200">
                        {t.token}
                      </td>
                      <td className="px-3 py-2">
                        <span
                          className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] ${statusClass(
                            t.status,
                          )}`}
                        >
                          <span className="h-1.5 w-1.5 rounded-full bg-current" />
                          {formatStatusLabel(t.status)}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-slate-200">
                        {t.clientId ? (
                          <>
                            <span className="font-semibold">{t.clientId}</span>
                            {t.notes && (
                              <span className="ml-1 text-[10px] text-slate-500">
                                · {t.notes}
                              </span>
                            )}
                          </>
                        ) : (
                          <span className="text-slate-500">Non affecté</span>
                        )}
                      </td>
                      <td className="px-3 py-2 font-mono text-[10px] text-slate-300">
                        {t.deviceId || <span className="text-slate-500">—</span>}
                      </td>
                      <td className="px-3 py-2 text-slate-300">
                        {formatDateTime(t.createdAt)}
                      </td>
                      <td className="px-3 py-2 text-slate-300">
                        {formatDateTime(t.expiresAt)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Panneau détail token */}
        <div className="flex w-[360px] flex-col gap-3 rounded-2xl border border-slate-800 bg-slate-950/85 p-3 text-xs shadow-[0_18px_40px_rgba(0,0,0,0.75)]">
          {!selectedToken && (
            <div className="rounded-xl bg-slate-900/80 p-3 text-slate-400">
              Sélectionne une licence dans la liste pour voir le détail.
            </div>
          )}

          {selectedToken && (
            <>
              <div className="rounded-xl border border-slate-800 bg-slate-900/80 p-3">
                <div className="mb-2 flex items-center justify-between gap-2">
                  <div>
                    <div className="text-[11px] uppercase tracking-wide text-slate-500">
                      Détail licence
                    </div>
                    <div className="font-mono text-[11px] text-emerald-300">
                      {selectedToken.token}
                    </div>
                  </div>
                  <button
                    type="button"
                    className="rounded-full border border-emerald-500/70 bg-emerald-500/10 px-3 py-1 text-[11px] font-medium text-emerald-100 hover:bg-emerald-500/20"
                    onClick={() => copyToClipboard(selectedToken.token)}
                  >
                    Copier le token
                  </button>
                </div>
                <div className="mt-1 flex items-center justify-between">
                  <span
                    className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] ${statusClass(
                      selectedToken.status,
                    )}`}
                  >
                    <span className="h-1.5 w-1.5 rounded-full bg-current" />
                    {formatStatusLabel(selectedToken.status)}
                  </span>
                  <span className="text-[10px] text-slate-400">
                    Durée&nbsp;: {selectedToken.durationDays} jours
                  </span>
                </div>
              </div>

              <div className="space-y-2 rounded-xl border border-slate-800 bg-slate-900/80 p-3">
                <SectionRow
                  label="ID revendeur"
                  value={selectedToken.resellerId}
                />
                <SectionRow
                  label="Client ID"
                  value={selectedToken.clientId ?? "Non affecté"}
                />
                <SectionRow
                  label="Device ID"
                  value={selectedToken.deviceId ?? "Non lié"}
                  mono
                />
                <SectionRow
                  label="Créé le"
                  value={formatDateTime(selectedToken.createdAt)}
                />
                <SectionRow
                  label="Activé le"
                  value={formatDateTime(selectedToken.activatedAt)}
                />
                <SectionRow
                  label="Expire le"
                  value={formatDateTime(selectedToken.expiresAt)}
                />
                <SectionRow
                  label="Notes"
                  value={selectedToken.notes || "—"}
                />
              </div>

              <div className="rounded-xl border border-emerald-700/60 bg-emerald-500/5 p-3 text-[11px] text-emerald-100">
                <div className="mb-1 font-semibold">
                  Pitch pour le revendeur
                </div>
                <p className="text-[11px] text-emerald-100/90">
                  « Chaque token est une licence SahelGuard prête à être
                  vendue. Une fois activée sur un téléphone, la licence
                  protège le device pendant{" "}
                  <span className="font-semibold">
                    {selectedToken.durationDays} jours
                  </span>{" "}
                  : localisation temps réel, géofencing, blocage anti-vol et
                  preuves pour la police. »
                </p>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function StatBadge({
  label,
  value,
  color,
}: {
  label: string;
  value: number;
  color: "slate" | "emerald" | "sky" | "rose";
}) {
  const map: Record<string, string> = {
    slate: "border-slate-600 bg-slate-900 text-slate-100",
    emerald: "border-emerald-500/70 bg-emerald-500/10 text-emerald-100",
    sky: "border-sky-500/70 bg-sky-500/10 text-sky-100",
    rose: "border-rose-500/70 bg-rose-500/10 text-rose-100",
  };
  return (
    <div
      className={`flex items-center gap-2 rounded-full border px-3 py-1 text-[11px] ${map[color]}`}
    >
      <span className="text-[10px] uppercase tracking-wide">{label}</span>
      <span className="text-xs font-semibold">{value}</span>
    </div>
  );
}

function SectionRow({
  label,
  value,
  mono,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="flex items-start justify-between gap-2">
      <div className="text-[11px] text-slate-500">{label}</div>
      <div
        className={`max-w-[200px] text-right text-[11px] ${
          mono ? "font-mono text-slate-100" : "text-slate-100"
        }`}
      >
        {value}
      </div>
    </div>
  );
}
