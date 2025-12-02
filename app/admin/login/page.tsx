"use client";

// app/admin/login/page.tsx
// MODE SUPER ADMIN DEV : pas de vérification API, on entre directement.

import { useState } from "react";
import { useRouter } from "next/navigation";

const ADMIN_TOKEN_KEY = "gc_admin_token";

function saveAdminToken(token: string) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(ADMIN_TOKEN_KEY, token);
}

function clearAdminToken() {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(ADMIN_TOKEN_KEY);
}

export default function AdminLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("admin@yarmotek.com");
  const [password, setPassword] = useState("YGC-ADMIN");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      // 🔥 MODE SUPER ADMIN DEV
      // On ne contacte pas l'API, on force la connexion locale.
      clearAdminToken();
      saveAdminToken("YGC-ADMIN"); // token forcé

      // Redirection directe vers la vue admin globale
      await router.push("/admin/devices");
    } catch (err: any) {
      console.error("Admin login error:", err);
      setError(err.message || "Erreur de connexion");
      clearAdminToken();
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-gray-100 flex flex-col">
      {/* Header global simple – adapte si tu as déjà une nav dans ton layout */}
      <nav className="bg-[#05060f] text-white h-14 flex items-center justify-between px-6">
        <div className="font-semibold text-lg">Yarmotek GuardCloud</div>
        <div className="text-xs opacity-70">
          Mode Super Admin (DEV – accès direct)
        </div>
      </nav>

      <main className="flex-1 flex items-center justify-center">
        <div className="max-w-md w-full bg-white shadow-lg rounded-2xl p-8">
          <h1 className="text-xl font-semibold mb-1">
            Connexion Admin – Yarmotek GuardCloud
          </h1>
          <p className="text-xs text-gray-500 mb-6">
            Mode développement : accès direct Super Admin (YGC-ADMIN),
            sans vérification serveur.
          </p>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm mb-1">
                Email administrateur
              </label>
              <input
                type="email"
                className="w-full border rounded-lg px-3 py-2 text-sm"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="username"
              />
            </div>

            <div>
              <label className="block text-sm mb-1">Mot de passe</label>
              <input
                type="password"
                className="w-full border rounded-lg px-3 py-2 text-sm"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
              />
            </div>

            {error && (
              <div className="text-xs text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium py-2.5 rounded-lg transition disabled:opacity-60"
            >
              {loading ? "Connexion..." : "Se connecter"}
            </button>
          </form>

          <p className="mt-4 text-[11px] text-gray-400 text-center">
            Propulsé par Yarmotek GuardCloud – Supervision drones, PC &
            smartphones.
          </p>
        </div>
      </main>
    </div>
  );
}
