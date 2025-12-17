import { NextResponse } from "next/server";

const API_BASE =
  process.env.GUARDCLOUD_API_BASE ??
  process.env.NEXT_PUBLIC_GUARDCLOUD_API_BASE ??
  "https://yarmotek-guardcloud-api.myarbanga.workers.dev";

type CreateTokensPayload = {
  count: number;
  validityDays: number;
  resellerId?: string | null;
  batchLabel?: string | null;
};

export async function POST(req: Request) {
  try {
    const payload = (await req.json()) as CreateTokensPayload;

    // Proxy vers le Worker GuardCloud (à adapter si ton endpoint est différent)
    const workerRes = await fetch(`${API_BASE}/admin/tokens/batch`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    const text = await workerRes.text();

    // 🔒 On s’assure que la réponse est bien du JSON
    let json: any;
    try {
      json = JSON.parse(text);
    } catch (e) {
      console.error("Réponse non JSON du Worker /admin/tokens/batch:", text);
      return NextResponse.json(
        {
          ok: false,
          error:
            "Réponse invalide du service tokens (non JSON). Vérifier le Worker GuardCloud.",
        },
        { status: 502 },
      );
    }

    return NextResponse.json(json, { status: workerRes.status });
  } catch (e: any) {
    console.error("Erreur interne route /api/admin/tokens:", e);
    return NextResponse.json(
      {
        ok: false,
        error:
          e?.message ??
          "Erreur interne lors de la création du lot de tokens (route Next).",
      },
      { status: 500 },
    );
  }
}
