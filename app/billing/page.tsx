"use client";

import BillingTable from "@/components/BillingTable";
import BillingInvoicesTable from "@/components/BillingInvoicesTable";

export default function BillingPage() {
  return (
    <div className="min-h-screen bg-slate-950 text-white px-6 py-6">
      <div className="max-w-6xl mx-auto space-y-5">
        <header className="space-y-1">
          <h1 className="text-2xl font-semibold">
            Yarmotek GuardCloud – Billing &amp; MoneyFusion
          </h1>
          <p className="text-xs text-slate-300">
            Vue synthétique des abonnements, factures et liens de paiement
            MoneyFusion.
          </p>
        </header>

        {/* Résumé rapide des abonnements (PC / phones / etc.) */}
        <section>
          <BillingTable />
        </section>

        {/* Historique détaillé des factures (client de démo / MoneyFusion) */}
        <section>
          <h2 className="text-sm font-semibold mb-2">
            Historique des factures GuardCloud
          </h2>
          <BillingInvoicesTable />
        </section>
      </div>
    </div>
  );
}
