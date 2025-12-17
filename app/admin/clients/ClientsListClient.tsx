"use client";

import { useEffect, useMemo, useRef, useState } from "react";

type RawClient = {
  clientId?: string;
  id?: string;
  name?: string;
  contactName?: string;
  phone?: string;
  email?: string;

  // éventuels champs côté Worker
  devicesCount?: number;
  devicesOnline?: number;
  devicesOffline?: number;
  devices?: { online?: boolean }[];

  // optionnels
  status?: "ACTIVE" | "SUSPENDED" | "PENDING" | string;
  credits?: number;
  createdAt?: string;
  updatedAt?: string;
};

type ApiResponse = {
  ok: boolean;
  items?: RawClient[];
  error?: string;
};

type Client = {
  clientId: string;
  name: string;
  contactName: string;
  phone: string;
  email: string;
  status: string;
  credits: number | null;
  devicesCount: number;
  devicesOnline: number;
  devicesOffline: number;
  createdAt: string | null;
  updatedAt: string | null;
};

type Prefs = {
  q: string;
  autoRefresh: boolean;
  refreshSec: number; // 15..120
  showOnlyActive: boolean;
};

const PREFS_KEY = "gc_clients_prefs_v1";

function asNumber(v: unknown): number | null {
  if (typeof v === "number" && !Number.isNaN(v)) return v;
  if (typeof v === "string") {
    const n = parseFloat(v);
    return Number.isNaN(n) ? null : n;
  }
  return null;
}

function safeString(v: unknown, fallback = "—"): string {
  if (typeof v === "string" && v.trim().length) return v.trim();
  return fallback;
}

function normalizeClient(raw: RawClient): Client {
  const id = String(raw.clientId ?? raw.id ?? raw.email ?? "").trim() || "UNKNOWN";
  const name = safeString(raw.name ?? raw.contactName ?? raw.email ?? id, "Client");

  const devicesCount =
    typeof raw.devicesCount === "number"
      ? raw.devicesCount
      : Array.isArray(raw.devices)
      ? raw.devices.length
      : 0;

  const devicesOnline =
    typeof raw.devicesOnline === "number"
      ? raw.devicesOnline
      : Array.isArray(raw.devices)
      ? raw.devices.filter((d) => d?.online).length
      : 0;

  const devicesOffline =
    typeof raw.devicesOffline === "number"
      ? raw.devicesOffline
      : Math.max(devicesCount - devicesOnline, 0);

  return {
    clientId: id,
    name,
    contactName: safeString(raw.contactName, "—"),
    phone: safeString(raw.phone, "—"),
    email: safeString(raw.email, "—"),
    status: safeString(raw.status, "ACTIVE"),
    credits: asNumber(raw.credits),
    devicesCount,
    devicesOnline,
    devicesOffline,
    createdAt: typeof raw.createdAt === "string" ? raw.createdAt : null,
    updatedAt: typeof raw.updatedAt === "string" ? raw.updatedAt : null,
  };
}

function badgeClassForStatus(status: string) {
  const s = status.toUpperCase();
  if (s.includes("SUSP")) return "border-rose-500/60 bg-rose-500/10 text-rose-200";
  if (s.includes("PEND")) return "border-amber-400/60 bg-amber-500/10 text-amber-200";
  if (s.includes("ACTIVE")) return "border-emerald-500/60 bg-emerald-500/10 text-emerald-200";
  return "border-slate-600 bg-slate-800/40 text-slate-200";
}

function fmtDate(iso: string | null) {
  if (!iso) return "—";
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return "—";
  return new Date(t).toLocaleString();
}

