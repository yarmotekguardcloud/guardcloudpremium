// app/api/guardcloud/command/route.ts
export const runtime = 'edge';

// 🔗 Base de l’API GuardCloud (Worker Cloudflare)
const API_BASE =
  process.env.NEXT_PUBLIC_GUARDCLOUD_API_BASE ??
  'https://yarmotek-guardcloud-api.myarbanga.workers.dev';

export async function POST(request: Request): Promise<Response> {
  try {
    const payload = await request.json();

    const upstream = await fetch(`${API_BASE}/admin/commands`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify(payload),
    });

    const text = await upstream.text();

    // On renvoie tel quel au front (JSON ou texte)
    return new Response(text, {
      status: upstream.status,
      headers: {
        'Content-Type': upstream.headers.get('Content-Type') ?? 'application/json',
      },
    });
  } catch (err: any) {
    console.error('GuardCloud proxy error', err);
    return new Response(
      JSON.stringify({
        ok: false,
        error: err?.message ?? 'Proxy error',
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      },
    );
  }
}
