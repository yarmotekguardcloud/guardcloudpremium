// app/api/guardcloud/command/route.ts
import { NextRequest, NextResponse } from 'next/server';

// URL de ton Worker Cloudflare
const API_BASE =
  process.env.NEXT_PUBLIC_GUARDCLOUD_API_BASE ??
  'https://yarmotek-guardcloud-api.myarbanga.workers.dev';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    // 🔐 On force ici l'API key côté backend (le front n’a jamais besoin de la connaître)
    const payload = {
      apiKey: 'YGC-ADMIN',
      deviceId: body.deviceId,
      action: body.action,
      message:
        body.message ??
        (body.action === 'RING'
          ? 'TEST ANTI-VOL YARMOTEK'
          : body.action === 'LOST_MODE'
          ? 'Téléphone perdu – contacter Yarmotek'
          : 'LOCK_SCREEN'),
      durationSec:
        typeof body.durationSec === 'number'
          ? body.durationSec
          : body.action === 'RING'
          ? 20
          : 0,
      level: body.level ?? (body.action === 'RING' ? 'HIGH' : 'NORMAL'),
    };

    // 👉 Appel réel vers le Worker Cloudflare
    const workerRes = await fetch(`${API_BASE}/admin/commands`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    const text = await workerRes.text();
    let json: any;
    try {
      json = JSON.parse(text);
    } catch {
      json = { raw: text };
    }

    if (!workerRes.ok || json?.ok === false) {
      return NextResponse.json(
        {
          ok: false,
          status: workerRes.status,
          error: json?.error ?? 'Erreur Worker Cloudflare',
          raw: json,
        },
        { status: workerRes.status || 500 },
      );
    }

    // ✅ Succès
    return NextResponse.json(
      {
        ok: true,
        command: json.command ?? json,
      },
      { status: 200 },
    );
  } catch (err: any) {
    console.error('Erreur proxy /api/guardcloud/command', err);
    return NextResponse.json(
      {
        ok: false,
        error: err?.message ?? 'Erreur interne proxy GuardCloud',
      },
      { status: 500 },
    );
  }
}
