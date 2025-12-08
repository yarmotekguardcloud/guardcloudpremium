export const runtime = 'edge';

import { NextRequest, NextResponse } from 'next/server';

const API_BASE =
  process.env.NEXT_PUBLIC_GUARDCLOUD_API_BASE ??
  'https://yarmotek-guardcloud-api.myarbanga.workers.dev';

// 🔑 Clé admin GuardCloud (celle qui marche déjà dans tes tests PowerShell)
const ADMIN_API_KEY =
  process.env.GUARDCLOUD_ADMIN_API_KEY ?? 'YGC-ADMIN';

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json().catch(() => ({}))) as Record<
      string,
      unknown
    >;

    // 👉 on force l’apiKey côté serveur (le front n’a plus besoin de l’envoyer)
    const payload = {
      ...body,
      apiKey: ADMIN_API_KEY,
    };

    const res = await fetch(`${API_BASE}/admin/commands`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify(payload),
    });

    const text = await res.text();

    if (!res.ok) {
      // on renvoie l’erreur brute du Worker pour debug dans le dashboard
      return new NextResponse(
        text ||
          JSON.stringify({
            ok: false,
            error: `GuardCloud API error ${res.status}`,
          }),
        {
          status: res.status,
          headers: { 'Content-Type': 'application/json' },
        },
      );
    }

    return new NextResponse(text, {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (e: any) {
    console.error('Proxy /api/guardcloud/command error:', e);
    return NextResponse.json(
      {
        ok: false,
        error: e?.message ?? 'GuardCloud proxy error',
      },
      { status: 500 },
    );
  }
}