export default function ClientsListClient() {
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [prefs, setPrefs] = useState<Prefs>({
    q: "",
    autoRefresh: true,
    refreshSec: 30,
    showOnlyActive: false,
  });

  const [selectedId, setSelectedId] = useState<string | null>(null);

  // éviter les setState après un unmount
  const aliveRef = useRef(true);

  const loadClients = async () => {
    try {
      setLoading(true);
      setError(null);

      const res = await fetch("/api/admin/clients", {
        method: "GET",
        cache: "no-store",
      });

      const json: ApiResponse = await res.json();
      if (!res.ok || !json.ok) {
        throw new Error(json.error ?? `API /admin/clients ok=false (HTTP ${res.status})`);
      }

      const normalized = (json.items ?? []).map(normalizeClient);

      if (!aliveRef.current) return;

      setClients(normalized);

      setSelectedId((prev) => {
        if (prev && normalized.some((c) => c.clientId === prev)) return prev;
        return normalized.length ? normalized[0].clientId : null;
      });
    } catch (e: any) {
      if (!aliveRef.current) return;
      console.error("Erreur chargement clients:", e);
      setError(e?.message ?? "Erreur inconnue lors du chargement des clients");
      setClients([]);
      setSelectedId(null);
    } finally {
      if (!aliveRef.current) return;
      setLoading(false);
    }
  };

  // ✅ SSR-safe: lecture localStorage uniquement côté client
  useEffect(() => {
    aliveRef.current = true;

    try {
      if (typeof window !== "undefined") {
        const saved = window.localStorage.getItem(PREFS_KEY);
        if (saved) {
          const parsed = JSON.parse(saved) as Partial<Prefs>;
          setPrefs((p) => ({
            q: typeof parsed.q === "string" ? parsed.q : p.q,
            autoRefresh: typeof parsed.autoRefresh === "boolean" ? parsed.autoRefresh : p.autoRefresh,
            refreshSec:
              typeof parsed.refreshSec === "number" && parsed.refreshSec >= 15 && parsed.refreshSec <= 120
                ? parsed.refreshSec
                : p.refreshSec,
            showOnlyActive:
              typeof parsed.showOnlyActive === "boolean" ? parsed.showOnlyActive : p.showOnlyActive,
          }));
        }
      }
    } catch {
      // ignore
    }

    void loadClients();

    return () => {
      aliveRef.current = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ✅ SSR-safe: écriture localStorage uniquement côté client
  useEffect(() => {
    try {
      if (typeof window !== "undefined") {
        window.localStorage.setItem(PREFS_KEY, JSON.stringify(prefs));
      }
    } catch {
      // ignore
    }
  }, [prefs]);

  // polling
  useEffect(() => {
    if (!prefs.autoRefresh) return;

    let interval: number | undefined;
    if (typeof window !== "undefined") {
      interval = window.setInterval(() => {
        void loadClients();
      }, Math.max(15, Math.min(120, prefs.refreshSec)) * 1000);
    }

    return () => {
      if (interval && typeof window !== "undefined") window.clearInterval(interval);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prefs.autoRefresh, prefs.refreshSec]);

  const { totalClients, totalDevices, totalOnline } = useMemo(() => {
    let devTotal = 0;
    let devOnline = 0;

    for (const c of clients) {
      devTotal += c.devicesCount;
      devOnline += c.devicesOnline;
    }

    return {
      totalClients: clients.length,
      totalDevices: devTotal,
      totalOnline: devOnline,
    };
  }, [clients]);

  const filtered = useMemo(() => {
    const q = prefs.q.trim().toLowerCase();
    const onlyActive = prefs.showOnlyActive;

    return clients.filter((c) => {
      if (onlyActive && !c.status.toUpperCase().includes("ACTIVE")) return false;
      if (!q) return true;

      const hay = [
        c.clientId,
        c.name,
        c.contactName,
        c.phone,
        c.email,
        c.status,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return hay.includes(q);
    });
  }, [clients, prefs.q, prefs.showOnlyActive]);

  const selected = useMemo(
    () => filtered.find((c) => c.clientId === selectedId) ?? clients.find((c) => c.clientId === selectedId) ?? null,
    [filtered, clients, selectedId],
  );

  const copy = async (text: string) => {
    try {
      if (typeof navigator === "undefined" || !navigator.clipboard) return;
      await navigator.clipboard.writeText(text);
    } catch {
      // ignore
    }
  };

  return (
    <div className="flex min-h-[calc(100vh-3.5rem)] flex-col bg-slate-950 text-slate-100">
      {/* Top bar */}
      <div className="px-4 py-3 border-b border-slate-800 bg-gradient-to-r from-slate-950 via-slate-900 to-slate-950">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="text-sm font-semibold tracking-tight">
              Clients • <span className="text-emerald-400">Gestion</span>
            </div>
            <div className="text-[11px] text-slate-400">
              {totalClients} client(s) • {totalDevices} appareils •{" "}
              <span className="text-emerald-300">{totalOnline} en ligne</span>
              {loading && <span className="ml-2 text-amber-300">• Chargement…</span>}
              {error && <span className="ml-2 text-rose-300">• Erreur API</span>}
            </div>
          </div>

          <div className="flex items-center gap-2 text-xs">
            <button
              type="button"
              onClick={() => void loadClients()}
              className="rounded-full border border-emerald-500/60 bg-emerald-500/10 px-3 py-1 text-emerald-100 hover:bg-emerald-500/20"
            >
              Rafraîchir
            </button>

            <div className="flex items-center gap-2 rounded-full border border-slate-800 bg-slate-900/70 px-3 py-1">
              <span className="text-[11px] text-slate-400">Auto</span>
              <button
                type="button"
                onClick={() => setPrefs((p) => ({ ...p, autoRefresh: !p.autoRefresh }))}
                className={`rounded-full px-2 py-0.5 text-[11px] ${
                  prefs.autoRefresh ? "bg-emerald-500/15 text-emerald-200" : "bg-slate-800 text-slate-300"
                }`}
              >
                {prefs.autoRefresh ? "ON" : "OFF"}
              </button>

              <select
                value={prefs.refreshSec}
                onChange={(e) => setPrefs((p) => ({ ...p, refreshSec: Number(e.target.value) }))}
                className="rounded-full bg-slate-900 px-2 py-0.5 text-[11px] text-slate-100 border border-slate-800"
              >
                {[15, 30, 60, 120].map((v) => (
                  <option key={v} value={v}>
                    {v}s
                  </option>
                ))}
              </select>
            </div>

            <label className="flex items-center gap-2 rounded-full border border-slate-800 bg-slate-900/70 px-3 py-1 text-[11px]">
              <input
                type="checkbox"
                checked={prefs.showOnlyActive}
                onChange={(e) => setPrefs((p) => ({ ...p, showOnlyActive: e.target.checked }))}
              />
              Actifs seulement
            </label>
          </div>
        </div>

        {/* Search */}
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <input
            value={prefs.q}
            onChange={(e) => setPrefs((p) => ({ ...p, q: e.target.value }))}
            placeholder="Rechercher (nom, email, téléphone, ID, statut)…"
            className="w-full max-w-xl rounded-full border border-slate-800 bg-slate-900/70 px-4 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:border-emerald-400 focus:outline-none"
          />
          {prefs.q.trim().length > 0 && (
            <button
              type="button"
              onClick={() => setPrefs((p) => ({ ...p, q: "" }))}
              className="rounded-full border border-slate-800 bg-slate-900/70 px-3 py-2 text-[11px] text-slate-300 hover:border-emerald-400"
            >
              Réinitialiser
            </button>
          )}
          <div className="text-[11px] text-slate-500">
            {filtered.length} résultat(s)
          </div>
        </div>
      </div>

      {/* Main content */}
      <div className="flex min-h-0 flex-1 gap-4 p-4">
        {/* Left list */}
        <div className="w-[360px] min-w-[320px] max-w-[420px] rounded-2xl border border-slate-800 bg-slate-950/60 p-3 shadow-[0_18px_40px_rgba(0,0,0,0.55)]">
          {error && (
            <div className="mb-3 rounded-xl border border-rose-500/40 bg-rose-500/10 p-3 text-[11px] text-rose-200">
              Impossible de charger la liste des clients. Vérifie le Worker /api/admin/clients.
            </div>
          )}

          {!error && !loading && filtered.length === 0 && (
            <div className="rounded-xl bg-slate-900/60 p-3 text-sm text-slate-400">
              Aucun client ne correspond au filtre.
            </div>
          )}

          <div className="max-h-[calc(100vh-210px)] overflow-y-auto pr-1">
            {filtered.map((c) => {
              const isSel = c.clientId === selectedId;
              return (
                <button
                  key={c.clientId}
                  type="button"
                  onClick={() => setSelectedId(c.clientId)}
                  className={`mb-2 w-full rounded-xl border px-3 py-2 text-left transition ${
                    isSel
                      ? "border-emerald-400 bg-gradient-to-r from-emerald-500/15 via-emerald-500/5 to-slate-900"
                      : "border-slate-800 bg-slate-900/50 hover:border-emerald-500/50 hover:bg-slate-900/70"
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="truncate text-sm font-semibold text-slate-100">{c.name}</div>
                      <div className="truncate text-[11px] text-slate-400">
                        {c.email !== "—" ? c.email : c.clientId}
                      </div>
                    </div>
                    <span
                      className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] ${badgeClassForStatus(
                        c.status,
                      )}`}
                    >
                      {c.status}
                    </span>
                  </div>

                  <div className="mt-2 flex items-center justify-between text-[11px] text-slate-400">
                    <span>Devices: {c.devicesCount}</span>
                    <span className="text-emerald-300">Online: {c.devicesOnline}</span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Right details */}
        <div className="flex min-h-0 flex-1 flex-col gap-3 rounded-2xl border border-slate-800 bg-slate-950/60 p-4 shadow-[0_18px_40px_rgba(0,0,0,0.55)]">
          {!selected ? (
            <div className="rounded-xl bg-slate-900/60 p-4 text-sm text-slate-400">
              Sélectionne un client à gauche pour voir les détails.
            </div>
          ) : (
            <>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-xs uppercase tracking-wide text-slate-500">
                    Dossier client
                  </div>
                  <div className="truncate text-lg font-semibold">{selected.name}</div>
                  <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-slate-400">
                    <span className="rounded-full border border-slate-800 bg-slate-900/70 px-2 py-0.5">
                      ID: <span className="text-slate-200">{selected.clientId}</span>
                    </span>
                    <span className={`rounded-full border px-2 py-0.5 ${badgeClassForStatus(selected.status)}`}>
                      {selected.status}
                    </span>
                    <button
                      type="button"
                      onClick={() => void copy(selected.clientId)}
                      className="rounded-full border border-slate-800 bg-slate-900/70 px-2 py-0.5 text-[11px] text-slate-200 hover:border-emerald-400"
                    >
                      Copier ID
                    </button>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => void loadClients()}
                    className="rounded-full border border-slate-800 bg-slate-900/70 px-3 py-1 text-[11px] text-slate-200 hover:border-emerald-400"
                  >
                    Recharger
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <InfoCard label="Contact" value={selected.contactName} />
                <InfoCard label="Téléphone" value={selected.phone} />
                <InfoCard label="Email" value={selected.email} />
                <InfoCard label="Crédits" value={selected.credits == null ? "—" : String(selected.credits)} />
              </div>

              <div className="grid grid-cols-3 gap-3">
                <InfoCard label="Appareils" value={String(selected.devicesCount)} />
                <InfoCard label="En ligne" value={String(selected.devicesOnline)} accent="emerald" />
                <InfoCard label="Hors ligne" value={String(selected.devicesOffline)} />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <InfoCard label="Créé" value={fmtDate(selected.createdAt)} />
                <InfoCard label="Mis à jour" value={fmtDate(selected.updatedAt)} />
              </div>

              <div className="rounded-2xl border border-slate-800 bg-slate-950/80 p-3">
                <div className="mb-2 text-[11px] uppercase tracking-wide text-slate-500">
                  Actions rapides
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => void copy(selected.email !== "—" ? selected.email : selected.clientId)}
                    className="rounded-full border border-slate-800 bg-slate-900/70 px-3 py-1 text-[11px] text-slate-200 hover:border-emerald-400"
                  >
                    Copier email
                  </button>
                  <button
                    type="button"
                    onClick={() => void copy(selected.phone !== "—" ? selected.phone : selected.clientId)}
                    className="rounded-full border border-slate-800 bg-slate-900/70 px-3 py-1 text-[11px] text-slate-200 hover:border-emerald-400"
                  >
                    Copier téléphone
                  </button>
                </div>
              </div>

              <div className="mt-auto text-[11px] text-slate-500">
                UI SSR-safe : aucune lecture window/localStorage hors hooks.
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function InfoCard({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent?: "emerald" | "slate";
}) {
  const accentCls =
    accent === "emerald"
      ? "border-emerald-500/60 bg-gradient-to-br from-emerald-500/15 to-slate-950"
      : "border-slate-800 bg-slate-950/60";

  return (
    <div className={`rounded-xl border px-3 py-2 ${accentCls}`}>
      <div className="text-[10px] uppercase tracking-wide text-slate-500">{label}</div>
      <div className="mt-1 text-sm text-slate-100">{value}</div>
    </div>
  );
}
