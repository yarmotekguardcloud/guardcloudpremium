// app/api/admin/devices/route.ts
import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'edge';

// 🔧 À adapter si besoin : base URL de ton Worker GuardCloud API
const API_BASE =
  process.env.GUARDCLOUD_API_BASE ??
  'https://yarmotek-guard-cloud.myarbanga.workers.dev';

// 🔧 Clé admin (tu peux la mettre en variable d’env : GUARDCLOUD_ADMIN_KEY)
const ADMIN_KEY = process.env.GUARDCLOUD_ADMIN_KEY ?? 'YGC-ADMIN';

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const type = url.searchParams.get('type') ?? 'phone';

    const apiUrl = `${API_BASE}/admin/devices?type=${encodeURIComponent(
      type
    )}`;

    const res = await fetch(apiUrl, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'X-Admin-Key': ADMIN_KEY, // adapte au header attendu par ton Worker
      },
    });

    const text = await res.text();

    return new NextResponse(text, {
      status: res.status,
      headers: {
        'content-type':
          res.headers.get('content-type') ?? 'application/json',
      },
    });
  } catch (err: any) {
    console.error('Erreur proxy /api/admin/devices:', err);
    return NextResponse.json(
      {
        ok: false,
        message: err?.message ?? 'Erreur proxy GuardCloud devices',
      },
      { status: 500 }
    );
  }
}
