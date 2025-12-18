# tools/fix-admin-proxy.ps1
# Next.js 15 cookies() async + centralize admin proxy (edge-safe) + 404 passthrough

$ErrorActionPreference = "Stop"

function Get-RepoRoot {
  $here = (Get-Location).Path
  while ($true) {
    if (Test-Path (Join-Path $here "package.json")) { return $here }
    $parent = (Get-Item $here).Parent
    if ($null -eq $parent) { throw "Repo root not found (package.json). Cd into the repo and retry." }
    $here = $parent.FullName
  }
}

$repo = Get-RepoRoot
Set-Location $repo
Write-Host "Repo root: $repo"

function Write-UTF8NoBOM([string]$RelPath, [string]$Content) {
  $full = Join-Path $repo $RelPath
  $dir = Split-Path -Parent $full
  if (!(Test-Path $dir)) { New-Item -ItemType Directory -Force -Path $dir | Out-Null }
  $utf8NoBom = New-Object System.Text.UTF8Encoding($false)
  [System.IO.File]::WriteAllText($full, $Content, $utf8NoBom)
  Write-Host "Wrote: $RelPath"
}

# ---------- Helper unique ----------
$gcAdminProxy = @'
import { cookies } from "next/headers";
import { cookieName, verifySessionCookie } from "../_session";

type ExtraHeaders = Record<string, string>;

function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers":
      "Content-Type, Authorization, x-admin-key, x-api-key, x-admin-token",
    "Access-Control-Allow-Methods":
      "GET, POST, PUT, PATCH, DELETE, OPTIONS, HEAD",
  };
}

/**
 * adminProxy(req, "/admin/xxx")
 * - Next 15: cookies() est async
 * - Injecte x-admin-key (GC_ADMIN_KEY)
 * - Proxy vers le Worker (GC_WORKER_BASE)
 * - Passthrough status (404 reste 404)
 */
export async function adminProxy(
  req: Request,
  path: string,
  extraHeaders: ExtraHeaders = {}
) {
  const store = await cookies(); // ✅ Next 15: async
  const ok = await verifySessionCookie(store.get(cookieName())?.value);

  if (!ok) {
    return new Response(JSON.stringify({ ok: false, error: "UNAUTHORIZED" }), {
      status: 401,
      headers: {
        "content-type": "application/json; charset=utf-8",
        ...corsHeaders(),
      },
    });
  }

  const base = (process.env.GC_WORKER_BASE || "").replace(/\/$/, "");
  if (!base) {
    return new Response(
      JSON.stringify({ ok: false, error: "GC_WORKER_BASE_MISSING" }),
      {
        status: 500,
        headers: {
          "content-type": "application/json; charset=utf-8",
          ...corsHeaders(),
        },
      }
    );
  }

  const adminKey = process.env.GC_ADMIN_KEY || "";
  if (!adminKey) {
    return new Response(
      JSON.stringify({ ok: false, error: "GC_ADMIN_KEY_MISSING" }),
      {
        status: 500,
        headers: {
          "content-type": "application/json; charset=utf-8",
          ...corsHeaders(),
        },
      }
    );
  }

  const url = new URL(req.url);
  const target = `${base}${path}${url.search ?? ""}`;

  const method = req.method.toUpperCase();

  // Ne pas forward les cookies du navigateur vers le Worker
  const headers = new Headers();

  const ct = req.headers.get("content-type");
  if (ct) headers.set("content-type", ct);

  const accept = req.headers.get("accept");
  if (accept) headers.set("accept", accept);

  const xApiKey = req.headers.get("x-api-key");
  if (xApiKey) headers.set("x-api-key", xApiKey);

  const xAdminToken = req.headers.get("x-admin-token");
  if (xAdminToken) headers.set("x-admin-token", xAdminToken);

  headers.set("x-admin-key", adminKey);

  for (const [k, v] of Object.entries(extraHeaders)) headers.set(k, v);

  const init: RequestInit = { method, headers };

  if (!["GET", "HEAD"].includes(method)) {
    const body = await req.arrayBuffer().catch(() => null);
    if (body) init.body = body;
  }

  const resp = await fetch(target, init);

  const outHeaders = new Headers(resp.headers);
  for (const [k, v] of Object.entries(corsHeaders())) outHeaders.set(k, v);

  if (!outHeaders.get("content-type")) {
    outHeaders.set("content-type", "application/json; charset=utf-8");
  }

  return new Response(resp.body, {
    status: resp.status,
    statusText: resp.statusText,
    headers: outHeaders,
  });
}

export function adminOptions() {
  return new Response(null, { status: 204, headers: corsHeaders() });
}
'@

Write-UTF8NoBOM "app/api/_lib/gcAdminProxy.ts" $gcAdminProxy

# ---------- Routes proxy (toutes méthodes) ----------
function RouteContent([string]$WorkerPath) {
@"
import { adminOptions, adminProxy } from "../../_lib/gcAdminProxy";
export const runtime = "edge";

export const GET = (req: Request) => adminProxy(req, "$WorkerPath");
export const POST = (req: Request) => adminProxy(req, "$WorkerPath");
export const PUT = (req: Request) => adminProxy(req, "$WorkerPath");
export const PATCH = (req: Request) => adminProxy(req, "$WorkerPath");
export const DELETE = (req: Request) => adminProxy(req, "$WorkerPath");
export const HEAD = (req: Request) => adminProxy(req, "$WorkerPath");
export const OPTIONS = adminOptions;
"@
}

Write-UTF8NoBOM "app/api/admin/devices/route.ts"   (RouteContent "/admin/devices")
Write-UTF8NoBOM "app/api/admin/clients/route.ts"   (RouteContent "/admin/clients")
Write-UTF8NoBOM "app/api/admin/tokens/route.ts"    (RouteContent "/admin/tokens")
Write-UTF8NoBOM "app/api/admin/resellers/route.ts" (RouteContent "/admin/resellers")

# ---------- Logout (cookies async Next 15) ----------
$logout = @'
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { cookieName } from "../../_session";

export const runtime = "edge";

export async function POST() {
  const store = await cookies(); // ✅ Next 15: async
  store.delete(cookieName());
  return NextResponse.json({ ok: true });
}

export async function GET() {
  return NextResponse.json({ ok: false, error: "Use POST" }, { status: 405 });
}

export async function OPTIONS() {
  return new Response(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Headers":
        "Content-Type, Authorization, x-admin-key, x-api-key, x-admin-token",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    },
  });
}
'@

Write-UTF8NoBOM "app/api/admin/logout/route.ts" $logout

Write-Host ""
Write-Host "✅ DONE. Now: git add/commit/push."
Write-Host "Cloudflare Pages env required: GC_WORKER_BASE, GC_ADMIN_KEY, GC_ADMIN_LOGIN, GC_ADMIN_PASSWORD, GC_SESSION_SECRET."
