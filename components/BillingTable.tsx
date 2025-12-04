"use client";

import React from "react";

type PlanRow = {
  id: string;
  label: string;
  segment: string;
  devices: string;
  priceXof: number;
  per: "MOIS" | "AN";
  note?: string;
};

const PLANS: PlanRow[] = [
  {
    id: "PHONE_BIZ",
    label: "Pack Smartphones Entreprise",
    segment: "Phones GuardCloud",
    devices: "10 – 50 téléphones",
    priceXof: 9900,
    per: "MOIS",
    note: "par appareil et par mois",
  },
  {
    id: "PC_BIZ",
    label: "Pack PC & Laptops",
    segment: "PCGuard / Bureau",
    devices: "5 – 50 PC",
    priceXof: 12900,
    per: "MOIS",
    note: "par poste fixe ou portable",
  },
  {
    id: "FULL_SECURITY",
    label: "Sécurité Globale Premium",
    segment: "Phones + PC + Drones / Sites",
    devices: "Par site critique",
    priceXof: 250000,
    per: "MOIS",
    note: "sur-mesure (banques, ministères, etc.)",
  },
];

export default function BillingTable() {
  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-950/70 overflow-hidden shadow-[0_0_40px_rgba(15,23,42,0.9)]">
      <div className="px-4 md:px-6 py-4 border-b border-slate-800 flex items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-white">
            Résumé des offres GuardCloud
          </h2>
          <p className="text-[11px] text-slate-400 mt-0.5">
            Base tarifaire indicative pour phones, PC et sites sensibles.
          </p>
        </div>
        <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/40 text-emerald-300">
          Démo commerciale
        </span>
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-full text-xs">
          <thead className="bg-slate-900/80 border-b border-slate-800">
            <tr>
              <Th>Offre</Th>
              <Th>Segment</Th>
              <Th>Volume d&apos;appareils</Th>
              <Th>Prix indicatif</Th>
              <Th>Commentaire</Th>
            </tr>
          </thead>
          <tbody>
            {PLANS.map((plan) => (
              <tr
                key={plan.id}
                className="border-t border-slate-800/60 hover:bg-slate-900/80 transition"
              >
                <Td>
                  <div className="font-semibold text-white">
                    {plan.label}
                  </div>
                  <div className="text-[10px] text-slate-400 mt-0.5">
                    Code interne : {plan.id}
                  </div>
                </Td>

                <Td>
                  <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-slate-800 text-slate-100 border border-slate-700 text-[10px]">
                    {plan.segment}
                  </span>
                </Td>

                <Td>{plan.devices}</Td>

                <Td>
                  <div className="font-semibold text-emerald-400">
                    {plan.priceXof.toLocaleString("fr-FR")} XOF / {plan.per}
                  </div>
                  <div className="text-[10px] text-slate-400 mt-0.5">
                    Facturation mensuelle via MoneyFusion
                  </div>
                </Td>

                <Td>
                  <div className="text-[11px] text-slate-300">
                    {plan.note || "Tarification adaptable selon le profil."}
                  </div>
                </Td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="px-4 md:px-6 py-3 border-t border-slate-800 text-[11px] text-slate-400">
        Ces montants sont indicatifs pour la démo. Tu peux ensuite les
        adapter par client, par pays ou par revendeur dans MoneyFusion.
      </div>
    </div>
  );
}

/* Petit helpers pour garder un style propre */
function Th({ children }: { children: React.ReactNode }) {
  return (
    <th className="px-4 md:px-6 py-2 text-left font-medium text-slate-300">
      {children}
    </th>
  );
}

function Td({ children }: { children: React.ReactNode }) {
  return <td className="px-4 md:px-6 py-2 align-top text-slate-100">{children}</td>;
}
