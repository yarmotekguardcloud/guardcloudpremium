// app/api/guardcloud/command/route.ts
import { NextRequest, NextResponse } from 'next/server';

// ⚡ Obligatoire pour Cloudflare Pages + next-on-pages
export const runtime = 'edge';

// URL de ton Worker Cloudflare
const API_BASE =
  process.env.NEXT_PUBLIC_GUARDCLOUD_API_BASE ??
  'https://yarmotek-guardcloud-api.myarbanga.workers.dev';

export async function POST(req: NextRequest) {
  try {
    const body: any = await req.json();

    // 🔐 On force l'API key côté backend (le front ne voit jamais la clé)
    const action = String(body.action || 'RING').toUpperCase();

    const payload = {
      apiKey: 'YGC-ADMIN',
      deviceId: body.deviceId,
      action,
      message:
        body.message ??
        (action === 'RING'
          ? 'TEST ANTI-VOL YARMOTEK'
          : action === 'LOST_MODE'
          ? 'Téléphone perdu – contacter Yarmotek'
          : 'LOCK_SCREEN'),
      durationSec:
        typeof body.durationSec === 'number'
          ? body.durationSec
          : action === 'RING'
          ? 20
          : 0,
      level: body.level ?? (action === 'RING' ? 'HIGH' : 'NORMAL'),
    };

    const workerRes = await fetch(`${API_BASE}/admin/commands`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
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
