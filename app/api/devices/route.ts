import { NextResponse } from 'next/server';

const API_BASE =
  process.env.NEXT_PUBLIC_GUARDCLOUD_API_BASE ??
  'https://yarmotek-guardcloud-api.myarbanga.workers.dev';

export async function GET() {
  try {
    const res = await fetch(`${API_BASE}/devices`, {
      cache: 'no-store',
    });

    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch (e) {
    console.error('Error fetching devices', e);
    return NextResponse.json(
      { ok: false, error: 'FETCH_DEVICES_FAILED' },
      { status: 500 }
    );
  }
}
