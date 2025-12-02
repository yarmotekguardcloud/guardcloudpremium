"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const CLIENT_ID_KEY = "gc_client_id";

export default function ClientLoginPage() {
  const router = useRouter();
  const [clientId, setClientId] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const id = clientId.trim();
    if (!id) {
      setError("Merci de saisir votre ID client (ou numéro de téléphone).");
      return;
    }

    setLoading(true);
    try {
      if (typeof window !== "undefined") {
        window.localStorage.setItem(CLIENT_ID_KEY, id);
      }
      await router.push("/client/devices");
    } catch (err: any) {
      console.error("Client login error:", err);
      setError("Erreur de connexion.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-gray-100 flex flex-col">
      <nav className="bg-[#05060f] text-white h-14 flex items-center justify-between px-6">
        <div className="font-semibold text-lg">Yarmotek GuardCloud</div>
        <div className="text-xs opacity-70">Espace Client</div>
      </nav>

      <main className="flex-1 flex items-center justify-center px-4">
        <div className="max-w-md w-full bg-white shadow-lg rounded-2xl p-8">
          <h1 className="text-xl font-semibold mb-1">
            Connexion Client – GuardCloud
          </h1>
          <p className="text-xs text-gray-500 mb-6">
            Accédez à la carte temps réel de vos appareils (PC &amp; smartphones).
          </p>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm mb-1">
                ID client / Téléphone
              </label>
              <input
                type="text"
                className="w-full border rounded-lg px-3 py-2 text-sm"
                placeholder="Ex : 75255416, CLI-75255416, CLIENT-XYZ..."
                value={clientId}
                onChange={(e) => setClientId(e.target.value)}
              />
              <p className="text-[11px] text-gray-400 mt-1">
                L&apos;ID doit correspondre à celui enregistré par Yarmotek
                (téléphone, code client, etc.).
              </p>
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
              {loading ? "Connexion..." : "Voir mes appareils"}
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
