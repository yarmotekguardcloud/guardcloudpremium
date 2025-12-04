"use client";

import { useEffect, useState } from "react";

const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE_URL ??
  "https://yarmotek-guardcloud-api.myarbanga.workers.dev";

type BillingInfo = {
  period: string;
  devicesCount: number;
  role: string;
  unitXof: number;
  totalXof: number;
  approxUsd: number;
};

type Invoice = {
  invoiceId: string;
  clientId: string;
  clientName: string | null;
  billing: BillingInfo;
  phone?: string | null;
  checkoutUrl: string;
  status: string;
  createdAt: string;
  paidAt?: string;
};

type InvoicesApiResponse = {
  ok: boolean;
  invoices?: Invoice[];
  error?: string;
};

const CLIENT_ID = "CLIENT-TEST";

function periodLabel(p: string) {
  if (p === "YEARLY") return "Année";
  if (p === "WEEKLY") return "Semaine";
  return "Mois";
}

function statusBadge(status: string) {
  const up = (status || "").toUpperCase();

  if (up === "PAID") {
    return (
      <span className="inline-flex rounded-full bg-emerald-900/80 px-3 py-1 text-xs font-medium text-emerald-200">
        Payée
      </span>
    );
  }

  if (up === "PENDING") {
    return (
      <span className="inline-flex rounded-full bg-amber-900/80 px-3 py-1 text-xs font-medium text-amber-200">
        En attente
      </span>
    );
  }

  return (
    <span className="inline-flex rounded-full bg-gray-800 px-3 py-1 text-xs font-medium text-gray-200">
      {status || "Inconnu"}
    </span>
  );
}

function getErrorMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  if (typeof err === "string") return err;
  try {
    return JSON.stringify(err);
  } catch {
    return "Erreur inconnue";
  }
}

export default function BillingInvoicesTable() {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        setError(null);

        const url = `${API_BASE}/billing/invoices/by-client?clientId=${encodeURIComponent(
          CLIENT_ID
        )}`;

        const res = await fetch(url);

        if (!res.ok) {
          throw new Error(`HTTP ${res.status.toString()}`);
        }

        const data = (await res.json()) as InvoicesApiResponse;

        if (!data.ok) {
          throw new Error(data.error || "Erreur API");
        }

        setInvoices(data.invoices ?? []);
      } catch (e: unknown) {
        console.error(e);
        setError(
          getErrorMessage(e) ||
            "Erreur lors du chargement des factures"
        );
      } finally {
        setLoading(false);
      }
    };

    load();
  }, []);

  const handleDownloadReceipt = (invoiceId: string) => {
    if (typeof window === "undefined") return;
    window.open(`/api/invoices/${invoiceId}/pdf`, "_blank");
  };

  if (loading) {
    return (
      <div className="text-gray-300 px-6 py-4">
        Chargement des factures…
      </div>
    );
  }

  if (error) {
    return (
      <div className="mb-4 rounded-md bg-red-900/60 px-4 py-2 text-sm text-red-200">
        {error}
      </div>
    );
  }

  if (!invoices.length) {
    return (
      <div className="px-6 py-4 text-sm text-gray-300">
        Aucune facture trouvée pour ce client.
      </div>
    );
  }

  return (
    <div className="rounded-xl bg-[#050816] border border-gray-800 overflow-hidden">
      <table className="w-full text-sm">
        <thead className="bg-[#060b1a] border-b border-gray-800">
          <tr>
            <th className="px-6 py-3 text-left font-medium text-gray-300">
              Facture
            </th>
            <th className="px-6 py-3 text-left font-medium text-gray-300">
              Client
            </th>
            <th className="px-6 py-3 text-left font-medium text-gray-300">
              Période
            </th>
            <th className="px-6 py-3 text-left font-medium text-gray-300">
              Appareils
            </th>
            <th className="px-6 py-3 text-left font-medium text-gray-300">
              Montant
            </th>
            <th className="px-6 py-3 text-left font-medium text-gray-300">
              Statut
            </th>
            <th className="px-6 py-3 text-left font-medium text-gray-300">
              Créée le
            </th>
            <th className="px-6 py-3 text-left font-medium text-gray-300">
              Actions
            </th>
          </tr>
        </thead>
        <tbody>
          {invoices.map((inv) => {
            const created = new Date(inv.createdAt);

            return (
              <tr
                key={inv.invoiceId}
                className="border-t border-gray-800 hover:bg-white/5 transition"
              >
                <td className="px-6 py-3 align-middle">
                  <div className="font-semibold">{inv.invoiceId}</div>
                  {inv.paidAt && (
                    <div className="text-xs text-emerald-300">
                      Payée le{" "}
                      {new Date(
                        inv.paidAt
                      ).toLocaleDateString("fr-FR")}
                    </div>
                  )}
                </td>

                <td className="px-6 py-3 align-middle">
                  <div className="font-semibold">
                    {inv.clientName ?? inv.clientId}
                  </div>
                  <div className="text-xs text-gray-400">
                    {inv.clientId}
                  </div>
                </td>

                <td className="px-6 py-3 align-middle">
                  {periodLabel(inv.billing.period)}
                </td>

                <td className="px-6 py-3 align-middle">
                  {inv.billing.devicesCount}
                </td>

                <td className="px-6 py-3 align-middle">
                  <div className="font-semibold text-emerald-400">
                    {inv.billing.totalXof.toLocaleString("fr-FR")} XOF
                  </div>
                  <div className="text-xs text-gray-400">
                    ≈ {inv.billing.approxUsd.toFixed(2)} USD
                  </div>
                </td>

                <td className="px-6 py-3 align-middle">
                  {statusBadge(inv.status)}
                </td>

                <td className="px-6 py-3 align-middle">
                  {created.toLocaleDateString("fr-FR")}
                </td>

                <td className="px-6 py-3 align-middle space-x-2">
                  <a
                    href={inv.checkoutUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-block mb-1 rounded-full bg-emerald-500 px-4 py-1 text-xs font-semibold text-black hover:bg-emerald-400"
                  >
                    Voir paiement
                  </a>

                  {inv.status.toUpperCase() === "PAID" && (
                    <button
                      type="button"
                      onClick={() =>
                        handleDownloadReceipt(inv.invoiceId)
                      }
                      className="inline-block rounded-full bg-sky-500 px-4 py-1 text-xs font-semibold text-black hover:bg-sky-400"
                    >
                      Reçu PDF
                    </button>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      <div className="px-6 py-4 text-xs text-gray-400 border-t border-gray-800">
        Historique des factures générées par l&apos;API GuardCloud
        (MoneyFusion – Fusion Link).
      </div>
    </div>
  );
}
