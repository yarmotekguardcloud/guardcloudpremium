"use client";

import { useRouter } from "next/navigation";

export default function HomePage() {
  const router = useRouter();

  return (
    <main className="min-h-screen bg-slate-950 text-white flex items-center justify-center px-4">
      <div className="max-w-5xl w-full">
        {/* En-tête */}
        <div className="mb-8 text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-slate-800/70 border border-slate-700 text-xs text-slate-300 mb-3">
            <span className="inline-block h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
            <span>Yarmotek GuardCloud · Premium 2025</span>
          </div>

          <h1 className="text-3xl md:text-4xl font-semibold mb-3">
            Universal Tracking · Phones · PC · Drones · GPS · IoT
          </h1>
          <p className="text-sm md:text-base text-slate-300 max-w-2xl mx-auto">
            Une seule plateforme pour suivre et sécuriser tous les appareils
            critiques de vos clients : entreprises, banques, fermes, flotte
            de véhicules, sites sensibles…
          </p>
        </div>

        {/* Cartes d’accès rapides */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          {/* Admin Global */}
          <Card
            title="Console Admin Globale"
            badge="YGC-ADMIN"
            description="Vue complète de tous les clients, appareils et factures. Mode démo pour tes présentations."
            primaryLabel="Accéder à l’admin"
            onPrimary={() => router.push("/admin/login")}
          >
            <p className="text-[11px] text-slate-300 mt-2">
              • Carte temps réel multi-clients<br />
              • Filtre par catégorie (Phones / PC / Drones)<br />
              • Accès facturation & MoneyFusion
            </p>
          </Card>

          {/* Espace Client */}
          <Card
            title="Espace Client Entreprise"
            badge="Client"
            description="Chaque client voit uniquement ses propres appareils GuardCloud (PC & smartphones)."
            primaryLabel="Espace client"
            onPrimary={() => router.push("/client/login")}
          >
            <p className="text-[11px] text-slate-300 mt-2">
              • Login par ID client<br />
              • Carte live de tous ses appareils<br />
              • Statistiques & statut temps réel
            </p>
          </Card>

          {/* Facturation / Démo MoneyFusion */}
          <Card
            title="Facturation & Démo Revendeur"
            badge="MoneyFusion"
            description="Factures, abonnements, historique de paiement pour tes clients et revendeurs."
            primaryLabel="Voir la facturation"
            onPrimary={() => router.push("/billing")}
            secondaryLabel="Carte démo publique"
            onSecondary={() => router.push("/map/devices")}
          >
            <p className="text-[11px] text-slate-300 mt-2">
              • Abonnement par appareil / par mois<br />
              • Liens de paiement (Fusion Link)<br />
              • Démo live carte publique GuardCloud
            </p>
          </Card>
        </div>

        {/* Bas de page mini-légal */}
        <div className="text-[11px] text-slate-500 text-center">
          Yarmotek GuardCloud · Une innovation Yarmotek International SARL · AES / Sahel
        </div>
      </div>
    </main>
  );
}

/* ------------------------------------------------------------------ */
/* Petit composant carte réutilisable                                 */
/* ------------------------------------------------------------------ */

type CardProps = {
  title: string;
  badge?: string;
  description: string;
  primaryLabel: string;
  onPrimary: () => void;
  secondaryLabel?: string;
  onSecondary?: () => void;
  children?: React.ReactNode;
};

function Card({
  title,
  badge,
  description,
  primaryLabel,
  onPrimary,
  secondaryLabel,
  onSecondary,
  children,
}: CardProps) {
  return (
    <div className="bg-slate-900/70 border border-slate-800 rounded-2xl p-4 flex flex-col justify-between shadow-[0_0_40px_rgba(15,23,42,0.9)]">
      <div>
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-base font-semibold">{title}</h2>
          {badge && (
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-800 text-slate-200 border border-slate-700">
              {badge}
            </span>
          )}
        </div>
        <p className="text-xs text-slate-300">{description}</p>
        {children}
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={onPrimary}
          className="px-3 py-1.5 rounded-full text-xs font-semibold bg-emerald-500 text-black hover:bg-emerald-400"
        >
          {primaryLabel}
        </button>
        {secondaryLabel && onSecondary && (
          <button
            type="button"
            onClick={onSecondary}
            className="px-3 py-1.5 rounded-full text-xs font-semibold bg-slate-800 text-slate-100 hover:bg-slate-700 border border-slate-600"
          >
            {secondaryLabel}
          </button>
        )}
      </div>
    </div>
  );
}
