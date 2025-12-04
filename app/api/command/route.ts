import { NextResponse } from 'next/server';

export const runtime = 'edge';

const API_BASE =
  process.env.NEXT_PUBLIC_GUARDCLOUD_API_BASE ??
  'https://yarmotek-guardcloud-api.myarbanga.workers.dev';

export async function POST(req: Request) {
  try {
    const body = await req.json();

    const res = await fetch(`${API_BASE}/command`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch (e) {
    console.error('Error sending command', e);
    return NextResponse.json(
      { ok: false, error: 'SEND_COMMAND_FAILED' },
      { status: 500 }
    );
  }
}
