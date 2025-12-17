export const runtime = 'edge';

// app/api/admin/commands/route.ts
import { NextResponse } from "next/server";

const GUARDCLOUD_API_BASE =
  process.env.NEXT_PUBLIC_GUARDCLOUD_API_BASE ??
  "https://yarmotek-guardcloud-api.myarbanga.workers.dev";

type CommandAction = "RING" | "LOST_MODE" | "LOCK";

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({} as any));

    const deviceId = String(body.deviceId || "").trim();
    const action = String(body.action || "").toUpperCase() as CommandAction;
    const durationSec =
      typeof body.durationSec === "number" ? body.durationSec : 20;

    if (!deviceId) {
      return NextResponse.json(
        { ok: false, error: "deviceId manquant" },
        { status: 400 },
      );
    }
    if (!["RING", "LOST_MODE", "LOCK"].includes(action)) {
      return NextResponse.json(
        { ok: false, error: `Action non supportée: ${action}` },
        { status: 400 },
      );
    }

    // Construction de la commande envoyée au Worker GuardCloud
    const payload: any = {
      deviceId,
      level: "HIGH",
    };

    if (action === "RING") {
      payload.action = "RING";
      payload.durationSec = durationSec || 20;
      payload.message =
        body.message ||
        "ALERTE SahelGuard – téléphone localisé par GuardCloud.";
    } else if (action === "LOST_MODE") {
      // on peut utiliser DISPLAY_MESSAGE pour forcer LostModeActivity
      payload.action = "DISPLAY_MESSAGE";
      payload.message =
        body.message ||
        "Téléphone déclaré perdu / volé. Merci de contacter le propriétaire (Yarmotek).";
    } else if (action === "LOCK") {
      // LOCK_SCREEN sera interprété par HeartbeatService.kt
      payload.action = "LOCK_SCREEN";
      payload.message =
        body.message ||
        "Téléphone verrouillé par SahelGuard (protection avancée).";
    }

    const workerRes = await fetch(
      `${GUARDCLOUD_API_BASE}/phone/command/create`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      },
    );

    const json = await workerRes.json().catch(() => ({} as any));

    if (!workerRes.ok || json.ok === false) {
      return NextResponse.json(
        {
          ok: false,
          error:
            json.error ||
            `Worker GuardCloud a répondu HTTP ${workerRes.status}`,
        },
        { status: 502 },
      );
    }

    return NextResponse.json({
      ok: true,
      commandId: json.commandId ?? null,
    });
  } catch (e: any) {
    console.error("Admin commands API error:", e);
    return NextResponse.json(
      {
        ok: false,
        error: e?.message ?? "Erreur interne API /admin/commands",
      },
      { status: 500 },
    );
  }
}
