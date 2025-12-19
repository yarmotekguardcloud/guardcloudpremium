import { NextRequest, NextResponse } from "next/server";

export const runtime = "edge";
export const dynamic = "force-dynamic";

const GUARDCLOUD_API_BASE = process.env.NEXT_PUBLIC_GUARDCLOUD_API_BASE ?? "https://yarmotek-guardcloud-api.myarbanga.workers.dev";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const deviceId = String(body.deviceId || "").trim();
    const action = String(body.action || "").toUpperCase();
    const durationSec = typeof body.durationSec === "number" ? body.durationSec : 20;

    if (!deviceId) return NextResponse.json({ ok: false, error: "deviceId manquant" }, { status: 400 });

    const payload: any = { deviceId, level: "HIGH" };
    if (action === "RING") {
      payload.action = "RING";
      payload.durationSec = durationSec;
      payload.message = body.message || "ALERTE SahelGuard – téléphone localisé.";
    } else if (action === "LOST_MODE") {
      payload.action = "DISPLAY_MESSAGE";
      payload.message = body.message || "Téléphone déclaré perdu / volé.";
    } else if (action === "LOCK") {
      payload.action = "LOCK_SCREEN";
      payload.message = body.message || "Téléphone verrouillé par SahelGuard.";
    }

    const workerRes = await fetch(`${GUARDCLOUD_API_BASE}/phone/command/create`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    const json = await workerRes.json().catch(() => ({}));
    return NextResponse.json({ ok: workerRes.ok && json.ok !== false, commandId: json.commandId ?? null });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}