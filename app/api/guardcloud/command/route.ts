// app/api/guardcloud/command/route.ts
export const runtime = 'edge';

const API_BASE =
  process.env.NEXT_PUBLIC_GUARDCLOUD_API_BASE ??
  'https://yarmotek-guardcloud-api.myarbanga.workers.dev';

// 🔑 Clé admin GuardCloud (peux la mettre aussi en variable d'env)
const ADMIN_API_KEY =
  process.env.GUARDCLOUD_ADMIN_KEY ?? 'YGC-ADMIN';

export async function POST(req: Request): Promise<Response> {
  try {
    const body = await req.json().catch(() => ({} as any));

    const payload = {
      apiKey: ADMIN_API_KEY,
      deviceId: String(body.deviceId ?? ''),
      action: String(body.action ?? ''),
      message: String(body.message ?? ''),
      durationSec: typeof body.durationSec === 'number'
        ? body.durationSec
        : 0,
      level: String(body.level ?? 'NORMAL'),
    };

    // Sécurité minimale : deviceId + action obligatoires
    if (!payload.deviceId || !payload.action) {
      return new Response(
        JSON.stringify({
          ok: false,
          error: 'deviceId et action sont obligatoires',
        }),
        {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        },
      );
    }

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
      // On renvoie l’erreur du Worker telle quelle
      return new Response(
        JSON.stringify({
          ok: false,
          status: res.status,
          error: text,
        }),
        {
          status: res.status,
          headers: { 'Content-Type': 'application/json' },
        },
      );
    }

    let json: any;
    try {
      json = JSON.parse(text);
    } catch {
      json = { raw: text };
    }

    return new Response(
      JSON.stringify({
        ok: true,
        ...json,
      }),
      {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          // utile si un jour tu appelles cette route depuis autre domaine
          'Access-Control-Allow-Origin': '*',
        },
      },
    );
  } catch (e: any) {
    console.error('Error /api/guardcloud/command', e);
    return new Response(
      JSON.stringify({
        ok: false,
        error: e?.message ?? 'Erreur interne API SahelGuard',
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      },
    );
  }
}
