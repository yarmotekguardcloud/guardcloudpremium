"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

type LoginResponse = {
  ok: boolean;
  token?: string;
  role?: string;
  error?: string;
};

const ADMIN_TOKEN_KEY = "gc_admin_token";
const LEGACY_JWT_KEY = "YGC_JWT";
const ROLE_KEY = "YGC_ROLE";

export default function AdminLoginPage() {
  const router = useRouter();

  const [login, setLogin] = useState("YGC-ADMIN");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const canSubmit = useMemo(
    () => login.trim().length > 0 && password.trim().length > 0 && !loading,
    [login, password, loading]
  );

  useEffect(() => {
    // Si déjà connecté, redirige direct
    try {
      const t = window.localStorage.getItem(ADMIN_TOKEN_KEY);
      if (t) router.replace("/admin/devices");
    } catch {
      // ignore
    }
  }, [router]);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();

    const l = login.trim();
    const p = password;

    if (!l || !p) {
      setErrorMsg("Merci de renseigner l’identifiant et le mot de passe.");
      return;
    }

    try {
      setLoading(true);
      setErrorMsg(null);

      // ✅ IMPORTANT: route Next (Pages) -> /api/admin/login (proxy vers Worker)
      const res = await fetch("/api/admin/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        // On envoie aussi email pour compat si backend attend "email"
        body: JSON.stringify({ login: l, email: l, password: p }),
      });

      const raw = await res.text();
      let data: LoginResponse | null = null;
      try {
        data = raw ? (JSON.parse(raw) as LoginResponse) : null;
      } catch {
        data = null;
      }

      if (!res.ok) {
        const msg = data?.error || `HTTP ${res.status}`;
        throw new Error(msg);
      }
      if (!data?.ok || !data.token) {
        throw new Error(data?.error || "Identifiants invalides");
      }

      // 🔐 Stockage token
      window.localStorage.setItem(ADMIN_TOKEN_KEY, data.token);
      window.localStorage.setItem(LEGACY_JWT_KEY, data.token);
      if (data.role) window.localStorage.setItem(ROLE_KEY, data.role);

      router.replace("/admin/devices");
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Erreur de connexion.";
      setErrorMsg(message);
    } finally {
      setLoading(false);
    }
  }

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
              placeholder="YGC-ADMIN ou admin@yarmotek.com"
              autoComplete="username"
              inputMode="email"
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
            disabled={!canSubmit}
            className="mt-2 w-full rounded-md bg-emerald-500 py-2 text-sm font-semibold text-black hover:bg-emerald-400 disabled:opacity-60"
          >
            {loading ? "Connexion…" : "Se connecter"}
          </button>

          <button
            type="button"
            onClick={() => {
              try {
                window.localStorage.removeItem(ADMIN_TOKEN_KEY);
                window.localStorage.removeItem(LEGACY_JWT_KEY);
                window.localStorage.removeItem(ROLE_KEY);
              } catch {
                // ignore
              }
              setErrorMsg("Token local effacé. Vous pouvez vous reconnecter.");
            }}
            className="w-full rounded-md border border-slate-700 bg-slate-950/40 py-2 text-xs text-slate-200 hover:bg-slate-950"
          >
            Effacer le token local
          </button>
        </form>
      </div>
    </div>
  );
}
