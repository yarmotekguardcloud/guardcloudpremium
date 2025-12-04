"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { API_BASE } from "@/lib/api";

type LoginResponse = {
  ok: boolean;
  token?: string;
  role?: string;
  error?: string;
};

export default function AdminLoginPage() {
  const router = useRouter();
  const [login, setLogin] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    if (!login || !password) {
      setErrorMsg("Merci de renseigner l’identifiant et le mot de passe.");
      return;
    }

    try {
      setLoading(true);
      setErrorMsg(null);

      const res = await fetch(`${API_BASE}/admin/login`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ login, password }),
      });

      if (!res.ok) {
        throw new Error(`HTTP ${res.status.toString()}`);
      }

      const data = (await res.json()) as LoginResponse;

      if (!data.ok || !data.token) {
        throw new Error(data.error || "Identifiants invalides");
      }

      // 🔐 Stockage simple du token pour TopNavbar / AuthGuard
      if (typeof window !== "undefined") {
        window.localStorage.setItem("gc_admin_token", data.token);
        window.localStorage.setItem("YGC_JWT", data.token); // legacy
        if (data.role) {
          window.localStorage.setItem("YGC_ROLE", data.role);
        }
      }

      router.replace("/admin/devices");
    } catch (err: unknown) {
      console.error(err);
      const message =
        err instanceof Error
          ? err.message
          : "Erreur de connexion au serveur.";
      setErrorMsg(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-950 text-white">
      <div className="w-full max-w-md rounded-2xl border border-slate-800 bg-slate-900/70 p-6 shadow-xl">
        <h1 className="text-xl font-semibold mb-1">
          Yarmotek GuardCloud – Admin
        </h1>
        <p className="text-xs text-slate-300 mb-4">
          Connectez-vous pour accéder au tableau de bord global.
        </p>

        {errorMsg && (
          <div className="mb-4 rounded-md bg-red-900/70 px-3 py-2 text-xs text-red-100">
            {errorMsg}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="space-y-1 text-sm">
            <label className="block text-slate-200">Identifiant</label>
            <input
              type="text"
              value={login}
              onChange={(e) => setLogin(e.target.value)}
              className="w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm outline-none focus:border-emerald-400"
              placeholder="admin@yarmotek.com ou YGC-ADMIN"
              autoComplete="username"
            />
          </div>

          <div className="space-y-1 text-sm">
            <label className="block text-slate-200">Mot de passe</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm outline-none focus:border-emerald-400"
              placeholder="••••••••"
              autoComplete="current-password"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="mt-2 w-full rounded-md bg-emerald-500 py-2 text-sm font-semibold text-black hover:bg-emerald-400 disabled:opacity-60"
          >
            {loading ? "Connexion…" : "Se connecter"}
          </button>
        </form>
      </div>
    </div>
  );
}
