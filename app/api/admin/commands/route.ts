// app/api/admin/commands/route.ts
import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'edge';

const API_BASE =
  process.env.GUARDCLOUD_API_BASE ??
  'https://yarmotek-guard-cloud.myarbanga.workers.dev';

const ADMIN_KEY = process.env.GUARDCLOUD_ADMIN_KEY ?? 'YGC-ADMIN';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    const apiUrl = `${API_BASE}/admin/commands`;

    const res = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'X-Admin-Key': ADMIN_KEY, // à adapter selon ton Worker
      },
      body: JSON.stringify(body),
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
    console.error('Erreur proxy /api/admin/commands:', err);
    return NextResponse.json(
      {
        ok: false,
        message: err?.message ?? 'Erreur proxy GuardCloud commands',
      },
      { status: 500 }
    );
  }
}
