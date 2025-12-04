"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

const CLIENT_ID_KEY = "gc_client_id";

export default function ClientLoginPage() {
  const router = useRouter();
  const [clientId, setClientId] = useState("");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    if (!clientId.trim()) {
      setErrorMsg("Merci de renseigner votre ID client.");
      return;
    }

    setLoading(true);
    setErrorMsg(null);

    if (typeof window !== "undefined") {
      window.localStorage.setItem(CLIENT_ID_KEY, clientId.trim());
    }

    router.replace("/client/devices");
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-950 text-white">
      <div className="w-full max-w-md rounded-2xl border border-slate-800 bg-slate-900/70 p-6 shadow-xl">
        <h1 className="text-xl font-semibold mb-1">
          Yarmotek GuardCloud – Espace Client
        </h1>
        <p className="text-xs text-slate-300 mb-4">
          Entrez votre ID client GuardCloud pour voir vos appareils.
        </p>

        {errorMsg && (
          <div className="mb-4 rounded-md bg-red-900/70 px-3 py-2 text-xs text-red-100">
            {errorMsg}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="space-y-1 text-sm">
            <label className="block text-slate-200">ID client</label>
            <input
              type="text"
              value={clientId}
              onChange={(e) => setClientId(e.target.value)}
              className="w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm outline-none focus:border-emerald-400"
              placeholder="Ex: CLIENT-ABC123"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="mt-2 w-full rounded-md bg-emerald-500 py-2 text-sm font-semibold text-black hover:bg-emerald-400 disabled:opacity-60"
          >
            {loading ? "Ouverture…" : "Accéder à mes appareils"}
          </button>
        </form>
      </div>
    </div>
  );
}
