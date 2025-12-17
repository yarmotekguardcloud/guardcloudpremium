"use client";

import { useMemo } from "react";
import type { HistoryPoint } from "./AntiTheftDashboard";

type Props = {
  deviceId: string | null;
  historyPoints: HistoryPoint[];
  onSelectPoint?: (point: HistoryPoint) => void;
};

function formatTime(ts: string) {
  const t = Date.parse(ts);
  if (Number.isNaN(t)) return ts;
  const d = new Date(t);
  return d.toLocaleTimeString(undefined, {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

export function DeviceHistoryPanel({
  deviceId,
  historyPoints,
  onSelectPoint,
}: Props) {
  const sorted = useMemo(
    () =>
      (historyPoints ?? []).slice().sort(
        (a, b) =>
          Date.parse(b.timestampIso) - Date.parse(a.timestampIso),
      ),
    [historyPoints],
  );

  if (!deviceId) {
    return (
      <div className="rounded-2xl bg-slate-900/80 p-3 text-xs text-slate-300">
        Sélectionne un appareil pour afficher son historique anti-vol.
      </div>
    );
  }

  if (!sorted.length) {
    return (
      <div className="rounded-2xl bg-slate-900/80 p-3 text-xs text-slate-300">
        Aucun point d’historique pour les dernières 24h.
        <br />
        Dès que le téléphone enverra des heartbeats, tu verras les positions
        apparaître ici.
      </div>
    );
  }

  const lastTs = sorted[0].timestampIso;

  return (
    <div className="flex h-full flex-col rounded-2xl bg-slate-900/85 p-3 text-xs text-slate-100">
      <div className="mb-2 flex items-center justify-between">
        <div>
          <div className="text-[11px] uppercase tracking-wide text-slate-500">
            Historique anti-vol
          </div>
          <div className="text-[11px] text-slate-400">
            Positions, SIM, mode avion (24h)
          </div>
        </div>
        <div className="rounded-full bg-slate-800 px-2 py-1 text-[11px] text-slate-300">
          Dernier point&nbsp;: {formatTime(lastTs)}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto rounded-2xl border border-slate-800 bg-slate-950/80">
        <table className="min-w-full text-[11px]">
          <thead className="sticky top-0 bg-slate-950">
            <tr className="border-b border-slate-800 text-[10px] uppercase tracking-wide text-slate-500">
              <th className="px-2 py-1 text-left">Heure</th>
              <th className="px-2 py-1 text-left">Lat / Lng</th>
              <th className="px-2 py-1 text-left">Préc.</th>
              <th className="px-2 py-1 text-left">Batt.</th>
              <th className="px-2 py-1 text-left">Réseau</th>
              <th className="px-2 py-1 text-left">SIM</th>
              <th className="px-2 py-1 text-left">Avion</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((p, idx) => {
              const hasCoord =
                typeof p.lat === "number" &&
                !Number.isNaN(p.lat) &&
                typeof p.lng === "number" &&
                !Number.isNaN(p.lng);

              const labelLatLng = hasCoord
                ? `${p.lat!.toFixed(5)} / ${p.lng!.toFixed(5)}`
                : "N/A";

              const isFirst = idx === 0;

              return (
                <tr
                  key={`${p.timestampIso}-${idx}`}
                  className={`cursor-pointer border-b border-slate-900/60 transition hover:bg-slate-800/60 ${
                    isFirst ? "bg-slate-800/50" : ""
                  }`}
                  onClick={() => {
                    if (hasCoord && onSelectPoint) {
                      onSelectPoint(p);
                    }
                  }}
                >
                  <td className="px-2 py-1 whitespace-nowrap">
                    {formatTime(p.timestampIso)}
                  </td>
                  <td className="px-2 py-1 font-mono text-[10px]">
                    {labelLatLng}
                  </td>
                  <td className="px-2 py-1">
                    {typeof p.accuracy_m === "number"
                      ? `±${Math.round(p.accuracy_m)}m`
                      : "N/A"}
                  </td>
                  <td className="px-2 py-1">
                    {p.battery != null ? `${p.battery}%` : "N/A"}
                  </td>
                  <td className="px-2 py-1">{p.networkType || "?"}</td>
                  <td className="px-2 py-1">
                    {p.simChanged ? (
                      <span className="rounded-full bg-rose-600/30 px-2 py-0.5 text-[10px] text-rose-100">
                        changée
                      </span>
                    ) : (
                      <span className="text-slate-400 text-[10px]">OK</span>
                    )}
                  </td>
                  <td className="px-2 py-1">
                    {p.airplaneMode ? (
                      <span className="rounded-full bg-amber-500/20 px-2 py-0.5 text-[10px] text-amber-200">
                        activé
                      </span>
                    ) : (
                      <span className="text-slate-400 text-[10px]">off</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="mt-2 text-[10px] text-slate-500">
        💡 Astuce : clique sur une ligne pour déplacer le marqueur sur la carte
        à cette position exacte.
      </div>
    </div>
  );
}
