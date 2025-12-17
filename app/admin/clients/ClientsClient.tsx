"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";

// ✅ Adapte si ton API diffère
const CLIENTS_API = "/api/admin/clients";

type ClientStatus = "ACTIVE" | "SUSPENDED" | "PENDING" | "UNKNOWN";

export type Client = {
  id: string;
  clientId: string;
  name: string;
  phone?: string | null;
  email?: string | null;
  status: ClientStatus;
  resellerId?: string | null;
  resellerName?: string | null;
  createdAt?: string | null;
  updatedAt?: string | null;

  devicesCount?: number | null;
  tokensBalance?: number | null;
  lastActivityAt?: string | null;
};

type ClientsResponse = {
  ok?: boolean;
  items?: any[];
  clients?: any[];
  error?: string;
};

function asString(v: unknown): string | null {
  if (typeof v === "string") return v;
  if (typeof v === "number" && Number.isFinite(v)) return String(v);
  return null;
}

function asNumber(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string") {
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

function normalizeStatus(raw: any): ClientStatus {
  const s = (raw?.status ?? raw?.state ?? raw?.clientStatus ?? "").toString().toUpperCase();
  if (s === "ACTIVE") return "ACTIVE";
  if (s === "SUSPENDED" || s === "DISABLED" || s === "BLOCKED") return "SUSPENDED";
  if (s === "PENDING" || s === "NEW") return "PENDING";
  return "UNKNOWN";
}

function normalizeClient(raw: any): Client {
  const clientId = asString(raw?.clientId ?? raw?.id ?? raw?.uid ?? "UNKNOWN") ?? "UNKNOWN";

  return {
    id: asString(raw?.id ?? raw?.clientId ?? clientId) ?? clientId,
    clientId,
    name: asString(raw?.name ?? raw?.clientName ?? raw?.companyName ?? "Client") ?? "Client",
    phone: asString(raw?.phone ?? raw?.clientPhone ?? raw?.msisdn) ?? null,
    email: asString(raw?.email ?? raw?.clientEmail) ?? null,
    status: normalizeStatus(raw),

    resellerId: asString(raw?.resellerId) ?? null,
    resellerName: asString(raw?.resellerName) ?? null,

    createdAt: asString(raw?.createdAt ?? raw?.created_at) ?? null,
    updatedAt: asString(raw?.updatedAt ?? raw?.updated_at) ?? null,

    devicesCount: asNumber(raw?.devicesCount ?? raw?.devices_count) ?? null,
    tokensBalance: asNumber(raw?.tokensBalance ?? raw?.tokenBalance ?? raw?.credits) ?? null,
    lastActivityAt: asString(raw?.lastActivityAt ?? raw?.lastSeenAt ?? raw?.lastSeen) ?? null,
  };
}

function formatAge(iso: string | null | undefined): string {
  if (!iso) return "N/A";
  const t = Date.parse(iso);
  if (!t || Number.isNaN(t)) return "N/A";
  const min = Math.round((Date.now() - t) / 60000);
  if (min < 1) return "à l’instant";
  if (min < 60) return `il y a ${min} min`;
  const h = Math.round(min / 60);
  if (h < 48) return `il y a ${h} h`;
  const d = Math.round(h / 24);
  return `il y a ${d} j`;
}

type SortKey = "NAME" | "STATUS" | "DEVICES" | "TOKENS" | "ACTIVITY";
type SortDir = "ASC" | "DESC";

export default function ClientsClient() {
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<ClientStatus | "ALL">("ALL");

  const [sortKey, setSortKey] = useState<SortKey>("ACTIVITY");
  const [sortDir, setSortDir] = useState<SortDir>("DESC");

  const [selectedId, setSelectedId] = useState<string | null>(null);

  // ✅ SSR-safe: lecture localStorage uniquement côté client
  useEffect(() => {
    try {
      const saved = window.localStorage.getItem("gc_clients_prefs");
      if (!saved) return;
      const parsed = JSON.parse(saved);
      if (parsed?.sortKey) setSortKey(parsed.sortKey);
      if (parsed?.sortDir) setSortDir(parsed.sortDir);
      if (parsed?.statusFilter) setStatusFilter(parsed.statusFilter);
    } catch {
      // ignore
    }
  }, []);

  // ✅ SSR-safe: écriture localStorage uniquement côté client
  useEffect(() => {
    try {
      window.localStorage.setItem(
        "gc_clients_prefs",
        JSON.stringify({ sortKey, sortDir, statusFilter }),
      );
    } catch {
      // ignore
    }
  }, [sortKey, sortDir, statusFilter]);

  // Load clients + polling
  useEffect(() => {
    let cancelled = false;
    let interval: number | undefined;

    const fetchClients = async () => {
      try {
        setLoading(true);
        setError(null);

        const res = await fetch(CLIENTS_API, { method: "GET", cache: "no-store" });
        const json = (await res.json()) as ClientsResponse;

        if (!res.ok) throw new Error(json?.error ?? `Erreur API clients (HTTP ${res.status})`);
        if (json.ok === false) throw new Error(json.error ?? "L’API clients a retourné une erreur.");

        const raw = json.items ?? json.clients ?? [];
        const normalized = (raw ?? []).map(normalizeClient);

        if (!cancelled) {
          setClients(normalized);
          setSelectedId((prev) => {
            if (prev && normalized.some((c) => c.clientId === prev)) return prev;
            return normalized[0]?.clientId ?? null;
          });
        }
      } catch (e: any) {
        if (!cancelled) setError(e?.message ?? "Erreur lors du chargement des clients.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void fetchClients();
    interval = window.setInterval(fetchClients, 30_000);

    return () => {
      cancelled = true;
      if (interval) window.clearInterval(interval);
    };
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return clients.filter((c) => {
      if (statusFilter !== "ALL" && c.status !== statusFilter) return false;
      if (!q) return true;
      const fields = [c.name, c.clientId, c.phone, c.email, c.resellerName, c.resellerId];
      return fields.filter(Boolean).some((v) => String(v).toLowerCase().includes(q));
    });
  }, [clients, query, statusFilter]);

  const sorted = useMemo(() => {
    const dir = sortDir === "ASC" ? 1 : -1;

    const keyFn = (c: Client): number | string => {
      switch (sortKey) {
        case "NAME":
          return (c.name ?? "").toLowerCase();
        case "STATUS":
          return c.status;
        case "DEVICES":
          return c.devicesCount ?? -1;
        case "TOKENS":
          return c.tokensBalance ?? -1;
        case "ACTIVITY": {
          const t = c.lastActivityAt ? Date.parse(c.lastActivityAt) : 0;
          return Number.isNaN(t) ? 0 : t;
        }
      }
    };

    return [...filtered].sort((a, b) => {
      const ka = keyFn(a);
      const kb = keyFn(b);

      if (typeof ka === "number" && typeof kb === "number") return (ka - kb) * dir;
      return String(ka).localeCompare(String(kb)) * dir;
    });
  }, [filtered, sortKey, sortDir]);

  const selected = useMemo(
    () => sorted.find((c) => c.clientId === selectedId) ?? null,
    [sorted, selectedId],
  );

  const counts = useMemo(() => {
    const total = clients.length;
    const active = clients.filter((c) => c.status === "ACTIVE").length;
    const suspended = clients.filter((c) => c.status === "SUSPENDED").length;
    const pending = clients.filter((c) => c.status === "PENDING").length;
    return { total, active, suspended, pending };
  }, [clients]);

  return (
    <div className="mx-auto flex min-h-[calc(100vh-0px)] w-full max-w-[1400px] flex-col gap-4 px-4 py-4">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-800 bg-gradient-to-r from-slate-950 via-slate-900 to-slate-950 px-4 py-3 shadow-lg shadow-black/40">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">
            GuardCloud • <span className="text-emerald-400">Clients</span>
          </h1>
          <p className="text-xs text-slate-400">
            Gestion clients (statut, activité, devices, crédits). SSR-safe (aucun window côté serveur).
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 text-xs">
          <Link
            href="/admin/devices"
            className="rounded-full border border-slate-700 bg-slate-900 px-3 py-1 text-slate-200 hover:border-emerald-400"
          >
            ← Retour Devices
          </Link>

          <div className="rounded-full bg-slate-900 px-3 py-1">
            <span className={`mr-2 inline-flex h-2 w-2 rounded-full ${loading ? "bg-amber-400" : "bg-emerald-400"}`} />
            {loading ? "Mise à jour…" : "OK"}
          </div>

          <div className="rounded-full bg-slate-900 px-3 py-1">
            Total : <span className="font-semibold">{counts.total}</span>
          </div>
          <div className="rounded-full bg-emerald-500/10 px-3 py-1 text-emerald-200">
            Actifs : <span className="font-semibold">{counts.active}</span>
          </div>
          <div className="rounded-full bg-amber-500/10 px-3 py-1 text-amber-200">
            En attente : <span className="font-semibold">{counts.pending}</span>
          </div>
          <div className="rounded-full bg-rose-500/10 px-3 py-1 text-rose-200">
            Suspendus : <span className="font-semibold">{counts.suspended}</span>
          </div>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="rounded-2xl border border-rose-500/40 bg-rose-950/40 px-4 py-3 text-sm text-rose-100">
          ❌ {error}
        </div>
      )}

      {/* Controls */}
      <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-slate-800 bg-slate-950/70 px-4 py-3">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Rechercher (nom, ID, tel, email, revendeur)…"
          className="w-full max-w-md rounded-full border border-slate-700 bg-slate-900/80 px-4 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:border-emerald-400 focus:outline-none"
        />

        <div className="flex items-center gap-2">
          <label className="text-xs text-slate-400">Statut</label>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as any)}
            className="rounded-full border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 focus:border-emerald-400 focus:outline-none"
          >
            <option value="ALL">Tous</option>
            <option value="ACTIVE">Actifs</option>
            <option value="PENDING">En attente</option>
            <option value="SUSPENDED">Suspendus</option>
            <option value="UNKNOWN">Inconnu</option>
          </select>
        </div>

        <div className="flex items-center gap-2">
          <label className="text-xs text-slate-400">Tri</label>
          <select
            value={sortKey}
            onChange={(e) => setSortKey(e.target.value as SortKey)}
            className="rounded-full border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 focus:border-emerald-400 focus:outline-none"
          >
            <option value="ACTIVITY">Activité</option>
            <option value="NAME">Nom</option>
            <option value="STATUS">Statut</option>
            <option value="DEVICES">Devices</option>
            <option value="TOKENS">Crédits</option>
          </select>

          <button
            type="button"
            onClick={() => setSortDir((d) => (d === "ASC" ? "DESC" : "ASC"))}
            className="rounded-full border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-200 hover:border-emerald-400"
          >
            {sortDir === "ASC" ? "↑" : "↓"}
          </button>
        </div>

        <div className="ml-auto text-xs text-slate-400">
          Résultats : <span className="font-semibold text-slate-200">{sorted.length}</span>
        </div>
      </div>

      {/* Layout */}
      <div className="grid min-h-0 flex-1 grid-cols-1 gap-4 lg:grid-cols-[520px_1fr]">
        {/* List */}
        <div className="min-h-0 rounded-2xl border border-slate-800 bg-slate-950/70 p-3">
          <div className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
            Liste clients
          </div>

          <div className="max-h-[calc(100vh-260px)] overflow-y-auto pr-1">
            {sorted.map((c) => {
              const active = selectedId === c.clientId;

              const badge =
                c.status === "ACTIVE"
                  ? "bg-emerald-500/15 text-emerald-200 border-emerald-500/40"
                  : c.status === "PENDING"
                  ? "bg-amber-500/15 text-amber-200 border-amber-500/40"
                  : c.status === "SUSPENDED"
                  ? "bg-rose-500/15 text-rose-200 border-rose-500/40"
                  : "bg-slate-700/40 text-slate-200 border-slate-600/50";

              return (
                <button
                  key={c.clientId}
                  type="button"
                  onClick={() => setSelectedId(c.clientId)}
                  className={`mb-2 w-full rounded-xl border px-3 py-3 text-left transition ${
                    active
                      ? "border-emerald-400 bg-emerald-500/10"
                      : "border-slate-800 bg-slate-900/50 hover:border-emerald-500/40"
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="truncate text-sm font-semibold">
                        {c.name}
                      </div>
                      <div className="mt-0.5 truncate text-xs text-slate-400">
                        ID: {c.clientId}
                        {c.phone ? ` • ${c.phone}` : ""}
                      </div>
                      <div className="mt-0.5 truncate text-[11px] text-slate-500">
                        Revendeur: {c.resellerName || c.resellerId || "N/A"}
                      </div>
                    </div>

                    <div className="flex flex-col items-end gap-2">
                      <span className={`rounded-full border px-2 py-0.5 text-[10px] ${badge}`}>
                        {c.status}
                      </span>
                      <span className="text-[10px] text-slate-500">
                        {c.lastActivityAt ? `Actif ${formatAge(c.lastActivityAt)}` : "Activité N/A"}
                      </span>
                    </div>
                  </div>

                  <div className="mt-2 grid grid-cols-2 gap-2 text-[11px] text-slate-300">
                    <div className="rounded-lg bg-slate-950/60 px-2 py-1">
                      Devices : <span className="font-semibold">{c.devicesCount ?? "—"}</span>
                    </div>
                    <div className="rounded-lg bg-slate-950/60 px-2 py-1">
                      Crédits : <span className="font-semibold">{c.tokensBalance ?? "—"}</span>
                    </div>
                  </div>
                </button>
              );
            })}

            {sorted.length === 0 && !loading && (
              <div className="rounded-xl bg-slate-900/60 p-4 text-sm text-slate-400">
                Aucun client ne correspond à tes filtres.
              </div>
            )}
          </div>
        </div>

        {/* Details */}
        <div className="min-h-0 rounded-2xl border border-slate-800 bg-slate-950/70 p-4">
          <div className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
            Détails
          </div>

          {!selected ? (
            <div className="rounded-xl bg-slate-900/60 p-4 text-sm text-slate-400">
              Sélectionne un client pour voir ses détails.
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="text-lg font-semibold">{selected.name}</div>
                  <div className="text-sm text-slate-400">Client ID : {selected.clientId}</div>
                  <div className="mt-1 text-sm text-slate-300">
                    {selected.phone ? `📞 ${selected.phone}` : "📞 N/A"}{" "}
                    {selected.email ? ` • ✉️ ${selected.email}` : ""}
                  </div>
                </div>

                <div className="rounded-2xl border border-slate-800 bg-slate-900/60 px-4 py-3 text-right">
                  <div className="text-xs text-slate-400">Dernière activité</div>
                  <div className="text-sm font-semibold">
                    {selected.lastActivityAt ? formatAge(selected.lastActivityAt) : "N/A"}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <StatCard label="Statut" value={selected.status} />
                <StatCard label="Devices" value={String(selected.devicesCount ?? "—")} />
                <StatCard label="Crédits tokens" value={String(selected.tokensBalance ?? "—")} />
                <StatCard label="Revendeur" value={selected.resellerName || selected.resellerId || "N/A"} />
              </div>

              <div className="rounded-2xl border border-slate-800 bg-slate-900/50 p-4">
                <div className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                  Actions rapides
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Link
                    href={`/admin/devices?clientId=${encodeURIComponent(selected.clientId)}`}
                    className="rounded-full border border-emerald-500/50 bg-emerald-500/10 px-4 py-2 text-sm font-semibold text-emerald-100 hover:bg-emerald-500/20"
                  >
                    Voir devices du client
                  </Link>

                  <button
                    type="button"
                    onClick={() => navigator.clipboard?.writeText(selected.clientId)}
                    className="rounded-full border border-slate-700 bg-slate-900 px-4 py-2 text-sm text-slate-200 hover:border-emerald-400"
                  >
                    Copier Client ID
                  </button>
                </div>
              </div>

              {(selected.createdAt || selected.updatedAt) && (
                <div className="text-xs text-slate-500">
                  Créé : {selected.createdAt ? new Date(selected.createdAt).toLocaleString() : "N/A"} •
                  Mis à jour : {selected.updatedAt ? new Date(selected.updatedAt).toLocaleString() : "N/A"}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900/60 px-4 py-3">
      <div className="text-xs uppercase tracking-wide text-slate-500">{label}</div>
      <div className="mt-1 text-sm font-semibold text-slate-100">{value}</div>
    </div>
  );
}
